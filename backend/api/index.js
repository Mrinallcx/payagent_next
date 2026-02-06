// Vercel Serverless Function with Express
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();

// CORS - Allow all origins
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

// Import store and controllers
const { supabase } = require('../lib/supabase');

// ============ Agent payment (create-link, pay-link) – same process as backend ============
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_ETH_RPC_URL;
const USDC_ADDRESS = process.env.SEPOLIA_USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87';
const USDC_DECIMALS = 6;
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)'
];

function getAgentKeys() {
  const k1 = process.env.AGENT_1_PRIVATE_KEY;
  const k2 = process.env.AGENT_2_PRIVATE_KEY;
  const list = [];
  if (k1) {
    try {
      const w = new ethers.Wallet(k1);
      list.push({ id: 1, wallet: w, address: w.address });
    } catch (e) {
      console.warn('Invalid AGENT_1_PRIVATE_KEY');
    }
  }
  if (k2) {
    try {
      const w = new ethers.Wallet(k2);
      list.push({ id: 2, wallet: w, address: w.address });
    } catch (e) {
      console.warn('Invalid AGENT_2_PRIVATE_KEY');
    }
  }
  return list;
}

const agents = getAgentKeys();

function maskAddress(addr) {
  if (!addr || addr.length < 10) return '0x****';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

// ============ In-memory storage fallback ============
let memoryStore = { requests: {} };

function toCamelCase(obj) {
  if (!obj) return obj;
  return {
    id: obj.id,
    token: obj.token,
    amount: obj.amount,
    receiver: obj.receiver,
    payer: obj.payer,
    description: obj.description,
    network: obj.network,
    status: obj.status,
    createdAt: obj.created_at ? new Date(obj.created_at).getTime() : (obj.createdAt || Date.now()),
    expiresAt: obj.expires_at ? new Date(obj.expires_at).getTime() : obj.expiresAt,
    txHash: obj.tx_hash || obj.txHash,
    paidAt: obj.paid_at ? new Date(obj.paid_at).getTime() : obj.paidAt,
    creatorWallet: obj.creator_wallet || obj.creatorWallet
  };
}

// ============ API Routes ============

// Create payment request
app.post('/api/create', async (req, res) => {
  try {
    const { token, amount, receiver, description, network, expiresInDays, creatorWallet } = req.body;

    if (!token || !amount || !receiver) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const expiresAt = expiresInDays 
      ? new Date(Date.now() + (parseInt(expiresInDays) * 24 * 60 * 60 * 1000)).toISOString()
      : null;

    const request = {
      id,
      token,
      amount,
      receiver,
      payer: null,
      description: description || '',
      network: (network || 'sepolia').toLowerCase(),
      status: 'PENDING',
      expires_at: expiresAt,
      tx_hash: null,
      paid_at: null,
      creator_wallet: creatorWallet || null
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        request: { id: data.id, link: `/r/${data.id}` }
      });
    } else {
      // Memory fallback
      memoryStore.requests[id] = { ...request, createdAt: Date.now() };
      return res.status(201).json({
        success: true,
        request: { id, link: `/r/${id}` }
      });
    }
  } catch (error) {
    console.error('Create error:', error);
    return res.status(500).json({ error: 'Failed to create payment request' });
  }
});

// Get all requests
app.get('/api/requests', async (req, res) => {
  try {
    const { wallet } = req.query;

    if (supabase) {
      let query = supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (wallet) {
        query = query.eq('creator_wallet', wallet);
      }

      const { data, error } = await query;
      if (error) throw error;

      const requests = data.map(toCamelCase).map(r => ({
        ...r,
        isExpired: r.expiresAt ? Date.now() > r.expiresAt : false,
        isPaid: r.status === 'PAID'
      }));

      return res.json({ success: true, requests, count: requests.length });
    } else {
      let requests = Object.values(memoryStore.requests);
      if (wallet) {
        requests = requests.filter(r => r.creator_wallet === wallet || r.creatorWallet === wallet);
      }
      return res.json({ success: true, requests: requests.map(toCamelCase), count: requests.length });
    }
  } catch (error) {
    console.error('Get all error:', error);
    return res.status(500).json({ error: 'Failed to get payment requests' });
  }
});

// Get single request
app.get('/api/request/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let request;
    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      if (error) throw error;
      request = toCamelCase(data);
    } else {
      request = memoryStore.requests[id];
      if (!request) {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      request = toCamelCase(request);
    }

    if (request.status === 'PAID') {
      return res.json({ success: true, status: 'PAID', request });
    }

    // Return 402 for pending payments
    return res.status(402).json({
      error: 'Payment Required',
      code: 402,
      payment: {
        id: request.id,
        amount: request.amount,
        token: request.token,
        network: request.network,
        receiver: request.receiver,
        description: request.description,
        expiresAt: request.expiresAt,
        createdAt: request.createdAt
      }
    });
  } catch (error) {
    console.error('Get request error:', error);
    return res.status(500).json({ error: 'Failed to get payment request' });
  }
});

// Delete request
app.delete('/api/request/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (supabase) {
      const { error } = await supabase
        .from('payment_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } else {
      delete memoryStore.requests[id];
    }

    return res.json({ success: true, message: 'Deleted', id });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete payment request' });
  }
});

// Verify payment (with on-chain verification)
const { verifyTransaction } = require('../lib/blockchain');

function getTokenAddressForVerify(tokenSymbol, network) {
  const symbol = (tokenSymbol || 'USDC').toUpperCase();
  const net = (network || 'sepolia').toLowerCase();
  if (symbol !== 'USDC') {
    return process.env.NEXT_PUBLIC_USDT_ADDRESS || null;
  }
  if (net.includes('bnb') && net.includes('test')) {
    return process.env.NEXT_PUBLIC_BNB_TESTNET_USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS;
  }
  return process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87';
}

app.post('/api/verify', async (req, res) => {
  try {
    const { requestId, txHash } = req.body;

    if (!requestId || !txHash) {
      return res.status(400).json({ error: 'Missing requestId or txHash' });
    }

    let request;
    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('id', requestId)
        .single();
      if (error && error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      if (error) throw error;
      request = toCamelCase(data);
    } else {
      request = memoryStore.requests[requestId];
      if (!request) {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      request = toCamelCase(request);
    }

    if (request.status === 'PAID') {
      return res.status(400).json({ error: 'Request already paid' });
    }

    const network = (request.network || 'sepolia').toLowerCase();
    const tokenSymbol = (request.token || 'USDC').toUpperCase();
    const isNative = tokenSymbol === 'ETH' || (tokenSymbol === 'BNB' && network.includes('bnb'));
    const tokenAddress = isNative ? null : getTokenAddressForVerify(request.token, request.network);

    const verification = await verifyTransaction(
      txHash,
      request.amount,
      tokenAddress,
      request.receiver,
      tokenSymbol,
      network
    );

    if (!verification.valid) {
      console.error('Payment verification failed:', verification.error, verification.details || '');
      return res.status(400).json({
        error: 'Payment verification failed',
        details: verification.error,
        verificationDetails: verification.details || undefined
      });
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .update({
          status: 'PAID',
          tx_hash: txHash,
          paid_at: new Date().toISOString()
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      return res.json({
        success: true,
        status: 'PAID',
        request: toCamelCase(data),
        verification
      });
    } else {
      const r = memoryStore.requests[requestId];
      if (r) {
        r.status = 'PAID';
        r.tx_hash = txHash;
        r.paid_at = new Date().toISOString();
      }
      return res.json({
        success: true,
        status: 'PAID',
        request: toCamelCase(r || request),
        verification
      });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ============ Agent payment API (deployed with backend on Vercel) ============

app.get('/api/agent/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-payment', agents: agents.length });
});

app.get('/api/agents', (req, res) => {
  res.json({
    success: true,
    agents: agents.map((a) => ({ id: a.id, address: maskAddress(a.address) }))
  });
});

app.post('/api/create-link', async (req, res) => {
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
          error: `Agent ${rid} not configured. Set AGENT_${rid}_PRIVATE_KEY in Vercel env.`
        });
      }
      receiverAddress = agent.address;
    }
    if (!receiverAddress) {
      return res.status(400).json({
        error: 'Missing receiver or receiverAgentId. Send receiverAgentId: 1 or 2, or receiver: "0x..."'
      });
    }

    const id = 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + (parseInt(expiresInDays, 10) * 24 * 60 * 60 * 1000)).toISOString()
      : null;
    const request = {
      id,
      token: 'USDC',
      amount: amountStr,
      receiver: receiverAddress,
      payer: null,
      description: description || '',
      network: 'sepolia',
      status: 'PENDING',
      expires_at: expiresAt,
      tx_hash: null,
      paid_at: null,
      creator_wallet: creatorWallet || null
    };

    if (supabase) {
      const { data, error } = await supabase.from('payment_requests').insert(request).select().single();
      if (error) throw error;
      return res.json({ success: true, linkId: data.id, link: `/r/${data.id}` });
    }
    memoryStore.requests[id] = { ...request, createdAt: Date.now() };
    return res.json({ success: true, linkId: id, link: `/r/${id}` });
  } catch (err) {
    console.error('Create link error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create link' });
  }
});

app.post('/api/pay-link', async (req, res) => {
  try {
    const { linkId, agentId } = req.body;
    if (!linkId) {
      return res.status(400).json({ error: 'Missing linkId' });
    }
    const payerId = agentId === 2 ? 2 : 1;
    const agent = agents.find((a) => a.id === payerId);
    if (!agent) {
      return res.status(400).json({ error: `Agent ${payerId} not configured. Set AGENT_${payerId}_PRIVATE_KEY in Vercel env.` });
    }

    let request;
    if (supabase) {
      const { data, error } = await supabase.from('payment_requests').select('*').eq('id', linkId).single();
      if (error && error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      if (error) throw error;
      request = toCamelCase(data);
    } else {
      request = memoryStore.requests[linkId];
      if (!request) {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      request = toCamelCase(request);
    }

    if (request.status === 'PAID') {
      return res.json({
        success: true,
        alreadyPaid: true,
        request,
        message: 'This link is already paid'
      });
    }

    const payment = request;
    if (!payment.amount || !payment.receiver) {
      return res.status(404).json({ error: 'Payment request not found or invalid' });
    }
    const token = (payment.token || 'USDC').toUpperCase();
    const network = (payment.network || 'sepolia').toLowerCase();
    if (token !== 'USDC' || !network.includes('sepolia')) {
      return res.status(400).json({ error: 'Only USDC on Sepolia is supported for agent payments' });
    }

    if (!SEPOLIA_RPC) {
      return res.status(500).json({ error: 'SEPOLIA_RPC_URL or NEXT_PUBLIC_ETH_RPC_URL not configured' });
    }

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC);
    const wallet = agent.wallet.connect(provider);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, wallet);

    const amountWei = ethers.parseUnits(String(payment.amount), USDC_DECIMALS);
    const tx = await usdc.transfer(payment.receiver, amountWei);
    const receipt = await tx.wait();
    const txHash = receipt.hash;

    const tokenAddress = getTokenAddressForVerify(request.token, request.network);
    const verification = await verifyTransaction(
      txHash,
      request.amount,
      tokenAddress,
      request.receiver,
      (request.token || 'USDC').toUpperCase(),
      (request.network || 'sepolia').toLowerCase()
    );

    if (!verification.valid) {
      return res.status(400).json({
        error: 'Payment sent but verification failed',
        txHash,
        verificationError: verification.error,
        verificationDetails: verification.details
      });
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .update({ status: 'PAID', tx_hash: txHash, paid_at: new Date().toISOString() })
        .eq('id', linkId)
        .select()
        .single();
      if (error) throw error;
      return res.json({
        success: true,
        txHash,
        request: toCamelCase(data),
        verification,
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
      });
    }
    const r = memoryStore.requests[linkId];
    if (r) {
      r.status = 'PAID';
      r.tx_hash = txHash;
      r.paid_at = new Date().toISOString();
    }
    return res.json({
      success: true,
      txHash,
      request: toCamelCase(r || request),
      verification,
      explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`
    });
  } catch (err) {
    console.error('Pay link error:', err);
    return res.status(500).json({
      error: err.message || 'Failed to pay link',
      code: err.code
    });
  }
});

// Export for Vercel
module.exports = app;
