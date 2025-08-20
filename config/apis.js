// config/apis.js
// Centralized API configuration with dynamic selection and fallbacks
// Compatible with service workers (non-module)

// Note: Utility functions are available globally via fetchHandler.js

// API Priority Levels
const PRIORITY = {
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3
};

// API Categories
const CATEGORIES = {
  SEARCH: 'search',
  NEWS: 'news',
  WEATHER: 'weather',
  STOCKS: 'stocks',
  MOVIES: 'movies',
  SOCIAL: 'social',
  TECH: 'tech',
  GENERAL: 'general'
};

// API Configuration Registry
const API_REGISTRY = {
  // Search APIs
  serpapi_google: {
    name: 'Google Search (SerpAPI)',
    category: CATEGORIES.SEARCH,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'serpapi',
    quotaLimit: 100, // requests per day
    handler: async (query, options = {}) => {
      if (typeof self !== 'undefined' && self.apiRequest) {
        return self.apiRequest.serpApi({
          q: query,
          engine: 'google',
          location: options.location || 'United States',
          hl: options.language || 'en',
          num: options.limit || 10
        });
      } else {
        throw new Error('SerpAPI not available');
      }
    },
    fallbacks: ['wikipedia_search', 'duckduckgo_instant']
  },

  wikipedia_search: {
    name: 'Wikipedia Search',
    category: CATEGORIES.SEARCH,
    priority: PRIORITY.HIGH,
    requiresKey: false,
    quotaLimit: null,
    handler: async (query, options = {}) => {
      const language = options.language || 'en';
      const encodedQuery = encodeURIComponent(query);
      
      // Check if robustFetch is available
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      
      // Common fetch options
      const fetchOptions = {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Shadow Market Tracker Extension/1.0'
        },
        mode: 'cors', // Explicitly set CORS mode
        timeout: 10000, // 10 second timeout
        maxRetries: 2 // Retry twice on failure
      };
      
      // Try direct page lookup first
      try {
        const response = await fetchFn(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`, fetchOptions);
        
        if (fetchFn === fetch) {
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error response');
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
          }
          return { data: await response.json() };
        }
        return response;
      } catch (error) {
        console.warn(`Wikipedia direct lookup failed: ${error.message}. Trying search API.`);
        // Fallback to search - note the origin=* parameter which is crucial for CORS
        const response = await fetchFn(`https://${language}.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodedQuery}&srlimit=5&origin=*`, fetchOptions);
        
        if (fetchFn === fetch) {
          if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unable to read error response');
            throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
          }
          return { data: await response.json() };
        }
        return response;
      }
    },
    fallbacks: ['duckduckgo_instant']
  },

  duckduckgo_instant: {
    name: 'DuckDuckGo Instant Answer',
    category: CATEGORIES.SEARCH,
    priority: PRIORITY.MEDIUM,
    requiresKey: false,
    quotaLimit: null,
    handler: async (query) => {
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const response = await fetchFn(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`, {
        method: 'GET',
        headers: { 
          'Accept': 'application/json',
          'User-Agent': 'Shadow Market Tracker Extension/1.0'
        },
        mode: 'cors', // Explicitly set CORS mode
        timeout: 10000, // 10 second timeout
        maxRetries: 2 // Retry twice on failure
      });
      
      if (fetchFn === fetch) {
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          throw new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
        }
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: []
  },

  // News APIs
  newsapi_everything: {
    name: 'NewsAPI Everything',
    category: CATEGORIES.NEWS,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'newsapi',
    quotaLimit: 1000,
    handler: async (query, options = {}) => {
      const apiKey = await getStoredApiKey('newsapi');
      if (!apiKey) throw new Error('NewsAPI key required');
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${options.limit || 10}&sortBy=publishedAt`;
      
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey
        }
      });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: ['serpapi_news', 'reddit_search']
  },

  serpapi_news: {
    name: 'News Search (SerpAPI)',
    category: CATEGORIES.NEWS,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'serpapi',
    quotaLimit: 100,
    handler: async (query, options = {}) => {
      if (typeof self !== 'undefined' && self.apiRequest) {
        return self.apiRequest.serpApi({
          q: query,
          engine: 'news',
          location: options.location || 'United States',
          hl: options.language || 'en',
          num: options.limit || 10,
          tbm: 'nws'
        });
      } else {
        throw new Error('SerpAPI not available');
      }
    },
    fallbacks: ['reddit_search']
  },

  reddit_search: {
    name: 'Reddit Search',
    category: CATEGORIES.NEWS,
    priority: PRIORITY.MEDIUM,
    requiresKey: false,
    quotaLimit: null,
    handler: async (query, options = {}) => {
      const subreddit = options.subreddit || 'all';
      const sort = options.sort || 'hot';
      const limit = options.limit || 25;
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&sort=${sort}&limit=${limit}&t=week`;
      
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Shadow Market Tracker Extension/1.0'
        }
      });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: []
  },

  // Weather APIs
  openweather_current: {
    name: 'OpenWeatherMap Current',
    category: CATEGORIES.WEATHER,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'openweather',
    quotaLimit: 1000,
    handler: async (query, options = {}) => {
      const apiKey = await getStoredApiKey('openweather');
      if (!apiKey) throw new Error('OpenWeatherMap API key required');
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(query)}&appid=${apiKey}&units=metric`;
      
      const response = await fetchFn(url, { method: 'GET' });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: ['weatherapi_current']
  },

  weatherapi_current: {
    name: 'WeatherAPI Current',
    category: CATEGORIES.WEATHER,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'rapidapi',
    quotaLimit: 100,
    handler: async (query, options = {}) => {
      if (typeof self !== 'undefined' && self.apiRequest) {
        return self.apiRequest.rapidApi(
          'https://weatherapi-com.p.rapidapi.com/current.json',
          'weatherapi-com.p.rapidapi.com',
          { params: { q: query } }
        );
      } else {
        throw new Error('RapidAPI not available');
      }
    },
    fallbacks: []
  },

  // Stock APIs
  alphavantage_quote: {
    name: 'Alpha Vantage Quote',
    category: CATEGORIES.STOCKS,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'alphavantage',
    quotaLimit: 5, // requests per minute
    handler: async (symbol, options = {}) => {
      const apiKey = await getStoredApiKey('alphavantage');
      if (!apiKey) throw new Error('Alpha Vantage API key required');
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`;
      
      const response = await fetchFn(url, { method: 'GET' });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: ['yahoo_finance']
  },

  yahoo_finance: {
    name: 'Yahoo Finance',
    category: CATEGORIES.STOCKS,
    priority: PRIORITY.MEDIUM,
    requiresKey: false,
    quotaLimit: null,
    handler: async (symbol) => {
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol.toUpperCase()}`;
      
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Shadow Market Tracker Extension/1.0'
        }
      });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: []
  },

  // Movie APIs
  omdb_search: {
    name: 'OMDB API',
    category: CATEGORIES.MOVIES,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'omdb',
    quotaLimit: 1000,
    handler: async (query, options = {}) => {
      const apiKey = await getStoredApiKey('omdb');
      if (!apiKey) throw new Error('OMDB API key required');
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${apiKey}`;
      
      const response = await fetchFn(url, { method: 'GET' });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: ['tmdb_search']
  },

  tmdb_search: {
    name: 'The Movie Database',
    category: CATEGORIES.MOVIES,
    priority: PRIORITY.HIGH,
    requiresKey: true,
    keyType: 'tmdb',
    quotaLimit: null,
    handler: async (query, options = {}) => {
      const apiKey = await getStoredApiKey('tmdb');
      if (!apiKey) throw new Error('TMDB API key required');
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(query)}&api_key=${apiKey}`;
      
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: []
  },

  // GitHub API
  github_search: {
    name: 'GitHub Repository Search',
    category: CATEGORIES.TECH,
    priority: PRIORITY.HIGH,
    requiresKey: false,
    quotaLimit: 60, // per hour without auth
    handler: async (query, options = {}) => {
      const sort = options.sort || 'stars';
      const order = options.order || 'desc';
      const perPage = options.limit || 10;
      
      const fetchFn = (typeof self !== 'undefined' && self.robustFetch) ? self.robustFetch : fetch;
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=${sort}&order=${order}&per_page=${perPage}`;
      
      const response = await fetchFn(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Shadow Market Tracker Extension/1.0'
        }
      });
      
      if (fetchFn === fetch) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { data: await response.json() };
      }
      return response;
    },
    fallbacks: []
  }
};

// Intent to API mapping
const INTENT_MAPPINGS = {
  search: {
    primary: ['serpapi_google', 'wikipedia_search'],
    fallback: ['duckduckgo_instant'],
    keywords: ['search', 'find', 'lookup', 'what is', 'who is', 'where is']
  },
  news: {
    primary: ['newsapi_everything', 'serpapi_news'],
    fallback: ['reddit_search'],
    keywords: ['news', 'latest', 'breaking', 'headlines', 'updates']
  },
  weather: {
    primary: ['openweather_current', 'weatherapi_current'],
    fallback: [],
    keywords: ['weather', 'temperature', 'forecast', 'climate', 'rain', 'sunny']
  },
  stocks: {
    primary: ['alphavantage_quote', 'yahoo_finance'],
    fallback: [],
    keywords: ['stock', 'shares', 'price', 'quote', 'market', 'trading']
  },
  movies: {
    primary: ['omdb_search', 'tmdb_search'],
    fallback: [],
    keywords: ['movie', 'film', 'cinema', 'actor', 'director', 'imdb']
  },
  tech: {
    primary: ['github_search'],
    fallback: ['serpapi_google'],
    keywords: ['github', 'repository', 'code', 'programming', 'software']
  }
};

// Get API key from storage
async function getStoredApiKey(provider) {
  try {
    const result = await chrome.storage.local.get([`${provider}_key`]);
    return result[`${provider}_key`] || null;
  } catch (error) {
    console.error(`Failed to retrieve ${provider} API key:`, error);
    return null;
  }
}

// Intent detection
function detectIntent(query) {
  const lowerQuery = query.toLowerCase();
  
  // Score each intent based on keyword matches
  const intentScores = {};
  
  for (const [intent, config] of Object.entries(INTENT_MAPPINGS)) {
    let score = 0;
    
    for (const keyword of config.keywords) {
      if (lowerQuery.includes(keyword)) {
        score += keyword.length; // Longer keywords get higher scores
      }
    }
    
    if (score > 0) {
      intentScores[intent] = score;
    }
  }
  
  // Find the highest scoring intent
  const sortedIntents = Object.entries(intentScores)
    .sort(([,a], [,b]) => b - a);
  
  if (sortedIntents.length > 0) {
    return {
      intent: sortedIntents[0][0],
      confidence: sortedIntents[0][1] / query.length,
      alternatives: sortedIntents.slice(1).map(([intent, score]) => ({
        intent,
        confidence: score / query.length
      }))
    };
  }
  
  // Default to search if no specific intent detected
  return {
    intent: 'search',
    confidence: 0.1,
    alternatives: []
  };
}

// Get APIs for intent with fallbacks
function getApisForIntent(intent, includeUnavailable = false) {
  const mapping = INTENT_MAPPINGS[intent] || INTENT_MAPPINGS.search;
  const apis = [];
  
  // Add primary APIs
  for (const apiId of mapping.primary) {
    const api = API_REGISTRY[apiId];
    if (api && (includeUnavailable || isApiAvailable(api))) {
      apis.push({ ...api, id: apiId, type: 'primary' });
    }
  }
  
  // Add fallback APIs if needed
  if (apis.length === 0 || includeUnavailable) {
    for (const apiId of mapping.fallback) {
      const api = API_REGISTRY[apiId];
      if (api && (includeUnavailable || isApiAvailable(api))) {
        apis.push({ ...api, id: apiId, type: 'fallback' });
      }
    }
  }
  
  // Sort by priority
  return apis.sort((a, b) => a.priority - b.priority);
}

// Check if API is available (has key if required)
async function isApiAvailable(api) {
  if (!api.requiresKey) {
    return true;
  }
  
  const key = await getStoredApiKey(api.keyType);
  return !!key;
}

// Execute API call with automatic fallback
async function executeApiWithFallback(apiId, query, options = {}) {
  const api = API_REGISTRY[apiId];
  if (!api) {
    throw new Error(`Unknown API: ${apiId}`);
  }
  
  const callStack = [apiId, ...api.fallbacks];
  let lastError = null;
  
  for (const currentApiId of callStack) {
    const currentApi = API_REGISTRY[currentApiId];
    if (!currentApi) continue;
    
    try {
      // Check if API is available
      if (!(await isApiAvailable(currentApi))) {
        throw new Error(`API ${currentApiId} requires a key but none found`);
      }
      
      console.log(`Trying API: ${currentApi.name}`);
      const result = await currentApi.handler(query, options);
      
      return {
        success: true,
        data: result.data || result,
        api: currentApiId,
        apiName: currentApi.name,
        wasFallback: currentApiId !== apiId
      };
      
    } catch (error) {
      console.warn(`API ${currentApi.name} failed:`, error.message);
      lastError = error;
      
      // Don't retry if it's the last API in the chain
      if (currentApiId === callStack[callStack.length - 1]) {
        break;
      }
    }
  }
  
  throw new Error(`All APIs failed. Last error: ${lastError?.message || 'Unknown error'}`);
}

// Parallel API execution
async function executeMultipleApis(apiIds, query, options = {}) {
  const promises = apiIds.map(apiId => 
    executeApiWithFallback(apiId, query, options)
      .then(result => ({ ...result, apiId }))
      .catch(error => ({ 
        success: false, 
        error: error.message, 
        apiId,
        apiName: API_REGISTRY[apiId]?.name || apiId
      }))
  );
  
  const results = await Promise.allSettled(promises);
  
  return results.map(result => 
    result.status === 'fulfilled' ? result.value : result.reason
  );
}

// Smart API selection based on query
async function smartApiSelection(query, options = {}) {
  const intentResult = detectIntent(query);
  const availableApis = await getApisForIntent(intentResult.intent);
  
  console.log(`Detected intent: ${intentResult.intent} (confidence: ${intentResult.confidence.toFixed(2)})`);
  console.log(`Available APIs:`, availableApis.map(api => api.name));
  
  if (availableApis.length === 0) {
    throw new Error(`No available APIs for intent: ${intentResult.intent}`);
  }
  
  // Use multiple APIs if requested or if confidence is low
  if (options.useMultiple || intentResult.confidence < 0.5) {
    const apiIds = availableApis.slice(0, options.maxApis || 2).map(api => api.id);
    return executeMultipleApis(apiIds, query, options);
  } else {
    const primaryApi = availableApis[0];
    return [await executeApiWithFallback(primaryApi.id, query, options)];
  }
}

// Health check for all APIs
async function checkAllApisHealth() {
  const healthResults = {};
  
  for (const [apiId, api] of Object.entries(API_REGISTRY)) {
    try {
      const isAvailable = await isApiAvailable(api);
      healthResults[apiId] = {
        name: api.name,
        available: isAvailable,
        requiresKey: api.requiresKey,
        keyType: api.keyType || null,
        category: api.category,
        priority: api.priority
      };
    } catch (error) {
      healthResults[apiId] = {
        name: api.name,
        available: false,
        error: error.message,
        requiresKey: api.requiresKey,
        keyType: api.keyType || null,
        category: api.category,
        priority: api.priority
      };
    }
  }
  
  return healthResults;
}

// Make functions available globally for service worker
if (typeof window === 'undefined' && typeof self !== 'undefined') {
  // Service Worker context
  self.API_REGISTRY = API_REGISTRY;
  self.INTENT_MAPPINGS = INTENT_MAPPINGS;
  self.CATEGORIES = CATEGORIES;
  self.PRIORITY = PRIORITY;
  self.detectIntent = detectIntent;
  self.getApisForIntent = getApisForIntent;
  self.isApiAvailable = isApiAvailable;
  self.executeApiWithFallback = executeApiWithFallback;
  self.executeMultipleApis = executeMultipleApis;
  self.smartApiSelection = smartApiSelection;
  self.checkAllApisHealth = checkAllApisHealth;
}
