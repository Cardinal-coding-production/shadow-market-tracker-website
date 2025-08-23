const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_live_R5bUcfPrk6LOKC',
  key_secret: process.env.RAZORPAY_KEY_SECRET || '60FxdU1hJh11gi2EuRDdfeAY'
});

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { action } = req.body;

    try {
      if (action === 'create_order') {
        // Create Razorpay order
        const order = await razorpay.orders.create({
          amount: 3000, // ₹30 in paise
          currency: 'INR',
          receipt: `receipt_${Date.now()}`,
          notes: {
            product: 'Shadow Market Tracker Premium',
            plan: 'monthly'
          }
        });

        return res.status(200).json({
          success: true,
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key: process.env.RAZORPAY_KEY_ID || 'rzp_live_R5bUcfPrk6LOKC'
        });

      } else if (action === 'verify_payment') {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify payment signature
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
          .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '60FxdU1hJh11gi2EuRDdfeAY')
          .update(body.toString())
          .digest('hex');

        if (expectedSignature === razorpay_signature) {
          // Payment verified successfully
          return res.status(200).json({
            success: true,
            message: 'Payment verified successfully',
            payment_id: razorpay_payment_id,
            order_id: razorpay_order_id
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'Payment verification failed'
          });
        }
      }

    } catch (error) {
      console.error('Payment API error:', error);
      return res.status(500).json({
        success: false,
        message: 'Payment processing failed',
        error: error.message
      });
    }
  }

  return res.status(405).json({ message: 'Method not allowed' });
}