const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { ethers } = require('ethers');
const { getAgentByWallet } = require('../lib/agents');
const { supabase } = require('../lib/supabase');

const NONCE_TTL_SEC = 300; // 5 minutes
const JWT_EXPIRY = '1h';

// In-memory nonce store (fallback when Supabase unavailable)
const memoryNonces = {};

/**
 * Cleanup expired nonces (lazy deletion)
 */
async function cleanupExpiredNonces() {
  const now = new Date().toISOString();
  if (supabase) {
    try {
      await supabase.from('auth_nonces').delete().lt('expires_at', now);
    } catch (e) {
      // Non-critical
    }
  } else {
    for (const [addr, entry] of Object.entries(memoryNonces)) {
      if (new Date(entry.expires_at) < new Date()) {
        delete memoryNonces[addr];
      }
    }
  }
}

/**
 * POST /api/auth/challenge
 *
 * Request: { wallet_address: "0x..." }
 * Response: { nonce: "Sign this to login to PayAgent: abc123...", expires_in: 300 }
 */
async function challengeHandler(req, res) {
  try {
    const { wallet_address } = req.body;

    if (!wallet_address || !/^0x[a-fA-F0-9]{40}$/i.test(wallet_address)) {
      return res.status(400).json({ error: 'Invalid or missing wallet_address' });
    }

    const normalizedAddress = wallet_address.toLowerCase();

    // Cleanup expired nonces periodically (lazy)
    cleanupExpiredNonces().catch(() => {});

    // Generate nonce
    const randomPart = crypto.randomBytes(16).toString('hex');
    const nonce = `Sign this to login to PayAgent: ${randomPart}`;
    const expiresAt = new Date(Date.now() + NONCE_TTL_SEC * 1000).toISOString();

    if (supabase) {
      // Upsert (one nonce per wallet at a time)
      const { error } = await supabase
        .from('auth_nonces')
        .upsert({
          wallet_address: normalizedAddress,
          nonce,
          expires_at: expiresAt
        }, { onConflict: 'wallet_address' });

      if (error) throw error;
    } else {
      memoryNonces[normalizedAddress] = { nonce, expires_at: expiresAt };
    }

    return res.json({
      success: true,
      nonce,
      expires_in: NONCE_TTL_SEC
    });
  } catch (error) {
    console.error('Challenge error:', error);
    return res.status(500).json({ error: 'Failed to generate challenge' });
  }
}

/**
 * POST /api/auth/verify
 *
 * Request: { wallet_address: "0x...", signature: "0x..." }
 * Response: { token: "eyJ...", expires_in: 3600, agent: { id, username, ... } }
 */
async function verifyHandler(req, res) {
  try {
    const { wallet_address, signature } = req.body;

    if (!wallet_address || !signature) {
      return res.status(400).json({ error: 'Missing wallet_address or signature' });
    }

    const normalizedAddress = wallet_address.toLowerCase();

    // Retrieve nonce
    let nonceEntry;
    if (supabase) {
      const { data, error } = await supabase
        .from('auth_nonces')
        .select('*')
        .eq('wallet_address', normalizedAddress)
        .single();

      if (error || !data) {
        return res.status(400).json({ error: 'No pending challenge found. Request one first via POST /api/auth/challenge' });
      }
      nonceEntry = data;
    } else {
      nonceEntry = memoryNonces[normalizedAddress];
      if (!nonceEntry) {
        return res.status(400).json({ error: 'No pending challenge found. Request one first via POST /api/auth/challenge' });
      }
    }

    // Check nonce expiry
    if (new Date(nonceEntry.expires_at) < new Date()) {
      // Delete expired nonce
      if (supabase) {
        await supabase.from('auth_nonces').delete().eq('wallet_address', normalizedAddress);
      } else {
        delete memoryNonces[normalizedAddress];
      }
      return res.status(400).json({ error: 'Challenge expired. Request a new one.' });
    }

    // Verify EIP-191 signature
    let recoveredAddress;
    try {
      recoveredAddress = ethers.verifyMessage(nonceEntry.nonce, signature);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid signature format' });
    }

    if (recoveredAddress.toLowerCase() !== normalizedAddress) {
      return res.status(401).json({ error: 'Signature does not match wallet address' });
    }

    // Delete nonce (one-time use)
    if (supabase) {
      await supabase.from('auth_nonces').delete().eq('wallet_address', normalizedAddress);
    } else {
      delete memoryNonces[normalizedAddress];
    }

    // Look up agent by wallet (optional — human users may not have one)
    const agent = await getAgentByWallet(normalizedAddress);

    if (agent && agent.deleted_at) {
      return res.status(403).json({ error: 'Agent account has been deleted' });
    }

    // Issue JWT (works for both agent and wallet-only users)
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res.status(500).json({ error: 'JWT authentication not configured on server' });
    }

    const jwtPayload = { wallet_address: normalizedAddress };
    if (agent) jwtPayload.agent_id = agent.id;

    const token = jwt.sign(jwtPayload, jwtSecret, { expiresIn: JWT_EXPIRY });

    const response = {
      success: true,
      token,
      expires_in: 3600,
      agent: agent ? {
        id: agent.id,
        username: agent.username,
        email: agent.email,
        wallet_address: agent.wallet_address,
        status: agent.status,
        verification_status: agent.verification_status,
        x_username: agent.x_username,
        api_key_expires_at: agent.api_key_expires_at
      } : null
    };

    return res.json(response);
  } catch (error) {
    console.error('Verify wallet error:', error);
    return res.status(500).json({ error: 'Failed to verify wallet signature' });
  }
}

module.exports = { challengeHandler, verifyHandler };
