export default function handler(req, res) {
  res.status(200).json({
    success: true,
    message: 'API is working correctly',
    timestamp: new Date().toISOString(),
    method: req.method
  });
}
