const crypto = require('crypto');
const { encryptSecret } = require('./crypto');
const { supabase } = require('./supabase');

const API_KEY_EXPIRY_DAYS = 10;

// In-memory fallback store
const memoryAgents = {};

/**
 * Register a new agent (pending verification — no API key issued yet)
 */
async function registerAgent({ username, email, wallet_address, chain, ip }) {
  // Validate username uniqueness
  if (supabase) {
    const { data: existing } = await supabase
      .from('agents')
      .select('id')
      .eq('username', username)
      .single();
    if (existing) {
      throw new Error('Username already taken');
    }
  } else {
    const existingAgent = Object.values(memoryAgents).find(a => a.username === username);
    if (existingAgent) {
      throw new Error('Username already taken');
    }
  }

  // Generate agent ID and verification challenge
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  const agent_id = `agent_${username}_${randomSuffix}`;
  const verification_challenge = `payagent-verify-${username}-${crypto.randomBytes(3).toString('hex')}`;

  // Generate placeholder key ID and encrypted secret (will be replaced on verification)
  const placeholderKeyId = `pk_pending_${crypto.randomBytes(8).toString('hex')}`;
  const placeholderSecret = `sk_pending_${crypto.randomBytes(16).toString('hex')}`;
  const api_secret_encrypted = encryptSecret(placeholderSecret);

  const webhookSecretRandom = crypto.randomBytes(32).toString('hex');
  const webhook_secret = `whsec_${webhookSecretRandom}`;
  // Store webhook secret as-is (not sensitive for auth — it's for webhook signature verification)
  const webhook_secret_hash = webhook_secret;

  const agent = {
    id: agent_id,
    username,
    email,
    api_key_id: placeholderKeyId,
    api_secret_encrypted,
    webhook_secret_hash,
    wallet_address: wallet_address || null,
    chain: chain || 'sepolia',
    status: 'pending_verification',
    verification_status: 'pending',
    verification_challenge,
    registered_ip: ip || null,
    last_known_ip: ip || null,
    total_payments_sent: 0,
    total_payments_received: 0,
    total_fees_paid: 0
  };

  if (supabase) {
    const { error } = await supabase.from('agents').insert(agent);
    if (error) throw error;
  } else {
    memoryAgents[agent_id] = { ...agent, created_at: new Date().toISOString(), last_active_at: new Date().toISOString() };
  }

  return {
    agent_id,
    verification_challenge
  };
}

/**
 * Activate agent after X verification — generates real API key ID + secret
 */
async function activateAgent(agentId, xUsername) {
  // Generate real API key ID + secret
  const api_key_id = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
  const api_secret = `sk_live_${crypto.randomBytes(32).toString('hex')}`;
  const api_secret_encrypted = encryptSecret(api_secret);

  const expiresAt = new Date(Date.now() + API_KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const updates = {
    status: 'active',
    verification_status: 'verified',
    x_username: xUsername || null,
    x_verified_at: new Date().toISOString(),
    api_key_id,
    api_secret_encrypted,
    api_key_expires_at: expiresAt
  };

  if (supabase) {
    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', agentId)
      .select()
      .single();
    if (error) throw error;
  } else {
    if (memoryAgents[agentId]) {
      Object.assign(memoryAgents[agentId], updates);
    } else {
      throw new Error('Agent not found');
    }
  }

  return { api_key_id, api_secret, expires_at: expiresAt };
}

/**
 * Rotate API key — generates new key ID + secret with fresh expiry
 */
async function rotateApiKey(agentId) {
  const api_key_id = `pk_live_${crypto.randomBytes(16).toString('hex')}`;
  const api_secret = `sk_live_${crypto.randomBytes(32).toString('hex')}`;
  const api_secret_encrypted = encryptSecret(api_secret);

  const expiresAt = new Date(Date.now() + API_KEY_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();

  if (supabase) {
    const { error } = await supabase
      .from('agents')
      .update({ api_key_id, api_secret_encrypted, api_key_expires_at: expiresAt })
      .eq('id', agentId);
    if (error) throw error;
  } else {
    if (memoryAgents[agentId]) {
      memoryAgents[agentId].api_key_id = api_key_id;
      memoryAgents[agentId].api_secret_encrypted = api_secret_encrypted;
      memoryAgents[agentId].api_key_expires_at = expiresAt;
    } else {
      throw new Error('Agent not found');
    }
  }

  return { api_key_id, api_secret, expires_at: expiresAt };
}

/**
 * Soft-delete an agent (preserves payment history)
 */
async function softDeleteAgent(agentId) {
  const updates = { status: 'inactive', deleted_at: new Date().toISOString() };

  if (supabase) {
    const { error } = await supabase.from('agents').update(updates).eq('id', agentId);
    if (error) throw error;
  } else {
    if (memoryAgents[agentId]) {
      Object.assign(memoryAgents[agentId], updates);
    }
  }
}

/**
 * Deactivate an agent
 */
async function deactivateAgent(agentId) {
  if (supabase) {
    const { error } = await supabase.from('agents').update({ status: 'inactive' }).eq('id', agentId);
    if (error) throw error;
  } else {
    if (memoryAgents[agentId]) {
      memoryAgents[agentId].status = 'inactive';
    }
  }
}

/**
 * Get agent by ID
 */
async function getAgentById(id) {
  if (supabase) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  }
  return memoryAgents[id] || null;
}

/**
 * Get agent by API key ID (for HMAC auth — exact match on public identifier)
 */
async function getAgentByKeyId(keyId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('api_key_id', keyId)
      .single();
    if (error) return null;
    return data;
  }
  return Object.values(memoryAgents).find(a => a.api_key_id === keyId) || null;
}

/**
 * Get agent by username
 */
async function getAgentByUsername(username) {
  if (supabase) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('username', username)
      .single();
    if (error) return null;
    return data;
  }
  return Object.values(memoryAgents).find(a => a.username === username) || null;
}

/**
 * Get agent by wallet address
 */
async function getAgentByWallet(walletAddress) {
  if (supabase) {
    // Only return active (non-deleted) agents; filter out inactive/deleted to avoid
    // .single() failing when multiple agents share the same wallet (e.g. after soft-delete)
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('wallet_address', walletAddress)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return data;
  }
  return Object.values(memoryAgents).find(a => a.wallet_address === walletAddress && !a.deleted_at) || null;
}

/**
 * Update wallet address for an agent
 */
async function updateWalletAddress(agentId, wallet_address, chain) {
  if (supabase) {
    const { data, error } = await supabase
      .from('agents')
      .update({ wallet_address, chain: chain || 'sepolia' })
      .eq('id', agentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  if (memoryAgents[agentId]) {
    memoryAgents[agentId].wallet_address = wallet_address;
    memoryAgents[agentId].chain = chain || 'sepolia';
    return memoryAgents[agentId];
  }
  throw new Error('Agent not found');
}

/**
 * Update last_active_at timestamp
 */
async function touchAgent(agentId) {
  if (supabase) {
    await supabase
      .from('agents')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', agentId);
  } else if (memoryAgents[agentId]) {
    memoryAgents[agentId].last_active_at = new Date().toISOString();
  }
}

/**
 * Update agent's last known IP
 */
async function updateAgentIp(agentId, ip) {
  if (supabase) {
    await supabase
      .from('agents')
      .update({ last_known_ip: ip })
      .eq('id', agentId);
  } else if (memoryAgents[agentId]) {
    memoryAgents[agentId].last_known_ip = ip;
  }
}

/**
 * Suspend agent (auto-triggered by IP anomaly)
 */
async function suspendAgent(agentId) {
  if (supabase) {
    await supabase.from('agents').update({ status: 'suspended' }).eq('id', agentId);
  } else if (memoryAgents[agentId]) {
    memoryAgents[agentId].status = 'suspended';
  }
}

/**
 * Increment IP change count
 */
async function incrementIpChangeCount(agentId) {
  if (supabase) {
    const agent = await getAgentById(agentId);
    if (agent) {
      await supabase.from('agents').update({ ip_change_count: (agent.ip_change_count || 0) + 1 }).eq('id', agentId);
      return (agent.ip_change_count || 0) + 1;
    }
  } else if (memoryAgents[agentId]) {
    memoryAgents[agentId].ip_change_count = (memoryAgents[agentId].ip_change_count || 0) + 1;
    return memoryAgents[agentId].ip_change_count;
  }
  return 0;
}

module.exports = {
  registerAgent,
  activateAgent,
  rotateApiKey,
  softDeleteAgent,
  deactivateAgent,
  getAgentById,
  getAgentByKeyId,
  getAgentByUsername,
  getAgentByWallet,
  updateWalletAddress,
  touchAgent,
  updateAgentIp,
  suspendAgent,
  incrementIpChangeCount,
  API_KEY_EXPIRY_DAYS
};
