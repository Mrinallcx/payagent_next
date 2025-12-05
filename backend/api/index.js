// Vercel Serverless Function with Express
const express = require('express');
const cors = require('cors');

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
      network: network || 'Sepolia (ETH Testnet)',
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

// Verify payment
app.post('/api/verify', async (req, res) => {
  try {
    const { requestId, txHash } = req.body;

    if (!requestId || !txHash) {
      return res.status(400).json({ error: 'Missing requestId or txHash' });
    }

    // Mark as paid (simplified - in production, verify on-chain)
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
        request: toCamelCase(data)
      });
    } else {
      const request = memoryStore.requests[requestId];
      if (request) {
        request.status = 'PAID';
        request.tx_hash = txHash;
        request.paid_at = new Date().toISOString();
      }
      return res.json({ success: true, status: 'PAID', request: toCamelCase(request) });
    }
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Export for Vercel
module.exports = app;
