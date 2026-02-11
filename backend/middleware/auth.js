const bcrypt = require('bcrypt');
const { getAgentByKeyPrefix, touchAgent } = require('../lib/agents');

/**
 * API Key Authentication Middleware
 *
 * Supports two header formats:
 *   x-api-key: pk_live_abc123...
 *   Authorization: Bearer pk_live_abc123...
 */
async function authMiddleware(req, res, next) {
  try {
    // Extract API key from headers
    let apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Provide your API key via x-api-key header or Authorization: Bearer <key>'
      });
    }

    // Extract prefix (first 12 chars) for fast DB lookup
    const prefix = apiKey.substring(0, 12);
    const agent = await getAgentByKeyPrefix(prefix);

    if (!agent) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Full key comparison via bcrypt
    const isValid = await bcrypt.compare(apiKey, agent.api_key_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Check agent status
    if (agent.status !== 'active') {
      return res.status(403).json({ error: `Agent account is ${agent.status}` });
    }

    // Attach agent to request (exclude sensitive hashes)
    req.agent = {
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
    };

    // Update last_active_at (non-blocking)
    touchAgent(agent.id).catch(() => {});

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional Auth Middleware
 *
 * Same as authMiddleware but does NOT reject unauthenticated requests.
 * If a valid API key is present, attaches req.agent. Otherwise continues without it.
 * Used for routes that work with both auth (agent API) and without (frontend dashboard).
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    let apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      // No auth provided — continue without agent context
      return next();
    }

    const prefix = apiKey.substring(0, 12);
    const agent = await getAgentByKeyPrefix(prefix);
    if (!agent) return next();

    const isValid = await bcrypt.compare(apiKey, agent.api_key_hash);
    if (!isValid) return next();

    if (agent.status !== 'active') return next();

    req.agent = {
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
    };

    touchAgent(agent.id).catch(() => {});
    next();
  } catch (error) {
    // On error, just continue without auth
    next();
  }
}

module.exports = { authMiddleware, optionalAuthMiddleware };
