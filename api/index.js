// Simple API endpoint for Vercel deployment
export default function handler(req, res) {
  res.status(200).json({ 
    message: 'Shadow Market Tracker API is running',
    platform: 'AI Bot Platform',
    bots: ['competitive_news', 'gap_finder', 'tender_rfp']
  });
}
