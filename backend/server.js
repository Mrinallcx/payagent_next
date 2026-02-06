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
      'http://localhost:3001',
      'https://payme-your-simple-payment-hub.vercel.app'
    ],
    credentials: true
  }));
app.use(express.json());

// Optional: Moltbook identity verification (when MOLTBOOK_APP_KEY is set)
const MOLTBOOK_APP_KEY = process.env.MOLTBOOK_APP_KEY;
const MOLTBOOK_AUDIENCE = process.env.MOLTBOOK_VERIFY_AUDIENCE || 'payme';

async function verifyMoltbookIdentity(req, res, next) {
  if (!MOLTBOOK_APP_KEY) return next();
  const token = req.headers['x-moltbook-identity'];
  if (!token) {
    return res.status(401).json({ error: 'Missing X-Moltbook-Identity header' });
  }
  try {
    const response = await fetch('https://moltbook.com/api/v1/agents/verify-identity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Moltbook-App-Key': MOLTBOOK_APP_KEY
      },
      body: JSON.stringify({ token, audience: MOLTBOOK_AUDIENCE })
    });
    const data = await response.json();
    if (!data.valid || !data.agent) {
      return res.status(401).json({ error: data.error || 'Invalid Moltbook identity', hint: data.hint });
    }
    req.moltbookAgent = data.agent;
    next();
  } catch (err) {
    console.error('Moltbook verify error:', err);
    return res.status(500).json({ error: 'Identity verification failed' });
  }
}

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
