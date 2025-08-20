// Enhanced content script for Shadow Market Tracker
// Extracts page features and communicates with backend

class PageFeatureExtractor {
    constructor() {
        this.backendUrl = 'http://localhost:8000/api/v1';
        this.extensionToken = null;
        this.init();
    }

    async init() {
        try {
            // Get extension token from storage
            const result = await chrome.storage.local.get(['extension_token']);
            this.extensionToken = result.extension_token;

            if (!this.extensionToken) {
                console.warn('Extension token not found. Some features may be limited.');
            }

            // Listen for messages from popup and background script
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                console.log('Content script received message:', request.action);
                
                if (request.action === 'analyze_page') {
                    this.extractAndAnalyze().then(sendResponse);
                    return true;
                }

                if (request.action === 'extract_content') {
                    try {
                        const pageContent = this.extractCompactContent();
                        console.log('Content extracted successfully:', pageContent);
                        sendResponse(pageContent);
                    } catch (error) {
                        console.error('Content extraction failed:', error);
                        sendResponse({ error: error.message });
                    }
                    return true;
                }
                
                // Handle unknown actions
                console.warn('Unknown action received:', request.action);
                sendResponse({ error: 'Unknown action: ' + request.action });
                return true;
            });

        } catch (error) {
            console.error('Content script initialization failed:', error);
        }
    }

    async extractAndAnalyze() {
        try {
            console.log('Starting page analysis...');
            const features = this.extractPageFeatures();
            
            if (this.extensionToken) {
                const analysis = await this.sendToBackend(features);
                console.log('Analysis completed:', analysis);
                return analysis;
            } else {
                console.log('No extension token, returning local features');
                return features;
            }
        } catch (error) {
            console.error('Page analysis failed:', error);
            return { error: error.message };
        }
    }

    extractPageFeatures() {
        try {
            const features = {
                url: window.location.href,
                title: this.extractTitle(),
                meta_description: this.extractMetaDescription(),
                headings: this.extractHeadings(),
                images: this.extractImages(),
                links: this.extractLinks(),
                text_content: this.extractVisibleText(),
                business_data: this.extractBusinessData(),
                market_intelligence: this.extractMarketIntelligence(),
                timestamp: new Date().toISOString()
            };
            return features;
        } catch (error) {
            console.error('Feature extraction failed:', error);
            return { error: error.message };
        }
    }

    extractTitle() {
        try {
            return document?.title || 'No title found';
        } catch (error) {
            return 'Title extraction failed';
        }
    }

    extractMetaDescription() {
        try {
            const metaDesc = document?.querySelector('meta[name="description"]');
            return metaDesc ? metaDesc.getAttribute('content') : 'No description found';
        } catch (error) {
            return 'Meta description extraction failed';
        }
    }

    extractHeadings() {
        try {
            const headings = [];
            const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
            
            headingElements.forEach((heading, index) => {
                if (index < 10) {
                    headings.push({
                        level: heading.tagName.toLowerCase(),
                        text: heading.textContent.trim()
                    });
                }
            });
            
            return headings;
        } catch (error) {
            return [];
        }
    }

    extractImages() {
        try {
            const images = [];
            const imgElements = document.querySelectorAll('img[src]');
            
            imgElements.forEach((img, index) => {
                if (index < 10) {
                    images.push({
                        src: img.src,
                        alt: img.alt || 'No alt text',
                        title: img.title || 'No title'
                    });
                }
            });
            
            return images;
        } catch (error) {
            return [];
        }
    }

    extractLinks() {
        try {
            const links = [];
            const linkElements = document.querySelectorAll('a[href]');
            
            linkElements.forEach((link, index) => {
                if (index < 20) {
                    links.push({
                        text: link.textContent.trim(),
                        href: link.href,
                        title: link.title || 'No title'
                    });
                }
            });
            
            return links;
        } catch (error) {
            return [];
        }
    }

    extractVisibleText() {
        try {
            // Don't remove elements, just query them safely
            const contentSelectors = [
                'main', 'article', '.content', '.post', '.entry', '#content', '#main', '.main-content'
            ];

            let mainText = '';

            for (const selector of contentSelectors) {
                const element = document?.querySelector(selector);
                if (element) {
                    mainText += element.textContent + ' ';
                }
            }

            if (!mainText.trim() && document?.body) {
                mainText = document.body.textContent || '';
            }

            return this.cleanText(mainText).substring(0, 5000);
        } catch (error) {
            return 'Text extraction failed';
        }
    }

    extractBusinessData() {
        try {
            return {
                company_name: this.extractCompanyName(),
                industry: this.extractIndustry(),
                products: this.extractProducts(),
                contact_info: this.extractContactInfo()
            };
        } catch (error) {
            return { error: 'Business data extraction failed' };
        }
    }

    extractCompanyName() {
        try {
            const selectors = [
                'meta[property="og:site_name"]',
                'meta[name="application-name"]',
                '.company-name',
                '.brand',
                'h1',
                'title'
            ];
            
            for (const selector of selectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const content = element.getAttribute('content') || element.textContent;
                    if (content && content.trim()) {
                        return content.trim();
                    }
                }
            }
            
            return 'Company name not found';
        } catch (error) {
            return 'Company name extraction failed';
        }
    }

    extractIndustry() {
        try {
            const industryKeywords = [
                'technology', 'healthcare', 'finance', 'retail', 'manufacturing',
                'education', 'real estate', 'transportation', 'energy', 'media'
            ];
            
            const pageText = document.body.textContent.toLowerCase();
            
            for (const keyword of industryKeywords) {
                if (pageText.includes(keyword)) {
                    return keyword.charAt(0).toUpperCase() + keyword.slice(1);
                }
            }
            
            return 'Industry not specified';
        } catch (error) {
            return 'Industry extraction failed';
        }
    }

    extractProducts() {
        try {
            const products = [];
            const productSelectors = [
                '.product', '.item', '.service', '[data-product]',
                '[class*="product"]', '[class*="service"]'
            ];
            
            productSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach((element, index) => {
                    if (index < 5) {
                        const text = element.textContent.trim();
                        if (text && text.length > 3) {
                            products.push(text);
                        }
                    }
                });
            });
            
            return products.length > 0 ? products : ['Products not specified'];
        } catch (error) {
            return ['Product extraction failed'];
        }
    }

    extractContactInfo() {
        try {
            return {
                email: this.extractEmail(),
                phone: this.extractPhone(),
                address: this.extractAddress()
            };
        } catch (error) {
            return { error: 'Contact info extraction failed' };
        }
    }

    extractEmail() {
        try {
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const pageText = document.body.textContent;
            const emails = pageText.match(emailRegex);
            return emails ? emails[0] : 'Email not found';
        } catch (error) {
            return 'Email extraction failed';
        }
    }

    extractPhone() {
        try {
            const phoneRegex = /(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
            const pageText = document.body.textContent;
            const phones = pageText.match(phoneRegex);
            return phones ? phones[0] : 'Phone not found';
        } catch (error) {
            return 'Phone extraction failed';
        }
    }

    extractAddress() {
        try {
            const addressSelectors = [
                '[class*="address"]', '[class*="location"]', '[itemtype*="PostalAddress"]',
                '.contact-info', '.location'
            ];
            
            for (const selector of addressSelectors) {
                const element = document.querySelector(selector);
                if (element) {
                    const text = element.textContent.trim();
                    if (text && text.length > 10) {
                        return text;
                    }
                }
            }
            
            return 'Address not found';
        } catch (error) {
            return 'Address extraction failed';
        }
    }

    extractMarketIntelligence() {
        try {
            return {
                competitors: this.extractCompetitors(),
                market_trends: this.extractMarketTrends(),
                opportunities: this.extractOpportunities()
            };
        } catch (error) {
            return { error: 'Market intelligence extraction failed' };
        }
    }

    extractCompetitors() {
        try {
            const competitorKeywords = ['competitor', 'competition', 'alternative', 'vs', 'versus'];
            const pageText = document.body.textContent.toLowerCase();
            const competitors = [];
            
            competitorKeywords.forEach(keyword => {
                if (pageText.includes(keyword)) {
                    competitors.push(keyword);
                }
            });
            
            return competitors.length > 0 ? competitors : ['Competitors not specified'];
        } catch (error) {
            return ['Competitor extraction failed'];
        }
    }

    extractMarketTrends() {
        try {
            const trendKeywords = ['trend', 'growth', 'increase', 'decrease', 'market', 'industry'];
            const pageText = document.body.textContent.toLowerCase();
            const trends = [];
            
            trendKeywords.forEach(keyword => {
                if (pageText.includes(keyword)) {
                    trends.push(keyword);
                }
            });
            
            return trends.length > 0 ? trends : ['Market trends not specified'];
        } catch (error) {
            return ['Market trend extraction failed'];
        }
    }

    extractOpportunities() {
        try {
            const opportunityKeywords = ['opportunity', 'potential', 'growth', 'expansion', 'new market'];
            const pageText = document.body.textContent.toLowerCase();
            const opportunities = [];
            
            opportunityKeywords.forEach(keyword => {
                if (pageText.includes(keyword)) {
                    opportunities.push(keyword);
                }
            });
            
            return opportunities.length > 0 ? opportunities : ['Opportunities not specified'];
        } catch (error) {
            return ['Opportunity extraction failed'];
        }
    }

    extractCompactContent() {
        try {
            return {
                url: window.location.href,
                title: this.extractTitle(),
                description: this.extractMetaDescription(),
                main_text: this.extractVisibleText().substring(0, 1000),
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return { error: error.message };
        }
    }

    cleanText(text) {
        try {
            return text
                .replace(/\s+/g, ' ')
                .replace(/[^\w\s.,!?-]/g, ' ')
                .trim();
        } catch (error) {
            return text || '';
        }
    }

    async sendToBackend(features) {
        try {
            if (!this.extensionToken) {
                throw new Error('No extension token available');
            }

            const response = await fetch(`${this.backendUrl}/analyze/page`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.extensionToken}`,
                    'X-Extension-Version': '1.0.0'
                },
                body: JSON.stringify({
                    ...features,
                    user_mode: 'growth'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Backend request failed:', error);
            return {
                error: error.message,
                features: features,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Initialize the feature extractor
const featureExtractor = new PageFeatureExtractor();
