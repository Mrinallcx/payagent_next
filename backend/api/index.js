// Simple Vercel Handler
module.exports = (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Return health check
  res.json({
    status: 'ok',
    message: 'PayMe API is running',
    path: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
};
