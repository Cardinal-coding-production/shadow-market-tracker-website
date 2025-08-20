/**
 * UI Overlay Module for Shadow Market Tracker
 * Creates and manages the draggable, resizable overlay widget
 */

class UIOverlay {
  constructor() {
    this.isVisible = false;
    this.currentView = 'market-overview'; // Default view
    this.position = { x: 20, y: 20 };
    this.size = { width: 350, height: 500 };
    this.isDragging = false;
    this.isResizing = false;
    this.dragOffset = { x: 0, y: 0 };
    this.container = null;
    this.content = null;
    this.refreshRate = 30000; // 30 seconds default
    this.refreshTimer = null;
    this.lastAnalysis = null;
  }
  
  /**
   * Initialize the UI overlay
   */
  init() {
    // Create overlay container if it doesn't exist
    if (!this.container) {
      this.createOverlay();
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load settings
    this.loadSettings();
    
    console.log('[UI Overlay] Initialized');
  }
  
  /**
   * Create the overlay DOM elements
   */
  createOverlay() {
    // Create container
    this.container = document.createElement('div');
    this.container.id = 'shadow-market-tracker-overlay';
    this.container.style.cssText = `
      position: fixed;
      top: ${this.position.y}px;
      left: ${this.position.x}px;
      width: ${this.size.width}px;
      height: ${this.size.height}px;
      background-color: rgba(30, 30, 30, 0.95);
      color: #fff;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      z-index: 9999;
      display: none;
      flex-direction: column;
      overflow: hidden;
      transition: opacity 0.3s ease;
    `;
    
    // Create header
    const header = document.createElement('div');
    header.className = 'smt-header';
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 15px;
      background-color: #2c3e50;
      cursor: move;
      user-select: none;
    `;
    
    const title = document.createElement('div');
    title.className = 'smt-title';
    title.textContent = 'Shadow Market Tracker';
    title.style.cssText = `
      font-weight: bold;
      font-size: 16px;
    `;
    
    const controls = document.createElement('div');
    controls.className = 'smt-controls';
    controls.style.cssText = `
      display: flex;
      gap: 10px;
    `;
    
    const refreshBtn = document.createElement('button');
    refreshBtn.className = 'smt-refresh-btn';
    refreshBtn.innerHTML = '⟳';
    refreshBtn.title = 'Refresh Analysis';
    refreshBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
    `;
    refreshBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.refreshAnalysis();
    });
    
    const minimizeBtn = document.createElement('button');
    minimizeBtn.className = 'smt-minimize-btn';
    minimizeBtn.innerHTML = '−';
    minimizeBtn.title = 'Minimize';
    minimizeBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 16px;
    `;
    minimizeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleMinimize();
    });
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'smt-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.title = 'Close';
    closeBtn.style.cssText = `
      background: none;
      border: none;
      color: #fff;
      cursor: pointer;
      font-size: 18px;
    `;
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.hide();
    });
    
    controls.appendChild(refreshBtn);
    controls.appendChild(minimizeBtn);
    controls.appendChild(closeBtn);
    
    header.appendChild(title);
    header.appendChild(controls);
    
    // Create navigation
    const nav = document.createElement('div');
    nav.className = 'smt-nav';
    nav.style.cssText = `
      display: flex;
      background-color: #34495e;
      overflow-x: auto;
      white-space: nowrap;
    `;
    
    const navItems = [
      { id: 'market-overview', label: 'Market Overview' },
      { id: 'competitor-stats', label: 'Competitor Stats' },
      { id: 'opportunities', label: 'Opportunities' }
    ];
    
    navItems.forEach(item => {
      const navItem = document.createElement('button');
      navItem.className = 'smt-nav-item';
      navItem.dataset.view = item.id;
      navItem.textContent = item.label;
      navItem.style.cssText = `
        padding: 10px 15px;
        background: none;
        border: none;
        color: #fff;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s ease;
      `;
      
      if (item.id === this.currentView) {
        navItem.style.opacity = '1';
        navItem.style.borderBottom = '2px solid #3498db';
      }
      
      navItem.addEventListener('click', () => {
        this.switchView(item.id);
      });
      
      nav.appendChild(navItem);
    });
    
    // Create content area
    this.content = document.createElement('div');
    this.content.className = 'smt-content';
    this.content.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 15px;
    `;
    
    // Create resize handle
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'smt-resize-handle';
    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 15px;
      height: 15px;
      cursor: nwse-resize;
      background: linear-gradient(135deg, transparent 50%, #3498db 50%);
    `;
    
    // Assemble the overlay
    this.container.appendChild(header);
    this.container.appendChild(nav);
    this.container.appendChild(this.content);
    this.container.appendChild(resizeHandle);
    
    // Add to document
    document.body.appendChild(this.container);
    
    // Set up drag and resize handlers
    this.setupDragHandlers(header);
    this.setupResizeHandlers(resizeHandle);
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'show_overlay') {
        this.show();
        sendResponse({ success: true });
      } else if (request.action === 'hide_overlay') {
        this.hide();
        sendResponse({ success: true });
      } else if (request.action === 'update_analysis') {
        this.updateContent(request.data);
        sendResponse({ success: true });
      }
      return true; // Keep message channel open for async response
    });
    
    // Handle keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Alt+Shift+S to toggle overlay
      if (e.altKey && e.shiftKey && e.key === 'S') {
        this.toggle();
      }
    });
  }
  
  /**
   * Set up drag handlers for the overlay
   * @param {HTMLElement} dragHandle - Element that triggers dragging
   */
  setupDragHandlers(dragHandle) {
    dragHandle.addEventListener('mousedown', (e) => {
      if (e.target === dragHandle || e.target.parentNode === dragHandle) {
        this.isDragging = true;
        this.dragOffset.x = e.clientX - this.container.offsetLeft;
        this.dragOffset.y = e.clientY - this.container.offsetTop;
        e.preventDefault();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        // Keep within viewport bounds
        const maxX = window.innerWidth - this.container.offsetWidth;
        const maxY = window.innerHeight - this.container.offsetHeight;
        
        this.position.x = Math.max(0, Math.min(x, maxX));
        this.position.y = Math.max(0, Math.min(y, maxY));
        
        this.container.style.left = `${this.position.x}px`;
        this.container.style.top = `${this.position.y}px`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (this.isDragging) {
        this.isDragging = false;
        this.saveSettings();
      }
    });
  }
  
  /**
   * Set up resize handlers for the overlay
   * @param {HTMLElement} resizeHandle - Element that triggers resizing
   */
  setupResizeHandlers(resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      this.isResizing = true;
      e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
      if (this.isResizing) {
        const width = e.clientX - this.container.offsetLeft;
        const height = e.clientY - this.container.offsetTop;
        
        // Enforce minimum size
        this.size.width = Math.max(300, width);
        this.size.height = Math.max(200, height);
        
        this.container.style.width = `${this.size.width}px`;
        this.container.style.height = `${this.size.height}px`;
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        this.saveSettings();
      }
    });
  }
  
  /**
   * Show the overlay
   */
  show() {
    this.container.style.display = 'flex';
    this.isVisible = true;
    
    // Start refresh timer
    this.startRefreshTimer();
    
    // Trigger initial analysis if needed
    if (!this.lastAnalysis) {
      this.refreshAnalysis();
    }
  }
  
  /**
   * Hide the overlay
   */
  hide() {
    this.container.style.display = 'none';
    this.isVisible = false;
    
    // Stop refresh timer
    this.stopRefreshTimer();
  }
  
  /**
   * Toggle overlay visibility
   */
  toggle() {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Toggle minimize state
   */
  toggleMinimize() {
    if (this.container.classList.contains('minimized')) {
      // Restore
      this.container.classList.remove('minimized');
      this.container.style.height = `${this.size.height}px`;
      this.content.style.display = 'block';
      document.querySelector('.smt-nav').style.display = 'flex';
      document.querySelector('.smt-minimize-btn').innerHTML = '−';
    } else {
      // Minimize
      this.container.classList.add('minimized');
      this.container.style.height = 'auto';
      this.content.style.display = 'none';
      document.querySelector('.smt-nav').style.display = 'none';
      document.querySelector('.smt-minimize-btn').innerHTML = '+';
    }
  }
  
  /**
   * Switch between different views
   * @param {string} viewId - ID of the view to switch to
   */
  switchView(viewId) {
    this.currentView = viewId;
    
    // Update nav highlighting
    const navItems = document.querySelectorAll('.smt-nav-item');
    navItems.forEach(item => {
      if (item.dataset.view === viewId) {
        item.style.opacity = '1';
        item.style.borderBottom = '2px solid #3498db';
      } else {
        item.style.opacity = '0.7';
        item.style.borderBottom = 'none';
      }
    });
    
    // Update content
    if (this.lastAnalysis) {
      this.updateContent(this.lastAnalysis);
    }
    
    this.saveSettings();
  }
  
  /**
   * Update the content based on analysis data
   * @param {Object} data - Analysis data
   */
  updateContent(data) {
    if (!data) return;
    
    this.lastAnalysis = data;
    
    // Clear current content
    this.content.innerHTML = '';
    
    // Create content based on current view
    switch (this.currentView) {
      case 'market-overview':
        this.renderMarketOverview(data);
        break;
      case 'competitor-stats':
        this.renderCompetitorStats(data);
        break;
      case 'opportunities':
        this.renderOpportunities(data);
        break;
    }
  }
  
  /**
   * Render Market Overview view
   * @param {Object} data - Analysis data
   */
  renderMarketOverview(data) {
    const metrics = data.marketMetrics || {};
    
    // Create market size section
    const marketSizeSection = document.createElement('div');
    marketSizeSection.className = 'smt-section';
    marketSizeSection.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #3498db;">Market Size</h3>
      <div class="smt-metric" style="font-size: 24px; font-weight: bold;">
        ${metrics.marketSize?.formatted || 'N/A'}
      </div>
      <div class="smt-confidence" style="font-size: 12px; color: #95a5a6;">
        Confidence: ${metrics.marketSize?.confidence || 'low'}
      </div>
    `;
    
    // Create growth rate section
    const growthSection = document.createElement('div');
    growthSection.className = 'smt-section';
    growthSection.style.marginTop = '20px';
    growthSection.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #3498db;">Annual Growth Rate</h3>
      <div class="smt-metric" style="font-size: 24px; font-weight: bold;">
        ${metrics.growthRate?.formatted || 'N/A'}
      </div>
      <div class="smt-confidence" style="font-size: 12px; color: #95a5a6;">
        Confidence: ${metrics.growthRate?.confidence || 'low'}
      </div>
    `;
    
    // Create competition level section
    const competitionSection = document.createElement('div');
    competitionSection.className = 'smt-section';
    competitionSection.style.marginTop = '20px';
    competitionSection.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #3498db;">Competition Level</h3>
      <div class="smt-metric" style="font-size: 24px; font-weight: bold; text-transform: capitalize;">
        ${metrics.competitionLevel?.value || 'Medium'}
      </div>
      <div class="smt-confidence" style="font-size: 12px; color: #95a5a6;">
        ${metrics.competitionLevel?.companyCount || 0} companies mentioned
      </div>
    `;
    
    // Create market trends section
    const trendsSection = document.createElement('div');
    trendsSection.className = 'smt-section';
    trendsSection.style.marginTop = '20px';
    trendsSection.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #3498db;">Market Trends</h3>
    `;
    
    const trendsList = document.createElement('ul');
    trendsList.style.cssText = `
      margin: 0;
      padding: 0 0 0 20px;
    `;
    
    if (metrics.marketTrends && metrics.marketTrends.length > 0) {
      metrics.marketTrends.forEach(trend => {
        const trendItem = document.createElement('li');
        trendItem.style.cssText = `
          margin-bottom: 5px;
        `;
        trendItem.innerHTML = `
          <span style="text-transform: capitalize;">${trend.name}</span>
          <span style="font-size: 12px; color: #95a5a6; margin-left: 5px;">(${trend.strength})</span>
        `;
        trendsList.appendChild(trendItem);
      });
    } else {
      const noTrends = document.createElement('p');
      noTrends.style.cssText = `
        margin: 0;
        color: #95a5a6;
        font-style: italic;
      `;
      noTrends.textContent = 'No significant trends detected';
      trendsList.appendChild(noTrends);
    }
    
    trendsSection.appendChild(trendsList);
    
    // Create risk score section
    const riskSection = document.createElement('div');
    riskSection.className = 'smt-section';
    riskSection.style.marginTop = '20px';
    
    let riskColor = '#2ecc71'; // Green for low risk
    if (metrics.riskScore?.level === 'medium') {
      riskColor = '#f39c12'; // Orange for medium risk
    } else if (metrics.riskScore?.level === 'high') {
      riskColor = '#e74c3c'; // Red for high risk
    }
    
    riskSection.innerHTML = `
      <h3 style="margin: 0 0 10px 0; font-size: 16px; color: #3498db;">Risk Assessment</h3>
      <div class="smt-risk-meter" style="display: flex; align-items: center;">
        <div class="smt-risk-label" style="
          font-size: 24px; 
          font-weight: bold; 
          text-transform: capitalize;
          color: ${riskColor};
        ">
          ${metrics.riskScore?.level || 'Medium'}
        </div>
        <div class="smt-risk-score" style="
          margin-left: 10px;
          font-size: 14px;
          color: #95a5a6;
        ">
          Score: ${metrics.riskScore?.score || 50}/100
        </div>
      </div>
    `;
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'smt-timestamp';
    timestamp.style.cssText = `
      margin-top: 30px;
      font-size: 11px;
      color: #95a5a6;
      text-align: right;
    `;
    
    const analysisTime = data.timestamp ? new Date(data.timestamp) : new Date();
    timestamp.textContent = `Last updated: ${analysisTime.toLocaleString()}`;
    
    // Assemble all sections
    this.content.appendChild(marketSizeSection);
    this.content.appendChild(growthSection);
    this.content.appendChild(competitionSection);
    this.content.appendChild(trendsSection);
    this.content.appendChild(riskSection);
    this.content.appendChild(timestamp);
  }
  
  /**
   * Render Competitor Stats view
   * @param {Object} data - Analysis data
   */
  renderCompetitorStats(data) {
    const entities = data.entities || [];
    const competitors = entities.filter(e => e.type === 'ORGANIZATION' && e.subtype === 'COMPANY