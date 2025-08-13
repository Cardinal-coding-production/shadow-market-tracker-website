// Checkout Functionality
class Checkout {
    constructor() {
        this.checkoutData = JSON.parse(localStorage.getItem('checkoutData'));
        this.init();
    }

    init() {
        if (!this.checkoutData || !this.checkoutData.items || this.checkoutData.items.length === 0) {
            this.redirectToProducts();
            return;
        }

        this.renderOrderSummary();
        this.bindEvents();
        this.setupFormValidation();
    }

    redirectToProducts() {
        alert('No items in cart. Redirecting to products page.');
        window.location.href = 'products.html';
    }

    renderOrderSummary() {
        const items = this.checkoutData.items;
        const subtotal = this.checkoutData.total;
        const gst = Math.round(subtotal * 0.18);
        const total = subtotal + gst;

        // Render main order items
        const checkoutItems = document.getElementById('checkoutItems');
        if (checkoutItems) {
            checkoutItems.innerHTML = items.map(item => `
                <div class="order-item">
                    <div class="item-details">
                        <h4>${item.title}</h4>
                        <p class="item-meta">Quantity: ${item.quantity}</p>
                    </div>
                    <div class="item-price">₹${(item.price * item.quantity).toLocaleString()}</div>
                </div>
            `).join('');
        }

        // Render sidebar items
        const sidebarItems = document.getElementById('sidebarItems');
        if (sidebarItems) {
            sidebarItems.innerHTML = items.map(item => `
                <div class="summary-item">
                    <span>${item.title} (${item.quantity}x)</span>
                    <span>₹${(item.price * item.quantity).toLocaleString()}</span>
                </div>
            `).join('');
        }

        // Update totals
        this.updateTotals(subtotal, gst, total);
    }

    updateTotals(subtotal, gst, total) {
        const elements = [
            { id: 'subtotal', value: subtotal },
            { id: 'gst', value: gst },
            { id: 'finalTotal', value: total },
            { id: 'sidebarSubtotal', value: subtotal },
            { id: 'sidebarGst', value: gst },
            { id: 'sidebarTotal', value: total }
        ];

        elements.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value.toLocaleString();
            }
        });
    }

    bindEvents() {
        const checkoutForm = document.getElementById('checkoutForm');
        if (checkoutForm) {
            checkoutForm.addEventListener('submit', (e) => this.handleSubmit(e));
        }

        // Auto-fill country-specific fields
        const countrySelect = document.getElementById('country');
        if (countrySelect) {
            countrySelect.addEventListener('change', (e) => this.handleCountryChange(e));
        }
    }

    setupFormValidation() {
        const requiredFields = document.querySelectorAll('input[required], select[required]');
        
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => this.validateField(field));
            field.addEventListener('input', () => this.clearFieldError(field));
        });

        // Email validation
        const emailField = document.getElementById('email');
        if (emailField) {
            emailField.addEventListener('blur', () => this.validateEmail(emailField));
        }

        // Phone validation
        const phoneField = document.getElementById('phone');
        if (phoneField) {
            phoneField.addEventListener('input', (e) => this.formatPhone(e));
        }

        // PIN code validation
        const pincodeField = document.getElementById('pincode');
        if (pincodeField) {
            pincodeField.addEventListener('input', (e) => this.validatePincode(e));
        }
    }

    validateField(field) {
        const value = field.value.trim();
        const isValid = value.length > 0;

        if (!isValid) {
            this.showFieldError(field, 'This field is required');
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    validateEmail(field) {
        const email = field.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const isValid = emailRegex.test(email);

        if (!isValid && email.length > 0) {
            this.showFieldError(field, 'Please enter a valid email address');
        } else if (email.length === 0) {
            this.showFieldError(field, 'Email is required');
        } else {
            this.clearFieldError(field);
        }

        return isValid;
    }

    formatPhone(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 10) {
            value = value.substring(0, 10);
        }
        e.target.value = value;
    }

    validatePincode(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 6) {
            value = value.substring(0, 6);
        }
        e.target.value = value;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        
        field.classList.add('error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(field) {
        field.classList.remove('error');
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    handleCountryChange(e) {
        const country = e.target.value;
        const pincodeField = document.getElementById('pincode');
        const pincodeLabel = document.querySelector('label[for="pincode"]');

        if (country === 'IN') {
            if (pincodeLabel) pincodeLabel.textContent = 'PIN Code *';
            if (pincodeField) pincodeField.placeholder = '110001';
        } else if (country === 'US') {
            if (pincodeLabel) pincodeLabel.textContent = 'ZIP Code *';
            if (pincodeField) pincodeField.placeholder = '10001';
        } else {
            if (pincodeLabel) pincodeLabel.textContent = 'Postal Code *';
            if (pincodeField) pincodeField.placeholder = '';
        }
    }

    validateForm() {
        const requiredFields = document.querySelectorAll('input[required], select[required]');
        const agreeTerms = document.getElementById('agreeTerms');
        let isValid = true;

        // Validate required fields
        requiredFields.forEach(field => {
            if (!this.validateField(field)) {
                isValid = false;
            }
        });

        // Validate email specifically
        const emailField = document.getElementById('email');
        if (emailField && !this.validateEmail(emailField)) {
            isValid = false;
        }

        // Check terms agreement
        if (agreeTerms && !agreeTerms.checked) {
            alert('Please agree to the Terms of Service and Privacy Policy');
            isValid = false;
        }

        return isValid;
    }

    async handleSubmit(e) {
        e.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        const submitButton = document.getElementById('placeOrderBtn');
        const originalText = submitButton.textContent;
        
        try {
            // Show loading state
            submitButton.disabled = true;
            submitButton.innerHTML = '🔄 Processing Order...';

            // Collect form data
            const formData = new FormData(e.target);
            const orderData = {
                customer: Object.fromEntries(formData),
                items: this.checkoutData.items,
                totals: {
                    subtotal: this.checkoutData.total,
                    gst: Math.round(this.checkoutData.total * 0.18),
                    total: this.checkoutData.total + Math.round(this.checkoutData.total * 0.18)
                },
                paymentMethod: formData.get('paymentMethod'),
                timestamp: Date.now()
            };

            // Simulate payment processing
            await this.processPayment(orderData);

            // Success - redirect to confirmation
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Order processing error:', error);
            alert('There was an error processing your order. Please try again.');
        } finally {
            // Reset button
            submitButton.disabled = false;
            submitButton.innerHTML = originalText;
        }
    }

    async processPayment(orderData) {
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 2000));

        // In a real implementation, this would integrate with PayU API
        console.log('Processing payment with PayU:', orderData);

        // Save order data
        localStorage.setItem('lastOrder', JSON.stringify(orderData));
        
        // Clear cart
        localStorage.removeItem('cart');
        localStorage.removeItem('checkoutData');

        return { success: true, transactionId: 'TXN' + Date.now() };
    }

    showSuccessMessage() {
        // Create success overlay
        const successOverlay = document.createElement('div');
        successOverlay.className = 'success-overlay';
        successOverlay.innerHTML = `
            <div class="success-modal">
                <div class="success-icon">✅</div>
                <h2>Order Placed Successfully!</h2>
                <p>Thank you for your purchase. You will receive a confirmation email shortly.</p>
                <p>Your subscription will be activated within 24 hours.</p>
                <button class="btn btn-primary" onclick="window.location.href='index.html'">
                    Return to Home
                </button>
            </div>
        `;

        document.body.appendChild(successOverlay);

        // Auto redirect after 5 seconds
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 5000);
    }
}

// Initialize checkout when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new Checkout();
});
