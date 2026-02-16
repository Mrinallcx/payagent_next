const jwt = require('jsonwebtoken');
const { getAgentByKeyId, getAgentByWallet, touchAgent } = require('../lib/agents');
const { decryptSecret, computeHmac, buildStringToSign, timingSafeEqual } = require('../lib/crypto');

const MAX_TIMESTAMP_DRIFT_SEC = 300; // 5 minutes replay protection window

/**
 * Extract client IP from request
 */
function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || 'unknown';
}

/**
 * Build sanitized agent object to attach to req.agent
 */
function buildAgentPayload(agent) {
  return {
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
    api_key_expires_at: agent.api_key_expires_at,
    registered_ip: agent.registered_ip,
    last_known_ip: agent.last_known_ip,
    ip_change_count: agent.ip_change_count
  };
}

/**
 * Run common agent status checks (shared by HMAC and JWT paths)
 */
function checkAgentStatus(agent, res) {
  if (agent.deleted_at) {
    res.status(403).json({ error: 'Agent account has been deleted' });
    return false;
  }
  if (agent.status === 'pending_verification') {
    res.status(403).json({ error: 'Agent pending verification. Complete X verification first via POST /api/agents/verify-x' });
    return false;
  }
  if (agent.status !== 'active') {
    res.status(403).json({ error: `Agent account is ${agent.status}` });
    return false;
  }
  return true;
}

/**
 * HMAC Authentication — for SDK / AI agents / curl
 *
 * Required headers:
 *   x-api-key-id: pk_live_abc123...
 *   x-timestamp: <unix epoch seconds>
 *   x-signature: <HMAC-SHA256 hex>
 *
 * String-to-sign: timestamp\nMETHOD\npath\nSHA256(body)
 */
async function hmacAuth(req, res) {
  const keyId = req.headers['x-api-key-id'];
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];

  if (!keyId || !timestamp || !signature) {
    res.status(401).json({
      error: 'Missing HMAC headers',
      message: 'Provide x-api-key-id, x-timestamp, and x-signature headers'
    });
    return false;
  }

  // Replay protection
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > MAX_TIMESTAMP_DRIFT_SEC) {
    res.status(401).json({
      error: 'Request timestamp expired or invalid',
      message: `Timestamp must be within ${MAX_TIMESTAMP_DRIFT_SEC} seconds of server time`
    });
    return false;
  }

  // Lookup agent
  const agent = await getAgentByKeyId(keyId);
  if (!agent) {
    res.status(401).json({ error: 'Invalid API key ID' });
    return false;
  }

  // Check API key expiry
  if (agent.api_key_expires_at && new Date(agent.api_key_expires_at) < new Date()) {
    res.status(401).json({
      error: 'API key expired',
      message: 'Your API key has expired. Regenerate via POST /api/agents/rotate-key',
      expired_at: agent.api_key_expires_at
    });
    return false;
  }

  // Decrypt secret and verify signature
  let apiSecret;
  try {
    apiSecret = decryptSecret(agent.api_secret_encrypted);
  } catch (err) {
    console.error('Failed to decrypt API secret:', err.message);
    res.status(500).json({ error: 'Internal authentication error' });
    return false;
  }

  // Get raw body for signature verification
  const rawBody = req._rawBody || (req.body ? JSON.stringify(req.body) : '');
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split('?')[0]; // Strip query params for signing

  const stringToSign = buildStringToSign(timestamp, method, path, rawBody);
  const expectedSignature = computeHmac(stringToSign, apiSecret);

  // Constant-time comparison
  if (!timingSafeEqual(signature, expectedSignature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return false;
  }

  // Status checks
  if (!checkAgentStatus(agent, res)) return false;

  req.agent = buildAgentPayload(agent);
  req.clientIp = getClientIp(req);
  touchAgent(agent.id).catch(() => {});
  return true;
}

/**
 * JWT Authentication — for browser dashboard
 *
 * Required header:
 *   Authorization: Bearer <jwt_token>
 */
async function jwtAuth(req, res) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Authentication required',
      message: 'Provide Authorization: Bearer <jwt> or HMAC headers (x-api-key-id, x-timestamp, x-signature)'
    });
    return false;
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    console.error('JWT_SECRET not configured');
    res.status(500).json({ error: 'JWT authentication not configured' });
    return false;
  }

  let payload;
  try {
    payload = jwt.verify(token, jwtSecret);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        error: 'JWT expired',
        message: 'Your session has expired. Please sign in again with your wallet.',
        code: 'JWT_EXPIRED'
      });
    } else {
      res.status(401).json({ error: 'Invalid JWT token' });
    }
    return false;
  }

  const { wallet_address } = payload;
  if (!wallet_address) {
    res.status(401).json({ error: 'Invalid JWT payload' });
    return false;
  }

  // Always set req.wallet for wallet-based operations
  req.wallet = wallet_address.toLowerCase();
  req.clientIp = getClientIp(req);

  // Optionally look up agent (wallet-only JWTs may not have one)
  const agent = await getAgentByWallet(wallet_address);
  if (agent) {
    if (!checkAgentStatus(agent, res)) return false;
    req.agent = buildAgentPayload(agent);
    touchAgent(agent.id).catch(() => {});
  }

  return true;
}

/**
 * Dual-mode Authentication Middleware
 *
 * Path A: HMAC auth — triggered by x-api-key-id header (SDK / agents / curl)
 * Path B: JWT auth — triggered by Authorization: Bearer header (browser dashboard)
 */
async function authMiddleware(req, res, next) {
  try {
    // Path A: HMAC auth (server-to-server)
    if (req.headers['x-api-key-id']) {
      const ok = await hmacAuth(req, res);
      if (ok) return next();
      return; // hmacAuth already sent the response
    }

    // Path B: JWT auth (browser dashboard)
    if (req.headers['authorization']) {
      const ok = await jwtAuth(req, res);
      if (ok) return next();
      return; // jwtAuth already sent the response
    }

    // No auth provided
    return res.status(401).json({
      error: 'Authentication required',
      message: 'Provide HMAC headers (x-api-key-id, x-timestamp, x-signature) or Authorization: Bearer <jwt>'
    });
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional Auth Middleware
 *
 * Same dual-mode as authMiddleware but does NOT reject unauthenticated requests.
 */
async function optionalAuthMiddleware(req, res, next) {
  try {
    req.clientIp = getClientIp(req);

    // Try HMAC auth
    if (req.headers['x-api-key-id']) {
      const keyId = req.headers['x-api-key-id'];
      const timestamp = req.headers['x-timestamp'];
      const signature = req.headers['x-signature'];

      if (keyId && timestamp && signature) {
        const now = Math.floor(Date.now() / 1000);
        const ts = parseInt(timestamp, 10);
        if (!isNaN(ts) && Math.abs(now - ts) <= MAX_TIMESTAMP_DRIFT_SEC) {
          const agent = await getAgentByKeyId(keyId);
          if (agent && !agent.deleted_at && agent.status === 'active') {
            if (!agent.api_key_expires_at || new Date(agent.api_key_expires_at) >= new Date()) {
              try {
                const apiSecret = decryptSecret(agent.api_secret_encrypted);
                const rawBody = req._rawBody || (req.body ? JSON.stringify(req.body) : '');
                const method = req.method.toUpperCase();
                const path = req.originalUrl.split('?')[0];
                const stringToSign = buildStringToSign(timestamp, method, path, rawBody);
                const expected = computeHmac(stringToSign, apiSecret);
                if (timingSafeEqual(signature, expected)) {
                  req.agent = buildAgentPayload(agent);
                  touchAgent(agent.id).catch(() => {});
                }
              } catch (e) { /* silently skip if decrypt fails */ }
            }
          }
        }
      }
      return next();
    }

    // Try JWT auth
    if (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ')) {
      const token = req.headers['authorization'].substring(7);
      const jwtSecret = process.env.JWT_SECRET;
      if (jwtSecret) {
        try {
          const payload = jwt.verify(token, jwtSecret);
          if (payload.wallet_address) {
            req.wallet = payload.wallet_address.toLowerCase();
            const agent = await getAgentByWallet(payload.wallet_address);
            if (agent && !agent.deleted_at && agent.status === 'active') {
              req.agent = buildAgentPayload(agent);
              touchAgent(agent.id).catch(() => {});
            }
          }
        } catch (e) { /* invalid JWT, just skip */ }
      }
      return next();
    }

    next();
  } catch (error) {
    next();
  }
}

module.exports = { authMiddleware, optionalAuthMiddleware, getClientIp };
