// Enhanced background script for Shadow Market Tracker
// Orchestrates communication with backend and manages analysis requests
// Fixed for Manifest V3 service worker compatibility

// Structured logging helper
function log(tag, level, message, meta = {}) {
  const logData = {
    tag,
    level,
    timestamp: new Date().toISOString(),
    message,
    ...meta
  };

  // Safely handle meta object to prevent TypeErrors
  const safeLog = (consoleMethod, prefix, msg, data) => {
    try {
      if (data && Object.keys(data).length > 0) {
        consoleMethod(`${prefix} ${msg}`, data);
      } else {
        consoleMethod(`${prefix} ${msg}`);
      }
    } catch (error) {
      // Fallback to simple logging if meta causes issues
      consoleMethod(`${prefix} ${msg} [meta logging failed]`);
    }
  };

  const prefix = `[${tag}]`;

  if (level === 'error') {
    safeLog(console.error, prefix, message, meta);
  } else if (level === 'warn') {
    safeLog(console.warn, prefix, message, meta);
  } else if (level === 'debug') {
    safeLog(console.debug, prefix, message, meta);
  } else {
    safeLog(console.log, prefix, message, meta);
  }
}

// Robust fetch with retry, timeout, and exponential backoff
async function fetchWithRetry(url, options = {}, {retries = 3, timeout = 15000, backoff = 500} = {}) {
  const controller = new AbortController();
  const signal = controller.signal;
  const timer = setTimeout(() => controller.abort(), timeout);
  
  try {
    log('BG', 'debug', `Fetch attempt ${4 - retries}/3`, { url, timeout, retries });
    
    const res = await fetch(url, {...options, signal, mode: 'cors'});
    
    if (!res.ok) {
      const body = await res.text().catch(() => null);
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    
    log('BG', 'debug', 'Fetch successful', { url, status: res.status });
    return await res.json().catch(() => {
      throw new Error('Invalid JSON');
    });
    
  } catch (err) {
    log('BG', 'debug', 'Fetch attempt failed', { 
      url, 
      error: err.message, 
      status: err.status,
      retries: retries - 1 
    });
    
    if (retries > 0 && (err.name === 'AbortError' || err.message.includes('Failed to fetch') || err.status >= 500)) {
      const delay = backoff + Math.random() * backoff;
      log('BG', 'debug', `Retrying in ${Math.round(delay)}ms`, { url, retries: retries - 1 });
      await new Promise(r => setTimeout(r, delay));
      return fetchWithRetry(url, options, {retries: retries - 1, timeout, backoff: backoff * 2});
    }
    
    // Only log backend connection failures as debug, not error
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      log('BG', 'debug', 'Backend connection failed (expected if no local server)', {
        url,
        error: err.message,
        status: err.status,
        attempts: 4 - retries
      });
    } else {
      log('BG', 'error', 'Fetch failed permanently', {
        url,
        error: err.message,
        status: err.status,
        attempts: 4 - retries
      });
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// Robust message passing to content script with injection fallback
async function messageTab(tabId, message) {
  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.sendMessage(tabId, message, async (resp) => {
        if (chrome.runtime.lastError) {
          // content script not present — inject then retry
          try {
            await chrome.scripting.executeScript({
              target: { tabId }, 
              files: ['content.js']
            });
            
            // Wait a bit for the content script to initialize
            await new Promise(resolve => setTimeout(resolve, 100));
            
            chrome.tabs.sendMessage(tabId, message, (r2) => {
              if (chrome.runtime.lastError) {
                log('BG', 'error', 'Content script injection failed', { 
                  error: chrome.runtime.lastError.message,
                  tabId: tabId 
                });
                return reject(new Error(`Content script communication failed: ${chrome.runtime.lastError.message}`));
              }
              resolve(r2);
            });
          } catch (e) {
            log('BG', 'error', 'Content script injection error', { 
              error: e.message,
              tabId: tabId 
            });
            return reject(new Error(`Content script injection failed: ${e.message}`));
          }
        } else {
          resolve(resp);
        }
      });
    } catch (error) {
      log('BG', 'error', 'Message tab error', { 
        error: error.message,
        tabId: tabId 
      });
      reject(error);
    }
  });
}

class BackgroundServiceWorker {
  constructor() {
    this.backendUrl = 'http://localhost:8000/api/v1';
    this.extensionToken = null;
    this.analysisQueue = [];
    this.isProcessing = false;
    this.keepAliveTimer = null;
    this.debugMode = true;
    this.lastActivity = Date.now();
    
    // Bind methods to preserve context
    this.handleMessage = this.handleMessage.bind(this);
    this.handleAlarm = this.handleAlarm.bind(this);
    this.handleInstalled = this.handleInstalled.bind(this);
    this.handleStartup = this.handleStartup.bind(this);
    
    this.init();
  }

  // Usage tracking methods
  async initializeUsageTracking() {
    const result = await chrome.storage.local.get(['pagesAnalyzedCount', 'lastResetMonth']);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthKey = `${currentYear}-${currentMonth}`;
    
    // Reset counter if new month
    if (result.lastResetMonth !== monthKey) {
      await chrome.storage.local.set({
        pagesAnalyzedCount: 0,
        lastResetMonth: monthKey
      });
      this.debugLog('info', 'Monthly usage counter reset');
    }
    
    // Initialize if not exists
    if (result.pagesAnalyzedCount === undefined) {
      await chrome.storage.local.set({ pagesAnalyzedCount: 0 });
    }
  }

  async incrementUsageCount() {
    const result = await chrome.storage.local.get(['pagesAnalyzedCount']);
    const newCount = (result.pagesAnalyzedCount || 0) + 1;
    await chrome.storage.local.set({ pagesAnalyzedCount: newCount });
    this.debugLog('info', `Usage count: ${newCount}/5`);
    return newCount;
  }

  async checkUsageLimit() {
    const result = await chrome.storage.local.get(['pagesAnalyzedCount']);
    const count = result.pagesAnalyzedCount || 0;
    return count < 5;
  }

  async getUsageStatus() {
    const result = await chrome.storage.local.get(['pagesAnalyzedCount', 'lastResetMonth']);
    return {
      count: result.pagesAnalyzedCount || 0,
      remaining: Math.max(0, 5 - (result.pagesAnalyzedCount || 0)),
      resetMonth: result.lastResetMonth
    };
  }

  async init() {
    try {
      this.debugLog('info', 'Starting background service worker initialization');

      // Set up debug mode
      if (typeof self !== 'undefined' && self.setDebugMode) {
        self.setDebugMode(this.debugMode);
      }

      // Log that we're starting initialization
      console.log('🚀 Shadow Market Tracker Background Script Starting...');
      
      // Initialize usage tracking
      await this.initializeUsageTracking();
      
      // Log manifest permissions
      await this.logManifestPermissions();
      
      // Get or create extension token
      await this.initializeToken();
      
      // Set up message listeners
      this.setupMessageListeners();
      
      // Set up action click handler for activeTab permission
      this.setupActionClickHandler();
      
      // Set up alarms (with proper error checking)
      await this.setupAlarms();
      
      // Start keep-alive mechanism
      this.startKeepAlive();
      
      // Initialize context menus if available
      await this.setupContextMenus();
      
      // Perform initial health check
      this.performHealthCheck();
      
      // Test fetch capability and API connectivity with a delay to ensure all scripts are loaded
      setTimeout(() => {
        this.testFetchCapability();
      }, 2000);
      
      this.debugLog('info', 'Background service worker initialized successfully');
      console.log('✅ Shadow Market Tracker Background Script Ready!');

    } catch (error) {
      this.debugLog('error', 'Background service worker initialization failed', error);
      console.error('❌ Shadow Market Tracker Background Script Failed to Initialize:', error);
    }
  }
  
  setupActionClickHandler() {
    try {
      if (chrome.action && chrome.action.onClicked) {
        chrome.action.onClicked.addListener(async (tab) => {
          this.debugLog('info', 'Extension icon clicked', { tabId: tab.id });
          
          // This listener activates the activeTab permission
          // Now we can safely capture screenshots and access tab content
          
          try {
            // Capture screenshot now that we have activeTab permission
            const screenshot = await this.captureScreenshot(tab.id);
            
            // Analyze the current page
            const analysis = await this.analyzePage({
              url: tab.url,
              title: tab.title,
              screenshot: screenshot
            });
            
            // Send a message to the popup if it's open
            chrome.runtime.sendMessage({
              action: 'analysisComplete',
              data: analysis
            }).catch(() => {
              // Popup might not be open, which is fine
            });
            
            this.debugLog('info', 'Analysis completed via action click', {
              tabId: tab.id,
              url: tab.url
            });
          } catch (error) {
            this.debugLog('error', 'Failed to process action click', {
              error: error.message,
              name: error.name,
              stack: error.stack,
              tabId: tab.id
            });
          }
        });
        this.debugLog('info', 'Action click handler set up successfully');
      } else {
        this.debugLog('warn', 'chrome.action.onClicked not available');
      }
    } catch (error) {
      this.debugLog('error', 'Failed to set up action click handler', error);
    }
  }
  
  async checkScreenshotPermissions() {
    try {
      this.debugLog('info', 'Checking screenshot permissions');
      
      // Check if chrome.permissions API is available
      if (!chrome.permissions || !chrome.permissions.contains) {
        this.debugLog('warn', 'chrome.permissions API not available');
        return { canProceed: false, reason: 'permissions_api_unavailable' };
      }
      
      // Check for activeTab permission
      const hasActiveTab = await chrome.permissions.contains({
        permissions: ['activeTab']
      });
      
      // Check for tabs permission
      const hasTabs = await chrome.permissions.contains({
        permissions: ['tabs']
      });
      
      const canProceed = hasActiveTab || hasTabs;
      
      this.debugLog('info', 'Screenshot permissions status', {
        activeTab: hasActiveTab,
        tabs: hasTabs,
        canProceed: canProceed
      });
      
      if (!canProceed) {
        this.debugLog('warn', 'Screenshot capture may fail - neither activeTab nor tabs permissions are in effect');
      }
      
      return {
        canProceed: canProceed,
        hasActiveTab: hasActiveTab,
        hasTabs: hasTabs,
        reason: canProceed ? null : 'missing_permissions'
      };
    } catch (error) {
      this.debugLog('error', 'Failed to check screenshot permissions', {
        error: error.message,
        name: error.name,
        stack: error.stack
      });
      return {
        canProceed: false,
        hasActiveTab: false,
        hasTabs: false,
        reason: 'permission_check_error',
        error: error.message
      };
    }
  }

  debugLog(level, message, data = null) {
    if (this.debugMode) {
      log('BG', level, message, { data });
    }
  }

  async setupContextMenus() {
    try {
      // Check if chrome.contextMenus API is available
      if (!chrome.contextMenus || !chrome.contextMenus.create) {
        this.debugLog('warn', 'chrome.contextMenus API not available');
        return;
      }

      // Remove all existing context menus first
      await chrome.contextMenus.removeAll();
      
      // Create context menu
      chrome.contextMenus.create({
        id: 'analyze-selection',
        title: 'Analyze with Shadow Market Tracker',
        contexts: ['selection', 'page']
      });
      
      // Set up context menu click listener
      if (chrome.contextMenus.onClicked) {
        chrome.contextMenus.onClicked.addListener(async (info, tab) => {
          try {
            const query = info.selectionText || 'current page';
            await this.handleApiRequest({ query, options: {} });
          } catch (error) {
            this.debugLog('error', 'Context menu action failed', error);
          }
        });
      }
      
      this.debugLog('info', 'Context menus configured successfully');
      
    } catch (error) {
      this.debugLog('error', 'Failed to setup context menus', error);
    }
  }

  async setupAlarms() {
    try {
      // Check if chrome.alarms API is available
      if (!chrome.alarms || !chrome.alarms.create) {
        this.debugLog('warn', 'chrome.alarms API not available');
        return;
      }

      // Clear existing alarms first
      await chrome.alarms.clearAll();
      
      // Set up periodic cleanup alarm
      chrome.alarms.create('cleanup', { periodInMinutes: 60 });
      chrome.alarms.create('healthCheck', { periodInMinutes: 30 });
      chrome.alarms.create('keepAlive', { periodInMinutes: 1 });
      
      // Set up alarm listener
      if (chrome.alarms.onAlarm && !chrome.alarms.onAlarm.hasListener(this.handleAlarm)) {
        chrome.alarms.onAlarm.addListener(this.handleAlarm);
      }
      
      this.debugLog('info', 'Alarms configured successfully');
      
    } catch (error) {
      this.debugLog('error', 'Failed to setup alarms', error);
    }
  }

  startKeepAlive() {
    // Keep service worker alive during active operations
    this.keepAliveTimer = setInterval(() => {
      // Update last activity
      this.lastActivity = Date.now();
      
      // Simple keep-alive ping
      if (chrome.runtime && chrome.runtime.getPlatformInfo) {
        chrome.runtime.getPlatformInfo()
          .then(() => {
            this.debugLog('debug', 'Keep-alive ping successful');
          })
          .catch(() => {
            this.debugLog('warn', 'Keep-alive ping failed');
          });
      }
    }, 25000); // Every 25 seconds (before 30s timeout)
  }

  async initializeToken() {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        this.debugLog('error', 'Chrome storage API not available');
        return;
      }
      
      const result = await chrome.storage.local.get(['extension_token']);
      this.extensionToken = result.extension_token;
      
      if (!this.extensionToken) {
        // Create a new token for the extension
        this.extensionToken = this.generateExtensionToken();
        await chrome.storage.local.set({ extension_token: this.extensionToken });
      }
      
      this.debugLog('info', 'Extension token initialized');
      
    } catch (error) {
      this.debugLog('error', 'Token initialization failed', error);
    }
  }

  generateExtensionToken() {
    // Generate a simple token for extension authentication
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return `ext_${timestamp}_${random}`;
  }

  setupMessageListeners() {
    if (!chrome.runtime || !chrome.runtime.onMessage) {
      this.debugLog('error', 'Chrome runtime API not available');
      return;
    }
    
    // Remove existing listeners to prevent duplicates
    if (chrome.runtime.onMessage.hasListener(this.handleMessage)) {
      chrome.runtime.onMessage.removeListener(this.handleMessage);
    }
    
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      // Handle all messages through the main handler
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async responses
    });
    this.debugLog('info', 'Message listeners configured');
  }
  
  async handleMessage(request, sender, sendResponse) {
    // Wrap in async handler to ensure proper response
    (async () => {
      try {
        // Add null checks for request
        if (!request || !request.action) {
          this.debugLog('error', 'Invalid request received', { request });
          sendResponse({ error: 'Invalid request: missing action' });
          return;
        }

        this.debugLog('info', `Handling message: ${request.action}`, request);
        this.lastActivity = Date.now();

        let result;

        switch (request.action) {
        case 'scan':
          // Handle scan action from the React popup component
          try {
            // Check usage limit first
            const canAnalyze = await this.checkUsageLimit();
            if (!canAnalyze) {
              result = { 
                error: 'Usage limit reached', 
                limitReached: true,
                upgradeUrl: 'https://shadowmarkettracker.com/extension-pricing.html?source=usage_limit'
              };
              break;
            }
            
            this.debugLog('info', 'Processing scan request', { 
              url: request.url, 
              title: request.title, 
              tabId: request.tabId 
            });
            
            // Increment usage count
            const newCount = await this.incrementUsageCount();
            
            result = await this.analyzePage({
              url: request.url || sender?.tab?.url,
              title: request.title || sender?.tab?.title,
              tabId: request.tabId || sender?.tab?.id
            });
            
            // Add usage info to result
            result.usageInfo = {
              count: newCount,
              remaining: Math.max(0, 5 - newCount)
            };

            this.debugLog('info', 'Scan completed successfully', {
              hasAnalysis: !!result?.analysis,
              hasResult: !!result?.result,
              usageCount: newCount
            });
          } catch (error) {
            this.debugLog('error', 'Scan failed', { 
              error: error.message, 
              stack: error.stack 
            });
            result = { error: error.message };
          }
          break;
          
        case 'analyze_page':
          result = await this.analyzePage(request.features);
          break;
          
        case 'capture_screenshot':
          result = await this.captureScreenshot(sender.tab?.id);
          break;
          
        case 'get_analysis_status':
          result = await this.getAnalysisStatus(request.analysisId);
          break;
          
        case 'api_request':
          result = await this.handleApiRequest(request);
          break;
          
        case 'health_check':
          result = await this.performHealthCheck();
          break;
          
        case 'get_usage_status':
          result = await this.getUsageStatus();
          break;
          
        case 'reset_usage_count':
          // Debug function to reset usage count
          await chrome.storage.local.set({ pagesAnalyzedCount: 0 });
          result = { success: true, message: 'Usage count reset' };
          break;
          
        case 'get_debug_logs':
          result = await this.getDebugLogs();
          break;
          
        case 'extract_content':
          // Handle content extraction request
          if (sender.tab?.id) {
            try {
              const pageContent = await messageTab(sender.tab.id, { action: 'extract_content' });
              result = { success: true, content: pageContent };
            } catch (error) {
              this.debugLog('error', 'Content extraction failed', { error: error.message });
              result = { error: 'Content extraction failed: ' + error.message };
            }
          } else {
            result = { error: 'No tab ID provided for content extraction' };
          }
          break;
          
        case 'PREMIUM_ACTIVATED':
          // Handle premium activation from payment page
          try {
            this.debugLog('info', 'Premium activation received', request.data);
            
            // Store premium status in extension storage
            await chrome.storage.local.set({
              premium_status: {
                active: true,
                paymentId: request.data.paymentId,
                plan: request.data.plan,
                activatedAt: new Date().toISOString()
              }
            });
            
            result = { success: true, message: 'Premium status activated' };
          } catch (error) {
            this.debugLog('error', 'Failed to activate premium status', error);
            result = { error: 'Failed to activate premium status' };
          }
          break;
          
        default:
          this.debugLog('warn', `Unknown action: ${request.action}`);
          result = { error: 'Unknown action' };
      }
      
        // Ensure we always send a response
        if (result === undefined) {
          result = { error: 'No result generated' };
        }

        this.debugLog('info', `Sending response for ${request.action}:`, result);
        sendResponse(result);

      } catch (error) {
        this.debugLog('error', 'Message handling failed', error);
        sendResponse({ error: error.message });
      }
    })();
  }

  async handleApiRequest(request) {
    try {
      const { query, options = {} } = request;
      
      if (!query) {
        throw new Error('Query is required for API requests');
      }
      
      this.debugLog('info', `Processing API request for query: "${query}"`);
      
      // Use basic API call for now
      const result = await this.basicApiCall(query, options);
      return {
        success: true,
        data: [result],
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.debugLog('error', 'API request failed', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async basicApiCall(query, options = {}) {
    // Basic fallback API call using Wikipedia
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Shadow Market Tracker Extension/1.0'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Wikipedia API error: ${response.status}`);
      }
      
      const data = await response.json();
      return {
        api: 'wikipedia_fallback',
        data: data,
        success: true
      };
      
    } catch (error) {
      throw new Error(`Basic API call failed: ${error.message}`);
    }
  }

  async logManifestPermissions() {
    try {
      if (chrome && chrome.runtime && chrome.runtime.getManifest) {
        const manifest = chrome.runtime.getManifest();
        this.debugLog('info', 'Loaded manifest permissions', {
          manifest_version: manifest.manifest_version,
          permissions: manifest.permissions || [],
          host_permissions: manifest.host_permissions || [],
          optional_permissions: manifest.optional_permissions || []
        });
      } else {
        this.debugLog('warn', 'Unable to access manifest information');
      }
    } catch (error) {
      this.debugLog('error', 'Failed to log manifest permissions', error);
    }
  }

  async testFetchCapability() {
    try {
      this.debugLog('info', 'Testing fetch capability');

      // Test URL that should be accessible without CORS issues
      const testUrl = 'https://jsonplaceholder.typicode.com/todos/1';

      // Test with fetchWithRetry
      try {
        const startTime = Date.now();
        const response = await fetchWithRetry(testUrl, {}, { timeout: 10000 });
        const duration = Date.now() - startTime;

        this.debugLog('info', `Fetch test successful (${duration}ms)`, {
          status: 'OK',
          contentType: 'application/json',
          dataSize: JSON.stringify(response).length
        });
      } catch (error) {
        this.debugLog('error', 'Fetch test failed', {
          message: error.message,
          name: error.name,
          stack: error.stack
        });
      }
      
      this.debugLog('info', 'Fetch capability test completed');
      
    } catch (error) {
      this.debugLog('error', 'Failed to test fetch capability', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });
    }
  }
  
  // Helper to convert headers to object for logging
  getHeadersObject(headers) {
    const result = {};
    if (headers && typeof headers.forEach === 'function') {
      headers.forEach((value, key) => {
        result[key] = value;
      });
    }
    return result;
  }
  
  async performHealthCheck() {
    try {
      this.debugLog('info', 'Performing health check');
      
      const healthResults = {
        timestamp: new Date().toISOString(),
        extension: {
          token: !!this.extensionToken,
          processing: this.isProcessing,
          queueLength: this.analysisQueue.length,
          lastActivity: this.lastActivity
        },
        apis: {},
        chrome: {
          alarms: !!(chrome.alarms && chrome.alarms.create),
          storage: !!(chrome.storage && chrome.storage.local),
          tabs: !!(chrome.tabs && chrome.tabs.query),
          runtime: !!(chrome.runtime && chrome.runtime.onMessage),
          contextMenus: !!(chrome.contextMenus && chrome.contextMenus.create)
        }
      };
      
      // Test basic internet connectivity
      try {
        const testUrl = 'https://httpbin.org/get';
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });
        healthResults.internet = testResponse.ok;
      } catch (error) {
        healthResults.internet = false;
        healthResults.internetError = error.message;
      }
      
      this.debugLog('info', 'Health check completed', healthResults);
      return healthResults;
      
    } catch (error) {
      this.debugLog('error', 'Health check failed', error);
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async getDebugLogs() {
    // Return recent console logs (this is a placeholder)
    return {
      timestamp: new Date().toISOString(),
      logs: [
        'Extension initialized successfully',
        'All APIs ready for requests',
        'Debug logging enabled'
      ]
    };
  }

  generateLocalAnalysis(features) {
    try {
      // Extract key information from features
      const url = features.url || '';
      const title = features.title || '';
      const content = features.text_content || '';
      const domain = this.extractDomain(url);

      // Analyze content for specific insights
      const contentAnalysis = this.analyzePageContent(content, title, url);
      const industryAnalysis = this.detectIndustry(content, title, url);
      const opportunityScore = this.calculateOpportunityScore(contentAnalysis, industryAnalysis);

      // Generate unique analysis based on actual content
      const analysis = {
        url: url,
        title: title,
        domain: domain,
        industry: industryAnalysis.industry,
        summary: contentAnalysis.summary,
        score: opportunityScore.score,
        confidence: opportunityScore.confidence,
        priority: opportunityScore.priority,
        opportunities: this.generateSmartOpportunities(contentAnalysis, industryAnalysis),
        trends: this.generateSmartTrends(contentAnalysis, industryAnalysis),
        signals: contentAnalysis.signals,
        actions: this.generateActionItems(features),
        source: 'enhanced_local_analysis',
        timestamp: new Date().toISOString()
      };

      return JSON.stringify(analysis, null, 2);
    } catch (error) {
      this.debugLog('error', 'Local analysis generation failed', { error: error.message });
      return JSON.stringify({
        error: 'Analysis failed',
        fallback: true,
        score: 50,
        confidence: 0.3,
        priority: 'low'
      });
    }
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'unknown';
    }
  }

  analyzePageContent(content, title, url) {
    const words = content.toLowerCase().split(/\s+/);
    const wordCount = words.length;

    // Detect key themes and signals
    const businessKeywords = ['business', 'company', 'service', 'product', 'solution', 'platform', 'software', 'app'];
    const techKeywords = ['technology', 'ai', 'machine learning', 'automation', 'digital', 'cloud', 'api'];
    const marketKeywords = ['market', 'industry', 'customers', 'users', 'growth', 'revenue', 'sales'];

    const businessScore = this.countKeywords(words, businessKeywords);
    const techScore = this.countKeywords(words, techKeywords);
    const marketScore = this.countKeywords(words, marketKeywords);

    const signals = [];
    if (businessScore > 5) signals.push('business-focused');
    if (techScore > 3) signals.push('technology-driven');
    if (marketScore > 3) signals.push('market-oriented');

    return {
      wordCount,
      businessScore,
      techScore,
      marketScore,
      signals,
      summary: this.generateContentSummary(title, businessScore, techScore, marketScore)
    };
  }

  countKeywords(words, keywords) {
    return words.filter(word => keywords.includes(word)).length;
  }

  generateContentSummary(title, businessScore, techScore, marketScore) {
    const domain = title.toLowerCase();

    if (domain.includes('shopify') || domain.includes('ecommerce')) {
      return 'E-commerce platform with significant market opportunities in online retail automation';
    } else if (domain.includes('github') || domain.includes('code')) {
      return 'Developer platform with opportunities in software development tools and automation';
    } else if (techScore > businessScore && techScore > marketScore) {
      return 'Technology-focused platform with innovation opportunities in digital transformation';
    } else if (businessScore > techScore && businessScore > marketScore) {
      return 'Business-oriented platform with opportunities in process optimization and efficiency';
    } else if (marketScore > techScore && marketScore > businessScore) {
      return 'Market-focused platform with opportunities in customer acquisition and growth';
    } else {
      return 'Multi-faceted platform with diverse business opportunities across technology and market segments';
    }
  }

  detectIndustry(content, title, url) {
    const domain = url.toLowerCase();
    const text = (title + ' ' + content).toLowerCase();

    const industries = {
      'ecommerce': ['shop', 'store', 'buy', 'sell', 'product', 'cart', 'checkout', 'payment'],
      'technology': ['software', 'app', 'platform', 'api', 'code', 'developer', 'tech'],
      'finance': ['bank', 'payment', 'money', 'finance', 'investment', 'trading'],
      'healthcare': ['health', 'medical', 'doctor', 'patient', 'treatment', 'medicine'],
      'education': ['learn', 'course', 'student', 'education', 'training', 'school'],
      'marketing': ['marketing', 'advertising', 'campaign', 'brand', 'social media'],
      'saas': ['subscription', 'cloud', 'service', 'dashboard', 'analytics', 'automation']
    };

    let bestMatch = 'general';
    let bestScore = 0;

    for (const [industry, keywords] of Object.entries(industries)) {
      const score = this.countKeywords(text.split(/\s+/), keywords);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = industry;
      }
    }

    return {
      industry: bestMatch,
      confidence: Math.min(bestScore / 10, 1),
      signals: bestScore
    };
  }

  calculateOpportunityScore(contentAnalysis, industryAnalysis) {
    const baseScore = 40;
    let score = baseScore;

    // Boost score based on content richness
    if (contentAnalysis.wordCount > 1000) score += 15;
    else if (contentAnalysis.wordCount > 500) score += 10;
    else if (contentAnalysis.wordCount > 100) score += 5;

    // Boost score based on business indicators
    score += Math.min(contentAnalysis.businessScore * 2, 20);
    score += Math.min(contentAnalysis.techScore * 1.5, 15);
    score += Math.min(contentAnalysis.marketScore * 1.5, 15);

    // Industry-specific adjustments
    if (industryAnalysis.industry === 'technology' || industryAnalysis.industry === 'saas') {
      score += 10;
    }

    score = Math.min(Math.max(score, 20), 95); // Clamp between 20-95

    const confidence = Math.min(0.3 + (contentAnalysis.signals.length * 0.15) + (industryAnalysis.confidence * 0.4), 0.9);

    let priority = 'low';
    if (score > 75) priority = 'high';
    else if (score > 55) priority = 'medium';

    return { score: Math.round(score), confidence, priority };
  }

  generateSmartOpportunities(contentAnalysis, industryAnalysis) {
    const opportunities = [];
    const industry = industryAnalysis.industry;

    // Industry-specific opportunities
    const opportunityTemplates = {
      'ecommerce': [
        {
          title: 'E-commerce Automation Platform',
          description: 'Automated inventory management and customer service for online retailers',
          confidence: 0.8,
          value_prop: 'Reduce operational costs by 30-40%',
          tam_estimate: '$2.5B+ e-commerce automation market'
        }
      ],
      'technology': [
        {
          title: 'Developer Productivity Suite',
          description: 'Integrated tools for code analysis, testing, and deployment automation',
          confidence: 0.85,
          value_prop: 'Accelerate development cycles by 40%',
          tam_estimate: '$4.2B+ developer tools market'
        }
      ],
      'saas': [
        {
          title: 'SaaS Analytics Dashboard',
          description: 'Unified analytics and reporting platform for SaaS businesses',
          confidence: 0.8,
          value_prop: 'Improve decision-making with real-time insights',
          tam_estimate: '$3.1B+ business analytics market'
        }
      ],
      'general': [
        {
          title: 'Business Process Automation',
          description: 'Workflow automation and optimization for improved efficiency',
          confidence: 0.6,
          value_prop: 'Reduce manual work by 50%',
          tam_estimate: '$500M+ process automation market'
        }
      ]
    };

    const templates = opportunityTemplates[industry] || opportunityTemplates['general'];

    // Add content-specific opportunities
    if (contentAnalysis.signals.includes('technology-driven')) {
      opportunities.push({
        title: 'AI Integration Opportunity',
        description: 'Leverage AI and machine learning for enhanced automation',
        confidence: 0.75,
        value_prop: 'Next-generation intelligent automation',
        tam_estimate: '$15B+ AI automation market'
      });
    }

    return [...templates.slice(0, 1), ...opportunities].slice(0, 2);
  }

  generateSmartTrends(contentAnalysis, industryAnalysis) {
    const trends = [];
    const industry = industryAnalysis.industry;

    // Industry-specific trends
    const trendTemplates = {
      'ecommerce': [
        { type: 'growth', title: 'Mobile Commerce Surge', description: '+67% mobile shopping adoption' }
      ],
      'technology': [
        { type: 'innovation', title: 'Low-Code Development', description: '+85% adoption in enterprise' }
      ],
      'saas': [
        { type: 'growth', title: 'SaaS Consolidation', description: '+35% platform integration demand' }
      ],
      'general': [
        { type: 'automation', title: 'Process Automation', description: '+55% workflow automation adoption' }
      ]
    };

    const templates = trendTemplates[industry] || trendTemplates['general'];

    return templates.slice(0, 2).map(trend => ({
      ...trend,
      timestamp: new Date().toISOString()
    }));
  }

  extractOpportunitiesFromFeatures(features) {
    const opportunities = [];
    
    if (features.business_data && features.business_data.industry) {
      opportunities.push(`Explore ${features.business_data.industry} market opportunities`);
    }
    
    if (features.text_content && features.text_content.length > 100) {
      opportunities.push('Content-rich page with potential for market analysis');
    }
    
    if (features.links && features.links.length > 5) {
      opportunities.push('Multiple business connections identified');
    }
    
    return opportunities.length > 0 ? opportunities : ['General business opportunity analysis available'];
  }

  extractRisksFromFeatures(features) {
    const risks = [];
    
    if (!features.business_data || !features.business_data.company_name) {
      risks.push('Limited company information available');
    }
    
    if (!features.text_content || features.text_content.length < 50) {
      risks.push('Minimal content for comprehensive analysis');
    }
    
    return risks.length > 0 ? risks : ['Standard market analysis risks apply'];
  }

  extractTrendsFromFeatures(features) {
    const trends = [];
    
    if (features.headings && features.headings.length > 0) {
      trends.push('Page structure indicates organized business content');
    }
    
    if (features.images && features.images.length > 0) {
      trends.push('Visual content suggests modern business approach');
    }
    
    return trends.length > 0 ? trends : ['Standard business trends analysis available'];
  }

  generateActionItems(features) {
    const actions = [];
    
    actions.push('Review extracted business data for accuracy');
    actions.push('Consider deeper market research for identified opportunities');
    actions.push('Monitor industry trends based on page content');
    
    if (features.business_data && features.business_data.contact_info) {
      actions.push('Follow up on identified business contacts');
    }
    
    return actions;
  }

    async analyzePage(features) {
    try {
      // Add to queue if already processing
      if (this.isProcessing) {
        return new Promise((resolve) => {
          this.analysisQueue.push({ features, resolve });
        });
      }

      this.isProcessing = true;

      // Extract page content using content script
      if (features.tabId && !features.pageContent) {
        try {
          this.debugLog('info', 'Extracting page content via content script', { tabId: features.tabId });
          const pageContent = await messageTab(features.tabId, { action: 'extract_content' });
          
          if (pageContent && !pageContent.error) {
            features.pageContent = pageContent;
            this.debugLog('info', 'Page content extracted successfully', { 
              contentSize: JSON.stringify(pageContent).length 
            });
          } else {
            this.debugLog('warn', 'Content script returned error', { error: pageContent?.error });
          }
        } catch (error) {
          this.debugLog('warn', 'Failed to extract page content, proceeding without it', { error: error.message });
        }
      }

      // Capture screenshot if not provided
      if (!features.screenshot) {
        features.screenshot = await this.captureScreenshot(); 
      }

      // Send to backend if available
      let response;
      try {
        response = await this.sendToBackend('/analyze/page', {
          ...features,
          user_mode: 'growth'
        });
      } catch (error) {
        this.debugLog('warn', 'Backend unavailable, using local analysis', { error: error.message });
        
        // Enhanced fallback to local analysis with structured insights
        response = {
          analysis: this.generateLocalAnalysis(features),
          result: this.generateLocalAnalysis(features),
          features: features,
          timestamp: new Date().toISOString(),
          source: 'local_analysis'
        };
      }

      this.isProcessing = false;
      
      // Process next item in queue
      if (this.analysisQueue.length > 0) {
        const next = this.analysisQueue.shift();
        this.analyzePage(next.features).then(next.resolve);
      }

      return response;

    } catch (error) {
      this.isProcessing = false;
      throw error;
    }
  }

  async captureScreenshot(tabId = null) {
    try {
      // Check if the required APIs are available
      if (!chrome.tabs || !chrome.tabs.captureVisibleTab) {
        this.debugLog('warn', 'Screenshot capture not available - chrome.tabs API missing');
        return null;
      }
      
      // Check permissions status
      const permissionsStatus = await this.checkScreenshotPermissions();
      if (!permissionsStatus.canProceed) {
        // Request activeTab permission if not already granted
        if (chrome.permissions && chrome.permissions.request) {
          this.debugLog('info', 'Requesting activeTab permission');
          const granted = await chrome.permissions.request({
            permissions: ['activeTab']
          });
          
          if (!granted) {
            this.debugLog('error', 'Permission request denied by user');
            throw new Error('Screenshot permission denied by user');
          }
          this.debugLog('info', 'activeTab permission granted');
        } else {
          this.debugLog('error', 'Cannot request permissions - API not available');
          throw new Error('Screenshot permissions not available');
        }
      }
      
      if (!tabId) {
        // Get current active tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        tabId = tabs[0]?.id;
        this.debugLog('info', 'Found active tab', { tabId: tabId, tabCount: tabs.length });
      }

      if (!tabId) {
        const error = new Error('No active tab found');
        this.debugLog('error', 'Screenshot capture failed - no active tab', { 
          error: error.message,
          name: error.name,
          stack: error.stack 
        });
        throw error;
      }

      // First ensure we have proper permissions by using the tabs permission
      // instead of relying solely on activeTab which requires user interaction
      try {
        this.debugLog('info', 'Attempting direct screenshot capture', { tabId });
        // Capture visible tab using the tabs permission
        const dataUrl = await chrome.tabs.captureVisibleTab(null, {
          format: 'jpeg',
          quality: 80
        });

        // Convert to base64
        const base64 = dataUrl.split(',')[1];
        this.debugLog('info', 'Screenshot capture successful', { size: base64.length });
        return base64;
      } catch (captureError) {
        // If capture fails due to permissions, try to inject a content script first
        // to ensure the activeTab permission is properly activated
        this.debugLog('warn', 'Direct capture failed, trying with content script injection', {
          error: captureError.message,
          name: captureError.name,
          stack: captureError.stack
        });
        
        if (chrome.scripting && chrome.scripting.executeScript) {
          // This will activate the activeTab permission
          this.debugLog('info', 'Attempting to activate activeTab permission via content script injection', { tabId });
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              function: () => { return true; } // Simple function to activate permission
            });
            
            this.debugLog('info', 'Content script injection successful, attempting capture again');
            // Try capture again after permission activation
            const dataUrl = await chrome.tabs.captureVisibleTab(null, {
              format: 'jpeg',
              quality: 80
            });
            
            const base64 = dataUrl.split(',')[1];
            this.debugLog('info', 'Screenshot capture successful after content script injection', { size: base64.length });
            return base64;
          } catch (injectionError) {
            this.debugLog('error', 'Content script injection failed', {
              error: injectionError.message,
              name: injectionError.name,
              stack: injectionError.stack,
              tabId: tabId
            });
            throw injectionError;
          }
        } else {
          this.debugLog('error', 'Chrome scripting API not available, cannot activate activeTab permission');
          throw captureError; // Re-throw if scripting API not available
        }
      }
    } catch (error) {
        this.debugLog('error', 'Screenshot capture failed', {
          error: error.message,
          name: error.name,
          stack: error.stack,
          tabId: tabId
        });
        return null;
      }
  }

  async sendToBackend(endpoint, data) {
    const requestId = Math.random().toString(36).substring(2, 8);
    try {
      const url = `${this.backendUrl}${endpoint}`;
      
      this.debugLog('info', `Sending request to backend [id=${requestId}]`, {
        url: url,
        method: 'POST',
        endpoint: endpoint,
        bodySize: JSON.stringify(data).length
      });
      
      // Use regular fetch for simplicity
      const requestOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.extensionToken}`,
          'X-Extension-Version': '1.0.0',
          'X-Request-ID': requestId
        },
        body: JSON.stringify(data),
        mode: 'cors' // Explicitly set CORS mode
      };
      
      this.debugLog('info', `Sending request to backend using native fetch [id=${requestId}]`, {
        url: url,
        method: requestOptions.method,
        endpoint: endpoint,
        bodySize: requestOptions.body ? requestOptions.body.length : 0
      });
      
      try {
        const startTime = Date.now();
        const response = await fetchWithRetry(url, requestOptions, { timeout: 15000 });

        const duration = Date.now() - startTime;

        this.debugLog('info', `Backend request successful [id=${requestId}]`, {
          status: response.status || 'OK',
          duration: duration
        });
        return response;
      } catch (fetchError) {
        // Log backend connection failures as debug, not error (expected when no backend server)
        if (url.includes('localhost') || url.includes('127.0.0.1')) {
          this.debugLog('debug', `Backend connection failed (expected): ${fetchError.message} [id=${requestId}]`, {
            url,
            status: fetchError.status
          });
        } else {
          this.debugLog('error', `Backend request failed: ${fetchError.name}: ${fetchError.message} [id=${requestId}]`, {
            url,
            status: fetchError.status,
            responseText: fetchError.responseText
          });
        }
        throw fetchError;
      }

    } catch (error) {
      // This catch block handles any errors not caught in the inner try/catch blocks
      if (this.backendUrl.includes('localhost') || this.backendUrl.includes('127.0.0.1')) {
        this.debugLog('debug', `Backend connection failed (expected): ${error.message} [id=${requestId}]`, {
          endpoint: endpoint
        });
      } else {
        this.debugLog('error', `Backend request failed: ${error.name}: ${error.message} [id=${requestId}]`, {
          endpoint: endpoint
        });
      }
      throw error;
    }
  }

  async getAnalysisStatus(analysisId) {
    try {
      const url = `${this.backendUrl}/analyze/page/${analysisId}`;
      const response = await fetchWithRetry(url, {
        headers: {
          'Authorization': `Bearer ${this.extensionToken}`
        }
      }, { timeout: 10000 });

      return response;

    } catch (error) {
      this.debugLog('error', 'Status check failed', error);
      throw error;
    }
  }

  async handleAlarm(alarm) {
    try {
      this.debugLog('info', `Handling alarm: ${alarm.name}`);
      
      switch (alarm.name) {
        case 'cleanup':
          await this.performCleanup();
          break;
        case 'healthCheck':
          await this.performHealthCheck();
          break;
        case 'keepAlive':
          this.lastActivity = Date.now();
          this.debugLog('debug', 'Keep-alive alarm triggered');
          break;
        default:
          this.debugLog('warn', `Unknown alarm: ${alarm.name}`);
      }
    } catch (error) {
      this.debugLog('error', `Alarm handler failed for ${alarm.name}`, error);
    }
  }

  async performCleanup() {
    try {
      if (!chrome.storage || !chrome.storage.local) {
        return;
      }
      
      // Clear old analysis results from storage
      const result = await chrome.storage.local.get(['analysis_results']);
      const results = result.analysis_results || {};
      
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      
      const cleanedResults = {};
      for (const [key, value] of Object.entries(results)) {
        if (value.timestamp && value.timestamp > oneDayAgo) {
          cleanedResults[key] = value;
        }
      }
      
      await chrome.storage.local.set({ analysis_results: cleanedResults });
      this.debugLog('info', 'Cleanup completed');
      
    } catch (error) {
      this.debugLog('error', 'Cleanup failed', error);
    }
  }

  handleInstalled(details) {
    if (details.reason === 'install') {
      this.debugLog('info', 'Shadow Market Tracker extension installed');
      this.initializeToken();
    } else if (details.reason === 'update') {
      this.debugLog('info', 'Shadow Market Tracker extension updated');
    }
  }

  handleStartup() {
    this.debugLog('info', 'Shadow Market Tracker extension started');
    this.init();
  }
}

// Initialize the background service worker
const backgroundWorker = new BackgroundServiceWorker();

// Handle extension installation and startup
if (chrome.runtime && chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener(backgroundWorker.handleInstalled.bind(backgroundWorker));
}

if (chrome.runtime && chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(backgroundWorker.handleStartup.bind(backgroundWorker));
}

// Export for testing/debugging
if (typeof self !== 'undefined') {
  self.backgroundWorker = backgroundWorker;
}