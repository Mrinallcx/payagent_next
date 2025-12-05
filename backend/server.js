// Load environment variables FIRST before anything else
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

// Verify environment variables are loaded
console.log('✅ Environment loaded:');
console.log('   ETH_RPC_URL:', process.env.NEXT_PUBLIC_ETH_RPC_URL ? '✓ Set' : '✗ Missing');
console.log('   USDC_ADDRESS:', process.env.NEXT_PUBLIC_USDC_ADDRESS ? '✓ Set' : '✗ Missing');
console.log('   USDT_ADDRESS:', process.env.NEXT_PUBLIC_USDT_ADDRESS ? '✓ Set' : '✗ Missing');

// Now load other modules
const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./routes/paymentRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: [
      'http://localhost:8080',
      'http://localhost:5173',
      'https://payme-your-simple-payment-hub.vercel.app'
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

// Routes
app.use('/api', paymentRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
