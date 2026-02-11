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

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payme-platform' });
});

// Import store and controllers
const { supabase } = require('../lib/supabase');

// ============ Blockchain constants ============
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_ETH_RPC_URL;
const USDC_ADDRESS = process.env.SEPOLIA_USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87';
const USDC_DECIMALS = 6;
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address account) view returns (uint256)'
];

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
    creatorWallet: obj.creator_wallet || obj.creatorWallet,
    creatorAgentId: obj.creator_agent_id || obj.creatorAgentId || null,
    payerAgentId: obj.payer_agent_id || obj.payerAgentId || null
  };
}

// ============ Auth Middleware ============
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth');

// ============ Agents ============
const { registerAgent, getAgentById, updateWalletAddress } = require('../lib/agents');

// ============ Fee system ============
const { getFeeConfig } = require('../lib/feeConfig');
const { calculateFee } = require('../lib/feeCalculator');
const { getLcxPriceUsd } = require('../lib/lcxPrice');

// ============ Webhooks ============
const { registerWebhook, getWebhooks, updateWebhook, deleteWebhook } = require('../lib/webhooks');
const { dispatchEvent } = require('../lib/webhookDispatcher');

// ============ AI ============
const { chatWithAgent } = require('../lib/ai/grokClient');
const { buildSystemPrompt } = require('../lib/ai/systemPrompt');
const { routeIntent } = require('../lib/ai/intentRouter');
const { saveMessage, getHistory, clearHistory } = require('../lib/ai/conversationMemory');

// ============ Public Routes (no auth) ============

// Agent registration (no auth required)
app.post('/api/agents/register', async (req, res) => {
  try {
    const { username, email, wallet_address, chain } = req.body;

    if (!username || !email) {
      return res.status(400).json({ error: 'Missing required fields: username, email' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate wallet address if provided
    if (wallet_address && !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet address format. Must be 0x followed by 40 hex characters.' });
    }

    const result = await registerAgent({ username, email, wallet_address: wallet_address || null, chain: chain || 'sepolia' });

    return res.status(201).json({
      success: true,
      message: 'Agent registered successfully. Save these credentials — they will NOT be shown again.',
      agent_id: result.agent_id,
      api_key: result.api_key,
      webhook_secret: result.webhook_secret
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message && error.message.includes('already')) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to register agent' });
  }
});

// Get single payment request (public - for payment view)
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

// ============ Authenticated Routes ============

// Agent profile
app.get('/api/agents/me', authMiddleware, async (req, res) => {
  try {
    const agent = req.agent;
    return res.json({
      success: true,
      agent: {
        id: agent.id,
        username: agent.username,
        email: agent.email,
        wallet_address: agent.wallet_address,
        chain: agent.chain,
        status: agent.status,
        created_at: agent.created_at,
        last_active_at: agent.last_active_at,
        total_payments_sent: agent.total_payments_sent,
        total_payments_received: agent.total_payments_received,
        total_fees_paid: agent.total_fees_paid
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Failed to get agent profile' });
  }
});

// Update wallet address
app.post('/api/agents/wallet', authMiddleware, async (req, res) => {
  try {
    const { wallet_address, chain } = req.body;

    if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
      return res.status(400).json({ error: 'Invalid wallet address format' });
    }

    const updated = await updateWalletAddress(req.agent.id, wallet_address, chain || req.agent.chain);

    return res.json({
      success: true,
      wallet_address: updated.wallet_address,
      chain: updated.chain
    });
  } catch (error) {
    console.error('Update wallet error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update wallet' });
  }
});

// Create payment request (optional auth — works from frontend without key, or from agents with key)
app.post('/api/create', optionalAuthMiddleware, async (req, res) => {
  try {
    const { token, amount, receiver, description, network, expiresInDays, creatorWallet } = req.body;

    if (!token || !amount || !receiver) {
      return res.status(400).json({ error: 'Missing required fields: token, amount, receiver' });
    }

    const id = 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + (parseInt(expiresInDays) * 24 * 60 * 60 * 1000)).toISOString()
      : null;

    const request = {
      id,
      token,
      amount: String(amount),
      receiver,
      payer: null,
      description: description || '',
      network: (network || 'sepolia').toLowerCase(),
      status: 'PENDING',
      expires_at: expiresAt,
      tx_hash: null,
      paid_at: null,
      creator_wallet: (req.agent && req.agent.wallet_address) || creatorWallet || null,
      creator_agent_id: req.agent ? req.agent.id : null
    };

    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .insert(request)
        .select()
        .single();

      if (error) throw error;

      // Dispatch webhook
      dispatchEvent('payment.created', toCamelCase(data)).catch(err => console.error('Webhook dispatch error:', err));

      return res.status(201).json({
        success: true,
        request: { id: data.id, link: `/r/${data.id}` }
      });
    } else {
      memoryStore.requests[id] = { ...request, createdAt: Date.now() };

      dispatchEvent('payment.created', toCamelCase(memoryStore.requests[id])).catch(err => console.error('Webhook dispatch error:', err));

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

// Get all requests (optional auth — agents see their own, frontend sees by wallet)
app.get('/api/requests', optionalAuthMiddleware, async (req, res) => {
  try {
    const { wallet } = req.query;

    if (supabase) {
      let query = supabase
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (req.agent) {
        // Authenticated agent: show their payments
        query = query.or(`creator_agent_id.eq.${req.agent.id},payer_agent_id.eq.${req.agent.id}`);
      } else if (wallet) {
        // Frontend dashboard: filter by wallet
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
      if (req.agent) {
        const agentId = req.agent.id;
        requests = requests.filter(r => r.creator_agent_id === agentId || r.payer_agent_id === agentId);
      } else if (wallet) {
        requests = requests.filter(r => r.creator_wallet === wallet || r.creatorWallet === wallet);
      }
      return res.json({ success: true, requests: requests.map(toCamelCase), count: requests.length });
    }
  } catch (error) {
    console.error('Get all error:', error);
    return res.status(500).json({ error: 'Failed to get payment requests' });
  }
});

// Delete request (optional auth for frontend compat)
app.delete('/api/request/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    if (supabase) {
      if (req.agent) {
        // Agent auth: only allow creator to delete
        const { data: existing } = await supabase
          .from('payment_requests')
          .select('creator_agent_id')
          .eq('id', id)
          .single();

        if (existing && existing.creator_agent_id && existing.creator_agent_id !== req.agent.id) {
          return res.status(403).json({ error: 'Only the creator can delete this payment request' });
        }
      }

      const { error } = await supabase
        .from('payment_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
    } else {
      if (req.agent) {
        const req_data = memoryStore.requests[id];
        if (req_data && req_data.creator_agent_id && req_data.creator_agent_id !== req.agent.id) {
          return res.status(403).json({ error: 'Only the creator can delete this payment request' });
        }
      }
      delete memoryStore.requests[id];
    }

    return res.json({ success: true, message: 'Deleted', id });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete payment request' });
  }
});

// ============ Create Link (Agent API) ============
app.post('/api/create-link', authMiddleware, async (req, res) => {
  try {
    const { amount, description, expiresInDays, receiver } = req.body;
    const amountStr = amount != null && amount !== '' ? String(amount).trim() : null;

    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amount' });
    }

    if (!req.agent.wallet_address) {
      return res.status(400).json({ error: 'You must register a wallet address before creating payment links. POST /api/agents/wallet' });
    }

    const receiverAddress = receiver || req.agent.wallet_address;
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
      creator_wallet: req.agent.wallet_address,
      creator_agent_id: req.agent.id
    };

    if (supabase) {
      const { data, error } = await supabase.from('payment_requests').insert(request).select().single();
      if (error) throw error;

      dispatchEvent('payment.created', toCamelCase(data)).catch(err => console.error('Webhook dispatch error:', err));

      return res.json({ success: true, linkId: data.id, link: `/r/${data.id}` });
    }

    memoryStore.requests[id] = { ...request, createdAt: Date.now() };
    dispatchEvent('payment.created', toCamelCase(memoryStore.requests[id])).catch(err => console.error('Webhook dispatch error:', err));

    return res.json({ success: true, linkId: id, link: `/r/${id}` });
  } catch (err) {
    console.error('Create link error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create link' });
  }
});

// ============ Pay Link (returns payment instructions + fee breakdown) ============
app.post('/api/pay-link', authMiddleware, async (req, res) => {
  try {
    const { linkId } = req.body;
    if (!linkId) {
      return res.status(400).json({ error: 'Missing linkId' });
    }

    if (!req.agent.wallet_address) {
      return res.status(400).json({ error: 'You must register a wallet address before paying. POST /api/agents/wallet' });
    }

    let request;
    if (supabase) {
      const { data, error } = await supabase.from('payment_requests').select('*').eq('id', linkId).single();
      if (error && error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Payment request not found' });
      }
      if (error) throw error;
      request = data;
    } else {
      request = memoryStore.requests[linkId];
      if (!request) {
        return res.status(404).json({ error: 'Payment request not found' });
      }
    }

    if (request.status === 'PAID') {
      return res.json({ success: true, alreadyPaid: true, message: 'This link is already paid' });
    }

    // Check expiry
    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This payment link has expired' });
    }

    // Calculate fee
    const feeInfo = await calculateFee(req.agent.wallet_address);

    // Build payment instructions (non-custodial: agent signs tx themselves)
    const creatorAgent = request.creator_agent_id ? await getAgentById(request.creator_agent_id) : null;
    const creatorWallet = creatorAgent ? creatorAgent.wallet_address : request.receiver;

    const feeConfig = await getFeeConfig();
    const instructions = {
      payment: {
        token: 'USDC',
        tokenAddress: USDC_ADDRESS,
        amount: request.amount,
        to: creatorWallet,
        network: request.network || 'sepolia',
        description: `Payment for ${linkId}`
      },
      fee: feeInfo,
      transfers: []
    };

    if (feeInfo.feeToken === 'LCX') {
      instructions.transfers = [
        { description: 'Payment to creator', token: 'USDC', tokenAddress: USDC_ADDRESS, amount: request.amount, to: creatorWallet },
        { description: 'Platform fee', token: 'LCX', tokenAddress: feeConfig.lcx_contract_address, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: 'LCX', tokenAddress: feeConfig.lcx_contract_address, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
    } else {
      const totalUsdcFromPayee = Number(request.amount) + feeInfo.feeTotal;
      instructions.transfers = [
        { description: 'Payment to creator', token: 'USDC', tokenAddress: USDC_ADDRESS, amount: request.amount, to: creatorWallet },
        { description: 'Platform fee', token: 'USDC', tokenAddress: USDC_ADDRESS, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: 'USDC', tokenAddress: USDC_ADDRESS, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
      instructions.totalPayeeOwes = String(totalUsdcFromPayee);
    }

    return res.json({
      success: true,
      linkId,
      instructions,
      message: `Submit the transfers below, then call POST /api/verify with the payment txHash to complete.`
    });
  } catch (err) {
    console.error('Pay link error:', err);
    return res.status(500).json({ error: err.message || 'Failed to process pay-link' });
  }
});

// ============ Verify Payment ============
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

app.post('/api/verify', optionalAuthMiddleware, async (req, res) => {
  try {
    const { requestId, txHash, feeTxHash, creatorRewardTxHash } = req.body;

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

    // Record fee transaction if fee tx hashes provided
    if (feeTxHash && supabase && req.agent) {
      try {
        const feeInfo = await calculateFee(req.agent.wallet_address);
        const feeConfig = await getFeeConfig();
        let lcxPrice = null;
        try { lcxPrice = await getLcxPriceUsd(); } catch(e) {}

        await supabase.from('fee_transactions').insert({
          id: 'FEE-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          payment_request_id: requestId,
          payer_agent_id: req.agent.id,
          creator_agent_id: request.creatorAgentId,
          fee_token: feeInfo.feeToken,
          fee_total: feeInfo.feeTotal,
          platform_share: feeInfo.platformShare,
          creator_reward: feeInfo.creatorReward,
          lcx_price_usd: lcxPrice,
          payment_amount: request.amount,
          payment_token: request.token || 'USDC',
          treasury_wallet: feeConfig.treasury_wallet,
          platform_fee_tx_hash: feeTxHash,
          creator_reward_tx_hash: creatorRewardTxHash || null,
          payment_tx_hash: txHash,
          status: 'COLLECTED'
        });

        // Update agent counters
        await supabase.rpc('increment_agent_counter', { agent_id_param: req.agent.id, counter_name: 'total_payments_sent' }).catch(() => {});
        if (request.creatorAgentId) {
          await supabase.rpc('increment_agent_counter', { agent_id_param: request.creatorAgentId, counter_name: 'total_payments_received' }).catch(() => {});
        }
        await supabase.rpc('increment_agent_fee', { agent_id_param: req.agent.id, fee_amount: feeInfo.feeTotal }).catch(() => {});
      } catch (feeErr) {
        console.error('Fee recording error (non-fatal):', feeErr);
      }
    }

    if (supabase) {
      const { data, error } = await supabase
        .from('payment_requests')
        .update({
          status: 'PAID',
          tx_hash: txHash,
          paid_at: new Date().toISOString(),
          payer_agent_id: req.agent ? req.agent.id : null
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;

      const paidRequest = toCamelCase(data);
      dispatchEvent('payment.paid', paidRequest).catch(err => console.error('Webhook dispatch error:', err));

      return res.json({
        success: true,
        status: 'PAID',
        request: paidRequest,
        verification
      });
    } else {
      const r = memoryStore.requests[requestId];
      if (r) {
        r.status = 'PAID';
        r.tx_hash = txHash;
        r.paid_at = new Date().toISOString();
        r.payer_agent_id = req.agent ? req.agent.id : null;
      }

      const paidRequest = toCamelCase(r || request);
      dispatchEvent('payment.paid', paidRequest).catch(err => console.error('Webhook dispatch error:', err));

      return res.json({
        success: true,
        status: 'PAID',
        request: paidRequest,
        verification
      });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ============ Webhook CRUD ============
app.post('/api/webhooks', authMiddleware, async (req, res) => {
  try {
    const { url, events } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing webhook url' });
    const webhook = await registerWebhook(req.agent.id, url, events || ['payment.paid', 'payment.created']);
    return res.status(201).json({ success: true, webhook });
  } catch (error) {
    console.error('Webhook register error:', error);
    return res.status(500).json({ error: error.message || 'Failed to register webhook' });
  }
});

app.get('/api/webhooks', authMiddleware, async (req, res) => {
  try {
    const webhooks = await getWebhooks(req.agent.id);
    return res.json({ success: true, webhooks });
  } catch (error) {
    console.error('Webhook list error:', error);
    return res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

app.put('/api/webhooks/:id', authMiddleware, async (req, res) => {
  try {
    const webhook = await updateWebhook(req.params.id, req.agent.id, req.body);
    return res.json({ success: true, webhook });
  } catch (error) {
    console.error('Webhook update error:', error);
    return res.status(500).json({ error: error.message || 'Failed to update webhook' });
  }
});

app.delete('/api/webhooks/:id', authMiddleware, async (req, res) => {
  try {
    await deleteWebhook(req.params.id, req.agent.id);
    return res.json({ success: true, message: 'Webhook deleted' });
  } catch (error) {
    console.error('Webhook delete error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete webhook' });
  }
});

app.post('/api/webhooks/:id/test', authMiddleware, async (req, res) => {
  try {
    const webhooks = await getWebhooks(req.agent.id);
    const webhook = webhooks.find(w => w.id === req.params.id);
    if (!webhook) return res.status(404).json({ error: 'Webhook not found' });

    const testPayload = {
      id: 'TEST-' + Date.now(),
      event: 'payment.test',
      payment: { id: 'REQ-TEST', amount: '1.00', token: 'USDC', status: 'PAID' },
      timestamp: new Date().toISOString()
    };

    // Send test event
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', webhook.secret)
      .update(JSON.stringify(testPayload))
      .digest('hex');

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayMe-Event': 'payment.test',
        'X-PayMe-Timestamp': String(Date.now()),
        'X-PayMe-Signature': `sha256=${signature}`
      },
      body: JSON.stringify(testPayload)
    });

    return res.json({
      success: true,
      message: 'Test event sent',
      responseStatus: response.status
    });
  } catch (error) {
    console.error('Webhook test error:', error);
    return res.status(500).json({ error: error.message || 'Failed to send test webhook' });
  }
});

// ============ AI Chat ============
app.post('/api/chat', authMiddleware, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Missing message' });
    }

    const agent = req.agent;

    // Gate 2: Wallet check
    if (!agent.wallet_address) {
      // Check if message contains a wallet address
      const walletMatch = message.match(/0x[a-fA-F0-9]{40}/);
      if (walletMatch) {
        // Auto-register wallet
        try {
          await updateWalletAddress(agent.id, walletMatch[0], agent.chain || 'sepolia');
          agent.wallet_address = walletMatch[0];
        } catch (err) {
          return res.status(400).json({
            error: 'Failed to register wallet address',
            details: err.message
          });
        }
        // Continue to AI with updated agent
      } else {
        return res.json({
          action_required: 'provide_wallet',
          message: "You don't have a wallet address registered. Please share your wallet address (0x...) to get started. You can send it in a message or call POST /api/agents/wallet."
        });
      }
    }

    // Load conversation history
    const history = await getHistory(agent.id, 10);

    // Build system prompt
    const systemPrompt = buildSystemPrompt(agent);

    // Build messages array
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ];

    // Call Grok
    const aiResponse = await chatWithAgent(messages);

    // Save user message and assistant response
    await saveMessage(agent.id, 'user', message);
    await saveMessage(agent.id, 'assistant', typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse));

    // Try to parse JSON action from AI response
    let parsedResponse;
    try {
      parsedResponse = typeof aiResponse === 'string' ? JSON.parse(aiResponse) : aiResponse;
    } catch {
      // AI returned plain text, not JSON action
      return res.json({
        message: typeof aiResponse === 'string' ? aiResponse : JSON.stringify(aiResponse),
        action: null
      });
    }

    // Gate 3: Validate and route action
    if (parsedResponse.action) {
      try {
        const actionResult = await routeIntent(parsedResponse.action, parsedResponse.params || {}, agent, { supabase, memoryStore });

        return res.json({
          message: parsedResponse.message || 'Action completed',
          action: parsedResponse.action,
          result: actionResult
        });
      } catch (actionErr) {
        return res.json({
          message: `Action failed: ${actionErr.message}`,
          action: parsedResponse.action,
          error: actionErr.message
        });
      }
    }

    return res.json({
      message: parsedResponse.message || JSON.stringify(parsedResponse),
      action: null
    });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: error.message || 'Chat failed' });
  }
});

// ============ Platform Stats (for dashboard, public) ============
app.get('/api/stats', async (req, res) => {
  try {
    if (!supabase) {
      return res.json({
        success: true,
        stats: { totalAgents: 0, totalPayments: 0, totalFeesCollected: 0 }
      });
    }

    const [agentsResult, paymentsResult, feesResult] = await Promise.all([
      supabase.from('agents').select('id', { count: 'exact', head: true }),
      supabase.from('payment_requests').select('id', { count: 'exact', head: true }).eq('status', 'PAID'),
      supabase.from('fee_transactions').select('fee_total').eq('status', 'COLLECTED')
    ]);

    const totalFees = (feesResult.data || []).reduce((sum, f) => sum + Number(f.fee_total || 0), 0);

    return res.json({
      success: true,
      stats: {
        totalAgents: agentsResult.count || 0,
        totalPayments: paymentsResult.count || 0,
        totalFeesCollected: totalFees
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Export for Vercel
module.exports = app;
