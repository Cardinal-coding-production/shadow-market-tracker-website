// Simple API endpoint for Vercel deployment
module.exports = function handler(req, res) {
  // Check if Razorpay environment variables are configured
  const razorpayConfigured = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  res.status(200).json({
    message: 'Shadow Market Tracker API is running',
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
