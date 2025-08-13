// Shadow Market Tracker Landing Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    // Mobile Navigation Toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
            navToggle.classList.toggle('active');
        });
    }
    
    // Close mobile menu when clicking on links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            navMenu.classList.remove('active');
            navToggle.classList.remove('active');
        });
    });
    
    // Smooth scrolling for anchor links
    const anchorLinks = document.querySelectorAll('a[href^="#"]');
    anchorLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                const offsetTop = targetElement.offsetTop - 80; // Account for fixed navbar
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Navbar background on scroll
    const navbar = document.querySelector('.navbar');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.style.background = 'rgba(0, 0, 0, 0.95)';
        } else {
            navbar.style.background = 'rgba(0, 0, 0, 0.9)';
        }
    });
    
    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fade-in 0.6s ease-out forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    // Observe elements for animation
    const animateElements = document.querySelectorAll('.feature-card, .pricing-card, .contact-item');
    animateElements.forEach(el => {
        el.style.opacity = '0';
        observer.observe(el);
    });
    
    // Add glow effect to buttons on hover
    const buttons = document.querySelectorAll('.btn-primary');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', function() {
            this.style.animation = 'pulse-glow 1s ease-in-out infinite';
        });
        
        button.addEventListener('mouseleave', function() {
            this.style.animation = '';
        });
    });
    
    // Dynamic stats counter (optional enhancement)
    function animateCounter(element, target, duration = 2000) {
        const start = 0;
        const increment = target / (duration / 16);
        let current = start;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            if (target >= 1000) {
                element.textContent = (current / 1000).toFixed(1) + 'K+';
            } else {
                element.textContent = Math.floor(current) + '%';
            }
        }, 16);
    }
    
    // Animate stats when they come into view
    const statsObserver = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const statNumbers = entry.target.querySelectorAll('.stat-number');
                statNumbers.forEach((stat, index) => {
                    const targets = [10000, 500, 95]; // Corresponding to the stats
                    setTimeout(() => {
                        animateCounter(stat, targets[index], 1500);
                    }, index * 200);
                });
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });
    
    const heroStats = document.querySelector('.hero-stats');
    if (heroStats) {
        statsObserver.observe(heroStats);
    }
    
    // Add cyberpunk glitch effect to hero title (optional)
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) {
        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every interval
                heroTitle.style.textShadow = '0 0 20px #BB00FF, 2px 0 0 #FF0080, -2px 0 0 #00FFFF';
                setTimeout(() => {
                    heroTitle.style.textShadow = '0 0 10px rgba(187, 0, 255, 0.6)';
                }, 100);
            }
        }, 3000);
    }
    
    // Chrome Web Store link management
    const chromeStoreUrl = 'https://chrome.google.com/webstore/detail/shadow-market-tracker/'; // Will be updated with actual ID
    const isExtensionLive = false; // Set to true when extension is published

    // Handle extension download buttons
    const extensionButtons = document.querySelectorAll('#getExtensionBtn, #heroGetExtensionBtn');
    extensionButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            if (isExtensionLive) {
                window.open(chromeStoreUrl, '_blank');
            } else {
                // Show coming soon modal
                showComingSoonModal();
            }
        });
    });

    function showComingSoonModal() {
        const modal = document.createElement('div');
        modal.className = 'coming-soon-modal';
        modal.innerHTML = `
            <div class="modal-overlay">
                <div class="modal-content">
                    <h2>🚀 Extension Launching Soon!</h2>
                    <p>Shadow Market Tracker is currently being reviewed by the Chrome Web Store team.</p>
                    <p>We'll notify you as soon as it's available for download!</p>
                    <div class="modal-actions">
                        <button class="btn btn-primary" onclick="this.closest('.coming-soon-modal').remove()">
                            Got it!
                        </button>
                        <a href="products.html" class="btn btn-secondary">
                            View Pricing
                        </a>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (modal.parentNode) {
                modal.remove();
            }
        }, 5000);
    }

    // Console easter egg
    console.log(`
    🔍 Shadow Market Tracker
    ========================
    Cyberpunk Business Intelligence

    Extension Status: ${isExtensionLive ? 'LIVE' : 'LAUNCHING SOON'}
    Interested in the code? Check out our GitHub!
    Built with ❤️ and neon purple.
    `);
});
