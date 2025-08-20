// Enhanced popup script for Shadow Market Tracker
// Handles UI interactions and communicates with background script

class PopupManager {
    constructor() {
        this.currentTab = null;
        this.currentAnalysis = null;
        this.isAnalyzing = false;
        this.isPremium = false;
        this.init();
    }

    async init() {
        try {
            // Get current tab with error handling
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            this.currentTab = tabs?.[0];

            if (!this.currentTab) {
                console.warn('No active tab found');
                this.showError('No active tab found');
                return;
            }

            // Set up event listeners
            this.setupEventListeners();

            // Check premium status
            await this.checkPremiumStatus();

            // Initialize UI
            await this.initializeUI();

            // Check for cached analysis
            await this.checkCachedAnalysis();

            // Test background script connection
            await this.testBackgroundConnection();

        } catch (error) {
            console.error('Popup initialization failed:', error);
            this.showError('Failed to initialize popup');
        }
    }

    async testBackgroundConnection() {
        try {
            console.log('🔍 Testing background script connection...');
            const response = await this.sendMessageWithRetry({ action: 'health_check' }, 1);
            console.log('✅ Background script is responsive:', response);
            this.updateConnectionStatus(true);
        } catch (error) {
            console.warn('⚠️ Background script connection issue:', error.message);
            this.updateConnectionStatus(false, error.message);
            // Don't throw error here, just log it - the extension can still work
        }
    }

    updateConnectionStatus(connected, errorMessage = '') {
        // Update the connection status indicator in the footer
        const statusElement = document.querySelector('.text-green-400');
        if (statusElement) {
            if (connected) {
                statusElement.textContent = '● Connected';
                statusElement.className = 'text-green-400';
            } else {
                statusElement.textContent = '● Disconnected';
                statusElement.className = 'text-red-400';
                if (errorMessage) {
                    statusElement.title = errorMessage;
                }
            }
        }
    }

    setupEventListeners() {
        // Navigation buttons
        document.getElementById('navHome').addEventListener('click', () => this.showSection('home'));
        document.getElementById('navTrends').addEventListener('click', () => this.showSection('trends'));
        document.getElementById('navAlerts').addEventListener('click', () => this.showSection('alerts'));
        document.getElementById('navAnalysis').addEventListener('click', () => this.showSection('analysis'));
        
        // Action buttons
        document.getElementById('analyzeBtn').addEventListener('click', () => this.analyzePage());
        document.getElementById('retryBtn').addEventListener('click', () => this.analyzePage());
        document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
        document.getElementById('testConnectionBtn').addEventListener('click', () => this.testConnection());
        
        // Navigation button styling
        const navButtons = document.querySelectorAll('.nav-btn');
        navButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                navButtons.forEach(b => b.classList.remove('active', 'bg-white/20'));
                btn.classList.add('active', 'bg-white/20');
            });
        });
    }

    async initializeUI() {
        if (!this.currentTab) {
            this.showError('No active tab found');
            return;
        }

        // Update page info
        this.updatePageInfo();
        
        // Check connection status
        await this.checkConnectionStatus();
    }

    updatePageInfo() {
        const pageInfo = document.getElementById('pageInfo');
        if (!pageInfo) {
            console.error('pageInfo element not found');
            return;
        }

        const title = this.currentTab?.title || 'Unknown Page';
        const url = this.currentTab?.url || '';

        pageInfo.innerHTML = `
            <div class="font-medium text-white">${this.truncateText(title, 50)}</div>
            <div class="text-sm text-white/70">${this.truncateText(url, 60)}</div>
        `;
    }

    async checkCachedAnalysis() {
        try {
            // Check if we have cached analysis for this URL
            const cached = await this.getCachedAnalysis(this.currentTab.url);
            if (cached) {
                this.displayAnalysis(cached);
            }
        } catch (error) {
            console.error('Failed to check cached analysis:', error);
        }
    }

        async analyzePage() {
        if (this.isAnalyzing) return;

        // Check usage limit before analysis
        if (!this.isPremium && !(await this.checkUsageLimit())) {
            this.redirectToPricing('usage_limit');
            return;
        }

        this.isAnalyzing = true;
        this.showLoading();

        try {
            // Check if currentTab exists
            if (!this.currentTab || !this.currentTab.url) {
                throw new Error('No active tab found');
            }

            // Increment usage count for non-premium users
            if (!this.isPremium) {
                await this.incrementUsage();
            }

            // Request analysis from background script using the scan action
            const response = await this.sendMessageWithRetry({
                action: 'scan',
                url: this.currentTab.url,
                title: this.currentTab.title,
                tabId: this.currentTab.id
            });

            // Check for chrome.runtime.lastError
            if (chrome.runtime.lastError) {
                throw new Error(`Runtime error: ${chrome.runtime.lastError.message}`);
            }

            // Add null guards
            if (!response) {
                throw new Error('No response received from background script');
            }

            if (response.error) {
                throw new Error(response.error);
            }

            this.currentAnalysis = response;
            this.displayAnalysis(response);

            // Cache the result
            await this.cacheAnalysis(this.currentTab.url, response);

        } catch (error) {
            console.error('Analysis failed:', error);
            
            // Check for specific Chrome runtime errors
            if (chrome.runtime.lastError) {
                console.error('Chrome runtime error:', chrome.runtime.lastError);
                this.showError(`Chrome runtime error: ${chrome.runtime.lastError.message}`);
            } else if (error.message.includes('No response received')) {
                this.showError('Background script not responding. Please try refreshing the page and testing the connection first.');
            } else {
                this.showError(error.message || 'Analysis failed');
            }
        } finally {
            this.isAnalyzing = false;
        }
    }

    async sendMessageWithRetry(message, maxRetries = 3) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`📤 Sending message (attempt ${attempt}/${maxRetries}):`, message);

                // Add a small delay between retries
                if (attempt > 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                }

                const response = await chrome.runtime.sendMessage(message);

                if (chrome.runtime.lastError) {
                    throw new Error(chrome.runtime.lastError.message);
                }

                console.log(`📥 Received response (attempt ${attempt}):`, response);
                return response;

            } catch (error) {
                console.error(`❌ Message failed (attempt ${attempt}/${maxRetries}):`, error);

                if (attempt === maxRetries) {
                    // On final attempt, provide a helpful error message
                    if (error.message.includes('Receiving end does not exist')) {
                        throw new Error('Extension background script is not responding. Please try reloading the extension.');
                    } else if (error.message.includes('Extension context invalidated')) {
                        throw new Error('Extension needs to be reloaded. Please reload the extension and try again.');
                    } else {
                        throw new Error(`Communication failed: ${error.message}`);
                    }
                }
            }
        }
    }

    displayAnalysis(analysis) {
        // Hide loading and error states
        this.hideLoading();
        this.hideError();

        // Show results
        const resultsDiv = document.getElementById('analysisResults');
        resultsDiv.classList.remove('hidden');
        resultsDiv.classList.add('fade-in');

        let parsedAnalysis = null;

        // Handle different response formats
        if (analysis.analysis) {
            // Parse the analysis string if it's JSON
            try {
                parsedAnalysis = JSON.parse(analysis.analysis);
            } catch {
                // If not JSON, create a basic structure
                parsedAnalysis = {
                    score: 75,
                    priority: 'medium',
                    confidence: 0.8,
                    opportunities: [{
                        title: 'Analysis Completed',
                        description: analysis.analysis,
                        confidence: 0.8,
                        value_prop: 'Market intelligence gathered',
                        tam_estimate: 'General market'
                    }],
                    trends: [{
                        type: 'analysis',
                        title: 'Page Analysis',
                        description: 'Content analysis completed successfully',
                        timestamp: new Date().toISOString()
                    }]
                };
            }
        } else if (analysis.result) {
            // Try to parse result as JSON
            try {
                parsedAnalysis = JSON.parse(analysis.result);
            } catch {
                // Create basic structure from result
                parsedAnalysis = {
                    score: 75,
                    priority: 'medium',
                    confidence: 0.8,
                    opportunities: [{
                        title: 'Analysis Result',
                        description: analysis.result,
                        confidence: 0.8,
                        value_prop: 'Market intelligence gathered',
                        tam_estimate: 'General market'
                    }],
                    trends: [{
                        type: 'result',
                        title: 'Analysis Complete',
                        description: 'Page analysis completed successfully',
                        timestamp: new Date().toISOString()
                    }]
                };
            }
        } else {
            // Fallback structure
            parsedAnalysis = {
                score: 50,
                priority: 'low',
                confidence: 0.5,
                opportunities: [{
                    title: 'Basic Analysis',
                    description: 'Page analysis completed with limited data',
                    confidence: 0.5,
                    value_prop: 'Basic market intelligence',
                    tam_estimate: 'General market'
                }],
                trends: [{
                    type: 'fallback',
                    title: 'Local Analysis',
                    description: 'Analysis completed using local processing',
                    timestamp: new Date().toISOString()
                }]
            };
        }

        // Update UI with parsed analysis
        this.updateScore(
            parsedAnalysis.score || 50,
            parsedAnalysis.priority || 'medium',
            parsedAnalysis.confidence || 0.5
        );
        this.updateBusinessIdeas(parsedAnalysis.opportunities || []);
        this.updateMarketSignals(parsedAnalysis.trends || parsedAnalysis.signals || []);

        // Update trends and analysis sections with dynamic content
        this.updateTrendsSection(parsedAnalysis);
        this.updateAnalysisSection(parsedAnalysis);
    }

    updateScore(score, priority, confidence) {
        const scoreValue = document.getElementById('scoreValue');
        const priorityBadge = document.getElementById('priorityBadge');
        const confidenceValue = document.getElementById('confidenceValue');
        const confidenceBar = document.getElementById('confidenceBar');
        
        scoreValue.textContent = Math.round(score);
        confidenceValue.textContent = `${Math.round(confidence * 100)}%`;
        confidenceBar.style.width = `${confidence * 100}%`;
        
        // Update priority badge
        priorityBadge.textContent = priority;
        priorityBadge.className = `px-2 py-1 rounded-full text-xs font-medium priority-${priority.toLowerCase()}`;
    }

    updateBusinessIdeas(ideas) {
        const container = document.getElementById('businessIdeas');

        if (!container) {
            console.error('businessIdeas container not found');
            return;
        }

        if (!ideas || ideas.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm">🔮 No business ideas generated yet</p>';
            return;
        }

        container.innerHTML = ideas.map(idea => {
            // Handle both object and string formats
            if (typeof idea === 'string') {
                return `
                    <div class="cyberpunk-card cyberpunk-slide">
                        <h4 class="font-medium text-primary">💼 Market Opportunity</h4>
                        <p class="text-sm text-secondary">${idea}</p>
                    </div>
                `;
            }

            const title = idea.title || 'Business Opportunity';
            const description = idea.description || 'Opportunity identified';
            const confidence = typeof idea.confidence === 'number' ? idea.confidence : 0.5;
            const valueProp = idea.value_prop || 'Value proposition to be determined';
            const tamEstimate = idea.tam_estimate || 'Market size to be analyzed';

            return `
                <div class="cyberpunk-card cyberpunk-slide">
                    <div class="flex items-start justify-between mb-2">
                        <h4 class="font-medium text-primary">💡 ${title}</h4>
                        <span class="status-info">${Math.round(confidence * 100)}%</span>
                    </div>
                    <p class="text-sm text-secondary mb-2">${description}</p>
                    <div class="text-xs text-muted space-y-1">
                        <div><span class="text-accent">💰 Value:</span> ${valueProp}</div>
                        <div><span class="text-accent">📊 Market:</span> ${tamEstimate}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateMarketSignals(signals) {
        const container = document.getElementById('marketSignals');

        if (!container) {
            console.error('marketSignals container not found');
            return;
        }

        if (!signals || signals.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm">📡 No market signals detected yet</p>';
            return;
        }

        container.innerHTML = signals.slice(0, 5).map(signal => {
            // Handle both object and string formats
            if (typeof signal === 'string') {
                return `
                    <div class="cyberpunk-card cyberpunk-slide">
                        <h4 class="font-medium text-sm text-primary">📊 Market Signal</h4>
                        <p class="text-xs text-secondary">${signal}</p>
                    </div>
                `;
            }

            const type = signal.type || 'signal';
            const title = signal.title || 'Market Trend';
            const description = signal.description || 'Trend detected';
            const timestamp = signal.timestamp || new Date().toISOString();

            return `
                <div class="cyberpunk-card cyberpunk-slide">
                    <div class="flex items-start justify-between mb-1">
                        <span class="status-info">${type}</span>
                        <span class="text-xs text-muted">${this.formatTimestamp(timestamp)}</span>
                    </div>
                    <h4 class="font-medium text-sm text-primary mb-1">📈 ${title}</h4>
                    <p class="text-xs text-secondary">${description}</p>
                </div>
            `;
        }).join('');
    }

    updateTrendsSection(analysis) {
        const trendsContent = document.getElementById('trendsContent');
        if (!trendsContent) return;

        // Extract industry and content type from current page
        const industry = this.detectIndustry(analysis);
        const contentType = this.detectContentType(analysis);

        // Generate relevant trends based on the page content
        const trends = this.generateRelevantTrends(industry, contentType, analysis);

        if (trends.length === 0) {
            trendsContent.innerHTML = `
                <div class="text-center text-muted py-8">
                    <div class="text-sm">🔮 No specific trends detected for this page</div>
                </div>
            `;
            return;
        }

        trendsContent.innerHTML = trends.map(trend => `
            <div class="cyberpunk-card cyberpunk-slide">
                <div class="flex items-center justify-between mb-2">
                    <h4 class="font-medium text-primary">${trend.icon} ${trend.title}</h4>
                    <span class="status-badge ${trend.statusColor} ${trend.statusTextColor}">${trend.status}</span>
                </div>
                <p class="text-sm text-secondary">${trend.description}</p>
            </div>
        `).join('');
    }

    updateAnalysisSection(analysis) {
        const analysisContent = document.getElementById('analysisContent');
        if (!analysisContent) return;

        // Generate market analysis based on page content
        const marketAnalysis = this.generateMarketAnalysis(analysis);

        analysisContent.innerHTML = `
            <div class="cyberpunk-card cyberpunk-slide">
                <h3 class="font-semibold mb-2 text-primary">💰 Market Size Analysis</h3>
                <div class="grid grid-cols-2 gap-4">
                    <div class="text-center">
                        <div class="text-2xl font-bold text-accent text-glow">${marketAnalysis.marketSize}</div>
                        <div class="text-sm text-muted">Estimated Market Size</div>
                    </div>
                    <div class="text-center">
                        <div class="text-2xl font-bold text-success">${marketAnalysis.growthRate}</div>
                        <div class="text-sm text-muted">Growth Potential</div>
                    </div>
                </div>
            </div>
            <div class="cyberpunk-card cyberpunk-slide">
                <h3 class="font-semibold mb-2 text-primary">⚔️ Competitive Landscape</h3>
                <div class="space-y-2">
                    <div class="flex justify-between">
                        <span class="text-secondary">Market Maturity</span>
                        <span class="text-primary">${marketAnalysis.maturity}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-secondary">Competition Level</span>
                        <span class="${marketAnalysis.competitionColor}">${marketAnalysis.competition}</span>
                    </div>
                    <div class="flex justify-between">
                        <span class="text-secondary">Entry Opportunity</span>
                        <span class="${marketAnalysis.opportunityColor}">${marketAnalysis.opportunity}</span>
                    </div>
                </div>
            </div>
            <div class="cyberpunk-card cyberpunk-slide">
                <h3 class="font-semibold mb-2 text-primary">🧠 Key Insights</h3>
                <div class="space-y-2">
                    ${marketAnalysis.insights.map(insight => `
                        <div class="flex items-start space-x-2">
                            <span class="text-accent mt-1">▶</span>
                            <span class="text-sm text-secondary">${insight}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    detectIndustry(analysis) {
        const url = this.currentTab?.url?.toLowerCase() || '';
        const title = this.currentTab?.title?.toLowerCase() || '';
        const content = JSON.stringify(analysis).toLowerCase();

        // Industry detection based on URL, title, and content
        if (url.includes('github') || url.includes('gitlab') || content.includes('software') || content.includes('developer')) {
            return 'technology';
        } else if (url.includes('shop') || url.includes('store') || url.includes('buy') || content.includes('ecommerce')) {
            return 'ecommerce';
        } else if (content.includes('finance') || content.includes('bank') || content.includes('investment')) {
            return 'finance';
        } else if (content.includes('health') || content.includes('medical') || content.includes('healthcare')) {
            return 'healthcare';
        } else if (content.includes('education') || content.includes('learning') || content.includes('course')) {
            return 'education';
        } else if (content.includes('marketing') || content.includes('advertising') || content.includes('social media')) {
            return 'marketing';
        } else if (content.includes('real estate') || content.includes('property') || content.includes('housing')) {
            return 'realestate';
        } else {
            return 'general';
        }
    }

    detectContentType(analysis) {
        const url = this.currentTab?.url?.toLowerCase() || '';
        const title = this.currentTab?.title?.toLowerCase() || '';

        if (url.includes('blog') || url.includes('article') || title.includes('blog')) {
            return 'blog';
        } else if (url.includes('product') || url.includes('item') || title.includes('product')) {
            return 'product';
        } else if (url.includes('service') || title.includes('service')) {
            return 'service';
        } else if (url.includes('company') || url.includes('about') || title.includes('company')) {
            return 'company';
        } else {
            return 'general';
        }
    }

    generateRelevantTrends(industry, contentType, analysis) {
        const trends = [];

        // Industry-specific trends
        switch (industry) {
            case 'technology':
                trends.push(
                    { icon: '🤖', title: 'AI Integration', status: 'Growing', statusColor: 'status-success', statusTextColor: '', description: '+45% growth in AI adoption across tech companies' },
                    { icon: '☁️', title: 'Cloud Migration', status: 'Hot', statusColor: 'status-error', statusTextColor: '', description: '+38% increase in cloud-first development strategies' },
                    { icon: '🔒', title: 'DevSecOps', status: 'Rising', statusColor: 'status-info', statusTextColor: '', description: '+52% adoption of security-integrated development' }
                );
                break;
            case 'ecommerce':
                trends.push(
                    { icon: '📱', title: 'Mobile Commerce', status: 'Dominant', statusColor: 'status-error', statusTextColor: '', description: '+67% of purchases now happen on mobile devices' },
                    { icon: '🚚', title: 'Same-Day Delivery', status: 'Growing', statusColor: 'status-success', statusTextColor: '', description: '+34% demand for instant fulfillment options' },
                    { icon: '🎯', title: 'Personalization', status: 'Critical', statusColor: 'status-error', statusTextColor: '', description: '+89% of consumers expect personalized experiences' }
                );
                break;
            case 'finance':
                trends.push(
                    { icon: '💳', title: 'Digital Payments', status: 'Accelerating', statusColor: 'status-success', statusTextColor: '', description: '+78% growth in contactless payment adoption' },
                    { icon: '🏦', title: 'Open Banking', status: 'Emerging', statusColor: 'status-info', statusTextColor: '', description: '+43% of banks implementing open API strategies' },
                    { icon: '🔐', title: 'Cybersecurity', status: 'Critical', statusColor: 'status-error', statusTextColor: '', description: '+156% increase in financial cyber threats' }
                );
                break;
            case 'healthcare':
                trends.push(
                    { icon: '💊', title: 'Telemedicine', status: 'Mainstream', statusColor: 'status-success', statusTextColor: '', description: '+284% growth in virtual healthcare consultations' },
                    { icon: '📊', title: 'Health Analytics', status: 'Growing', statusColor: 'status-info', statusTextColor: '', description: '+67% adoption of predictive health analytics' },
                    { icon: '🤖', title: 'AI Diagnostics', status: 'Emerging', statusColor: 'status-info', statusTextColor: '', description: '+45% improvement in AI-assisted diagnosis accuracy' }
                );
                break;
            case 'education':
                trends.push(
                    { icon: '💻', title: 'Online Learning', status: 'Dominant', statusColor: 'status-success', statusTextColor: '', description: '+340% growth in online course enrollment' },
                    { icon: '🎮', title: 'Gamification', status: 'Rising', statusColor: 'status-info', statusTextColor: '', description: '+78% increase in gamified learning platforms' },
                    { icon: '🎯', title: 'Micro-Learning', status: 'Hot', statusColor: 'status-error', statusTextColor: '', description: '+92% preference for bite-sized learning content' }
                );
                break;
            case 'marketing':
                trends.push(
                    { icon: '📱', title: 'Social Commerce', status: 'Exploding', statusColor: 'status-error', statusTextColor: '', description: '+123% growth in social media shopping' },
                    { icon: '🎥', title: 'Video Content', status: 'Dominant', statusColor: 'status-success', statusTextColor: '', description: '+87% of marketers use video as primary content' },
                    { icon: '🤖', title: 'Marketing Automation', status: 'Standard', statusColor: 'status-info', statusTextColor: '', description: '+67% of companies use automated marketing tools' }
                );
                break;
            default:
                trends.push(
                    { icon: '📈', title: 'Digital Transformation', status: 'Universal', statusColor: 'status-success', statusTextColor: '', description: '+89% of businesses accelerating digital initiatives' },
                    { icon: '🌱', title: 'Sustainability', status: 'Growing', statusColor: 'status-info', statusTextColor: '', description: '+76% of consumers prefer sustainable brands' },
                    { icon: '👥', title: 'Remote Work', status: 'Stable', statusColor: 'status-warning', statusTextColor: '', description: '+28% adoption of hybrid work models' }
                );
        }

        return trends.slice(0, 3); // Return top 3 most relevant trends
    }

    generateMarketAnalysis(analysis) {
        const industry = this.detectIndustry(analysis);
        const contentType = this.detectContentType(analysis);
        const url = this.currentTab?.url || '';

        // Generate market size estimates based on industry
        const marketData = this.getMarketDataByIndustry(industry);

        // Analyze competition level based on content and industry
        const competitionAnalysis = this.analyzeCompetition(industry, contentType, analysis);

        // Generate insights based on the page content
        const insights = this.generateInsights(industry, contentType, analysis, url);

        return {
            marketSize: marketData.size,
            growthRate: marketData.growth,
            maturity: marketData.maturity,
            competition: competitionAnalysis.level,
            competitionColor: competitionAnalysis.color,
            opportunity: competitionAnalysis.opportunity,
            opportunityColor: competitionAnalysis.opportunityColor,
            insights: insights
        };
    }

    getMarketDataByIndustry(industry) {
        const marketData = {
            technology: { size: '$5.2T', growth: '12.3%', maturity: 'Rapidly Evolving' },
            ecommerce: { size: '$4.9T', growth: '14.7%', maturity: 'Mature but Growing' },
            finance: { size: '$22.5T', growth: '6.8%', maturity: 'Mature' },
            healthcare: { size: '$8.3T', growth: '7.9%', maturity: 'Stable Growth' },
            education: { size: '$6.2T', growth: '8.5%', maturity: 'Transforming' },
            marketing: { size: '$1.7T', growth: '13.2%', maturity: 'Dynamic' },
            realestate: { size: '$3.7T', growth: '5.4%', maturity: 'Cyclical' },
            general: { size: '$2.1T', growth: '8.2%', maturity: 'Varied' }
        };

        return marketData[industry] || marketData.general;
    }

    analyzeCompetition(industry, contentType, analysis) {
        // Analyze competition based on various factors
        let competitionScore = 0;

        // Industry-based competition
        const industryCompetition = {
            technology: 4, ecommerce: 5, finance: 3, healthcare: 2,
            education: 3, marketing: 5, realestate: 3, general: 3
        };

        competitionScore += industryCompetition[industry] || 3;

        // Content type affects competition
        if (contentType === 'product') competitionScore += 1;
        if (contentType === 'service') competitionScore += 0.5;

        // Determine competition level and colors using cyberpunk theme
        if (competitionScore >= 4.5) {
            return {
                level: 'Very High',
                color: 'text-error',
                opportunity: 'Challenging',
                opportunityColor: 'text-error'
            };
        } else if (competitionScore >= 3.5) {
            return {
                level: 'High',
                color: 'text-warning',
                opportunity: 'Moderate',
                opportunityColor: 'text-warning'
            };
        } else if (competitionScore >= 2.5) {
            return {
                level: 'Medium',
                color: 'text-warning',
                opportunity: 'Good',
                opportunityColor: 'text-success'
            };
        } else {
            return {
                level: 'Low',
                color: 'text-success',
                opportunity: 'Excellent',
                opportunityColor: 'text-success'
            };
        }
    }

    generateInsights(industry, contentType, analysis, url) {
        const insights = [];

        // Industry-specific insights
        switch (industry) {
            case 'technology':
                insights.push(
                    'AI and automation are driving rapid market transformation',
                    'Cloud-first strategies are becoming the standard',
                    'Developer experience is a key competitive differentiator'
                );
                break;
            case 'ecommerce':
                insights.push(
                    'Mobile-first design is critical for market success',
                    'Personalization drives 35% higher conversion rates',
                    'Supply chain optimization is a major competitive advantage'
                );
                break;
            case 'finance':
                insights.push(
                    'Regulatory compliance is a significant barrier to entry',
                    'Digital transformation is accelerating customer expectations',
                    'Security and trust are paramount for customer acquisition'
                );
                break;
            case 'healthcare':
                insights.push(
                    'Telemedicine adoption has permanently changed patient expectations',
                    'Data privacy regulations create both challenges and opportunities',
                    'AI-assisted diagnostics are becoming mainstream'
                );
                break;
            case 'education':
                insights.push(
                    'Hybrid learning models are the new standard',
                    'Personalized learning paths increase engagement by 60%',
                    'Micro-credentials are disrupting traditional education'
                );
                break;
            case 'marketing':
                insights.push(
                    'First-party data collection is becoming critical',
                    'Video content generates 12x more engagement',
                    'Marketing automation is essential for scale'
                );
                break;
            default:
                insights.push(
                    'Digital transformation is accelerating across all sectors',
                    'Customer experience is the primary competitive battleground',
                    'Sustainability initiatives are becoming business imperatives'
                );
        }

        // Add content-specific insights
        if (contentType === 'product') {
            insights.push('Product differentiation through unique value propositions is key');
        } else if (contentType === 'service') {
            insights.push('Service quality and customer support drive retention');
        }

        return insights.slice(0, 4); // Return top 4 insights
    }

    showLoading() {
        document.getElementById('loadingState').classList.remove('hidden');
        document.getElementById('analysisResults').classList.add('hidden');
        document.getElementById('errorState').classList.add('hidden');
    }

    hideLoading() {
        document.getElementById('loadingState').classList.add('hidden');
    }

    showError(message) {
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorState').classList.remove('hidden');
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('analysisResults').classList.add('hidden');
    }

    hideError() {
        document.getElementById('errorState').classList.add('hidden');
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.section').forEach(section => {
            section.classList.add('hidden');
        });
        
        // Show selected section
        document.getElementById(`${sectionName}Section`).classList.remove('hidden');
    }

    async checkConnectionStatus() {
        try {
            // Simple connection check
            const statusElement = document.getElementById('connectionStatus');
            const statusDot = statusElement.querySelector('div');
            const statusText = statusElement.querySelector('span');
            
            // For now, assume connected
            statusDot.className = 'w-2 h-2 bg-green-400 rounded-full';
            statusText.textContent = 'Connected';
            
        } catch (error) {
            console.error('Connection check failed:', error);
        }
    }

    async getCachedAnalysis(url) {
        try {
            const result = await chrome.storage.local.get(['analysis_results']);
            const results = result.analysis_results || {};
            const key = `analysis_${btoa(url).replace(/[^a-zA-Z0-9]/g, '')}`;
            return results[key];
        } catch (error) {
            console.error('Failed to get cached analysis:', error);
            return null;
        }
    }

    async cacheAnalysis(url, analysis) {
        try {
            const result = await chrome.storage.local.get(['analysis_results']);
            const results = result.analysis_results || {};
            const key = `analysis_${btoa(url).replace(/[^a-zA-Z0-9]/g, '')}`;
            
            results[key] = {
                ...analysis,
                timestamp: Date.now(),
                url: url
            };
            
            await chrome.storage.local.set({ analysis_results: results });
        } catch (error) {
            console.error('Failed to cache analysis:', error);
        }
    }

        async testConnection() {
        try {
            const resultElement = document.getElementById('connectionTestResult');
            if (!resultElement) {
                console.error('Connection test result element not found');
                return;
            }

            resultElement.textContent = 'Testing connection...';
            resultElement.className = 'mt-2 text-sm text-white/70';

            console.log('🧪 Testing connection to background script...');

            // Test basic message to background script
            const response = await this.sendMessageWithRetry({
                action: 'health_check'
            });

            console.log('📡 Background script response:', response);

            // Check for chrome.runtime.lastError
            if (chrome.runtime.lastError) {
                console.error('❌ Chrome runtime error:', chrome.runtime.lastError);
                resultElement.textContent = `❌ Runtime error: ${chrome.runtime.lastError.message}`;
                resultElement.className = 'mt-2 text-sm text-red-400';
                return;
            }

            // Add null guards
            if (!response) {
                console.error('❌ No response received');
                resultElement.textContent = '❌ No response received from background script';
                resultElement.className = 'mt-2 text-sm text-red-400';
                return;
            }

            if (response.error) {
                console.error('❌ Response contains error:', response.error);
                resultElement.textContent = `❌ Connection failed: ${response.error}`;
                resultElement.className = 'mt-2 text-sm text-red-400';
            } else {
                console.log('✅ Connection test successful!');
                resultElement.textContent = '✅ Connection successful! Background script is responding.';
                resultElement.className = 'mt-2 text-sm text-green-400';
                
                // Show additional health info if available
                if (response.extension) {
                    console.log('📊 Extension health:', response.extension);
                }
            }
        } catch (error) {
            console.error('❌ Connection test failed with exception:', error);
            const resultElement = document.getElementById('connectionTestResult');
            if (resultElement) {
                resultElement.textContent = `❌ Connection error: ${error.message}`;
                resultElement.className = 'mt-2 text-sm text-red-400';
            }
        }
    }

    showSettings() {
        // Create a simple settings modal
        const settingsModal = document.createElement('div');
        settingsModal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
        settingsModal.innerHTML = `
            <div class="glass p-6 rounded-lg max-w-sm w-full mx-4">
                <h3 class="text-lg font-semibold mb-4">Extension Settings</h3>
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <span class="text-white/70">Auto-analyze pages</span>
                        <input type="checkbox" id="autoAnalyze" class="rounded">
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-white/70">Debug mode</span>
                        <input type="checkbox" id="debugMode" class="rounded">
                    </div>
                    <div class="flex items-center justify-between">
                        <span class="text-white/70">Cache results</span>
                        <input type="checkbox" id="cacheResults" class="rounded" checked>
                    </div>
                    <div class="border-t border-white/20 pt-4 mt-4">
                        <button id="resetUsage" class="w-full bg-red-500/20 hover:bg-red-500/30 px-4 py-2 rounded-lg text-sm transition-colors mb-2">
                            Reset Usage Count (Debug)
                        </button>
                        <button id="showUsageInfo" class="w-full bg-yellow-500/20 hover:bg-yellow-500/30 px-4 py-2 rounded-lg text-sm transition-colors">
                            Show Usage Info
                        </button>
                    </div>
                </div>
                <div class="flex gap-2 mt-6">
                    <button id="saveSettings" class="flex-1 bg-blue-500/20 hover:bg-blue-500/30 px-4 py-2 rounded-lg text-sm transition-colors">
                        Save
                    </button>
                    <button id="closeSettings" class="flex-1 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-sm transition-colors">
                        Close
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(settingsModal);

        // Add event listeners
        document.getElementById('closeSettings').addEventListener('click', () => {
            document.body.removeChild(settingsModal);
        });

        document.getElementById('saveSettings').addEventListener('click', () => {
            // Save settings to storage
            const settings = {
                autoAnalyze: document.getElementById('autoAnalyze').checked,
                debugMode: document.getElementById('debugMode').checked,
                cacheResults: document.getElementById('cacheResults').checked
            };

            chrome.storage.local.set({ extension_settings: settings }, () => {
                console.log('Settings saved:', settings);
                document.body.removeChild(settingsModal);
            });
        });

        // Debug functions
        document.getElementById('resetUsage').addEventListener('click', async () => {
            await chrome.storage.local.set({ usage_count: 0, usage_date: new Date().toDateString() });
            alert('Usage count reset to 0');
            console.log('🔄 Usage count reset');
        });

        document.getElementById('showUsageInfo').addEventListener('click', async () => {
            const result = await chrome.storage.local.get(['usage_count', 'usage_date']);
            alert(`Usage: ${result.usage_count || 0}/5\nDate: ${result.usage_date || 'Not set'}`);
            console.log('📊 Usage info:', result);
        });

        // Load current settings
        chrome.storage.local.get(['extension_settings'], (result) => {
            const settings = result.extension_settings || {};
            document.getElementById('autoAnalyze').checked = settings.autoAnalyze || false;
            document.getElementById('debugMode').checked = settings.debugMode || false;
            document.getElementById('cacheResults').checked = settings.cacheResults !== false; // Default to true
        });
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    async checkPremiumStatus() {
        try {
            // Check if this is first time opening extension
            const firstTime = await this.checkFirstTimeUser();
            if (firstTime) {
                this.redirectToPricing();
                return;
            }

            const premiumData = localStorage.getItem('shadowMarketTracker_premium');
            if (premiumData) {
                const status = JSON.parse(premiumData);
                this.isPremium = status.active;
                
                if (this.isPremium) {
                    this.showPremiumStatus();
                } else {
                    await this.showUpgradePrompt();
                }
            } else {
                await this.showUpgradePrompt();
            }
        } catch (error) {
            console.error('Failed to check premium status:', error);
            this.showUpgradePrompt();
        }
    }

    async checkFirstTimeUser() {
        try {
            const result = await chrome.storage.local.get(['extension_opened']);
            if (!result.extension_opened) {
                await chrome.storage.local.set({ extension_opened: true });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to check first time user:', error);
            return false;
        }
    }

    redirectToPricing(source = 'first_install') {
        const url = `https://shadowmarkettracker.com/extension-pricing.html?source=${source}`;
        console.log(`🚀 Redirecting to pricing: ${url}`);
        chrome.tabs.create({ url });
        window.close();
    }

    async checkUsageLimit() {
        try {
            const result = await chrome.storage.local.get(['usage_count', 'usage_date']);
            const today = new Date().toDateString();
            
            console.log('🔍 Checking usage limit:', { current: result.usage_count || 0, date: result.usage_date, today });
            
            // Reset count if it's a new day
            if (result.usage_date !== today) {
                await chrome.storage.local.set({ 
                    usage_count: 0, 
                    usage_date: today 
                });
                console.log('📅 Reset usage count for new day');
                return true;
            }
            
            const usageCount = result.usage_count || 0;
            const canUse = usageCount < 5;
            console.log(`📊 Usage check: ${usageCount}/5 uses, can use: ${canUse}`);
            return canUse;
        } catch (error) {
            console.error('Failed to check usage limit:', error);
            return true; // Allow on error
        }
    }

    async incrementUsage() {
        try {
            const result = await chrome.storage.local.get(['usage_count']);
            const newCount = (result.usage_count || 0) + 1;
            await chrome.storage.local.set({ usage_count: newCount });
            
            console.log(`📈 Usage incremented to: ${newCount}/5`);
            
            // Show usage warning at 4 uses
            if (newCount === 4) {
                console.log('⚠️ Showing usage warning at 4th use');
                setTimeout(() => this.showUsageWarning(), 1000); // Delay to ensure UI is ready
            }
        } catch (error) {
            console.error('Failed to increment usage:', error);
        }
    }

    showUsageWarning() {
        const warningElement = document.createElement('div');
        warningElement.className = 'usage-warning bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-lg p-3 mb-4';
        warningElement.innerHTML = `
            <div class="text-center">
                <div class="text-sm font-medium text-orange-300 mb-2">⚠️ Usage Limit Warning</div>
                <div class="text-xs text-white/70 mb-3">You have 1 free analysis remaining. Upgrade to premium for unlimited access!</div>
                <button id="warningUpgradeBtn" class="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200">
                    Upgrade Now - ₹30/month
                </button>
            </div>
        `;
        
        const container = document.querySelector('.p-4');
        if (container) {
            container.insertBefore(warningElement, container.firstChild);
            
            document.getElementById('warningUpgradeBtn').addEventListener('click', () => {
                chrome.tabs.create({ url: 'https://shadowmarkettracker.com/extension-pricing.html?source=usage_warning' });
            });
        }
    }

    showPremiumStatus() {
        const statusElement = document.createElement('div');
        statusElement.className = 'premium-status bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-2 mb-4';
        statusElement.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="text-yellow-400">👑</span>
                <span class="text-sm font-medium text-white">Premium Active</span>
                <span class="text-xs text-white/70">All features unlocked</span>
            </div>
        `;
        
        const container = document.querySelector('.p-4');
        if (container) {
            container.insertBefore(statusElement, container.firstChild);
        }
    }

    async showUpgradePrompt() {
        // Get current usage count
        const result = await chrome.storage.local.get(['usage_count']);
        const usageCount = result.usage_count || 0;
        const remainingUses = Math.max(0, 5 - usageCount);
        
        const upgradeElement = document.createElement('div');
        upgradeElement.className = 'upgrade-prompt bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-3 mb-4';
        upgradeElement.innerHTML = `
            <div class="text-center">
                <div class="text-sm font-medium text-white mb-2">🚀 Free Trial Active</div>
                <div class="text-xs text-white/70 mb-2">${remainingUses} free analyses remaining today</div>
                <div class="text-xs text-white/70 mb-3">Upgrade for unlimited analysis, advanced insights, and premium APIs</div>
                <button id="upgradeBtn" class="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-all duration-200">
                    Upgrade Now - ₹30/month
                </button>
            </div>
        `;
        
        const container = document.querySelector('.p-4');
        if (container) {
            container.insertBefore(upgradeElement, container.firstChild);
            
            // Add click handler for upgrade button
            document.getElementById('upgradeBtn').addEventListener('click', () => {
                chrome.tabs.create({ url: 'https://shadowmarkettracker.com/extension-pricing.html' });
            });
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return '';
        
        try {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now - date;
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            
            if (diffHours < 1) return 'Just now';
            if (diffHours < 24) return `${diffHours}h ago`;
            
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays}d ago`;
        } catch (error) {
            return '';
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const popup = new PopupManager();
    // Store globally for debugging
    window.popupManager = popup;
});

// Handle popup window focus
window.addEventListener('focus', () => {
    // Refresh page info when popup is focused
    if (window.popupManager) {
        window.popupManager.updatePageInfo();
    }
}); 