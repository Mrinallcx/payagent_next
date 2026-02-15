const crypto = require('crypto');
const { supabase } = require('./supabase');

// ============ In-memory storage (fallback for serverless) ============
let memoryStore = { requests: {} };

// ============ Supabase storage ============
async function createRequestSupabase({ token, amount, receiver, payer, description, network, expiresInDays, creatorWallet }) {
  const id = 'REQ-' + crypto.randomUUID().split('-')[0].toUpperCase();
  
  const expiresAt = expiresInDays 
    ? new Date(Date.now() + (parseInt(expiresInDays) * 24 * 60 * 60 * 1000)).toISOString()
    : null;

  const request = {
    id,
    token,
    amount,
    receiver,
    payer: payer || null,
    description: description || '',
    network: network || 'sepolia',
    status: 'PENDING',
    expires_at: expiresAt,
    tx_hash: null,
    paid_at: null,
    creator_wallet: creatorWallet || null
  };

  const { data, error } = await supabase
    .from('payment_requests')
    .insert(request)
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }

  return toCamelCase(data);
}

async function getRequestSupabase(id) {
  const { data, error } = await supabase
    .from('payment_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Supabase select error:', error);
    throw error;
  }

  return toCamelCase(data);
}

async function markPaidSupabase(id, txHash) {
  const { data, error } = await supabase
    .from('payment_requests')
    .update({
      status: 'PAID',
      tx_hash: txHash,
      paid_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Supabase update error:', error);
    throw error;
  }

  return toCamelCase(data);
}

async function getAllRequestsSupabase(creatorWallet = null) {
  let query = supabase
    .from('payment_requests')
    .select('*')
    .order('created_at', { ascending: false });

  if (creatorWallet) {
    query = query.eq('creator_wallet', creatorWallet);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Supabase select all error:', error);
    throw error;
  }

  return data.map(toCamelCase);
}

async function deleteRequestSupabase(id) {
  const { error } = await supabase
    .from('payment_requests')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Supabase delete error:', error);
    throw error;
  }

  return true;
}

// ============ Memory-based fallback functions ============
function createRequestMemory({ token, amount, receiver, payer, description, network, expiresInDays, creatorWallet }) {
  const id = 'REQ-' + crypto.randomUUID().split('-')[0].toUpperCase();
  const expiresAt = expiresInDays ? Date.now() + (parseInt(expiresInDays) * 24 * 60 * 60 * 1000) : null;

  const request = {
    id,
    token,
    amount,
    receiver,
    payer: payer || null,
    description: description || '',
    network: network || 'sepolia',
    status: 'PENDING',
    createdAt: Date.now(),
    expiresAt,
    txHash: null,
    paidAt: null,
    creatorWallet: creatorWallet || null
  };

  memoryStore.requests[id] = request;
  return request;
}

function getRequestMemory(id) {
  return memoryStore.requests[id] || null;
}

function markPaidMemory(id, txHash) {
  const request = memoryStore.requests[id];
  if (!request) return null;

  request.status = 'PAID';
  request.txHash = txHash;
  request.paidAt = Date.now();
  return request;
}

function getAllRequestsMemory(creatorWallet = null) {
  let requests = Object.values(memoryStore.requests);
  if (creatorWallet) {
    requests = requests.filter(r => r.creatorWallet === creatorWallet);
  }
  return requests.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function deleteRequestMemory(id) {
  if (memoryStore.requests[id]) {
    delete memoryStore.requests[id];
    return true;
  }
  return false;
}

// ============ Helper functions ============
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
    createdAt: obj.created_at ? new Date(obj.created_at).getTime() : null,
    expiresAt: obj.expires_at ? new Date(obj.expires_at).getTime() : null,
    txHash: obj.tx_hash,
    paidAt: obj.paid_at ? new Date(obj.paid_at).getTime() : null,
    creatorWallet: obj.creator_wallet
  };
}

// ============ Unified API ============
const useSupabase = !!supabase;

async function createRequest(params) {
  if (useSupabase) {
    return createRequestSupabase(params);
  }
  return createRequestMemory(params);
}

async function getRequest(id) {
  if (useSupabase) {
    return getRequestSupabase(id);
  }
  return getRequestMemory(id);
}

async function markPaid(id, txHash) {
  if (useSupabase) {
    return markPaidSupabase(id, txHash);
  }
  return markPaidMemory(id, txHash);
}

async function getAllRequests(creatorWallet = null) {
  if (useSupabase) {
    return getAllRequestsSupabase(creatorWallet);
  }
  return getAllRequestsMemory(creatorWallet);
}

async function deleteRequest(id) {
  if (useSupabase) {
    return deleteRequestSupabase(id);
  }
  return deleteRequestMemory(id);
}

console.log(`📦 Storage: ${useSupabase ? 'Supabase' : 'In-Memory (serverless fallback)'}`);

module.exports = {
  createRequest,
  getRequest,
  markPaid,
  getAllRequests,
  deleteRequest,
  useSupabase
};
