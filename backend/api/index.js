// Vercel Serverless Function Entry Point
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const express = require('express');
const cors = require('cors');
const paymentRoutes = require('../routes/paymentRoutes');

const app = express();

// CORS configuration - Allow all origins for now
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  credentials: false
}));

// Handle preflight requests
app.options('*', cors());

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
