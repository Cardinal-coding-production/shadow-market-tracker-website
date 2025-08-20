/**
 * API Utilities for ShadowMarketTracker Extension
 * Provides functions for API configuration, authentication, and key management
 */

// Import API configuration
self.importScripts('../config/apiConfig.js');

/**
 * Get configuration for a specific API provider
 * @param {string} provider - The API provider name (e.g., 'salesforce', 'hubspot')
 * @returns {Object|null} - The API configuration or null if not found
 */
self.getApiConfig = function(provider) {
  if (!provider || typeof provider !== 'string') {
    console.warn('[API Utils] getApiConfig called with invalid provider:', provider);
    return null;
  }
  
  if (!self.API_CONFIG) {
    console.error('[API Utils] API_CONFIG not found. Make sure apiConfig.js is loaded.');
    return null;
  }
  
  const config = self.API_CONFIG[provider.toLowerCase()];
  if (!config) {
    console.warn(`[API Utils] No configuration found for provider: ${provider}`);
    return null;
  }
  
  return config;
};

/**
 * Get API key or token for a specific provider
 * @param {string} provider - The API provider or key name
 * @returns {Promise<string|null>} - The API key/token or null if not found
 */
self.getApiKey = function(provider) {
  return new Promise((resolve, reject) => {
    if (!provider || typeof provider !== 'string') {
      console.warn('[API Utils] getApiKey called with invalid provider:', provider);
      resolve(null);
      return;
    }
    
    // Try to get from chrome.storage.local
    if (chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([provider], (result) => {
        if (chrome.runtime.lastError) {
          console.error('[API Utils] Error retrieving API key:', chrome.runtime.lastError);
          resolve(null);
          return;
        }
        
        const key = result[provider];
        if (!key) {
          console.warn(`[API Utils] No API key found for provider: ${provider}`);
          resolve(null);
          return;
        }
        
        resolve(key);
      });
    } else {
      console.error('[API Utils] chrome.storage.local not available');
      resolve(null);
    }
  });
};

/**
 * Set API key or token for a specific provider
 * @param {string} provider - The API provider or key name
 * @param {string} key - The API key or token to store
 * @returns {Promise<boolean>} - True if successful, false otherwise
 */
self.setApiKey = function(provider, key) {
  return new Promise((resolve, reject) => {
    if (!provider || typeof provider !== 'string') {
      console.warn('[API Utils] setApiKey called with invalid provider:', provider);
      resolve(false);
      return;
    }
    
    if (!key || typeof key !== 'string') {
      console.warn('[API Utils] setApiKey called with invalid key');
      resolve(false);
      return;
    }
    
    // Store in chrome.storage.local
    if (chrome && chrome.storage && chrome.storage.local) {
      const data = {};
      data[provider] = key;
      
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) {
          console.error('[API Utils] Error storing API key:', chrome.runtime.lastError);
          resolve(false);
          return;
        }
        
        console.log(`[API Utils] API key for ${provider} stored successfully`);
        resolve(true);
      });
    } else {
      console.error('[API Utils] chrome.storage.local not available');
      resolve(false);
    }
  });
};

/**
 * Apply authentication to fetch options based on API configuration
 * @param {string} provider - The API provider name
 * @param {Object} options - The fetch options to modify
 * @returns {Promise<Object>} - The modified fetch options with authentication
 */
self.applyApiAuth = async function(provider, options = {}) {
  if (!provider || typeof provider !== 'string') {
    console.warn('[API Utils] applyApiAuth called with invalid provider:', provider);
    return options;
  }
  
  const config = self.getApiConfig(provider);
  if (!config) {
    return options;
  }
  
  // Initialize headers if not present
  if (!options.headers) {
    options.headers = {};
  }
  
  // Initialize query parameters if not present
  if (!options.params) {
    options.params = {};
  }
  
  // Apply authentication based on type
  switch (config.authType) {
    case 'API_KEY': {
      const keyName = config.keyName || provider;
      const key = await self.getApiKey(keyName);
      
      if (!key) {
        console.warn(`[API Utils] No API key found for ${provider}`);
        return options;
      }
      
      if (config.keyLocation === 'header') {
        options.headers[config.keyHeaderName || 'X-Api-Key'] = key;
      } else if (config.keyLocation === 'query') {
        options.params[config.keyParamName || 'api_key'] = key;
      }
      break;
    }
    
    case 'OAUTH2': {
      const tokenKey = config.tokenKey || `${provider}_token`;
      const token = await self.getApiKey(tokenKey);
      
      if (!token) {
        console.warn(`[API Utils] No OAuth token found for ${provider}`);
        return options;
      }
      
      options.headers['Authorization'] = `${config.tokenType || 'Bearer'} ${token}`;
      break;
    }
    
    case 'BASIC_AUTH': {
      const username = await self.getApiKey(`${provider}_username`);
      const password = await self.getApiKey(`${provider}_password`);
      
      if (!username || !password) {
        console.warn(`[API Utils] Missing credentials for ${provider}`);
        return options;
      }
      
      const base64Credentials = btoa(`${username}:${password}`);
      options.headers['Authorization'] = `Basic ${base64Credentials}`;
      break;
    }
    
    default:
      console.warn(`[API Utils] Unknown auth type for ${provider}: ${config.authType}`);
  }
  
  return options;
};

/**
 * Check if a URL should use a proxy to avoid CORS issues
 * @param {string} url - The URL to check
 * @returns {boolean} - True if proxy should be used
 */
self.shouldUseProxy = function(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    
    // Common domains that typically require proxy due to CORS restrictions
    const corsRestrictedDomains = [
      'api.salesforce.com',
      'login.salesforce.com',
      'api.hubapi.com',
      'api.zoho.com',
      'www.zohoapis.com',
      'api.powerbi.com',
      'api.tableau.com',
      'api.monday.com',
      'api.pipedrive.com',
      'api.slack.com',
      'api.atlassian.com',
      'jira.atlassian.com'
    ];
    
    // Check if the host matches or is a subdomain of any restricted domain
    return corsRestrictedDomains.some(domain => {
      return host === domain || host.endsWith(`.${domain}`);
    });
  } catch (error) {
    console.error('[API Utils] Error parsing URL:', error);
    return false;
  }
};

/**
 * Build a URL with query parameters
 * @param {string} baseUrl - The base URL
 * @param {Object} params - The query parameters
 * @returns {string} - The complete URL with query parameters
 */
self.buildUrl = function(baseUrl, params = {}) {
  if (!baseUrl || typeof baseUrl !== 'string') {
    return baseUrl;
  }
  
  if (!params || typeof params !== 'object' || Object.keys(params).length === 0) {
    return baseUrl;
  }
  
  try {
    const url = new URL(baseUrl);
    
    // Add each parameter to the URL
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value);
      }
    });
    
    return url.toString();
  } catch (error) {
    console.error('[API Utils] Error building URL:', error);
    
    // Fallback method if URL constructor fails
    const separator = baseUrl.includes('?') ? '&' : '?';
    const queryString = Object.entries(params)
      .filter(([_, value]) => value !== undefined && value !== null)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    return queryString ? `${baseUrl}${separator}${queryString}` : baseUrl;
  }
};