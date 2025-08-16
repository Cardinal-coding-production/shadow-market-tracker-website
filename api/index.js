// Unified API endpoint for Vercel deployment
const Razorpay = require('razorpay');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  try {
    if (req.method === 'GET' && !action) {
      // Default API status
      const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

      return res.status(200).json({
        message: 'Shadow Market Tracker API is running - FORCE UPDATE',
        platform: 'AI Bot Platform',
        bots: ['competitive_news', 'gap_finder', 'tender_rfp'],
        payment_gateway: {
          razorpay_configured: razorpayConfigured,
          key_id_present: !!process.env.RAZORPAY_KEY_ID,
          key_secret_present: !!process.env.RAZORPAY_KEY_SECRET,
          test_key_id: process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.substring(0, 8) + '...' : 'Not set'
        }
      });
    }

    if (req.method === 'GET' && action === 'test') {
      // Test endpoint
      return res.status(200).json({
        success: true,
        message: 'API is working correctly',
        timestamp: new Date().toISOString(),
        method: req.method,
        environment: {
          hasRazorpayKeyId: !!process.env.RAZORPAY_KEY_ID,
          hasRazorpayKeySecret: !!process.env.RAZORPAY_KEY_SECRET
        }
      });
    }

    if (req.method === 'POST' && action === 'create-order') {
      // Create Razorpay order
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        return res.status(500).json({
          success: false,
          error: 'Razorpay credentials not configured'
        });
      }

      const { amount, currency = 'INR', receipt, notes } = req.body;

      if (!amount) {
        return res.status(400).json({
          success: false,
          error: 'Amount is required'
        });
      }

      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });

      const options = {
        amount: parseInt(amount),
        currency: currency,
        receipt: receipt || `receipt_${Date.now()}`,
        notes: notes || {}
      };

      const order = await razorpay.orders.create(options);

      return res.status(200).json({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      });
    }

    if (req.method === 'POST' && action === 'verify-payment') {
      // Verify Razorpay payment
      if (!process.env.RAZORPAY_KEY_SECRET) {
        return res.status(500).json({
          success: false,
          error: 'Razorpay secret not configured'
        });
      }

      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: 'Missing required payment verification parameters'
        });
      }

      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest('hex');

      const isAuthentic = expectedSignature === razorpay_signature;

      if (isAuthentic) {
        return res.status(200).json({
          success: true,
          message: 'Payment verified successfully',
          payment_id: razorpay_payment_id,
          order_id: razorpay_order_id
        });
      } else {
        return res.status(400).json({
          success: false,
          error: 'Payment verification failed'
        });
      }
    }

    // Unknown endpoint
    return res.status(404).json({
      success: false,
      error: 'Endpoint not found'
    });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
};
