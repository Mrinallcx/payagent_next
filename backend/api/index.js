// Vercel Serverless Function with Express
const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');

const app = express();

// CORS - Allow all origins
app.use(cors({ origin: '*' }));

// Capture raw body for HMAC signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    req._rawBody = buf.toString('utf8');
  }
}));

// ============ Rate Limiting ============
const { globalLimiter, sensitiveLimiter } = require('../middleware/rateLimit');
app.use(globalLimiter);

// ============ Request Logger (audit trail) ============
const { requestLogger } = require('../middleware/requestLogger');
app.use(requestLogger);

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'PayAgent API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'payagent-platform' });
});

// Import store and controllers
const { supabase } = require('../lib/supabase');

// ============ Chain Registry (single source of truth for chains & tokens) ============
const {
  getTokenAddress,
  isValidNetwork,
  isNativeToken,
  getCanonicalName,
  getSupportedNetworks,
  getSupportedNetworkList,
  getExplorerUrl,
} = require('../lib/chainRegistry');

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
const { authMiddleware, optionalAuthMiddleware, getClientIp } = require('../middleware/auth');

// ============ Agents ============
const {
  registerAgent,
  activateAgent,
  rotateApiKey,
  softDeleteAgent,
  deactivateAgent,
  getAgentById,
  getAgentByUsername,
  getAgentByWallet,
  updateWalletAddress
} = require('../lib/agents');

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

// ============ X Verification ============
const { verifyTweet } = require('../lib/xVerification');

// ============ IP Monitor ============
const { checkIpAnomaly } = require('../lib/ipMonitor');

// ============ API Logs ============
const { getAgentLogs, getAgentIpHistory } = require('../lib/apiLogs');

// ============ Wallet Auth (for browser dashboard) ============
const { challengeHandler, verifyHandler } = require('../middleware/walletAuth');

// ============ Public Routes (no auth) ============

// Wallet auth challenge + verify (for browser dashboard login)
app.post('/api/auth/challenge', sensitiveLimiter, challengeHandler);
app.post('/api/auth/verify', sensitiveLimiter, verifyHandler);

// Agent registration (no auth required, with rate limit)
app.post('/api/agents/register', sensitiveLimiter, async (req, res) => {
  try {
    const { username, email, wallet_address, walletAddress, chain } = req.body;
    const finalWallet = wallet_address || walletAddress || null;

    if (!username || !email) {
      return res.status(400).json({ error: 'Missing required fields: username, email' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate wallet address if provided
    if (finalWallet && !/^0x[a-fA-F0-9]{40}$/.test(finalWallet)) {
      return res.status(400).json({ error: 'Invalid wallet address format. Must be 0x followed by 40 hex characters.' });
    }

    const ip = getClientIp(req);
    const result = await registerAgent({ username, email, wallet_address: finalWallet, chain: chain || 'sepolia', ip });

    return res.status(201).json({
      success: true,
      message: 'Agent registered. Complete X verification to activate your account and receive API credentials.',
      agent_id: result.agent_id,
      verification_challenge: result.verification_challenge,
      instructions: `Post the following to X (Twitter), then call POST /api/agents/verify-x with your username and the tweet URL:\n\n"${result.verification_challenge}"`
    });
  } catch (error) {
    console.error('Registration error:', error);
    if (error.message && error.message.includes('already')) {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message || 'Failed to register agent' });
  }
});

// X (Twitter) Verification (no auth — agent not yet activated)
app.post('/api/agents/verify-x', sensitiveLimiter, async (req, res) => {
  try {
    const { username, tweet_url } = req.body;

    if (!username || !tweet_url) {
      return res.status(400).json({ error: 'Missing required fields: username, tweet_url' });
    }

    // Find the agent by username
    const agent = await getAgentByUsername(username);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (agent.verification_status === 'verified') {
      return res.status(400).json({ error: 'Agent already verified' });
    }

    if (!agent.verification_challenge) {
      return res.status(400).json({ error: 'No verification challenge found. Register first.' });
    }

    // Verify the tweet
    const result = await verifyTweet(tweet_url, agent.verification_challenge);

    if (!result.valid) {
      return res.status(400).json({
        error: 'Verification failed',
        details: result.error,
        challenge: agent.verification_challenge,
        instructions: `Make sure your tweet contains exactly: ${agent.verification_challenge}`
      });
    }

    // Activate the agent and generate real API key
    const activation = await activateAgent(agent.id, result.x_username);

    return res.json({
      success: true,
      message: 'Agent verified and activated! Save these credentials — they will NOT be shown again.',
      agent_id: agent.id,
      api_key_id: activation.api_key_id,
      api_secret: activation.api_secret,
      api_key_expires_at: activation.expires_at,
      x_username: result.x_username,
      webhook_secret: null // Webhook secret was already generated; this can be regenerated via API
    });
  } catch (error) {
    console.error('X verification error:', error);
    return res.status(500).json({ error: error.message || 'Verification failed' });
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

// ============ Public Fee Info (for human payers in browser) ============
app.get('/api/request/:id/fee', async (req, res) => {
  try {
    const { id } = req.params;
    const { payer } = req.query;

    if (!payer || !/^0x[a-fA-F0-9]{40}$/.test(payer)) {
      return res.status(400).json({ error: 'Missing or invalid payer wallet address. Use ?payer=0x...' });
    }

    // Look up the payment request
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
      request = data;
    } else {
      request = memoryStore.requests[id];
      if (!request) {
        return res.status(404).json({ error: 'Payment request not found' });
      }
    }

    if (request.status === 'PAID') {
      return res.json({ success: true, alreadyPaid: true, message: 'This link is already paid' });
    }

    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This payment link has expired' });
    }

    const paymentNetwork = request.network || 'sepolia';
    const paymentToken = (request.token || 'USDC').toUpperCase();
    const paymentTokenAddress = getTokenAddress(paymentNetwork, paymentToken);
    const lcxTokenAddress = getTokenAddress(paymentNetwork, 'LCX');

    // Calculate fee for this payer
    const feeInfo = await calculateFee(payer, paymentNetwork, paymentToken);

    // Validate: payment amount must exceed fee when fee is deducted from payment
    if (feeInfo.feeDeductedFromPayment && Number(request.amount) <= feeInfo.feeTotal) {
      return res.status(400).json({
        error: `Payment amount (${request.amount} ${paymentToken}) must be greater than the fee (${feeInfo.feeTotal} ${feeInfo.feeToken}). Minimum payment: ${(feeInfo.feeTotal + 0.01).toFixed(6)} ${paymentToken}`
      });
    }

    const creatorWallet = request.creator_wallet || request.receiver;
    const feeConfig = await getFeeConfig();

    let transfers;
    let creatorReceives = request.amount;

    if (feeInfo.feeToken === 'LCX' && !feeInfo.feeDeductedFromPayment) {
      // Payer has LCX — creator gets full amount, fee in LCX separately
      transfers = [
        { description: 'Payment to creator', token: paymentToken, tokenAddress: paymentTokenAddress, amount: request.amount, to: creatorWallet },
        { description: 'Platform fee', token: 'LCX', tokenAddress: lcxTokenAddress, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: 'LCX', tokenAddress: lcxTokenAddress, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
    } else {
      // Fee deducted from payment token
      creatorReceives = Number((Number(request.amount) - feeInfo.feeTotal).toFixed(8));
      const feeTokenAddress = isNativeToken(feeInfo.feeToken, paymentNetwork) ? null : getTokenAddress(paymentNetwork, feeInfo.feeToken);
      transfers = [
        { description: 'Payment to creator', token: paymentToken, tokenAddress: paymentTokenAddress, amount: String(creatorReceives), to: creatorWallet },
        { description: 'Platform fee', token: feeInfo.feeToken, tokenAddress: feeTokenAddress || paymentTokenAddress, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: feeInfo.feeToken, tokenAddress: feeTokenAddress || paymentTokenAddress, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
    }

    return res.json({
      success: true,
      payment: {
        token: paymentToken,
        amount: request.amount,
        network: paymentNetwork,
        to: creatorWallet,
        description: request.description
      },
      fee: feeInfo,
      transfers,
      creatorReceives: String(creatorReceives)
    });
  } catch (error) {
    console.error('Fee info error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get fee info' });
  }
});

// ============ Authenticated Routes ============

// Agent profile
app.get('/api/agents/me', authMiddleware, async (req, res) => {
  try {
    const agent = req.agent;

    // Trigger IP anomaly check (non-blocking)
    if (req.clientIp) {
      checkIpAnomaly(agent.id, req.clientIp, agent.last_known_ip, agent.ip_change_count).catch(() => {});
    }

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
        total_fees_paid: agent.total_fees_paid,
        verification_status: agent.verification_status,
        x_username: agent.x_username,
        api_key_expires_at: agent.api_key_expires_at
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

// ============ API Key Rotation ============
app.post('/api/agents/rotate-key', sensitiveLimiter, authMiddleware, async (req, res) => {
  try {
    const result = await rotateApiKey(req.agent.id);

    return res.json({
      success: true,
      message: 'API key rotated. Save the new credentials — they will NOT be shown again.',
      api_key_id: result.api_key_id,
      api_secret: result.api_secret,
      expires_at: result.expires_at
    });
  } catch (error) {
    console.error('Key rotation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to rotate API key' });
  }
});

// ============ Agent Deactivation ============
app.post('/api/agents/deactivate', authMiddleware, async (req, res) => {
  try {
    await deactivateAgent(req.agent.id);
    return res.json({ success: true, message: 'Agent deactivated' });
  } catch (error) {
    console.error('Deactivation error:', error);
    return res.status(500).json({ error: error.message || 'Failed to deactivate agent' });
  }
});

// ============ Soft Delete Agent ============
app.delete('/api/agents/me', authMiddleware, async (req, res) => {
  try {
    await softDeleteAgent(req.agent.id);
    return res.json({ success: true, message: 'Agent deleted. Payment history is preserved.' });
  } catch (error) {
    console.error('Delete agent error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete agent' });
  }
});

// ============ Agent Logs (for /logs page) ============
app.get('/api/agents/logs', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await getAgentLogs(req.agent.id, { limit, offset });

    return res.json({
      success: true,
      logs: result.logs,
      total: result.total,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get logs error:', error);
    return res.status(500).json({ error: 'Failed to get logs' });
  }
});

// ============ Agent IP History ============
app.get('/api/agents/ip-history', authMiddleware, async (req, res) => {
  try {
    const history = await getAgentIpHistory(req.agent.id);
    return res.json({ success: true, ip_history: history });
  } catch (error) {
    console.error('Get IP history error:', error);
    return res.status(500).json({ error: 'Failed to get IP history' });
  }
});

// ============ Agent By Wallet (for frontend dashboard) ============
app.get('/api/agents/by-wallet', async (req, res) => {
  try {
    const { wallet } = req.query;
    if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
      return res.status(400).json({ error: 'Invalid or missing wallet address' });
    }

    const agent = await getAgentByWallet(wallet);
    if (!agent) {
      return res.json({ success: true, agent: null });
    }

    // Don't expose sensitive data
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
        verification_status: agent.verification_status,
        x_username: agent.x_username,
        api_key_expires_at: agent.api_key_expires_at,
        total_payments_sent: agent.total_payments_sent,
        total_payments_received: agent.total_payments_received,
        total_fees_paid: agent.total_fees_paid,
        deleted_at: agent.deleted_at
      }
    });
  } catch (error) {
    console.error('Get agent by wallet error:', error);
    return res.status(500).json({ error: 'Failed to look up agent' });
  }
});

// Create payment request (optional auth — works from frontend without key, or from agents with key)
app.post('/api/create', optionalAuthMiddleware, async (req, res) => {
  try {
    const { token, amount, receiver, description, network, expiresInDays, creatorWallet } = req.body;

    if (!token || !amount || !receiver) {
      return res.status(400).json({ error: 'Missing required fields: token, amount, receiver' });
    }

    // Validate network if provided
    const resolvedNetwork = getCanonicalName(network || 'sepolia');
    if (!resolvedNetwork) {
      return res.status(400).json({
        error: `Unsupported network: "${network}". Supported: ${getSupportedNetworks().join(', ')}`
      });
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
      network: resolvedNetwork,
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
    const { amount, description, expiresInDays, receiver, network, token } = req.body;
    const amountStr = amount != null && amount !== '' ? String(amount).trim() : null;

    if (!amountStr || isNaN(Number(amountStr)) || Number(amountStr) <= 0) {
      return res.status(400).json({ error: 'Missing or invalid amount' });
    }

    if (!req.agent.wallet_address) {
      return res.status(400).json({ error: 'You must register a wallet address before creating payment links. POST /api/agents/wallet' });
    }

    // Network is required
    if (!network) {
      return res.status(400).json({
        error: 'Missing required field: network. Supported: ' + getSupportedNetworks().join(', ')
      });
    }

    const resolvedNetwork = getCanonicalName(network);
    if (!resolvedNetwork) {
      return res.status(400).json({
        error: `Unsupported network: "${network}". Supported: ${getSupportedNetworks().join(', ')}`
      });
    }

    // Resolve token (default USDC)
    const resolvedToken = (token || 'USDC').toUpperCase();

    const receiverAddress = receiver || req.agent.wallet_address;
    const id = 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const expiresAt = expiresInDays
      ? new Date(Date.now() + (parseInt(expiresInDays, 10) * 24 * 60 * 60 * 1000)).toISOString()
      : null;

    const request = {
      id,
      token: resolvedToken,
      amount: amountStr,
      receiver: receiverAddress,
      payer: null,
      description: description || '',
      network: resolvedNetwork,
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

      return res.json({ success: true, linkId: data.id, link: `/r/${data.id}`, network: resolvedNetwork, token: resolvedToken, amount: amountStr });
    }

    memoryStore.requests[id] = { ...request, createdAt: Date.now() };
    dispatchEvent('payment.created', toCamelCase(memoryStore.requests[id])).catch(err => console.error('Webhook dispatch error:', err));

    return res.json({ success: true, linkId: id, link: `/r/${id}`, network: resolvedNetwork, token: resolvedToken, amount: amountStr });
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

    // Resolve network and token addresses via chain registry
    const paymentNetwork = request.network || 'sepolia';
    const paymentToken = request.token || 'USDC';
    const paymentTokenAddress = getTokenAddress(paymentNetwork, paymentToken);
    const lcxTokenAddress = getTokenAddress(paymentNetwork, 'LCX');
    const usdcTokenAddress = getTokenAddress(paymentNetwork, 'USDC');

    // Calculate fee (network-aware — checks LCX balance on the correct chain)
    // Pass paymentToken so fee falls back to the same token if no LCX
    const feeInfo = await calculateFee(req.agent.wallet_address, paymentNetwork, paymentToken);

    // Validate: payment amount must exceed fee when fee is deducted from payment
    if (feeInfo.feeDeductedFromPayment && Number(request.amount) <= feeInfo.feeTotal) {
      return res.status(400).json({
        error: `Payment amount (${request.amount} ${paymentToken}) must be greater than the fee (${feeInfo.feeTotal} ${feeInfo.feeToken}). Minimum payment: ${(feeInfo.feeTotal + 0.01).toFixed(6)} ${paymentToken}`
      });
    }

    // Build payment instructions (non-custodial: agent signs tx themselves)
    const creatorAgent = request.creator_agent_id ? await getAgentById(request.creator_agent_id) : null;
    const creatorWallet = creatorAgent ? creatorAgent.wallet_address : request.receiver;

    const feeConfig = await getFeeConfig();
    const instructions = {
      payment: {
        token: paymentToken,
        tokenAddress: paymentTokenAddress,
        amount: request.amount,
        to: creatorWallet,
        network: paymentNetwork,
        description: `Payment for ${linkId}`
      },
      fee: feeInfo,
      transfers: []
    };

    if (feeInfo.feeToken === 'LCX' && !feeInfo.feeDeductedFromPayment) {
      // Payer has LCX — creator gets full amount, fee in LCX separately
      instructions.transfers = [
        { description: 'Payment to creator', token: paymentToken, tokenAddress: paymentTokenAddress, amount: request.amount, to: creatorWallet },
        { description: 'Platform fee', token: 'LCX', tokenAddress: lcxTokenAddress, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: 'LCX', tokenAddress: lcxTokenAddress, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
    } else {
      // Fee deducted from payment token — creator gets amount minus fee
      const creatorReceives = Number((Number(request.amount) - feeInfo.feeTotal).toFixed(8));
      const feeTokenAddress = isNativeToken(feeInfo.feeToken, paymentNetwork) ? null : getTokenAddress(paymentNetwork, feeInfo.feeToken);
      instructions.transfers = [
        { description: 'Payment to creator', token: paymentToken, tokenAddress: paymentTokenAddress, amount: String(creatorReceives), to: creatorWallet },
        { description: 'Platform fee', token: feeInfo.feeToken, tokenAddress: feeTokenAddress || paymentTokenAddress, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: feeInfo.feeToken, tokenAddress: feeTokenAddress || paymentTokenAddress, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
      instructions.feeDeductedFromPayment = true;
      instructions.creatorReceives = String(creatorReceives);
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

// ============ Execute Payment (on-chain) — DEPRECATED ============
const { verifyTransaction, executePayment } = require('../lib/blockchain');

app.post('/api/execute-payment', authMiddleware, async (req, res) => {
  // Always signal deprecation on every response from this endpoint
  res.set('Deprecation', 'true');
  res.set('X-PayAgent-Deprecated', 'execute-payment');
  res.set('Link', '<https://www.npmjs.com/package/@payagent/sdk>; rel="successor-version"');

  try {
    const { linkId, privateKey } = req.body;

    if (!linkId) {
      return res.status(400).json({ error: 'Missing linkId' });
    }
    if (!privateKey) {
      return res.status(400).json({ error: 'Missing privateKey. The payer private key is required to sign on-chain transactions.' });
    }

    // Validate the private key format
    let payerAddress;
    try {
      const { ethers } = require('ethers');
      const tempWallet = new ethers.Wallet(privateKey);
      payerAddress = tempWallet.address;
    } catch (e) {
      return res.status(400).json({ error: 'Invalid privateKey format' });
    }

    if (!req.agent.wallet_address) {
      return res.status(400).json({ error: 'You must register a wallet address before paying. POST /api/agents/wallet' });
    }

    // Fetch the payment request
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

    if (request.expires_at && new Date(request.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This payment link has expired' });
    }

    // Build transfers (same logic as pay-link)
    const paymentNetwork = request.network || 'sepolia';
    const paymentToken = request.token || 'USDC';
    const paymentTokenAddress = getTokenAddress(paymentNetwork, paymentToken);
    const lcxTokenAddress = getTokenAddress(paymentNetwork, 'LCX');
    const usdcTokenAddress = getTokenAddress(paymentNetwork, 'USDC');

    const feeInfo = await calculateFee(req.agent.wallet_address, paymentNetwork, paymentToken);
    const creatorAgent = request.creator_agent_id ? await getAgentById(request.creator_agent_id) : null;
    const creatorWallet = creatorAgent ? creatorAgent.wallet_address : request.receiver;
    const feeConfig = await getFeeConfig();

    let transfers;
    if (feeInfo.feeToken === 'LCX' && !feeInfo.feeDeductedFromPayment) {
      transfers = [
        { description: 'Payment to creator', token: paymentToken, tokenAddress: paymentTokenAddress, amount: request.amount, to: creatorWallet },
        { description: 'Platform fee', token: 'LCX', tokenAddress: lcxTokenAddress, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: 'LCX', tokenAddress: lcxTokenAddress, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
    } else {
      const creatorReceives = Number((Number(request.amount) - feeInfo.feeTotal).toFixed(8));
      const feeTokenAddress = isNativeToken(feeInfo.feeToken, paymentNetwork) ? null : getTokenAddress(paymentNetwork, feeInfo.feeToken);
      transfers = [
        { description: 'Payment to creator', token: paymentToken, tokenAddress: paymentTokenAddress, amount: String(creatorReceives), to: creatorWallet },
        { description: 'Platform fee', token: feeInfo.feeToken, tokenAddress: feeTokenAddress || paymentTokenAddress, amount: String(feeInfo.platformShare), to: feeConfig.treasury_wallet },
        { description: 'Creator reward', token: feeInfo.feeToken, tokenAddress: feeTokenAddress || paymentTokenAddress, amount: String(feeInfo.creatorReward), to: creatorWallet }
      ];
    }

    // Execute all transfers on-chain
    const executionResult = await executePayment(privateKey, transfers, paymentNetwork);

    // Extract the main payment txHash for verification/recording
    const paymentTxHash = executionResult.transactions[0]?.txHash;
    const feeTxHash = executionResult.transactions[1]?.txHash || null;
    const rewardTxHash = executionResult.transactions[2]?.txHash || null;

    // Mark as PAID
    if (supabase) {
      await supabase
        .from('payment_requests')
        .update({
          status: 'PAID',
          tx_hash: paymentTxHash,
          paid_at: new Date().toISOString(),
          payer: payerAddress,
          payer_agent_id: req.agent.id
        })
        .eq('id', linkId);

      // Record fee transaction
      try {
        let lcxPrice = null;
        try { lcxPrice = await getLcxPriceUsd(); } catch(e) {}

        await supabase.from('fee_transactions').insert({
          id: 'FEE-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          payment_request_id: linkId,
          payer_agent_id: req.agent.id,
          creator_agent_id: request.creator_agent_id,
          fee_token: feeInfo.feeToken,
          fee_total: feeInfo.feeTotal,
          platform_share: feeInfo.platformShare,
          creator_reward: feeInfo.creatorReward,
          lcx_price_usd: lcxPrice,
          payment_amount: request.amount,
          payment_token: paymentToken,
          treasury_wallet: feeConfig.treasury_wallet,
          platform_fee_tx_hash: feeTxHash,
          creator_reward_tx_hash: rewardTxHash,
          payment_tx_hash: paymentTxHash,
          status: 'COLLECTED'
        });
      } catch (feeErr) {
        console.error('Fee recording error (non-fatal):', feeErr);
      }
    } else {
      // In-memory update
      memoryStore.requests[linkId] = {
        ...memoryStore.requests[linkId],
        status: 'PAID',
        tx_hash: paymentTxHash,
        paid_at: new Date().toISOString(),
        payer: payerAddress,
        payer_agent_id: req.agent.id
      };
    }

    // Dispatch webhook
    dispatchEvent('payment.paid', {
      id: linkId,
      status: 'PAID',
      txHash: paymentTxHash,
      payer: payerAddress,
      amount: request.amount,
      token: paymentToken,
      network: paymentNetwork
    }).catch(err => console.error('Webhook dispatch error:', err));

    return res.json({
      success: true,
      message: 'Payment executed and verified on-chain',
      linkId,
      payer: payerAddress,
      network: paymentNetwork,
      transactions: executionResult.transactions,
      status: 'PAID',
      deprecated: true,
      migration: 'This endpoint is deprecated. Use @payagent/sdk instead. Install: npm install @payagent/sdk ethers'
    });

  } catch (err) {
    console.error('Execute payment error:', err);

    // Provide user-friendly error messages for common blockchain errors
    const msg = err.message || 'Failed to execute payment';
    if (msg.includes('insufficient funds')) {
      return res.status(400).json({ error: 'Insufficient funds in payer wallet for this transaction (check token balance and gas)' });
    }
    if (msg.includes('nonce')) {
      return res.status(400).json({ error: 'Transaction nonce conflict. Please try again.' });
    }

    return res.status(500).json({ error: msg });
  }
});

// ============ Verify Payment ============

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

    const network = getCanonicalName(request.network || 'sepolia') || 'sepolia';
    const tokenSymbol = (request.token || 'USDC').toUpperCase();
    const tokenAddress = isNativeToken(tokenSymbol, network) ? null : getTokenAddress(network, tokenSymbol);

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
        const feeInfo = await calculateFee(req.agent.wallet_address, network, tokenSymbol);
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
        'X-PayAgent-Event': 'payment.test',
        'X-PayAgent-Timestamp': String(Date.now()),
        'X-PayAgent-Signature': `sha256=${signature}`
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

        // If the router returned a chain selection prompt (e.g. create_link without network),
        // override the action so the client knows to show chain options
        const effectiveAction = actionResult.action_required === 'select_chain'
          ? 'select_chain'
          : parsedResponse.action;

        return res.json({
          message: actionResult.message || parsedResponse.message || 'Action completed',
          action: effectiveAction,
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

// ============ Supported Chains (public) ============
app.get('/api/chains', (req, res) => {
  const chains = getSupportedNetworkList();
  return res.json({ success: true, chains });
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
