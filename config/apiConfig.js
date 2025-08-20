// apiConfig.js
// Centralized API authentication configuration
// Compatible with service workers (non-module)

// API Authentication Types
const AUTH_TYPES = {
  NONE: 'NONE',           // No authentication required
  API_KEY: 'API_KEY',     // Simple API key
  OAUTH2: 'OAUTH2',       // OAuth 2.0 token
  BASIC: 'BASIC',         // Basic authentication
  CUSTOM: 'CUSTOM'        // Custom authentication logic
};

// API Configuration Registry
const API_CONFIG = {
  // Business Intelligence Platforms
  salesforce: { 
    baseUrl: 'https://api.salesforce.com/v1',
    authType: AUTH_TYPES.OAUTH2, 
    tokenKey: 'sf_token',
    headerName: 'Authorization',
    headerFormat: 'Bearer {token}',
    requiredScopes: ['data:read', 'data:write']
  },
  hubspot: { 
    baseUrl: 'https://api.hubapi.com/v1',
    authType: AUTH_TYPES.API_KEY, 
    keyName: 'hubspot_api_key',
    headerName: 'X-HubSpot-API-Key',
    headerFormat: '{key}'
  },
  zoho: { 
    baseUrl: 'https://www.zohoapis.com/crm/v2',
    authType: AUTH_TYPES.OAUTH2, 
    tokenKey: 'zoho_token',
    headerName: 'Authorization',
    headerFormat: 'Zoho-oauthtoken {token}'
  },
  powerbi: { 
    baseUrl: 'https://api.powerbi.com/v1.0',
    authType: AUTH_TYPES.OAUTH2, 
    tokenKey: 'powerbi_token',
    headerName: 'Authorization',
    headerFormat: 'Bearer {token}'
  },
  tableau: { 
    baseUrl: 'https://api.tableau.com/v1',
    authType: AUTH_TYPES.API_KEY, 
    keyName: 'tableau_api_key',
    headerName: 'X-Tableau-Auth',
    headerFormat: '{key}'
  },
  monday: { 
    baseUrl: 'https://api.monday.com/v2',
    authType: AUTH_TYPES.API_KEY, 
    keyName: 'monday_api_key',
    headerName: 'Authorization',
    headerFormat: '{key}'
  },
  pipedrive: { 
    baseUrl: 'https://api.pipedrive.com/v1',
    authType: AUTH_TYPES.API_KEY, 
    keyName: 'pipedrive_api_key',
    queryParam: 'api_token'
  },
  slack: { 
    baseUrl: 'https://slack.com/api',
    authType: AUTH_TYPES.OAUTH2, 
    tokenKey: 'slack_token',
    headerName: 'Authorization',
    headerFormat: 'Bearer {token}'
  },
  jira: { 
    baseUrl: 'https://api.atlassian.com/ex/jira',
    authType: AUTH_TYPES.OAUTH2, 
    tokenKey: 'jira_token',
    headerName: 'Authorization',
    headerFormat: 'Bearer {token}'
  },
  
  // Other APIs
  rapidapi: {
    authType: AUTH_TYPES.API_KEY,
    keyName: 'rapidapi_key',
    headerName: 'X-RapidAPI-Key',
    headerFormat: '{key}',
    hostHeaderName: 'X-RapidAPI-Host'
  },
  serpapi: {
    baseUrl: 'https://serpapi.com',
    authType: AUTH_TYPES.API_KEY,
    keyName: 'serpapi_key',
    queryParam: 'api_key'
  }
};

// Helper function to get API configuration
function getApiConfig(apiName) {
  return API_CONFIG[apiName.toLowerCase()] || null;
}

// Make functions available globally for service worker
if (typeof window === 'undefined' && typeof self !== 'undefined') {
  // Service Worker context
  self.API_CONFIG = API_CONFIG;
  self.AUTH_TYPES = AUTH_TYPES;
  self.getApiConfig = getApiConfig;
}