// Simple test endpoint to verify API is working
module.exports = function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const timestamp = new Date().toISOString();
  
  res.status(200).json({
    success: true,
    message: 'API is working correctly',
    timestamp: timestamp,
    method: req.method,
    environment: {
      hasRazorpayKeyId: !!process.env.RAZORPAY_KEY_ID,
      hasRazorpayKeySecret: !!process.env.RAZORPAY_KEY_SECRET,
      nodeVersion: process.version
    }
  });
};
