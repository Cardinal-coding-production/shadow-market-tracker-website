/**
 * Dashboard JavaScript for Shadow Market Tracker AI Bot Platform
 */

document.addEventListener('DOMContentLoaded', function() {
    // Initialize dashboard
    initializeDashboard();
    
    // Setup event listeners
    setupEventListeners();
    
    // Load initial data
    loadDashboardData();
});

function initializeDashboard() {
    console.log('Shadow Market Tracker Dashboard initialized');
    
    // Add loading states
    addLoadingStates();
    
    // Initialize tooltips
    initializeTooltips();
    
    // Setup responsive navigation
    setupResponsiveNav();
}

function setupEventListeners() {
    // User menu dropdown
    const userAvatar = document.querySelector('.user-avatar');
    const userDropdown = document.querySelector('.user-dropdown');
    
    if (userAvatar && userDropdown) {
        userAvatar.addEventListener('click', function(e) {
            e.stopPropagation();
            userDropdown.style.display = userDropdown.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function() {
            userDropdown.style.display = 'none';
        });
    }
    
    // Bot action buttons
    const botActionButtons = document.querySelectorAll('.btn-icon');
    botActionButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const action = this.getAttribute('title');
            handleBotAction(action, this);
        });
    });
    
    // Alert action buttons
    const alertButtons = document.querySelectorAll('.alert-item .btn');
    alertButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            const alertItem = this.closest('.alert-item');
            handleAlertAction(alertItem, this.textContent.trim());
        });
    });
    
    // Navigation items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            if (this.getAttribute('href') === '#') {
                e.preventDefault();
                setActiveNavItem(this);
                loadSection(this.textContent.trim().toLowerCase());
            }
        });
    });
}

function addLoadingStates() {
    // Add loading animation to stat cards
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
        card.classList.add('loading');
        setTimeout(() => {
            card.classList.remove('loading');
        }, 1000 + Math.random() * 1000);
    });
}

function initializeTooltips() {
    // Simple tooltip implementation
    const tooltipElements = document.querySelectorAll('[title]');
    tooltipElements.forEach(element => {
        element.addEventListener('mouseenter', function() {
            showTooltip(this, this.getAttribute('title'));
        });
        
        element.addEventListener('mouseleave', function() {
            hideTooltip();
        });
    });
}

function setupResponsiveNav() {
    // Handle mobile navigation if needed
    const sidebar = document.querySelector('.dashboard-sidebar');
    const main = document.querySelector('.dashboard-main');
    
    if (window.innerWidth <= 768) {
        // Mobile-specific setup
        console.log('Mobile layout detected');
    }
}

function loadDashboardData() {
    // Simulate loading dashboard data
    setTimeout(() => {
        updateStats();
        updateBotStatus();
        updateRecentAlerts();
    }, 500);
}

function updateStats() {
    // Animate stat numbers
    const statNumbers = document.querySelectorAll('.stat-number');
    statNumbers.forEach(stat => {
        const finalValue = stat.textContent;
        if (!isNaN(finalValue)) {
            animateNumber(stat, 0, parseInt(finalValue), 1000);
        }
    });
}

function animateNumber(element, start, end, duration) {
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const current = Math.floor(start + (end - start) * progress);
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateBotStatus() {
    // Simulate real-time bot status updates
    const botStatusElements = document.querySelectorAll('.bot-status');
    botStatusElements.forEach(status => {
        // Add pulse animation for running bots
        if (status.textContent.toLowerCase().includes('running')) {
            status.style.animation = 'pulse 2s infinite';
        }
    });
}

function updateRecentAlerts() {
    // Add timestamps and animations to alerts
    const alertTimes = document.querySelectorAll('.alert-time');
    alertTimes.forEach(time => {
        // Update relative time
        updateRelativeTime(time);
    });
}

function updateRelativeTime(element) {
    const timeText = element.textContent;
    // Simple relative time update (in a real app, this would use actual timestamps)
    element.style.opacity = '0.7';
}

function handleBotAction(action, button) {
    console.log(`Bot action: ${action}`);
    
    // Add visual feedback
    button.style.transform = 'scale(0.95)';
    setTimeout(() => {
        button.style.transform = 'scale(1)';
    }, 150);
    
    // Simulate action
    switch(action.toLowerCase()) {
        case 'configure':
            showNotification('Bot configuration panel would open here', 'info');
            break;
        case 'view alerts':
            showNotification('Navigating to alerts for this bot', 'info');
            break;
        case 'view opportunities':
            showNotification('Loading market opportunities', 'info');
            break;
        case 'view tenders':
            showNotification('Loading relevant tenders', 'info');
            break;
        default:
            showNotification(`${action} action triggered`, 'info');
    }
}

function handleAlertAction(alertItem, action) {
    console.log(`Alert action: ${action}`);
    
    // Add visual feedback
    alertItem.style.opacity = '0.7';
    setTimeout(() => {
        alertItem.style.opacity = '1';
    }, 300);
    
    switch(action.toLowerCase()) {
        case 'view details':
            showNotification('Opening alert details', 'info');
            break;
        case 'explore':
            showNotification('Opening opportunity analysis', 'info');
            break;
        case 'review':
            showNotification('Opening tender details', 'info');
            break;
        default:
            showNotification(`${action} action completed`, 'success');
    }
}

function setActiveNavItem(clickedItem) {
    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Add active class to clicked item
    clickedItem.classList.add('active');
}

function loadSection(sectionName) {
    console.log(`Loading section: ${sectionName}`);
    
    // In a real application, this would load different dashboard sections
    showNotification(`Loading ${sectionName} section`, 'info');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '8px',
        color: 'white',
        fontWeight: '500',
        zIndex: '1000',
        transform: 'translateX(100%)',
        transition: 'transform 0.3s ease',
        maxWidth: '300px'
    });
    
    // Set background color based on type
    const colors = {
        info: '#3B82F6',
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444'
    };
    notification.style.backgroundColor = colors[type] || colors.info;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after delay
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

function showTooltip(element, text) {
    // Simple tooltip implementation
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = text;
    
    Object.assign(tooltip.style, {
        position: 'absolute',
        background: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '4px',
        fontSize: '12px',
        whiteSpace: 'nowrap',
        zIndex: '1001',
        pointerEvents: 'none'
    });
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = element.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';
}

function hideTooltip() {
    const tooltip = document.querySelector('.tooltip');
    if (tooltip) {
        tooltip.remove();
    }
}

// Add CSS for loading animation
const style = document.createElement('style');
style.textContent = `
    .loading {
        opacity: 0.6;
        animation: pulse 1.5s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
    }
    
    .notification {
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
`;
document.head.appendChild(style);
