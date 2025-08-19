export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    // Check subscription status
    const { paymentId } = req.query;
    
    if (!paymentId) {
      return res.status(400).json({ error: 'Payment ID required' });
    }

    // In production, check against database
    // For now, return active status for any valid payment ID
    return res.status(200).json({
      success: true,
      subscription: {
        active: true,
        plan: 'monthly',
        amount: 30,
        currency: 'INR',
        paymentId: paymentId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  }

  if (req.method === 'POST') {
    // Activate subscription after successful payment
    const { paymentId, orderId, plan = 'monthly' } = req.body;
    
    if (!paymentId || !orderId) {
      return res.status(400).json({ error: 'Payment ID and Order ID required' });
    }

    // In production, save to database
    return res.status(200).json({
      success: true,
      message: 'Subscription activated',
      subscription: {
        active: true,
        plan: plan,
        paymentId: paymentId,
        orderId: orderId,
        activatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}