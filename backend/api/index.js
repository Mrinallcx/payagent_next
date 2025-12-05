// Vercel Serverless Function Entry Point
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const express = require('express');
const cors = require('cors');
const paymentRoutes = require('../routes/paymentRoutes');

const app = express();

// CORS configuration
app.use(cors({
  origin: [
    'http://localhost:8080',
    'http://localhost:5173',
    'http://localhost:3000',
    'https://payme-your-simple-payment-hub.vercel.app',
    /\.vercel\.app$/
  ],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
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

// API Routes
app.use('/api', paymentRoutes);

// Export for Vercel
module.exports = app;

