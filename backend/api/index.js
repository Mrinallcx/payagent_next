// Minimal Vercel Serverless Function
const express = require('express');
const cors = require('cors');

const app = express();

// CORS
app.use(cors({ origin: '*' }));
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'PayMe API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Try to load routes
let routesLoaded = false;
let loadError = null;

try {
  // Check if supabase can be loaded
  const { supabase } = require('../lib/supabase');
  console.log('Supabase client:', supabase ? 'Created' : 'Null (no credentials)');
  
  // Load routes
  const paymentRoutes = require('../routes/paymentRoutes');
  app.use('/api', paymentRoutes);
  routesLoaded = true;
  console.log('✅ Routes loaded');
} catch (error) {
  loadError = error.message;
  console.error('❌ Error loading routes:', error);
}

// Debug endpoint
app.get('/debug', (req, res) => {
  res.json({
    routesLoaded,
    loadError,
    env: {
      SUPABASE_URL: process.env.SUPABASE_URL ? 'Set' : 'Missing',
      SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY ? 'Set' : 'Missing',
      NEXT_PUBLIC_ETH_RPC_URL: process.env.NEXT_PUBLIC_ETH_RPC_URL ? 'Set' : 'Missing',
    }
  });
});

// Fallback for API routes if not loaded
if (!routesLoaded) {
  app.use('/api', (req, res) => {
    res.status(500).json({ 
      error: 'API routes failed to load',
      details: loadError
    });
  });
}

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message });
});

module.exports = app;
