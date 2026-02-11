// Load environment variables FIRST before anything else
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config(); // Also check .env

// Verify environment variables are loaded
console.log('Environment loaded:');
console.log('   ETH_RPC_URL:', process.env.NEXT_PUBLIC_ETH_RPC_URL ? 'Set' : 'Missing');
console.log('   USDC_ADDRESS:', process.env.NEXT_PUBLIC_USDC_ADDRESS ? 'Set' : 'Missing');
console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');
console.log('   XAI_API_KEY:', process.env.XAI_API_KEY ? 'Set' : 'Missing');
console.log('   TREASURY:', process.env.PLATFORM_TREASURY_WALLET ? 'Set' : 'Missing');

// Import the app from api/index.js (same routes for local and Vercel)
const app = require('./api/index');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`PayMe server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API base: http://localhost:${PORT}/api`);
});
