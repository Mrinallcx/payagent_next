import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });
import cors from 'cors';
import { ethers } from 'ethers';

const PORT = process.env.AGENT_SERVICE_PORT || 3001;
const rawPaymeUrl = (process.env.PAYME_API_URL || 'http://localhost:3000').replace(/\/$/, '');
// Use 127.0.0.1 so fetch reaches PayMe backend (localhost can fail with IPv6 / ECONNREFUSED)
const PAYME_API_URL = rawPaymeUrl.replace(/localhost/, '127.0.0.1');
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL;
const USDC_ADDRESS = process.env.SEPOLIA_USDC_ADDRESS || '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87';
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)'
];

function getAgentKeys() {
  const k1 = process.env.AGENT_1_PRIVATE_KEY;
  const k2 = process.env.AGENT_2_PRIVATE_KEY;
  const agents = [];
  if (k1) {
    try {
      const w = new ethers.Wallet(k1);
      agents.push({ id: 1, wallet: w, address: w.address });
    } catch (e) {
      console.warn('Invalid AGENT_1_PRIVATE_KEY');
    }
  }
  if (k2) {
    try {
      const w = new ethers.Wallet(k2);
      agents.push({ id: 2, wallet: w, address: w.address });
    } catch (e) {
      console.warn('Invalid AGENT_2_PRIVATE_KEY');
    }
  }
  return agents;
}

const agents = getAgentKeys();

function maskAddress(addr) {
  if (!addr || addr.length < 10) return '0x****';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-payment', agents: agents.length });
});

app.get('/agents', (req, res) => {
  res.json({
    success: true,
    agents: agents.map((a) => ({ id: a.id, address: maskAddress(a.address) }))
  });
});

app.post('/create-link', async (req, res) => {
  try {
    const body = req.body || {};
    const { amount, receiver, receiverAgentId, description, expiresInDays, creatorWallet } = body;
    const amountStr = amount != null && amount !== '' ? String(amount).trim() : null;
    if (!amountStr || isNaN(Number(amountStr))) {
      return res.status(400).json({ error: 'Missing or invalid amount' });
    }
    let receiverAddress = receiver && String(receiver).trim() || null;
    const rid = Number(receiverAgentId);
    if (rid === 1 || rid === 2) {
      const agent = agents.find((a) => a.id === rid);
      if (!agent) {
        return res.status(400).json({
          error: `Agent ${rid} not configured. Add AGENT_${rid}_PRIVATE_KEY to agent-payment-service/.env and restart (see /health – agents should be 2).`
        });
      }
      receiverAddress = agent.address;
    }
    if (!receiverAddress) {
      return res.status(400).json({
        error: 'Missing receiver or receiverAgentId. Send receiverAgentId: 1 or 2, or receiver: "0x..."'
      });
    }
    let response;
    try {
      response = await fetch(`${PAYME_API_URL}/api/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'USDC',
          amount: amountStr,
          receiver: receiverAddress,
          description: description || '',
          network: 'sepolia',
          expiresInDays: expiresInDays ?? 7,
          creatorWallet: creatorWallet || null
        })
      });
    } catch (fetchErr) {
      const msg = fetchErr.cause?.code === 'ECONNREFUSED' || fetchErr.message?.includes('fetch failed')
        ? `PayMe backend unreachable at ${PAYME_API_URL}. Start it: cd backend && npm run dev`
        : fetchErr.message;
      console.error('Create link error:', msg);
      return res.status(503).json({ error: msg });
    }
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    res.json({
      success: true,
      linkId: data.request.id,
      link: data.request.link
    });
  } catch (err) {
    console.error('Create link error:', err);
    res.status(500).json({ error: err.message || 'Failed to create link' });
  }
});

app.post('/pay-link', async (req, res) => {
  try {
    const { linkId, agentId } = req.body;
    if (!linkId) {
      return res.status(400).json({ error: 'Missing linkId' });
    }
    const id = agentId === 2 ? 2 : 1;
    const agent = agents.find((a) => a.id === id);
    if (!agent) {
      return res.status(400).json({ error: `Agent ${id} not configured (missing or invalid private key)` });
    }

    const getRes = await fetch(`${PAYME_API_URL}/api/request/${linkId}`);
    const getData = await getRes.json();

    if (getRes.ok && getData.status === 'PAID') {
      return res.json({
        success: true,
        alreadyPaid: true,
        request: getData.request,
        message: 'This link is already paid'
      });
    }

    const payment = getData.payment || getData.request;
    if (!payment || !payment.amount || !payment.receiver) {
      return res.status(404).json({ error: 'Payment request not found or invalid' });
    }

    const token = (payment.token || 'USDC').toUpperCase();
    const network = (payment.network || 'sepolia').toLowerCase();
    if (token !== 'USDC' || !network.includes('sepolia')) {
      return res.status(400).json({ error: 'Only USDC on Sepolia is supported for agent payments' });
    }

    if (!SEPOLIA_RPC) {
      return res.status(500).json({ error: 'SEPOLIA_RPC_URL not configured' });
    }

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = agent.wallet.connect(provider);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

    const amountWei = ethers.parseUnits(String(payment.amount), USDC_DECIMALS);
    const tx = await usdc.transfer(payment.receiver, amountWei);
    const receipt = await tx.wait();
    const txHash = receipt.hash;

    const verifyRes = await fetch(`${PAYME_API_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: linkId, txHash })
    });
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      return res.status(verifyRes.status).json({
        error: 'Payment sent but verification failed',
        txHash,
        verificationError: verifyData.error || verifyData.details,
        verificationDetails: verifyData.verificationDetails
      });
    }

    res.json({
      success: true,
      txHash,
      request: verifyData.request,
      verification: verifyData.verification,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
    });
  } catch (err) {
    console.error('Pay link error:', err);
    res.status(500).json({
      error: err.message || 'Failed to pay link',
      code: err.code
    });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Agent payment service running on port ${PORT}`);
  console.log(`Agents configured: ${agents.length}`);
  console.log(`  PayMe backend: ${PAYME_API_URL} (must be running for create-link / pay-link)`);
  console.log('  Keep this terminal open; Agent 2 and Agent 1 depend on it.');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set AGENT_SERVICE_PORT in .env.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
