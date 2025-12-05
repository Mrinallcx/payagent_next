// Vercel Serverless Function Entry Point
try {
  require('dotenv').config();
} catch (e) {
  console.log('dotenv not available, using process.env directly');
}

const express = require('express');
const cors = require('cors');

const app = express();

// CORS configuration - Allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: false
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());

// Log environment status
console.log('🔧 Environment Check:');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✓ Set' : '✗ Missing');
console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing');
console.log('   ETH_RPC_URL:', process.env.NEXT_PUBLIC_ETH_RPC_URL ? '✓ Set' : '✗ Missing');

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'PayMe API is running',
    timestamp: new Date().toISOString(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      rpc: !!process.env.NEXT_PUBLIC_ETH_RPC_URL
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Load routes with error handling
try {
  const paymentRoutes = require('../routes/paymentRoutes');
  app.use('/api', paymentRoutes);
  console.log('✅ Routes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load routes:', error.message);
  
  // Fallback error route
  app.use('/api', (req, res) => {
    res.status(500).json({ 
      error: 'Routes failed to load', 
      details: error.message 
    });
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

// Export for Vercel
module.exports = app;
