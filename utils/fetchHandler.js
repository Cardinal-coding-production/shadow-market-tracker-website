// utils/fetchHandler.js
// Robust fetch handler with retry logic, timeout, and error handling
// Compatible with service workers (non-module)

// Configuration
const DEFAULT_TIMEOUT = 15000;
const MAX_RETRIES = 3;
const RETRY_DELAY_BASE = 1000;
const RATE_LIMIT_DELAY = 500;

// Debug mode - set to true to enable detailed logging
let DEBUG_MODE = true;

// Track request timing for rate limiting
let lastRequestTime = 0;

// Debug logger
const debugLog = (level, message, data = null) => {
  if (!DEBUG_MODE && level !== 'error') return;
  
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] FetchHandler:`;
  
  if (data) {
    // Enhanced logging for objects to avoid [object Object] in logs
    if (typeof data === 'object' && data !== null) {
      try {
        console[level](prefix, message, JSON.stringify(data, null, 2));
      } catch (e) {
        console[level](prefix, message, data);
      }
    } else {
      console[level](prefix, message, data);
    }
  } else {
    console[level](prefix, message);
  }
};

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Rate limiting
const enforceRateLimit = async () => {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < RATE_LIMIT_DELAY) {
    const waitTime = RATE_LIMIT_DELAY - timeSinceLastRequest;
    debugLog('info', `Rate limiting: waiting ${waitTime}ms`);
    await sleep(waitTime);
  }
  
  lastRequestTime = Date.now();
};

// Calculate retry delay with exponential backoff
const getRetryDelay = (attempt) => {
  return RETRY_DELAY_BASE * Math.pow(2, attempt - 1) + Math.random() * 1000;
};

// Enhanced fetch with retry logic, authentication and CORS handling
async function robustFetch(url, options = {}) {
  const {
    method = 'GET',
    headers = {},
    body = null,
    timeout = DEFAULT_TIMEOUT,
    maxRetries = MAX_RETRIES,
    skipRateLimit = false,
    retryCondition = null,
    apiName = null,
    authConfig = null,
    useProxy = false,
    ...fetchOptions
  } = options;

  // Rate limiting (unless skipped)
  if (!skipRateLimit) {
    await enforceRateLimit();
  }

  const requestId = Math.random().toString(36).substring(2, 8);
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const queryParams = {};
  urlObj.searchParams.forEach((value, key) => {
    queryParams[key] = value;
  });
  
  // Prepare headers
  const finalHeaders = {
    'Content-Type': 'application/json',
    'User-Agent': 'Shadow Market Tracker Extension/1.0',
    ...headers
  };
  
  // Handle authentication if apiName or authConfig is provided
  let apiConfig = null;
  if (authConfig) {
    apiConfig = authConfig;
  } else if (apiName && typeof self !== 'undefined' && self.getApiConfig) {
    apiConfig = self.getApiConfig(apiName);
  } else if (apiName && typeof getApiConfig !== 'undefined') {
    apiConfig = getApiConfig(apiName);
  }
  
  // Apply authentication if config exists
  if (apiConfig) {
    try {
      if (apiConfig.authType === 'API_KEY' || apiConfig.authType === AUTH_TYPES?.API_KEY) {
        // Handle API key authentication
        const apiKey = await getApiKey(apiConfig.keyName);
        if (!apiKey) {
          debugLog('error', `Missing API key for ${apiName}`, { keyName: apiConfig.keyName });
          throw new Error(`Authentication failed: Missing API key for ${apiName}`);
        }
        
        if (apiConfig.headerName) {
          // Add API key to headers
          const headerValue = apiConfig.headerFormat 
            ? apiConfig.headerFormat.replace('{key}', apiKey)
            : apiKey;
          finalHeaders[apiConfig.headerName] = headerValue;
        }
        
        if (apiConfig.hostHeaderName && apiConfig.host) {
          // For APIs like RapidAPI that need a host header
          finalHeaders[apiConfig.hostHeaderName] = apiConfig.host;
        }
        
        if (apiConfig.queryParam) {
          // Add API key as query parameter
          urlObj.searchParams.set(apiConfig.queryParam, apiKey);
        }
      } else if (apiConfig.authType === 'OAUTH2' || apiConfig.authType === AUTH_TYPES?.OAUTH2) {
        // Handle OAuth token authentication
        const token = await getApiKey(apiConfig.tokenKey);
        if (!token) {
          debugLog('error', `Missing OAuth token for ${apiName}`, { tokenKey: apiConfig.tokenKey });
          throw new Error(`Authentication failed: Missing OAuth token for ${apiName}`);
        }
        
        const headerValue = apiConfig.headerFormat 
          ? apiConfig.headerFormat.replace('{token}', token)
          : `Bearer ${token}`;
        finalHeaders[apiConfig.headerName || 'Authorization'] = headerValue;
      }
    } catch (authError) {
      debugLog('error', `Authentication error for ${apiName}`, authError);
      throw authError;
    }
  }
  
  // Enhanced pre-fetch logging
  debugLog('debug', `Starting Request [id=${requestId}]`, {
    apiName: apiName || 'unknown',
    url: url,
    fullUrl: urlObj.toString(),
    method: method,
    headers: finalHeaders,
    queryParams: queryParams,
    bodySize: body ? (typeof body === 'string' ? body.length : JSON.stringify(body).length) : 0
  });
  
  if (method !== 'GET' && body) {
    debugLog('debug', `Request Body [id=${requestId}]`, {
      body: typeof body === 'string' ? body : JSON.stringify(body)
    });
  }

  // Determine if we should use proxy for this request
  let shouldUseProxy = useProxy;
  let targetUrl = urlObj.toString();
  
  // Main retry loop
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    let corsRetry = false;
    try {
      debugLog('info', `Attempt ${attempt}/${maxRetries} [${requestId}]${shouldUseProxy ? ' via proxy' : ''}`);

      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        debugLog('warn', `Request timeout after ${timeout}ms [${requestId}]`);
        controller.abort();
      }, timeout);

      // Prepare request options
      const requestOptions = {
        method,
        headers: finalHeaders,
        signal: controller.signal,
        mode: 'cors', // Explicitly set CORS mode
        credentials: 'omit', // Don't send cookies for cross-origin requests
        ...fetchOptions
      };

      // Add body for POST/PUT requests
      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        requestOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
      }

      // If using proxy, modify the request to go through background script
      if (shouldUseProxy) {
        // Store original request details to be handled by background script
        const proxyData = {
          originalUrl: targetUrl,
          method,
          headers: finalHeaders,
          body: requestOptions.body,
          timeout
        };
        
        // Use message passing to background script
        if (chrome && chrome.runtime && chrome.runtime.sendMessage) {
          debugLog('info', `Sending request via background proxy [${requestId}]`);
          const proxyResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
              action: 'proxyFetch',
              data: proxyData
            }, response => {
              if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
              } else if (response.error) {
                reject(new Error(response.error));
              } else {
                resolve(response);
              }
            });
            
            // Set a timeout for message response
            setTimeout(() => reject(new Error('Proxy request timed out')), timeout);
          });
          
          clearTimeout(timeoutId);
          return proxyResponse;
        } else {
          throw new Error('Background proxy not available');
        }
      }

      // Execute fetch
      const startTime = Date.now();
      const response = await fetch(targetUrl, requestOptions);
      clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      debugLog('info', `Response received in ${duration}ms [${requestId}]`, {
        status: response.status,
        statusText: response.statusText
      });

      // Check if response is ok
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        error.status = response.status;
        error.response = response;
        error.url = targetUrl;
        error.requestId = requestId;
        error.headers = {};
        
        // Extract response headers
        response.headers.forEach((value, key) => {
          error.headers[key] = value;
        });
        
        throw error;
      }

      // Parse response
      let data;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else if (contentType && contentType.includes('text/')) {
        data = await response.text();
      } else {
        data = await response.arrayBuffer();
      }

      debugLog('info', `Request successful [${requestId}]`, { dataType: typeof data });
      
      return {
        data,
        response,
        duration,
        attempt,
        success: true
      };

    } catch (error) {
      const isLastAttempt = attempt === maxRetries;
      const isCorsError = error.message.includes('CORS') || 
                         error.message.includes('Cross-Origin Request Blocked') ||
                         error.message.includes('Access-Control-Allow-Origin');
      
      // Enhanced error logging
      debugLog('error', `Fetch Failed [id=${requestId}] Attempt ${attempt}/${maxRetries}`, {
        error: error.message,
        name: error.name,
        status: error.status || 0,
        url: url,
        type: isCorsError ? 'cors' : 'other'
      });
      
      // Log detailed error information for better debugging
      if (error.response) {
        try {
          const errorBody = await error.response.text();
          debugLog('error', `Response details [id=${requestId}]`, {
            status: error.status,
            statusText: error.response.statusText,
            body: errorBody,
            headers: Object.fromEntries([...error.response.headers.entries()])
          });
        } catch (textError) {
          debugLog('error', `Could not read error response body [id=${requestId}]`, {
            textError: textError.message
          });
        }
      }
      
      // Handle CORS errors by retrying with proxy
      if (isCorsError && !shouldUseProxy && attempt === 1) {
        debugLog('warn', `CORS error detected, retrying via proxy [${requestId}]`);
        shouldUseProxy = true;
        corsRetry = true;
        continue; // Skip the normal retry logic and immediately retry with proxy
      }

      // Check if we should retry
      const shouldRetry = !isLastAttempt && shouldRetryError(error, retryCondition);
      
      if (shouldRetry) {
        const delay = getRetryDelay(attempt);
        debugLog('info', `Retrying [id=${requestId}]`, {
          attempt: attempt,
          nextAttempt: attempt + 1,
          maxRetries: maxRetries,
          delayMs: delay,
          url: url
        });
        await sleep(delay);
        continue;
      }

      // Final failure - enhanced logging
      debugLog('error', `All Fetch Attempts Failed [id=${requestId}]`, { 
        error: error.message,
        name: error.name,
        status: error.status || 0,
        url: url,
        method: method,
        attempts: attempt,
        maxRetries: maxRetries,
        totalDuration: Date.now() - startTime
      });
      throw error;
    }
  }
}

// Determine if an error should trigger a retry
function shouldRetryError(error, customCondition = null) {
  // Custom retry condition
  if (customCondition && typeof customCondition === 'function') {
    return customCondition(error);
  }

  // Default retry conditions
  const retryableErrors = [
    'Failed to fetch',
    'NetworkError',
    'TimeoutError',
    'AbortError'
  ];

  const retryableStatuses = [408, 429, 500, 502, 503, 504];

  // Check error message
  if (retryableErrors.some(errType => error.message.includes(errType) || error.name === errType)) {
    return true;
  }

  // Check HTTP status
  if (error.status && retryableStatuses.includes(error.status)) {
    return true;
  }

  return false;
}

// API-specific fetch functions
const apiRequest = {
  // RapidAPI request
  rapidApi: async (endpoint, host, options = {}) => {
    const apiKey = await getApiKey('rapidapi');
    if (!apiKey) {
      throw new Error('RapidAPI key not found');
    }

    const { params = {}, ...fetchOptions } = options;
    
    // Build URL with parameters
    const url = new URL(endpoint);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    return robustFetch(url.toString(), {
      ...fetchOptions,
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': host,
        ...fetchOptions.headers
      }
    });
  },

  // SerpAPI request
  serpApi: async (params = {}) => {
    const apiKey = await getApiKey('serpapi');
    if (!apiKey) {
      throw new Error('SerpAPI key not found');
    }

    const url = new URL('https://serpapi.com/search.json');
    Object.entries({ ...params, api_key: apiKey }).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    return robustFetch(url.toString());
  },

  // Generic external API
  external: (url, options = {}) => {
    return robustFetch(url, options);
  }
};

// Get API key from storage with improved error handling
async function getApiKey(provider) {
  if (!provider) {
    debugLog('error', 'getApiKey called without provider');
    return null;
  }
  
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      debugLog('error', 'Chrome storage API not available');
      return null;
    }
    const result = await chrome.storage.local.get([`${provider}_key`]);
    const key = result[`${provider}_key`];
    if (!key) {
      debugLog('warn', `API key not found in storage`, { provider });
    }
    return key;
  } catch (error) {
    debugLog('error', `Failed to get ${provider} key:`, error.message);
    return null;
  }
}

// Set API key in storage
async function setApiKey(provider, value) {
  if (!provider) {
    debugLog('error', 'setApiKey called without provider');
    return false;
  }
  
  try {
    if (typeof chrome === 'undefined' || !chrome.storage) {
      debugLog('error', 'Chrome storage API not available');
      return false;
    }
    const data = {};
    data[`${provider}_key`] = value;
    await chrome.storage.local.set(data);
    debugLog('info', `API key saved successfully`, { provider });
    return true;
  } catch (error) {
    debugLog('error', `Failed to save API key: ${error.message}`);
    return false;
  }
}

// Batch requests with concurrency control
async function batchRequests(requests, maxConcurrency = 3) {
  const results = [];
  const executing = [];

  for (const request of requests) {
    const promise = executeRequest(request).then(result => {
      executing.splice(executing.indexOf(promise), 1);
      return result;
    });

    results.push(promise);
    executing.push(promise);

    if (executing.length >= maxConcurrency) {
      await Promise.race(executing);
    }
  }

  return Promise.allSettled(results);
}

// Execute a single request from batch
async function executeRequest(request) {
  const { url, options = {}, type = 'external' } = request;
  
  try {
    switch (type) {
      case 'rapidapi':
        return await apiRequest.rapidApi(url, request.host, options);
      case 'serpapi':
        return await apiRequest.serpApi(options);
      default:
        return await apiRequest.external(url, options);
    }
  } catch (error) {
    return { error: error.message, url, type };
  }
}

// Health check utility
async function healthCheck() {
  const healthResults = {
    internet: false,
    rapidapi: false,
    serpapi: false,
    wikipedia: false,
    github: false
  };

  try {
    // Test basic internet connectivity
    await robustFetch('https://httpbin.org/get', { timeout: 5000, maxRetries: 1 });
    healthResults.internet = true;
    debugLog('info', 'Internet connectivity: OK');
  } catch (error) {
    debugLog('error', 'Internet connectivity: FAILED', error.message);
  }

  try {
    // Test Wikipedia (no auth required)
    await robustFetch('https://en.wikipedia.org/api/rest_v1/page/summary/test', { 
      timeout: 5000, 
      maxRetries: 1 
    });
    healthResults.wikipedia = true;
    debugLog('info', 'Wikipedia API: OK');
  } catch (error) {
    debugLog('error', 'Wikipedia API: FAILED', error.message);
  }

  try {
    // Test GitHub API (no auth required for basic search)
    await robustFetch('https://api.github.com/search/repositories?q=test&per_page=1', { 
      timeout: 5000, 
      maxRetries: 1 
    });
    healthResults.github = true;
    debugLog('info', 'GitHub API: OK');
  } catch (error) {
    debugLog('error', 'GitHub API: FAILED', error.message);
  }

  // Test APIs that require keys
  try {
    const rapidApiKey = await getApiKey('rapidapi');
    if (rapidApiKey) {
      await robustFetch('https://httpbin.org/get', {
        timeout: 5000,
        maxRetries: 1,
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'httpbin.org'
        }
      });
      healthResults.rapidapi = true;
      debugLog('info', 'RapidAPI: OK');
    }
  } catch (error) {
    debugLog('error', 'RapidAPI: FAILED', error.message);
  }

  try {
    const serpApiKey = await getApiKey('serpapi');
    if (serpApiKey) {
      await robustFetch(`https://serpapi.com/search.json?q=test&api_key=${serpApiKey}&num=1`, {
        timeout: 5000,
        maxRetries: 1
      });
      healthResults.serpapi = true;
      debugLog('info', 'SerpAPI: OK');
    }
  } catch (error) {
    debugLog('error', 'SerpAPI: FAILED', error.message);
  }

  return healthResults;
}

// Enable/disable debug mode
function setDebugMode(enabled) {
  DEBUG_MODE = enabled;
  debugLog('info', `Debug mode ${enabled ? 'enabled' : 'disabled'}`);
}

// Make functions available globally for service worker
if (typeof window === 'undefined' && typeof self !== 'undefined') {
  // Service Worker context
  self.robustFetch = robustFetch;
  self.apiRequest = apiRequest;
  self.batchRequests = batchRequests;
  self.healthCheck = healthCheck;
  self.setDebugMode = setDebugMode;
  self.debugLog = debugLog;
  self.sleep = sleep;
}
