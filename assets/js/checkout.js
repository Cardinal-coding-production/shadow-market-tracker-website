// Checkout functionality
class CheckoutManager {
    constructor() {
        this.cart = this.getCartFromStorage();
        this.init();
    }

    init() {
        this.loadCartItems();
        this.calculateTotals();
        this.setupEventListeners();
        this.loadRazorpayScript();
    }

    getCartFromStorage() {
        const cart = localStorage.getItem('cart');
        return cart ? JSON.parse(cart) : [];
    }

    loadCartItems() {
        const checkoutItems = document.getElementById('checkoutItems');
        const sidebarItems = document.getElementById('sidebarItems');

        if (this.cart.length === 0) {
            checkoutItems.innerHTML = '<p>No items in cart. <a href="products.html">Browse products</a></p>';
            sidebarItems.innerHTML = '<p>No items</p>';
            return;
        }

        let itemsHTML = '';
        let sidebarHTML = '';

        this.cart.forEach(item => {
            itemsHTML += `
                <div class="order-item">
                    <div class="item-info">
                        <h4>${item.name}</h4>
                        <p>${item.description}</p>
                    </div>
                    <div class="item-price">₹${item.price.toLocaleString()}</div>
                </div>
            `;

            sidebarHTML += `
                <div class="summary-item">
                    <span>${item.name}</span>
                    <span>₹${item.price.toLocaleString()}</span>
                </div>
            `;
        });

        checkoutItems.innerHTML = itemsHTML;
        sidebarItems.innerHTML = sidebarHTML;
    }

    calculateTotals() {
        const subtotal = this.cart.reduce((sum, item) => sum + item.price, 0);
        const gst = Math.round(subtotal * 0.18);
        const total = subtotal + gst;

        // Update main checkout totals
        document.getElementById('subtotal').textContent = subtotal.toLocaleString();
        document.getElementById('gst').textContent = gst.toLocaleString();
        document.getElementById('finalTotal').textContent = total.toLocaleString();

        // Update sidebar totals
        document.getElementById('sidebarSubtotal').textContent = subtotal.toLocaleString();
        document.getElementById('sidebarGst').textContent = gst.toLocaleString();
        document.getElementById('sidebarTotal').textContent = total.toLocaleString();

        this.totalAmount = total;
    }

    setupEventListeners() {
        const form = document.getElementById('checkoutForm');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.processPayment();
        });
    }

    loadRazorpayScript() {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    async processPayment() {
        const form = document.getElementById('checkoutForm');
        const formData = new FormData(form);
        const agreeTerms = document.getElementById('agreeTerms').checked;

        if (!agreeTerms) {
            alert('Please agree to the Terms of Service to continue.');
            return;
        }

        const customerData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            company: formData.get('company'),
            address: formData.get('address'),
            city: formData.get('city'),
            state: formData.get('state'),
            pincode: formData.get('pincode'),
            country: formData.get('country')
        };

        try {
            // Show loading
            const btn = document.getElementById('placeOrderBtn');
            btn.innerHTML = '⏳ Processing...';
            btn.disabled = true;

            // Create order
            const orderResponse = await fetch('/api/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount: this.totalAmount,
                    currency: 'INR',
                    receipt: `receipt_${Date.now()}`,
                    notes: {
                        customer_name: `${customerData.firstName} ${customerData.lastName}`,
                        customer_email: customerData.email,
                        items: this.cart.map(item => item.name).join(', ')
                    }
                })
            });

            const orderData = await orderResponse.json();

            if (!orderData.success) {
                throw new Error(orderData.error || 'Failed to create order');
            }

            // Initialize Razorpay
            const options = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'Shadow Market Tracker',
                description: 'AI-powered business intelligence tools',
                order_id: orderData.order_id,
                prefill: {
                    name: `${customerData.firstName} ${customerData.lastName}`,
                    email: customerData.email,
                    contact: customerData.phone
                },
                theme: {
                    color: '#8B5CF6'
                },
                handler: (response) => {
                    this.verifyPayment(response, customerData);
                },
                modal: {
                    ondismiss: () => {
                        btn.innerHTML = '🔒 Place Order Securely';
                        btn.disabled = false;
                    }
                }
            };

            const rzp = new Razorpay(options);
            rzp.open();

        } catch (error) {
            console.error('Payment error:', error);
            alert('Payment failed: ' + error.message);

            // Reset button
            const btn = document.getElementById('placeOrderBtn');
            btn.innerHTML = '🔒 Place Order Securely';
            btn.disabled = false;
        }
    }

    async verifyPayment(paymentResponse, customerData) {
        try {
            const verifyResponse = await fetch('/api/verify', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    razorpay_order_id: paymentResponse.razorpay_order_id,
                    razorpay_payment_id: paymentResponse.razorpay_payment_id,
                    razorpay_signature: paymentResponse.razorpay_signature
                })
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
                // Clear cart
                localStorage.removeItem('cart');

                // Redirect to success page
                window.location.href = `payment-success.html?payment_id=${paymentResponse.razorpay_payment_id}&order_id=${paymentResponse.razorpay_order_id}`;
            } else {
                throw new Error('Payment verification failed');
            }

        } catch (error) {
            console.error('Verification error:', error);
            alert('Payment verification failed. Please contact support.');
        }
}

// Initialize checkout when page loads
document.addEventListener('DOMContentLoaded', () => {
    new CheckoutManager();
});
