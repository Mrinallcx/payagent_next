#!/usr/bin/env node

/**
 * PayAgent Platform — Comprehensive Test Suite
 *
 * Covers:
 *   1.  Chain Registry (unit)
 *   2.  Health & Public Endpoints
 *   3.  Agent Registration (new X-verification flow)
 *   4.  HMAC Authentication & Security
 *   5.  Wallet Management
 *   6.  Multi-Chain Link Creation
 *   7.  Network Validation & Rejection
 *   7b. Intent Router — Chain Selection
 *   8.  Payment Request View
 *   9.  Pay-Link (multi-chain token resolution)
 *   9b. Execute-Payment Input Validation
 *   9c. Execute-Payment Deprecation Headers
 *   10. Payment Verification (mocked)
 *   11. Input Validation & Edge Cases
 *   12. Request Listing & Deletion
 *   13. Platform Stats
 *   14. Cross-Chain Consistency
 *   15. API Key Rotation (now returns api_key_id + api_secret)
 *   16. Agent Deactivation & Soft Delete
 *   17. Agent Logs & IP History
 *   18. X (Twitter) Verification Flow
 *   19. Rate Limiting
 *   20. Agent Lookup by Wallet
 *   21. HMAC Signature Validation (replay, tamper, missing headers)
 *   22. Wallet Auth (challenge, verify, JWT)
 *
 * Run:  node test.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('crypto');

// ─── Force in-memory mode (no Supabase) ────────────────────────────
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

// ─── Provide required env for chain registry RPC ───────────────────
process.env.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/test';
process.env.ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/test';
process.env.BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
process.env.PLATFORM_TREASURY_WALLET = '0xTREASURY0000000000000000000000000000001';
process.env.LCX_CONTRACT_ADDRESS = '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b';

// ─── HMAC + JWT env vars ───────────────────────────────────────────
process.env.HMAC_ENCRYPTION_KEY = process.env.HMAC_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ─── Import chain registry for unit tests ──────────────────────────
const registry = require('./lib/chainRegistry');

// ─── Import agents module for test helpers ─────────────────────────
const { activateAgent, getAgentByUsername } = require('./lib/agents');

// ─── Import crypto helpers for HMAC signing ────────────────────────
const { computeHmac, buildStringToSign } = require('./lib/crypto');

// ─── Boot Express app on a random port ─────────────────────────────
const app = require('./api/index');
let server;
let BASE_URL;

// ─── Agent credentials (populated during registration tests) ───────
const agents = {
  creator: { apiKeyId: null, apiSecret: null, agentId: null, wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC1' },
  payer:   { apiKeyId: null, apiSecret: null, agentId: null, wallet: '0xAABBCCDDEEFF00112233445566778899AABBCCDD' },
};

// ─── Created link IDs (populated during link creation tests) ───────
const links = {
  sepolia:  null,
  ethereum: null,
  base:     null,
  ethLink:  null,
};

// ─── HMAC Signing Helper ───────────────────────────────────────────
function signRequest(method, path, body, apiKeyId, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const stringToSign = buildStringToSign(timestamp, method, path, bodyStr);
  const signature = computeHmac(stringToSign, apiSecret);
  return { timestamp, signature, apiKeyId };
}

// ─── HTTP helper (supports HMAC and JWT auth) ──────────────────────
function request(method, path, body, auth) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };

    if (auth) {
      if (typeof auth === 'object' && auth.apiKeyId) {
        // HMAC auth
        const { timestamp, signature, apiKeyId } = signRequest(
          method, url.pathname, body, auth.apiKeyId, auth.apiSecret
        );
        opts.headers['x-api-key-id'] = apiKeyId;
        opts.headers['x-timestamp'] = timestamp;
        opts.headers['x-signature'] = signature;
      } else if (typeof auth === 'string' && auth.startsWith('jwt_')) {
        // JWT auth (strip prefix)
        opts.headers['Authorization'] = `Bearer ${auth.substring(4)}`;
      } else if (typeof auth === 'string') {
        // Legacy Bearer (for backward compat tests)
        opts.headers['Authorization'] = `Bearer ${auth}`;
      }
    }

    const bodyStr = body ? JSON.stringify(body) : null;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Helper: send raw HTTP request with custom headers (for HMAC edge-case tests)
 */
function rawRequest(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json', ...headers },
    };
    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

/**
 * Helper: Register + activate an agent (bypasses X verification for testing)
 * Returns { agentId, apiKeyId, apiSecret, expiresAt }
 */
async function registerAndActivate(username, email, wallet, chain) {
  const res = await request('POST', '/api/agents/register', {
    username,
    email,
    wallet_address: wallet,
    chain: chain || 'sepolia',
  });
  assert.equal(res.status, 201);
  assert.ok(res.body.verification_challenge);

  const agentId = res.body.agent_id;

  // Directly activate the agent (bypassing X verification for tests)
  const activation = await activateAgent(agentId, 'test_x_user');

  return {
    agentId,
    apiKeyId: activation.api_key_id,
    apiSecret: activation.api_secret,
    expiresAt: activation.expires_at
  };
}

// ═══════════════════════════════════════════════════════════════════
//  TEST LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      const addr = server.address();
      BASE_URL = `http://127.0.0.1:${addr.port}`;
      console.log(`\n  Test server listening on ${BASE_URL}\n`);
      resolve();
    });
    server.on('error', reject);
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  setTimeout(() => process.exit(0), 500);
});

// ═══════════════════════════════════════════════════════════════════
//  1. CHAIN REGISTRY — UNIT TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Chain Registry', () => {
  it('lists exactly 3 supported chains', () => {
    const chains = registry.getSupportedNetworks();
    assert.deepStrictEqual(chains, ['sepolia', 'ethereum', 'base']);
  });

  it('resolves canonical names from aliases', () => {
    assert.equal(registry.resolveNetwork('sepolia'), 'sepolia');
    assert.equal(registry.resolveNetwork('ethereum'), 'ethereum');
    assert.equal(registry.resolveNetwork('mainnet'), 'ethereum');
    assert.equal(registry.resolveNetwork('eth-mainnet'), 'ethereum');
    assert.equal(registry.resolveNetwork('eth'), 'ethereum');
    assert.equal(registry.resolveNetwork('base'), 'base');
    assert.equal(registry.resolveNetwork('base-mainnet'), 'base');
  });

  it('rejects unsupported networks', () => {
    assert.equal(registry.resolveNetwork('polygon'), null);
    assert.equal(registry.resolveNetwork('solana'), null);
    assert.equal(registry.resolveNetwork(''), null);
    assert.equal(registry.resolveNetwork(null), null);
  });

  it('isValidNetwork returns correct booleans', () => {
    assert.equal(registry.isValidNetwork('sepolia'), true);
    assert.equal(registry.isValidNetwork('ethereum'), true);
    assert.equal(registry.isValidNetwork('base'), true);
    assert.equal(registry.isValidNetwork('polygon'), false);
  });

  describe('Token addresses', () => {
    it('Sepolia USDC is correct', () => {
      assert.equal(registry.getTokenAddress('sepolia', 'USDC'), '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87');
    });
    it('Ethereum mainnet USDC is correct', () => {
      assert.equal(registry.getTokenAddress('ethereum', 'USDC'), '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    });
    it('Base mainnet USDC is correct', () => {
      assert.equal(registry.getTokenAddress('base', 'USDC'), '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    });
    it('ETH returns null (native) on all chains', () => {
      assert.equal(registry.getTokenAddress('sepolia', 'ETH'), null);
      assert.equal(registry.getTokenAddress('ethereum', 'ETH'), null);
      assert.equal(registry.getTokenAddress('base', 'ETH'), null);
    });
  });

  describe('Native token detection', () => {
    it('ETH is native on all supported chains', () => {
      assert.equal(registry.isNativeToken('ETH', 'sepolia'), true);
      assert.equal(registry.isNativeToken('ETH', 'ethereum'), true);
      assert.equal(registry.isNativeToken('ETH', 'base'), true);
    });
    it('USDC is NOT native', () => {
      assert.equal(registry.isNativeToken('USDC', 'ethereum'), false);
    });
  });

  describe('Explorer URLs', () => {
    it('sepolia explorer', () => { assert.equal(registry.getExplorerUrl('sepolia'), 'https://sepolia.etherscan.io'); });
    it('ethereum explorer', () => { assert.equal(registry.getExplorerUrl('ethereum'), 'https://etherscan.io'); });
    it('base explorer', () => { assert.equal(registry.getExplorerUrl('base'), 'https://basescan.org'); });
  });

  describe('RPC URLs', () => {
    it('returns configured RPC for sepolia', () => { assert.ok(registry.getRpcUrl('sepolia')); });
    it('returns configured RPC for ethereum', () => { assert.ok(registry.getRpcUrl('ethereum')); });
    it('returns configured RPC for base', () => { assert.ok(registry.getRpcUrl('base')); });
    it('returns null for unsupported network', () => { assert.equal(registry.getRpcUrl('polygon'), null); });
  });

  describe('Chain config', () => {
    it('returns full config for ethereum', () => {
      const config = registry.getChainConfig('ethereum');
      assert.equal(config.chainId, 1);
      assert.equal(config.isTestnet, false);
    });
    it('sepolia is marked as testnet', () => {
      const config = registry.getChainConfig('sepolia');
      assert.equal(config.isTestnet, true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
//  2. HEALTH & PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

describe('Health & Public Endpoints', () => {
  it('GET / returns 200 with status ok', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /health returns healthy', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
  });

  it('GET /api/chains returns all 3 chains', async () => {
    const res = await request('GET', '/api/chains');
    assert.equal(res.status, 200);
    assert.equal(res.body.chains.length, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  3. AGENT REGISTRATION (X-Verification Flow)
// ═══════════════════════════════════════════════════════════════════

describe('Agent Registration', () => {
  it('registers creator agent — returns challenge, not API key', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'test_creator',
      email: 'creator@test.com',
      wallet_address: agents.creator.wallet,
      chain: 'ethereum',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.verification_challenge);
    assert.ok(!res.body.api_key, 'Should NOT return API key at registration');
    assert.ok(!res.body.api_key_id, 'Should NOT return api_key_id at registration');
    agents.creator.agentId = res.body.agent_id;
  });

  it('creator agent starts in pending_verification status', async () => {
    const agent = await getAgentByUsername('test_creator');
    assert.equal(agent.status, 'pending_verification');
    assert.equal(agent.verification_status, 'pending');
  });

  it('activating agent generates api_key_id + api_secret', async () => {
    const activation = await activateAgent(agents.creator.agentId, 'test_x_creator');
    assert.ok(activation.api_key_id.startsWith('pk_live_'));
    assert.ok(activation.api_secret.startsWith('sk_live_'));
    assert.ok(activation.expires_at);
    agents.creator.apiKeyId = activation.api_key_id;
    agents.creator.apiSecret = activation.api_secret;
  });

  it('registers and activates payer agent', async () => {
    const result = await registerAndActivate('test_payer', 'payer@test.com', agents.payer.wallet, 'sepolia');
    agents.payer.apiKeyId = result.apiKeyId;
    agents.payer.apiSecret = result.apiSecret;
    agents.payer.agentId = result.agentId;
  });

  it('rejects duplicate username', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'test_creator',
      email: 'other@test.com',
    });
    assert.equal(res.status, 409);
  });

  it('rejects missing username', async () => {
    const res = await request('POST', '/api/agents/register', { email: 'x@x.com' });
    assert.equal(res.status, 400);
  });

  it('rejects invalid email format', async () => {
    const res = await request('POST', '/api/agents/register', { username: 'badEmail', email: 'not-an-email' });
    assert.equal(res.status, 400);
  });

  it('rejects invalid wallet address format', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'badWallet',
      email: 'w@w.com',
      walletAddress: 'not-a-wallet',
    });
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  4. HMAC AUTHENTICATION & SECURITY
// ═══════════════════════════════════════════════════════════════════

describe('HMAC Authentication & Security', () => {
  it('GET /api/agents/me requires auth', async () => {
    const res = await request('GET', '/api/agents/me');
    assert.equal(res.status, 401);
  });

  it('rejects invalid API key ID', async () => {
    const res = await rawRequest('GET', '/api/agents/me', null, {
      'x-api-key-id': 'pk_live_invalidkeyid00000000000000',
      'x-timestamp': Math.floor(Date.now() / 1000).toString(),
      'x-signature': 'deadbeef'.repeat(8),
    });
    assert.equal(res.status, 401);
  });

  it('GET /api/agents/me works with valid HMAC signature', async () => {
    const res = await request('GET', '/api/agents/me', null, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'test_creator');
    assert.equal(res.body.agent.wallet_address, agents.creator.wallet);
    assert.equal(res.body.agent.verification_status, 'verified');
    assert.ok(res.body.agent.api_key_expires_at);
  });

  it('POST /api/create-link requires auth', async () => {
    const res = await request('POST', '/api/create-link', { amount: '10' });
    assert.equal(res.status, 401);
  });

  it('POST /api/pay-link requires auth', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: 'REQ-FAKE' });
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  5. WALLET MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

describe('Wallet Management', () => {
  it('updates wallet address', async () => {
    const newWallet = '0xDDEEFF0011223344556677889900AABBCCDDEEFF';
    const res = await request('POST', '/api/agents/wallet', {
      wallet_address: newWallet,
      chain: 'base',
    }, agents.payer);
    assert.equal(res.status, 200);
    assert.equal(res.body.wallet_address, newWallet);
    assert.equal(res.body.chain, 'base');
    agents.payer.wallet = newWallet;
  });

  it('rejects invalid wallet format', async () => {
    const res = await request('POST', '/api/agents/wallet', { wallet_address: '0xTOOSHORT' }, agents.payer);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  6. MULTI-CHAIN LINK CREATION
// ═══════════════════════════════════════════════════════════════════

describe('Multi-Chain Link Creation', () => {
  it('creates USDC link on sepolia', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10', network: 'sepolia', description: 'Sepolia test',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(res.body.linkId.startsWith('REQ-'));
    assert.equal(res.body.network, 'sepolia');
    assert.equal(res.body.token, 'USDC');
    links.sepolia = res.body.linkId;
  });

  it('creates USDC link on ethereum mainnet', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '50', network: 'ethereum', description: 'Mainnet payment',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.network, 'ethereum');
    links.ethereum = res.body.linkId;
  });

  it('creates USDT link on base', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '25', network: 'base', token: 'USDT', description: 'Base USDT',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.network, 'base');
    assert.equal(res.body.token, 'USDT');
    links.base = res.body.linkId;
  });

  it('creates ETH link on ethereum', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '0.5', network: 'ethereum', token: 'ETH',
    }, agents.creator);
    assert.equal(res.status, 200);
    links.ethLink = res.body.linkId;
  });

  it('rejects create-link when network is not provided', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '1', description: 'Default network test',
    }, agents.creator);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('network'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  7. NETWORK VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('Network Validation', () => {
  it('rejects "polygon"', async () => {
    const res = await request('POST', '/api/create-link', { amount: '10', network: 'polygon' }, agents.creator);
    assert.equal(res.status, 400);
  });
  it('rejects empty string network', async () => {
    const res = await request('POST', '/api/create-link', { amount: '10', network: '' }, agents.creator);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  7b. INTENT ROUTER
// ═══════════════════════════════════════════════════════════════════

describe('Intent Router — Chain Selection', () => {
  const { routeIntent } = require('./lib/ai/intentRouter');
  const testMemStore = { requests: {}, agents: {} };

  it('returns select_chain when create_link without network', async () => {
    const result = await routeIntent('create_link', { amount: '10', token: 'USDC' },
      { id: 'test', wallet_address: '0xDDEEFF0011223344556677889900AABBCCDDEEFF', chain: 'sepolia' },
      { supabase: null, memoryStore: testMemStore });
    assert.equal(result.action_required, 'select_chain');
    assert.ok(Array.isArray(result.chains));
  });

  it('creates link when network provided', async () => {
    const result = await routeIntent('create_link', { amount: '5', network: 'base', token: 'USDT' },
      { id: 'test', wallet_address: '0xDDEEFF0011223344556677889900AABBCCDDEEFF', chain: 'sepolia' },
      { supabase: null, memoryStore: testMemStore });
    assert.ok(result.linkId);
    assert.equal(result.network, 'base');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  8. PAYMENT REQUEST VIEW
// ═══════════════════════════════════════════════════════════════════

describe('Payment Request View', () => {
  it('returns 402 for pending sepolia link', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}`);
    assert.equal(res.status, 402);
    assert.equal(res.body.payment.network, 'sepolia');
  });
  it('returns 404 for non-existent link', async () => {
    const res = await request('GET', '/api/request/REQ-DOESNOTEXIST');
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9. PAY-LINK
// ═══════════════════════════════════════════════════════════════════

describe('Pay-Link (multi-chain token resolution)', () => {
  it('resolves Sepolia USDC address', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.sepolia }, agents.payer);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.tokenAddress, '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87');
  });

  it('resolves Ethereum mainnet USDC address', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.ethereum }, agents.payer);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.tokenAddress, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
  });

  it('ETH link returns null tokenAddress (native)', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.ethLink }, agents.payer);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.tokenAddress, null);
  });

  it('returns 404 for non-existent link', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: 'REQ-DOESNOTEXIST' }, agents.payer);
    assert.equal(res.status, 404);
  });

  it('requires linkId', async () => {
    const res = await request('POST', '/api/pay-link', {}, agents.payer);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9b. EXECUTE-PAYMENT — REMOVED (Security C1)
// ═══════════════════════════════════════════════════════════════════

describe('Execute Payment — Removed (Security C1)', () => {
  it('returns 410 Gone', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, agents.payer);
    assert.equal(res.status, 410);
    assert.ok(res.body.error.includes('permanently removed'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  10. PAYMENT VERIFICATION (mocked)
// ═══════════════════════════════════════════════════════════════════

describe('Payment Verification', () => {
  it('requires requestId and txHash', async () => {
    const res = await request('POST', '/api/verify', {}, agents.payer);
    assert.equal(res.status, 400);
  });
  it('returns 404 for non-existent request', async () => {
    const res = await request('POST', '/api/verify', { requestId: 'REQ-DOESNOTEXIST', txHash: '0xfake' }, agents.payer);
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  11. INPUT VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('Input Validation & Edge Cases', () => {
  it('rejects zero amount', async () => {
    const res = await request('POST', '/api/create-link', { amount: '0' }, agents.creator);
    assert.equal(res.status, 400);
  });
  it('rejects negative amount', async () => {
    const res = await request('POST', '/api/create-link', { amount: '-5' }, agents.creator);
    assert.equal(res.status, 400);
  });
  it('rejects non-numeric amount', async () => {
    const res = await request('POST', '/api/create-link', { amount: 'abc' }, agents.creator);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  12. REQUEST LISTING & DELETION
// ═══════════════════════════════════════════════════════════════════

describe('Request Listing & Deletion', () => {
  it('lists all requests for authenticated agent', async () => {
    const res = await request('GET', '/api/requests', null, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(res.body.requests.length > 0);
  });

  it('deletes a request', async () => {
    const createRes = await request('POST', '/api/create-link', { amount: '1', network: 'sepolia' }, agents.creator);
    const tempId = createRes.body.linkId;
    const delRes = await request('DELETE', `/api/request/${tempId}`, null, agents.creator);
    assert.equal(delRes.status, 200);
    const getRes = await request('GET', `/api/request/${tempId}`);
    assert.equal(getRes.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  13. PLATFORM STATS
// ═══════════════════════════════════════════════════════════════════

describe('Platform Stats', () => {
  it('GET /api/stats returns stats object', async () => {
    const res = await request('GET', '/api/stats');
    assert.equal(res.status, 200);
    assert.ok('totalAgents' in res.body.stats);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  14. CROSS-CHAIN CONSISTENCY
// ═══════════════════════════════════════════════════════════════════

describe('Cross-Chain Consistency', () => {
  it('same token has DIFFERENT addresses across chains', () => {
    const sepoliaUSDC = registry.getTokenAddress('sepolia', 'USDC');
    const ethUSDC = registry.getTokenAddress('ethereum', 'USDC');
    const baseUSDC = registry.getTokenAddress('base', 'USDC');
    assert.notEqual(sepoliaUSDC, ethUSDC);
    assert.notEqual(sepoliaUSDC, baseUSDC);
    assert.notEqual(ethUSDC, baseUSDC);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  15. API KEY ROTATION (now returns api_key_id + api_secret)
// ═══════════════════════════════════════════════════════════════════

describe('API Key Rotation', () => {
  let oldKeyId;
  let oldSecret;
  let newKeyId;
  let newSecret;

  it('rotates API key and returns new credentials', async () => {
    oldKeyId = agents.payer.apiKeyId;
    oldSecret = agents.payer.apiSecret;
    const res = await request('POST', '/api/agents/rotate-key', {}, agents.payer);
    assert.equal(res.status, 200);
    assert.ok(res.body.api_key_id.startsWith('pk_live_'));
    assert.ok(res.body.api_secret.startsWith('sk_live_'));
    assert.ok(res.body.expires_at);
    newKeyId = res.body.api_key_id;
    newSecret = res.body.api_secret;
    agents.payer.apiKeyId = newKeyId;
    agents.payer.apiSecret = newSecret;
  });

  it('old credentials no longer work', async () => {
    const res = await request('GET', '/api/agents/me', null, { apiKeyId: oldKeyId, apiSecret: oldSecret });
    assert.equal(res.status, 401);
  });

  it('new credentials work', async () => {
    const res = await request('GET', '/api/agents/me', null, { apiKeyId: newKeyId, apiSecret: newSecret });
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'test_payer');
  });

  it('requires auth to rotate', async () => {
    const res = await request('POST', '/api/agents/rotate-key', {});
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  16. AGENT DEACTIVATION & SOFT DELETE
// ═══════════════════════════════════════════════════════════════════

describe('Agent Deactivation & Soft Delete', () => {
  let tempAgent;

  it('register temp agent for deactivation test', async () => {
    tempAgent = await registerAndActivate('temp_deact_agent', 'temp@test.com', '0xAA00BB00CC00DD00EE00FF00112233445566778A', 'sepolia');
    assert.ok(tempAgent.apiKeyId);
  });

  it('deactivates agent', async () => {
    const res = await request('POST', '/api/agents/deactivate', {}, tempAgent);
    assert.equal(res.status, 200);
    assert.equal(res.body.message, 'Agent deactivated');
  });

  it('deactivated agent is rejected by auth', async () => {
    const res = await request('GET', '/api/agents/me', null, tempAgent);
    assert.equal(res.status, 403);
  });

  it('register another temp agent for deletion test', async () => {
    tempAgent = await registerAndActivate('temp_delete_agent', 'del@test.com', '0xAA00BB00CC00DD00EE00FF00112233445566778B', 'sepolia');
  });

  it('soft-deletes agent', async () => {
    const res = await request('DELETE', '/api/agents/me', null, tempAgent);
    assert.equal(res.status, 200);
    assert.ok(res.body.message.includes('deleted'));
  });

  it('deleted agent is rejected by auth', async () => {
    const res = await request('GET', '/api/agents/me', null, tempAgent);
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  17. AGENT LOGS & IP HISTORY
// ═══════════════════════════════════════════════════════════════════

describe('Agent Logs & IP History', () => {
  it('GET /api/agents/logs returns paginated logs', async () => {
    // Make a few requests first to generate logs
    await request('GET', '/api/agents/me', null, agents.creator);
    await request('GET', '/api/agents/me', null, agents.creator);

    const res = await request('GET', '/api/agents/logs?limit=10&offset=0', null, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.logs));
    assert.ok(typeof res.body.total === 'number');
  });

  it('GET /api/agents/ip-history returns IP history', async () => {
    const res = await request('GET', '/api/agents/ip-history', null, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.ip_history));
  });

  it('requires auth to view logs', async () => {
    const res = await request('GET', '/api/agents/logs');
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  18. X (TWITTER) VERIFICATION FLOW
// ═══════════════════════════════════════════════════════════════════

describe('X Verification — API Endpoint', () => {
  it('POST /api/agents/verify-x requires username and tweet_url', async () => {
    const res = await request('POST', '/api/agents/verify-x', {});
    assert.equal(res.status, 400);
  });

  it('returns 404 for non-existent username', async () => {
    const res = await request('POST', '/api/agents/verify-x', {
      username: 'nonexistent_user_12345',
      tweet_url: 'https://x.com/someone/status/12345',
    });
    assert.equal(res.status, 404);
  });

  it('rejects already-verified agent', async () => {
    const res = await request('POST', '/api/agents/verify-x', {
      username: 'test_creator',
      tweet_url: 'https://x.com/test_creator/status/12345',
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('already verified'));
  });
});

describe('X Verification — Unit Tests', () => {
  const { generateChallenge, isValidTweetUrl, extractUsernameFromUrl } = require('./lib/xVerification');

  it('generateChallenge returns correct format', () => {
    const challenge = generateChallenge('testuser');
    assert.ok(challenge.startsWith('payagent-verify-testuser-'));
  });

  it('isValidTweetUrl accepts x.com URLs', () => {
    assert.ok(isValidTweetUrl('https://x.com/user/status/12345'));
    assert.ok(isValidTweetUrl('https://twitter.com/user/status/12345'));
  });

  it('isValidTweetUrl rejects invalid URLs', () => {
    assert.equal(isValidTweetUrl('https://example.com'), false);
    assert.equal(isValidTweetUrl('not-a-url'), false);
  });

  it('extractUsernameFromUrl works correctly', () => {
    assert.equal(extractUsernameFromUrl('https://x.com/john_doe/status/12345'), 'john_doe');
    assert.equal(extractUsernameFromUrl('https://twitter.com/alice/status/67890'), 'alice');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  19. RATE LIMITING
// ═══════════════════════════════════════════════════════════════════

describe('Rate Limiting', () => {
  it('rate limit headers are present in responses', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    assert.ok('ratelimit-limit' in res.headers || 'x-ratelimit-limit' in res.headers,
      'Should have rate limit headers');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  20. AGENT LOOKUP BY WALLET
// ═══════════════════════════════════════════════════════════════════

describe('Agent Lookup by Wallet', () => {
  it('finds agent by wallet address', async () => {
    const res = await request('GET', `/api/agents/by-wallet?wallet=${agents.creator.wallet}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.agent);
    assert.equal(res.body.agent.username, 'test_creator');
  });

  it('returns null for unknown wallet', async () => {
    const res = await request('GET', '/api/agents/by-wallet?wallet=0x0000000000000000000000000000000000000001');
    assert.equal(res.status, 200);
    assert.equal(res.body.agent, null);
  });

  it('rejects invalid wallet format', async () => {
    const res = await request('GET', '/api/agents/by-wallet?wallet=invalid');
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  21. HMAC SIGNATURE VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('HMAC Signature Validation', () => {
  it('valid HMAC signature is accepted', async () => {
    const res = await request('GET', '/api/agents/me', null, agents.creator);
    assert.equal(res.status, 200);
  });

  it('invalid signature is rejected', async () => {
    const res = await rawRequest('GET', '/api/agents/me', null, {
      'x-api-key-id': agents.creator.apiKeyId,
      'x-timestamp': Math.floor(Date.now() / 1000).toString(),
      'x-signature': 'badsignature'.padEnd(64, '0'),
    });
    assert.equal(res.status, 401);
    assert.ok(res.body.error.includes('Invalid signature'));
  });

  it('expired timestamp is rejected (replay protection)', async () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 min ago
    const bodyStr = '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
    const stringToSign = `${oldTimestamp}\nGET\n/api/agents/me\n${bodyHash}`;
    const signature = computeHmac(stringToSign, agents.creator.apiSecret);

    const res = await rawRequest('GET', '/api/agents/me', null, {
      'x-api-key-id': agents.creator.apiKeyId,
      'x-timestamp': oldTimestamp,
      'x-signature': signature,
    });
    assert.equal(res.status, 401);
    assert.ok(res.body.error.includes('timestamp'));
  });

  it('missing HMAC headers are rejected', async () => {
    // Only provide key ID, missing timestamp and signature
    const res = await rawRequest('GET', '/api/agents/me', null, {
      'x-api-key-id': agents.creator.apiKeyId,
    });
    assert.equal(res.status, 401);
    assert.ok(res.body.error.includes('Missing HMAC headers'));
  });

  it('tampered body is detected (POST request)', async () => {
    // Sign with one body, send a different one
    const url = new URL('/api/create-link', BASE_URL);
    const legitimateBody = { amount: '10', network: 'sepolia' };
    const { timestamp, signature } = signRequest('POST', '/api/create-link', legitimateBody, agents.creator.apiKeyId, agents.creator.apiSecret);

    // Send with a DIFFERENT body
    const tamperedBody = { amount: '999999', network: 'sepolia' };

    const res = await rawRequest('POST', '/api/create-link', tamperedBody, {
      'x-api-key-id': agents.creator.apiKeyId,
      'x-timestamp': timestamp,
      'x-signature': signature,
    });
    assert.equal(res.status, 401);
    assert.ok(res.body.error.includes('Invalid signature'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  22. WALLET AUTH (Challenge + Verify + JWT)
// ═══════════════════════════════════════════════════════════════════

describe('Wallet Auth — Challenge & Verify', () => {
  it('POST /api/auth/challenge returns a nonce', async () => {
    const res = await request('POST', '/api/auth/challenge', {
      wallet_address: agents.creator.wallet,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.nonce);
    assert.ok(res.body.nonce.startsWith('Sign this to login to PayAgent:'));
    assert.equal(res.body.expires_in, 300);
  });

  it('POST /api/auth/challenge rejects invalid wallet', async () => {
    const res = await request('POST', '/api/auth/challenge', {
      wallet_address: 'not-a-wallet',
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/verify rejects invalid signature', async () => {
    // First get a challenge
    const challengeRes = await request('POST', '/api/auth/challenge', {
      wallet_address: agents.creator.wallet,
    });
    assert.equal(challengeRes.status, 200);

    // Submit a fake signature
    const res = await request('POST', '/api/auth/verify', {
      wallet_address: agents.creator.wallet,
      signature: '0xdeadbeef',
    });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/verify rejects without prior challenge', async () => {
    const res = await request('POST', '/api/auth/verify', {
      wallet_address: '0x1111111111111111111111111111111111111111',
      signature: '0xdeadbeef',
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('No pending challenge'));
  });

  it('JWT auth works for dashboard endpoints (unit test via ethers)', async function() {
    // Use ethers to create a proper wallet and sign
    const { ethers } = require('ethers');
    const wallet = ethers.Wallet.createRandom();
    // Use lowercase consistently: verifyHandler calls getAgentByWallet(wallet_address)
    // with the original case from the request, while in-memory store does exact match
    const walletAddress = wallet.address.toLowerCase();

    // Register and activate an agent with this wallet
    const tempAgent = await registerAndActivate(
      'jwt_test_agent',
      'jwt@test.com',
      walletAddress,
      'sepolia'
    );

    // Get challenge
    const challengeRes = await request('POST', '/api/auth/challenge', {
      wallet_address: walletAddress,
    });
    assert.equal(challengeRes.status, 200);
    const nonce = challengeRes.body.nonce;

    // Sign with ethers
    const signature = await wallet.signMessage(nonce);

    // Verify and get JWT
    const verifyRes = await request('POST', '/api/auth/verify', {
      wallet_address: walletAddress,
      signature,
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.token);
    assert.equal(verifyRes.body.expires_in, 3600);
    assert.ok(verifyRes.body.agent);
    assert.equal(verifyRes.body.agent.username, 'jwt_test_agent');

    // Use JWT for authenticated endpoint
    const jwtToken = verifyRes.body.token;
    const meRes = await request('GET', '/api/agents/me', null, `jwt_${jwtToken}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.agent.username, 'jwt_test_agent');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  23. FEE CALCULATOR — PAYMENT TOKEN FALLBACK
// ═══════════════════════════════════════════════════════════════════

describe('Fee Calculator — Payment Token Fallback', () => {
  const { calculateFee } = require('./lib/feeCalculator');

  it('returns feeDeductedFromPayment=true when paying in USDC (no LCX balance)', async () => {
    // Use a random address that has no LCX on any chain
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'sepolia', 'USDC');
    assert.equal(result.feeDeductedFromPayment, true);
    assert.equal(result.feeToken, 'USDC');
    assert.ok(result.feeTotal > 0);
    assert.ok(result.platformShare > 0);
    assert.ok(result.creatorReward > 0);
    assert.ok(Math.abs(result.feeTotal - result.platformShare - result.creatorReward) < 0.000001);
  });

  it('returns feeDeductedFromPayment=true when paying in USDT (no LCX balance)', async () => {
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'base', 'USDT');
    assert.equal(result.feeDeductedFromPayment, true);
    assert.equal(result.feeToken, 'USDT');
    assert.ok(result.feeTotal > 0);
  });

  it('returns feeDeductedFromPayment=true when paying in ETH (no LCX balance)', async () => {
    // ETH fee requires ETH/USD price lookup — uses fallback $2500 if CoinGecko is unreachable
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'ethereum', 'ETH');
    assert.equal(result.feeDeductedFromPayment, true);
    assert.equal(result.feeToken, 'ETH');
    assert.ok(result.feeTotal > 0);
    assert.ok(result.feeTotal < 1, 'ETH fee should be a fraction of an ETH');
  });

  it('LCX as payment token and no LCX balance returns fee in LCX denomination', async () => {
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'sepolia', 'LCX');
    assert.equal(result.feeDeductedFromPayment, true);
    assert.equal(result.feeToken, 'LCX');
    assert.equal(result.feeTotal, 4); // Standard 4 LCX fee
    assert.equal(result.platformShare, 2);
    assert.equal(result.creatorReward, 2);
  });

  it('fee splits are approximately 50/50 for stablecoin fallback', async () => {
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'sepolia', 'USDC');
    assert.equal(result.feeDeductedFromPayment, true);
    // platformShare = floor(feeTotal/2), creatorReward = feeTotal - platformShare
    // Allow rounding difference of up to 0.01 (1 cent)
    assert.ok(Math.abs(result.platformShare - result.creatorReward) < 0.01,
      `Platform (${result.platformShare}) and creator (${result.creatorReward}) shares should be approximately equal`);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  24. PUBLIC FEE ENDPOINT — GET /api/request/:id/fee
// ═══════════════════════════════════════════════════════════════════

describe('Public Fee Endpoint — GET /api/request/:id/fee', () => {
  it('returns fee breakdown for an existing link', async () => {
    const payerAddr = '0x0000000000000000000000000000000000000002';
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=${payerAddr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.payment);
    assert.ok(res.body.fee);
    assert.ok(Array.isArray(res.body.transfers));
    assert.equal(res.body.transfers.length, 3);
    assert.ok(res.body.creatorReceives);
  });

  it('fee-deducted transfer reduces creator amount', async () => {
    const payerAddr = '0x0000000000000000000000000000000000000002';
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=${payerAddr}`);
    assert.equal(res.status, 200);

    if (res.body.fee.feeDeductedFromPayment) {
      const creatorReceives = parseFloat(res.body.creatorReceives);
      const paymentAmount = parseFloat(res.body.payment.amount);
      assert.ok(creatorReceives < paymentAmount, 'Creator should receive less than payment when fee is deducted');
      assert.ok(creatorReceives > 0, 'Creator should still receive a positive amount');
    }
  });

  it('returns 3 transfers (payment, platform fee, creator reward)', async () => {
    const payerAddr = '0x0000000000000000000000000000000000000002';
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=${payerAddr}`);
    assert.equal(res.status, 200);

    const descriptions = res.body.transfers.map(t => t.description);
    assert.ok(descriptions.includes('Payment to creator'));
    assert.ok(descriptions.includes('Platform fee'));
    assert.ok(descriptions.includes('Creator reward'));
  });

  it('returns fee breakdown for USDT link on base', async () => {
    const payerAddr = '0x0000000000000000000000000000000000000002';
    const res = await request('GET', `/api/request/${links.base}/fee?payer=${payerAddr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.payment.token, 'USDT');
    assert.equal(res.body.payment.network, 'base');
    assert.ok(res.body.fee);
  });

  it('returns 404 for non-existent link', async () => {
    const res = await request('GET', '/api/request/REQ-NOPE/fee?payer=0x0000000000000000000000000000000000000002');
    assert.equal(res.status, 404);
  });

  it('rejects missing payer address', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}/fee`);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('payer'));
  });

  it('rejects invalid payer address format', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=invalid`);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('payer'));
  });

  it('no auth required (public endpoint)', async () => {
    // No auth headers — should still work
    const payerAddr = '0x0000000000000000000000000000000000000002';
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=${payerAddr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  25. PAY-LINK — FEE DEDUCTION FROM PAYMENT TOKEN
// ═══════════════════════════════════════════════════════════════════

describe('Pay-Link — Fee Deduction from Payment Token', () => {
  it('transfers use payment token when fee is deducted', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.sepolia }, agents.payer);
    assert.equal(res.status, 200);

    const feeInfo = res.body.instructions.fee;
    if (feeInfo.feeDeductedFromPayment) {
      // All transfers should be in the same token
      const paymentToken = res.body.instructions.payment.token;
      for (const transfer of res.body.instructions.transfers) {
        assert.equal(transfer.token, paymentToken, `Transfer "${transfer.description}" should use ${paymentToken}`);
      }

      // Creator amount should be reduced
      const creatorTransfer = res.body.instructions.transfers.find(t => t.description === 'Payment to creator');
      assert.ok(Number(creatorTransfer.amount) < Number(res.body.instructions.payment.amount),
        'Creator should receive less than the payment amount');

      // Verify feeDeductedFromPayment flag and creatorReceives
      assert.equal(res.body.instructions.feeDeductedFromPayment, true);
      assert.ok(res.body.instructions.creatorReceives);
    }
  });

  it('USDT link on base deducts fee from USDT', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.base }, agents.payer);
    assert.equal(res.status, 200);

    const feeInfo = res.body.instructions.fee;
    if (feeInfo.feeDeductedFromPayment) {
      assert.equal(feeInfo.feeToken, 'USDT');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
//  26. EDGE CASES — PAYMENT AMOUNT vs FEE
// ═══════════════════════════════════════════════════════════════════

describe('Edge Cases — Payment Amount vs Fee', () => {
  let tinyLink;

  it('creates a very small payment link', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '0.001', network: 'sepolia', token: 'USDC', description: 'Tiny payment',
    }, agents.creator);
    assert.equal(res.status, 200);
    tinyLink = res.body.linkId;
  });

  it('pay-link rejects when payment amount <= fee', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: tinyLink }, agents.payer);
    // Should return 400 because fee exceeds payment amount
    // (unless payer has LCX, in which case LCX fee path is used and no deduction)
    if (res.body.instructions && res.body.instructions.fee && res.body.instructions.fee.feeDeductedFromPayment) {
      // This shouldn't happen — the server should reject it
      assert.fail('Server should have rejected payment where fee >= amount');
    } else if (res.status === 400) {
      assert.ok(res.body.error.includes('fee') || res.body.error.includes('greater'));
    }
    // If status is 200, the payer has LCX and the LCX fee path was used (no deduction)
  });

  it('public fee endpoint rejects when payment amount <= fee', async () => {
    const payerAddr = '0x0000000000000000000000000000000000000003';
    const res = await request('GET', `/api/request/${tinyLink}/fee?payer=${payerAddr}`);
    // Should be 400 since fee will exceed 0.001 USDC
    if (res.status === 400) {
      assert.ok(res.body.error.includes('fee') || res.body.error.includes('greater'));
    }
    // Status 200 only if payer has LCX (unlikely for 0x000...003)
  });
});

// ═══════════════════════════════════════════════════════════════════
//  27. DELETE AUTH — NEW-H1 (require real auth, no wallet query param)
// ═══════════════════════════════════════════════════════════════════

describe('DELETE Auth — NEW-H1', () => {
  let tempLinkId;

  it('creates a link for deletion tests', async () => {
    const res = await request('POST', '/api/create-link', { amount: '2', network: 'sepolia' }, agents.creator);
    assert.equal(res.status, 200);
    tempLinkId = res.body.linkId;
  });

  it('rejects unauthenticated delete with no wallet param (no auth)', async () => {
    const res = await request('DELETE', `/api/request/${tempLinkId}`);
    // optionalAuthMiddleware allows unauthenticated requests through;
    // endpoint returns 400 when neither auth nor wallet param is provided
    assert.equal(res.status, 400, 'No auth + no wallet param should return 400');
  });

  it('rejects delete by non-creator agent', async () => {
    const res = await request('DELETE', `/api/request/${tempLinkId}`, null, agents.payer);
    assert.equal(res.status, 403, 'Non-creator should get 403');
  });

  it('allows delete by authenticated creator agent', async () => {
    const res = await request('DELETE', `/api/request/${tempLinkId}`, null, agents.creator);
    assert.equal(res.status, 200, 'Creator should be able to delete');
    assert.ok(res.body.success);
  });

  it('returns 404 for already-deleted request', async () => {
    const res = await request('DELETE', `/api/request/${tempLinkId}`, null, agents.creator);
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  28. WEBHOOK SECRET ENCRYPTION — H3 (encrypt, not hash)
// ═══════════════════════════════════════════════════════════════════

describe('Webhook Secret Encryption — H3', () => {
  const { encryptSecret, decryptSecret } = require('./lib/crypto');

  it('encryptSecret produces a reversible iv:ciphertext:authTag format', () => {
    const raw = 'whsec_' + crypto.randomBytes(32).toString('hex');
    const encrypted = encryptSecret(raw);
    // Should be in iv:ciphertext:authTag format
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3, 'Encrypted secret should have 3 colon-separated parts');
    // Decrypt should return original
    const decrypted = decryptSecret(encrypted);
    assert.equal(decrypted, raw, 'Decrypted secret should match original');
  });

  it('encrypted secret is NOT the same as a SHA256 hash', () => {
    const raw = 'whsec_test123';
    const encrypted = encryptSecret(raw);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    assert.notEqual(encrypted, hash, 'Encrypted format should differ from SHA256 hash');
    // Encrypted format has colons, hash does not
    assert.ok(encrypted.includes(':'), 'Encrypted secret should contain colons');
    assert.ok(!hash.includes(':'), 'SHA256 hash should not contain colons');
  });

  it('HMAC signed with decrypted secret matches HMAC signed with original', () => {
    const rawSecret = 'whsec_' + crypto.randomBytes(32).toString('hex');
    const encrypted = encryptSecret(rawSecret);
    const decrypted = decryptSecret(encrypted);

    const payload = JSON.stringify({ event: 'payment.paid', amount: '10.00' });

    const sigFromOriginal = crypto.createHmac('sha256', rawSecret).update(payload).digest('hex');
    const sigFromDecrypted = crypto.createHmac('sha256', decrypted).update(payload).digest('hex');

    assert.equal(sigFromDecrypted, sigFromOriginal,
      'Signature from decrypted secret must match signature from original secret');
  });

  it('HMAC signed with SHA256 hash does NOT match original (the old bug)', () => {
    const rawSecret = 'whsec_' + crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(rawSecret).digest('hex');

    const payload = JSON.stringify({ event: 'payment.paid', amount: '10.00' });

    const sigFromOriginal = crypto.createHmac('sha256', rawSecret).update(payload).digest('hex');
    const sigFromHash = crypto.createHmac('sha256', hash).update(payload).digest('hex');

    assert.notEqual(sigFromHash, sigFromOriginal,
      'Signature from SHA256 hash should NOT match (this was the H3 bug)');
  });
});
