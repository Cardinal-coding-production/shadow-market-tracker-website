/**
 * ML Service Module for Shadow Market Tracker
 * Provides machine learning and data analysis capabilities
 */

class MLService {
  constructor() {
    this.models = {};
    this.initialized = false;
    this.modelStatus = {
      sentiment: false,
      entityRecognition: false,
      classification: false,
      forecasting: false
    };
    
    // Configuration
    this.config = {
      useRemoteModels: true,  // If false, will use TensorFlow.js local models
      modelEndpoint: 'http://localhost:8000/api/v1/ml',
      modelsToLoad: ['sentiment', 'entityRecognition'],
      maxTextLength: 10000,
      cacheResults: true,
      cacheTTL: 24 * 60 * 60 * 1000 // 24 hours
    };
    
    // Cache for analysis results
    this.cache = new Map();
  }
  
  /**
   * Initialize the ML service
   */
  async init() {
    console.log('[ML Service] Initializing...');
    
    try {
      if (this.config.useRemoteModels) {
        // Check if backend ML service is available
        await this.checkBackendAvailability();
      } else {
        // Load local TensorFlow.js models
        await this.loadLocalModels();
      }
      
      this.initialized = true;
      console.log('[ML Service] Initialization complete', this.modelStatus);
      return true;
    } catch (error) {
      console.error('[ML Service] Initialization failed:', error);
      return false;
    }
  }
  
  /**
   * Check if backend ML service is available
   */
  async checkBackendAvailability() {
    try {
      const response = await fetch(`${this.config.modelEndpoint}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        this.modelStatus = data.models || this.modelStatus;
        console.log('[ML Service] Backend available:', data);
        return true;
      } else {
        throw new Error(`Backend responded with status ${response.status}`);
      }
    } catch (error) {
      console.warn('[ML Service] Backend unavailable, falling back to local models:', error);
      this.config.useRemoteModels = false;
      await this.loadLocalModels();
      return false;
    }
  }
  
  /**
   * Load local TensorFlow.js models
   */
  async loadLocalModels() {
    console.log('[ML Service] Loading local models...');
    
    // Check if TensorFlow.js is available
    if (typeof tf === 'undefined') {
      console.error('[ML Service] TensorFlow.js not available');
      return false;
    }
    
    try {
      // Load sentiment analysis model
      if (this.config.modelsToLoad.includes('sentiment')) {
        // Simple rule-based sentiment for fallback
        this.models.sentiment = {
          type: 'rule-based',
          loaded: true
        };
        this.modelStatus.sentiment = true;
      }
      
      // Load entity recognition model
      if (this.config.modelsToLoad.includes('entityRecognition')) {
        // Simple rule-based entity recognition for fallback
        this.models.entityRecognition = {
          type: 'rule-based',
          loaded: true
        };
        this.modelStatus.entityRecognition = true;
      }
      
      return true;
    } catch (error) {
      console.error('[ML Service] Failed to load local models:', error);
      return false;
    }
  }
  
  /**
   * Analyze page content using ML models
   * @param {Object} pageFeatures - Features extracted from the page
   * @returns {Object} - Analysis results
   */
  async analyzeContent(pageFeatures) {
    if (!this.initialized) {
      await this.init();
    }
    
    // Generate cache key based on URL and timestamp
    const cacheKey = `${pageFeatures.url}_${Date.now()}`;
    
    // Check cache first
    if (this.config.cacheResults && this.cache.has(cacheKey)) {
      const cachedResult = this.cache.get(cacheKey);
      if (Date.now() - cachedResult.timestamp < this.config.cacheTTL) {
        console.log('[ML Service] Returning cached result for:', pageFeatures.url);
        return cachedResult.data;
      }
    }
    
    console.log('[ML Service] Analyzing content:', pageFeatures.url);
    
    try {
      let results;
      
      if (this.config.useRemoteModels) {
        // Use backend for analysis
        results = await this.analyzeWithBackend(pageFeatures);
      } else {
        // Use local models
        results = await this.analyzeWithLocalModels(pageFeatures);
      }
      
      // Cache results
      if (this.config.cacheResults) {
        this.cache.set(cacheKey, {
          data: results,
          timestamp: Date.now()
        });
      }
      
      return results;
    } catch (error) {
      console.error('[ML Service] Analysis failed:', error);
      
      // Return basic fallback analysis
      return this.generateFallbackAnalysis(pageFeatures);
    }
  }
  
  /**
   * Analyze content using backend ML service
   * @param {Object} pageFeatures - Features extracted from the page
   * @returns {Object} - Analysis results from backend
   */
  async analyzeWithBackend(pageFeatures) {
    try {
      const response = await fetch(`${this.config.modelEndpoint}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          features: pageFeatures,
          models: this.config.modelsToLoad
        })
      });
      
      if (response.ok) {
        return await response.json();
      } else {
        throw new Error(`Backend responded with status ${response.status}`);
      }
    } catch (error) {
      console.error('[ML Service] Backend analysis failed:', error);
      // Fall back to local analysis
      return this.analyzeWithLocalModels(pageFeatures);
    }
  }
  
  /**
   * Analyze content using local ML models
   * @param {Object} pageFeatures - Features extracted from the page
   * @returns {Object} - Analysis results from local models
   */
  async analyzeWithLocalModels(pageFeatures) {
    console.log('[ML Service] Analyzing with local models');
    
    const results = {
      sentiment: null,
      entities: [],
      topics: [],
      marketMetrics: {},
      businessOpportunities: [],
      timestamp: Date.now()
    };
    
    // Combine text for analysis
    const text = [
      pageFeatures.title,
      pageFeatures.meta_description,
      ...pageFeatures.headings,
      pageFeatures.visible_text
    ].join(' ').substring(0, this.config.maxTextLength);
    
    // Perform sentiment analysis
    if (this.modelStatus.sentiment) {
      results.sentiment = await this.analyzeSentiment(text);
    }
    
    // Perform entity recognition
    if (this.modelStatus.entityRecognition) {
      results.entities = await this.extractEntities(text);
    }
    
    // Extract topics
    results.topics = this.extractTopics(text);
    
    // Generate market metrics
    results.marketMetrics = this.generateMarketMetrics(pageFeatures, results.entities);
    
    // Generate business opportunities
    results.businessOpportunities = this.generateBusinessOpportunities(
      pageFeatures,
      results.entities,
      results.sentiment
    );
    
    return results;
  }
  
  /**
   * Analyze sentiment of text
   * @param {string} text - Text to analyze
   * @returns {Object} - Sentiment analysis results
   */
  async analyzeSentiment(text) {
    // Simple rule-based sentiment analysis as fallback
    const positiveWords = [
      'good', 'great', 'excellent', 'amazing', 'awesome', 'fantastic',
      'wonderful', 'best', 'positive', 'success', 'successful', 'benefit',
      'benefits', 'profit', 'profitable', 'growth', 'growing', 'increase',
      'increasing', 'improved', 'improvement', 'leading', 'innovative'
    ];
    
    const negativeWords = [
      'bad', 'poor', 'terrible', 'awful', 'horrible', 'worst',
      'negative', 'failure', 'fail', 'failed', 'problem', 'issue',
      'issues', 'concern', 'concerns', 'risk', 'risks', 'loss',
      'losses', 'decrease', 'decreasing', 'declined', 'declining'
    ];
    
    const words = text.toLowerCase().split(/\W+/);
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    const total = positiveCount + negativeCount;
    const score = total > 0 ? (positiveCount - negativeCount) / total : 0;
    
    return {
      score: score, // Range: -1 to 1
      positive: positiveCount,
      negative: negativeCount,
      neutral: words.length - positiveCount - negativeCount,
      label: score > 0.1 ? 'positive' : score < -0.1 ? 'negative' : 'neutral'
    };
  }
  
  /**
   * Extract entities from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Extracted entities
   */
  async extractEntities(text) {
    // Simple rule-based entity extraction as fallback
    const entities = [];
    
    // Company patterns
    const companyPatterns = [
      /([A-Z][a-z]+\s)+Inc\.?/g,
      /([A-Z][a-z]+\s)+Corp\.?/g,
      /([A-Z][a-z]+\s)+Corporation/g,
      /([A-Z][a-z]+\s)+LLC/g,
      /([A-Z][a-z]+\s)+Ltd\.?/g
    ];
    
    // Product patterns
    const productPatterns = [
      /([A-Z][a-z]*\d+)/g, // Product codes like iPhone14
      /(\w+\s)?[A-Z][a-z]*\s(Suite|Platform|Software|System|Tool)/g
    ];
    
    // Price patterns
    const pricePatterns = [
      /\$\d+(?:\.\d{2})?/g,
      /\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?/g,
      /\d+(?:\.\d{2})?(\s)?USD/g
    ];
    
    // Date patterns
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{2,4}/g,
      /\d{4}-\d{2}-\d{2}/g,
      /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2},?\s\d{4}/g
    ];
    
    // Extract companies
    companyPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        entities.push({
          text: match,
          type: 'ORGANIZATION',
          subtype: 'COMPANY'
        });
      });
    });
    
    // Extract products
    productPatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        entities.push({
          text: match,
          type: 'PRODUCT',
          subtype: 'SOFTWARE'
        });
      });
    });
    
    // Extract prices
    pricePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        entities.push({
          text: match,
          type: 'MONEY',
          subtype: 'PRICE'
        });
      });
    });
    
    // Extract dates
    datePatterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => {
        entities.push({
          text: match,
          type: 'DATE',
          subtype: 'CALENDAR'
        });
      });
    });
    
    // Remove duplicates
    const uniqueEntities = [];
    const seen = new Set();
    
    entities.forEach(entity => {
      const key = `${entity.text}_${entity.type}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueEntities.push(entity);
      }
    });
    
    return uniqueEntities;
  }
  
  /**
   * Extract topics from text
   * @param {string} text - Text to analyze
   * @returns {Array} - Extracted topics
   */
  extractTopics(text) {
    // Simple keyword-based topic extraction
    const businessTopics = {
      'finance': ['finance', 'financial', 'investment', 'investor', 'stock', 'market', 'trading', 'fund'],
      'technology': ['technology', 'tech', 'software', 'hardware', 'digital', 'internet', 'web', 'app', 'application'],
      'marketing': ['marketing', 'advertisement', 'campaign', 'brand', 'branding', 'customer', 'consumer'],
      'sales': ['sales', 'revenue', 'conversion', 'lead', 'prospect', 'customer', 'deal', 'pipeline'],
      'operations': ['operations', 'logistics', 'supply chain', 'manufacturing', 'production', 'inventory'],
      'hr': ['hr', 'human resources', 'recruitment', 'hiring', 'employee', 'talent', 'workforce'],
      'legal': ['legal', 'law', 'compliance', 'regulation', 'policy', 'contract', 'agreement'],
      'product': ['product', 'feature', 'design', 'development', 'roadmap', 'release', 'version']
    };
    
    const topics = [];
    const lowerText = text.toLowerCase();
    
    Object.entries(businessTopics).forEach(([topic, keywords]) => {
      let count = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = lowerText.match(regex) || [];
        count += matches.length;
      });
      
      if (count > 0) {
        topics.push({
          name: topic,
          score: count / 100, // Normalize score
          count: count
        });
      }
    });
    
    // Sort by score descending
    topics.sort((a, b) => b.score - a.score);
    
    return topics.slice(0, 5); // Return top 5 topics
  }
  
  /**
   * Generate market metrics based on page features and entities
   * @param {Object} pageFeatures - Features extracted from the page
   * @param {Array} entities - Extracted entities
   * @returns {Object} - Market metrics
   */
  generateMarketMetrics(pageFeatures, entities) {
    // Extract domain and path for context
    const url = new URL(pageFeatures.url);
    const domain = url.hostname;
    const path = url.pathname;
    
    // Default metrics
    const metrics = {
      marketSize: this.estimateMarketSize(pageFeatures, entities),
      growthRate: this.estimateGrowthRate(pageFeatures, entities),
      competitionLevel: this.estimateCompetitionLevel(pageFeatures, entities),
      pricePoints: this.extractPricePoints(entities),
      marketTrends: this.identifyMarketTrends(pageFeatures),
      riskScore: this.calculateRiskScore(pageFeatures, entities)
    };
    
    return metrics;
  }
  
  /**
   * Estimate market size based on page content
   * @param {Object} pageFeatures - Features extracted from the page
   * @param {Array} entities - Extracted entities
   * @returns {Object} - Market size estimate
   */
  estimateMarketSize(pageFeatures, entities) {
    // Look for market size mentions in text
    const text = pageFeatures.visible_text.toLowerCase();
    
    // Patterns for market size mentions
    const patterns = [
      /market\s+size\s+of\s+\$(\d+(?:\.\d+)?)(\s?(?:billion|million|trillion))/i,
      /\$(\d+(?:\.\d+)?)(\s?(?:billion|million|trillion))\s+market/i,
      /(\d+(?:\.\d+)?)\s?(billion|million|trillion)\s+market/i
    ];
    
    let size = null;
    let confidence = 'low';
    let source = 'estimated';
    
    // Check for explicit mentions
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const unit = match[2]?.trim().toLowerCase() || 'million';
        
        let multiplier = 1000000; // Default to million
        if (unit.includes('billion')) multiplier = 1000000000;
        if (unit.includes('trillion')) multiplier = 1000000000000;
        
        size = value * multiplier;
        confidence = 'medium';
        source = 'extracted';
        break;
      }
    }
    
    // If no explicit mention, estimate based on industry
    if (!size) {
      // Extract industry from topics or entities
      const industry = this.detectIndustry(pageFeatures, entities);
      
      // Industry average market sizes (very rough estimates)
      const industrySizes = {
        'technology': 5000000000,
        'finance': 8000000000,
        'healthcare': 3000000000,
        'retail': 2000000000,
        'manufacturing': 4000000000,
        'education': 1000000000,
        'entertainment': 2500000000
      };
      
      size = industrySizes[industry] || 1000000000; // Default to 1B
    }
    
    return {
      value: size,
      formatted: this.formatCurrency(size),
      confidence: confidence,
      source: source
    };
  }
  
  /**
   * Detect industry from page content
   * @param {Object} pageFeatures - Features extracted from the page
   * @param {Array} entities - Extracted entities
   * @returns {string} - Detected industry
   */
  detectIndustry(pageFeatures, entities) {
    const text = [
      pageFeatures.title,
      pageFeatures.meta_description,
      ...pageFeatures.headings,
      pageFeatures.visible_text
    ].join(' ').toLowerCase();
    
    const industries = {
      'technology': ['software', 'hardware', 'tech', 'digital', 'internet', 'web', 'app', 'cloud', 'saas', 'ai', 'data'],
      'finance': ['finance', 'banking', 'investment', 'insurance', 'loan', 'credit', 'financial', 'bank', 'fintech'],
      'healthcare': ['health', 'medical', 'hospital', 'doctor', 'patient', 'care', 'clinical', 'pharma', 'drug'],
      'retail': ['retail', 'shop', 'store', 'ecommerce', 'product', 'consumer', 'brand', 'shopping'],
      'manufacturing': ['manufacturing', 'factory', 'production', 'industrial', 'supply chain', 'material'],
      'education': ['education', 'school', 'university', 'college', 'student', 'learning', 'course', 'training'],
      'entertainment': ['entertainment', 'media', 'game', 'video', 'film', 'movie', 'music', 'streaming']
    };
    
    let maxCount = 0;
    let detectedIndustry = 'other';
    
    Object.entries(industries).forEach(([industry, keywords]) => {
      let count = 0;
      keywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex) || [];
        count += matches.length;
      });
      
      if (count > maxCount) {
        maxCount = count;
        detectedIndustry = industry;
      }
    });
    
    return detectedIndustry;
  }
  
  /**
   * Format currency value
   * @param {number} value - Currency value
   * @returns {string} - Formatted currency string
   */
  formatCurrency(value) {
    if (value === null || value === undefined) return 'N/A';
    
    if (value >= 1000000000) {
      return `$${(value / 1000000000).toFixed(1)}B`;
    } else if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    } else {
      return `$${value.toFixed(2)}`;
    }
  }
}

// Initialize and expose the ML service
self.mlService = new MLService();

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MLService;
}