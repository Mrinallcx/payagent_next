const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { supabase } = require('./supabase');

const BCRYPT_ROUNDS = 12;

// In-memory fallback store
const memoryAgents = {};

/**
 * Register a new agent
 */
async function registerAgent({ username, email, wallet_address, chain }) {
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

  // Generate credentials
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  const agent_id = `agent_${username}_${randomSuffix}`;

  const apiKeyRandom = crypto.randomBytes(32).toString('hex');
  const api_key = `pk_live_${apiKeyRandom}`;
  const api_key_prefix = api_key.substring(0, 12);
  const api_key_hash = await bcrypt.hash(api_key, BCRYPT_ROUNDS);

  const webhookSecretRandom = crypto.randomBytes(32).toString('hex');
  const webhook_secret = `whsec_${webhookSecretRandom}`;
  const webhook_secret_hash = await bcrypt.hash(webhook_secret, BCRYPT_ROUNDS);

  const agent = {
    id: agent_id,
    username,
    email,
    api_key_hash,
    api_key_prefix,
    webhook_secret_hash,
    wallet_address: wallet_address || null,
    chain: chain || 'sepolia',
    status: 'active',
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

  // Return plaintext credentials (shown once)
  return {
    agent_id,
    api_key,
    webhook_secret
  };
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
 * Get agent by API key prefix (for auth)
 */
async function getAgentByKeyPrefix(prefix) {
  if (supabase) {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('api_key_prefix', prefix)
      .single();
    if (error) return null;
    return data;
  }
  return Object.values(memoryAgents).find(a => a.api_key_prefix === prefix) || null;
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

module.exports = {
  registerAgent,
  getAgentById,
  getAgentByKeyPrefix,
  updateWalletAddress,
  touchAgent
};
