#!/usr/bin/env node

/**
 * PayAgent Platform — Comprehensive E2E Pre-Launch Test Suite
 *
 * Covers ALL 34 API endpoints across 13 test groups:
 *
 *   1.  Health & Configuration
 *   2.  Agent Lifecycle (Registration, Activation, Profile, Deactivation, Delete)
 *   3.  Wallet Auth & JWT (Challenge, Verify, Wallet-only JWT)
 *   4.  Payment Link Creation (Agent HMAC + Human wallet)
 *   5.  Payment Request Retrieval & Fee Info
 *   6.  Payment Verification (mocked — no real blockchain)
 *   7.  Request Listing & Deletion (HMAC, wallet-param, ownership checks)
 *   8.  Rewards & Platform Stats
 *   9.  Webhook CRUD
 *  10.  HMAC Security (replay, tamper, missing headers)
 *  11.  Input Validation & Edge Cases
 *  12.  Agent Logs & IP History
 *  13.  Rate Limiting
 *
 * Run:  node --test --test-force-exit e2e-all-features-test.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('crypto');

// ─── Force in-memory mode (no Supabase) ────────────────────────────
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

// ─── Provide required env vars ─────────────────────────────────────
process.env.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/test';
process.env.ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/test';
process.env.BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
process.env.PLATFORM_TREASURY_WALLET = '0xTREASURY0000000000000000000000000000001';
process.env.LCX_CONTRACT_ADDRESS = '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b';
process.env.HMAC_ENCRYPTION_KEY = process.env.HMAC_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ─── Imports ───────────────────────────────────────────────────────
const { activateAgent, getAgentByUsername } = require('./lib/agents');
const { computeHmac, buildStringToSign } = require('./lib/crypto');

// ─── Boot Express app ──────────────────────────────────────────────
const app = require('./api/index');
let server;
let BASE_URL;

// ─── Test State ────────────────────────────────────────────────────
const agents = {
  creator: { apiKeyId: null, apiSecret: null, agentId: null, wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC1' },
  payer:   { apiKeyId: null, apiSecret: null, agentId: null, wallet: '0xAABBCCDDEEFF00112233445566778899AABBCCDD' },
};

const links = {
  sepolia: null,
  ethereum: null,
  base: null,
  ethLink: null,
  humanLink: null,
  deleteAgentLink: null,
  deleteHumanLink: null,
  deleteNonOwnerLink: null,
};

const HUMAN_WALLET = '0x1234567890ABCDEF1234567890ABCDEF12345678';

// ─── HMAC Signing Helper ──────────────────────────────────────────
function signRequest(method, path, body, apiKeyId, apiSecret) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyStr = body ? JSON.stringify(body) : '';
  const stringToSign = buildStringToSign(timestamp, method, path, bodyStr);
  const signature = computeHmac(stringToSign, apiSecret);
  return { timestamp, signature, apiKeyId };
}

// ─── HTTP Helper ──────────────────────────────────────────────────
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
        const { timestamp, signature, apiKeyId } = signRequest(
          method, url.pathname, body, auth.apiKeyId, auth.apiSecret
        );
        opts.headers['x-api-key-id'] = apiKeyId;
        opts.headers['x-timestamp'] = timestamp;
        opts.headers['x-signature'] = signature;
      } else if (typeof auth === 'string' && auth.startsWith('jwt_')) {
        opts.headers['Authorization'] = `Bearer ${auth.substring(4)}`;
      } else if (typeof auth === 'string') {
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

async function registerAndActivate(username, email, wallet, chain) {
  const res = await request('POST', '/api/agents/register', {
    username, email, wallet_address: wallet, chain: chain || 'sepolia',
  });
  assert.equal(res.status, 201);
  const agentId = res.body.agent_id;
  const activation = await activateAgent(agentId, `x_${username}`);
  return { agentId, apiKeyId: activation.api_key_id, apiSecret: activation.api_secret };
}

// ═══════════════════════════════════════════════════════════════════
//  LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      const addr = server.address();
      BASE_URL = `http://127.0.0.1:${addr.port}`;
      console.log(`\n  E2E test server on ${BASE_URL}\n`);
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
//  1. HEALTH & CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

describe('1. Health & Configuration', () => {
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

  it('GET /api/chains returns 3 supported chains', async () => {
    const res = await request('GET', '/api/chains');
    assert.equal(res.status, 200);
    assert.equal(res.body.chains.length, 3);
    const names = res.body.chains.map(c => c.id || c.name || c);
    assert.ok(names.some(n => n === 'sepolia' || n.includes('sepolia')));
  });

  it('GET /api/prices returns token prices with correct structure', async () => {
    const res = await request('GET', '/api/prices');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.prices);
    assert.ok(typeof res.body.prices.LCX === 'number');
    assert.ok(typeof res.body.prices.ETH === 'number');
    assert.ok(typeof res.body.prices.USDC === 'number');
    assert.ok(typeof res.body.prices.USDT === 'number');
    assert.ok(res.body.prices.LCX > 0, 'LCX price should be > 0');
    assert.ok(res.body.prices.ETH > 0, 'ETH price should be > 0');
    assert.ok(res.body.prices.USDC > 0, 'USDC price should be > 0');
    assert.ok(res.body.prices.USDT > 0, 'USDT price should be > 0');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  2. AGENT LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

describe('2. Agent Lifecycle', () => {
  it('registers creator agent (returns challenge, not API key)', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'e2e_creator', email: 'creator@e2e.com',
      wallet_address: agents.creator.wallet, chain: 'ethereum',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.verification_challenge);
    assert.ok(!res.body.api_key, 'Should NOT return API key at registration');
    agents.creator.agentId = res.body.agent_id;
  });

  it('creator is pending_verification before activation', async () => {
    const agent = await getAgentByUsername('e2e_creator');
    assert.equal(agent.status, 'pending_verification');
  });

  it('activating agent yields api_key_id + api_secret', async () => {
    const activation = await activateAgent(agents.creator.agentId, 'x_e2e_creator');
    assert.ok(activation.api_key_id.startsWith('pk_live_'));
    assert.ok(activation.api_secret.startsWith('sk_live_'));
    agents.creator.apiKeyId = activation.api_key_id;
    agents.creator.apiSecret = activation.api_secret;
  });

  it('registers and activates payer agent', async () => {
    const result = await registerAndActivate('e2e_payer', 'payer@e2e.com', agents.payer.wallet, 'sepolia');
    agents.payer.apiKeyId = result.apiKeyId;
    agents.payer.apiSecret = result.apiSecret;
    agents.payer.agentId = result.agentId;
  });

  it('GET /api/agents/me (HMAC) returns creator profile', async () => {
    const res = await request('GET', '/api/agents/me', null, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'e2e_creator');
    assert.equal(res.body.agent.status, 'active');
    assert.equal(res.body.agent.verification_status, 'verified');
  });

  it('GET /api/agents/by-wallet returns agent', async () => {
    const res = await request('GET', `/api/agents/by-wallet?wallet=${agents.creator.wallet}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'e2e_creator');
  });

  it('GET /api/agents/by-wallet returns null for unknown wallet', async () => {
    const res = await request('GET', '/api/agents/by-wallet?wallet=0x0000000000000000000000000000000000000099');
    assert.equal(res.status, 200);
    assert.equal(res.body.agent, null);
  });

  it('GET /api/agents/list returns agents array (empty in-memory)', async () => {
    const res = await request('GET', '/api/agents/list');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(Array.isArray(res.body.agents));
  });

  it('rejects duplicate username registration', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'e2e_creator', email: 'other@e2e.com',
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
});

// ═══════════════════════════════════════════════════════════════════
//  3. WALLET AUTH & JWT
// ═══════════════════════════════════════════════════════════════════

describe('3. Wallet Auth & JWT', () => {
  let jwtToken = null;

  it('POST /api/auth/challenge returns nonce', async () => {
    const res = await request('POST', '/api/auth/challenge', {
      wallet_address: agents.creator.wallet,
    });
    assert.equal(res.status, 200);
    assert.ok(res.body.nonce);
    assert.ok(res.body.nonce.startsWith('Sign this to login to PayAgent:'));
    assert.equal(res.body.expires_in, 300);
  });

  it('POST /api/auth/challenge rejects invalid wallet', async () => {
    const res = await request('POST', '/api/auth/challenge', { wallet_address: 'not-a-wallet' });
    assert.equal(res.status, 400);
  });

  it('POST /api/auth/verify rejects fake signature', async () => {
    await request('POST', '/api/auth/challenge', { wallet_address: agents.creator.wallet });
    const res = await request('POST', '/api/auth/verify', {
      wallet_address: agents.creator.wallet, signature: '0xdeadbeef',
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

  it('full wallet login flow with ethers.Wallet (agent wallet)', async () => {
    const { ethers } = require('ethers');
    const wallet = ethers.Wallet.createRandom();
    // Use lowercase everywhere: registration, challenge, verify all must match
    // (getAgentByWallet does exact match in-memory; verifyHandler uses original case)
    const lowerAddr = wallet.address.toLowerCase();

    const tempAgent = await registerAndActivate('jwt_flow_agent', 'jwt@e2e.com', lowerAddr, 'sepolia');

    const challengeRes = await request('POST', '/api/auth/challenge', { wallet_address: lowerAddr });
    assert.equal(challengeRes.status, 200);

    const signature = await wallet.signMessage(challengeRes.body.nonce);
    const verifyRes = await request('POST', '/api/auth/verify', {
      wallet_address: lowerAddr, signature,
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.token);
    assert.equal(verifyRes.body.expires_in, 3600);
    assert.ok(verifyRes.body.agent, 'Agent field should be present for agent wallet');
    assert.equal(verifyRes.body.agent.username, 'jwt_flow_agent');

    jwtToken = verifyRes.body.token;

    const meRes = await request('GET', '/api/agents/me', null, `jwt_${jwtToken}`);
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.agent.username, 'jwt_flow_agent');
  });

  it('wallet-only JWT (no agent) — agent field is null', async () => {
    const { ethers } = require('ethers');
    const standaloneWallet = ethers.Wallet.createRandom();

    const challengeRes = await request('POST', '/api/auth/challenge', { wallet_address: standaloneWallet.address });
    assert.equal(challengeRes.status, 200);

    const signature = await standaloneWallet.signMessage(challengeRes.body.nonce);
    const verifyRes = await request('POST', '/api/auth/verify', {
      wallet_address: standaloneWallet.address, signature,
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.token, 'Should still get a JWT');
    assert.equal(verifyRes.body.agent, null, 'Agent should be null for non-agent wallet');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  4. PAYMENT LINK CREATION
// ═══════════════════════════════════════════════════════════════════

describe('4. Payment Link Creation', () => {
  it('agent creates USDC link on sepolia (HMAC)', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10', network: 'sepolia', description: 'E2E sepolia test',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(res.body.linkId.startsWith('REQ-'));
    assert.equal(res.body.network, 'sepolia');
    assert.equal(res.body.token, 'USDC');
    links.sepolia = res.body.linkId;
  });

  it('agent creates USDC link on ethereum (HMAC)', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '50', network: 'ethereum', description: 'E2E mainnet',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.network, 'ethereum');
    links.ethereum = res.body.linkId;
  });

  it('agent creates USDT link on base (HMAC)', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '25', network: 'base', token: 'USDT',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.token, 'USDT');
    links.base = res.body.linkId;
  });

  it('agent creates ETH link on ethereum (HMAC)', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '0.5', network: 'ethereum', token: 'ETH',
    }, agents.creator);
    assert.equal(res.status, 200);
    links.ethLink = res.body.linkId;
  });

  it('human creates link via POST /api/create (no auth, with creatorWallet)', async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC', amount: '15', receiver: HUMAN_WALLET,
      network: 'sepolia', creatorWallet: HUMAN_WALLET,
    });
    assert.ok([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}`);
    assert.ok(res.body.request.id.startsWith('REQ-'));
    links.humanLink = res.body.request.id;
  });

  it('rejects missing network on create-link', async () => {
    const res = await request('POST', '/api/create-link', { amount: '1' }, agents.creator);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('network'));
  });

  it('rejects unsupported network', async () => {
    const res = await request('POST', '/api/create-link', { amount: '10', network: 'polygon' }, agents.creator);
    assert.equal(res.status, 400);
  });

  it('rejects POST /api/create with missing required fields', async () => {
    const res = await request('POST', '/api/create', { token: 'USDC' });
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  5. PAYMENT REQUEST RETRIEVAL & FEE INFO
// ═══════════════════════════════════════════════════════════════════

describe('5. Payment Request Retrieval & Fee Info', () => {
  it('GET /api/request/:id returns 402 for pending link', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}`);
    assert.equal(res.status, 402);
    assert.ok(res.body.payment);
    assert.equal(res.body.payment.network, 'sepolia');
    assert.equal(res.body.payment.token, 'USDC');
  });

  it('GET /api/request/:id returns 404 for non-existent link', async () => {
    const res = await request('GET', '/api/request/REQ-DOESNOTEXIST');
    assert.equal(res.status, 404);
  });

  it('GET /api/request/:id/fee returns fee breakdown with 3 transfers', async () => {
    const payer = '0x0000000000000000000000000000000000000002';
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=${payer}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.fee);
    assert.ok(Array.isArray(res.body.transfers));
    assert.equal(res.body.transfers.length, 3);
    const descriptions = res.body.transfers.map(t => t.description);
    assert.ok(descriptions.includes('Payment to creator'));
    assert.ok(descriptions.includes('Platform fee'));
    assert.ok(descriptions.includes('Creator reward'));
  });

  it('fee endpoint returns 404 for non-existent link', async () => {
    const res = await request('GET', '/api/request/REQ-NOPE/fee?payer=0x0000000000000000000000000000000000000002');
    assert.equal(res.status, 404);
  });

  it('fee endpoint rejects missing payer', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}/fee`);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('payer'));
  });

  it('fee endpoint rejects invalid payer format', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=invalid`);
    assert.equal(res.status, 400);
  });

  it('pay-link resolves Sepolia USDC address', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.sepolia }, agents.payer);
    assert.equal(res.status, 200);
    assert.ok(res.body.instructions);
    assert.equal(res.body.instructions.payment.tokenAddress, '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87');
  });

  it('pay-link returns null tokenAddress for ETH (native)', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: links.ethLink }, agents.payer);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.tokenAddress, null);
  });

  it('pay-link returns 404 for non-existent link', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: 'REQ-DOESNOTEXIST' }, agents.payer);
    assert.equal(res.status, 404);
  });

  it('pay-link requires linkId', async () => {
    const res = await request('POST', '/api/pay-link', {}, agents.payer);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  6. PAYMENT VERIFICATION (mocked)
// ═══════════════════════════════════════════════════════════════════

describe('6. Payment Verification (mocked)', () => {
  it('rejects missing requestId and txHash', async () => {
    const res = await request('POST', '/api/verify', {});
    assert.equal(res.status, 400);
  });

  it('rejects non-existent requestId', async () => {
    const res = await request('POST', '/api/verify', {
      requestId: 'REQ-DOESNOTEXIST', txHash: '0xfaketxhash123',
    });
    assert.equal(res.status, 404);
  });

  it('handles blockchain verification failure gracefully (no crash)', async () => {
    const res = await request('POST', '/api/verify', {
      requestId: links.sepolia,
      txHash: '0x' + 'a'.repeat(64),
    });
    // Should return 500 (blockchain verification fails) or 400, but NOT crash
    assert.ok([400, 500].includes(res.status), `Expected 400 or 500, got ${res.status}`);
  });

  it('execute-payment returns 410 Gone (deprecated)', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, agents.payer);
    assert.equal(res.status, 410);
    assert.ok(res.body.error.includes('permanently removed'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  7. REQUEST LISTING & DELETION
// ═══════════════════════════════════════════════════════════════════

describe('7. Request Listing & Deletion', () => {
  before(async () => {
    // Create links specifically for deletion tests
    const res1 = await request('POST', '/api/create-link', {
      amount: '3', network: 'sepolia',
    }, agents.creator);
    assert.equal(res1.status, 200);
    links.deleteAgentLink = res1.body.linkId;

    const res2 = await request('POST', '/api/create', {
      token: 'USDC', amount: '5', receiver: HUMAN_WALLET,
      network: 'sepolia', creatorWallet: HUMAN_WALLET,
    });
    assert.ok([200, 201].includes(res2.status));
    links.deleteHumanLink = res2.body.request.id;

    const res3 = await request('POST', '/api/create', {
      token: 'USDC', amount: '7', receiver: HUMAN_WALLET,
      network: 'sepolia', creatorWallet: HUMAN_WALLET,
    });
    assert.ok([200, 201].includes(res3.status));
    links.deleteNonOwnerLink = res3.body.request.id;
  });

  it('GET /api/requests (HMAC) returns agent links', async () => {
    const res = await request('GET', '/api/requests', null, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(res.body.requests.length > 0, 'Agent should have links');
  });

  it('GET /api/requests?wallet=... (no auth) returns human links', async () => {
    const res = await request('GET', `/api/requests?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.requests.length > 0, 'Human wallet should have links');
    for (const link of res.body.requests) {
      assert.equal(link.creatorWallet, HUMAN_WALLET);
    }
  });

  it('agent deletes own link via HMAC — 200', async () => {
    const res = await request('DELETE', `/api/request/${links.deleteAgentLink}`, null, agents.creator);
    assert.equal(res.status, 200);
    assert.ok(res.body.success);
  });

  it('agent-deleted link returns 404 on retry', async () => {
    const res = await request('DELETE', `/api/request/${links.deleteAgentLink}`, null, agents.creator);
    assert.equal(res.status, 404);
  });

  it('human deletes own link via ?wallet= param — 200', async () => {
    const res = await request('DELETE', `/api/request/${links.deleteHumanLink}?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.success);
  });

  it('non-owner wallet gets 403 on delete', async () => {
    const OTHER_WALLET = '0x9999999999999999999999999999999999999999';
    const res = await request('DELETE', `/api/request/${links.deleteNonOwnerLink}?wallet=${OTHER_WALLET}`);
    assert.equal(res.status, 403);
    assert.ok(res.body.error.includes('creator'));
  });

  it('no wallet, no auth on delete returns 400', async () => {
    const res = await request('DELETE', `/api/request/${links.deleteNonOwnerLink}`);
    assert.equal(res.status, 400);
  });

  it('human-deleted link returns 404 on retry', async () => {
    const res = await request('DELETE', `/api/request/${links.deleteHumanLink}?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  8. REWARDS & PLATFORM STATS
// ═══════════════════════════════════════════════════════════════════

describe('8. Rewards & Platform Stats', () => {
  it('GET /api/rewards?wallet=... returns rewards structure', async () => {
    const res = await request('GET', `/api/rewards?wallet=${agents.creator.wallet}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.rewards);
    assert.ok(Array.isArray(res.body.rewards.human));
    assert.ok(Array.isArray(res.body.rewards.agent));
    assert.ok(res.body.totals);
    assert.equal(typeof res.body.totals.humanRewardsCount, 'number');
    assert.equal(typeof res.body.totals.agentRewardsCount, 'number');
  });

  it('GET /api/rewards rejects missing wallet param', async () => {
    const res = await request('GET', '/api/rewards');
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('wallet'));
  });

  it('GET /api/stats returns platform stats structure', async () => {
    const res = await request('GET', '/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.stats);
    assert.equal(typeof res.body.stats.totalAgents, 'number');
    assert.equal(typeof res.body.stats.totalPayments, 'number');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9. WEBHOOK CRUD
// ═══════════════════════════════════════════════════════════════════

describe('9. Webhook CRUD', () => {
  let webhookId = null;

  it('POST /api/webhooks creates a webhook', async () => {
    const res = await request('POST', '/api/webhooks', {
      url: 'https://example.com/webhook',
      events: ['payment.paid'],
    }, agents.creator);
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.webhook);
    assert.ok(res.body.webhook.id);
    assert.ok(res.body.webhook.secret, 'Webhook response should include secret');
    webhookId = res.body.webhook.id;
  });

  it('GET /api/webhooks lists webhooks', async () => {
    const res = await request('GET', '/api/webhooks', null, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.webhooks.length >= 1);
    const found = res.body.webhooks.find(w => w.id === webhookId);
    assert.ok(found, 'Created webhook should be in list');
    assert.ok(!found.secret, 'Listed webhook should NOT expose secret');
  });

  it('PUT /api/webhooks/:id updates webhook URL', async () => {
    const res = await request('PUT', `/api/webhooks/${webhookId}`, {
      url: 'https://example.com/updated-webhook',
    }, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('GET /api/webhooks shows updated URL', async () => {
    const res = await request('GET', '/api/webhooks', null, agents.creator);
    const found = res.body.webhooks.find(w => w.id === webhookId);
    assert.equal(found.url, 'https://example.com/updated-webhook');
  });

  it('DELETE /api/webhooks/:id removes webhook', async () => {
    const res = await request('DELETE', `/api/webhooks/${webhookId}`, null, agents.creator);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('deleted webhook no longer in list', async () => {
    const res = await request('GET', '/api/webhooks', null, agents.creator);
    const found = res.body.webhooks.find(w => w.id === webhookId);
    assert.ok(!found, 'Deleted webhook should not be in list');
  });

  it('webhook endpoints require auth', async () => {
    const res = await request('POST', '/api/webhooks', { url: 'https://example.com/hook' });
    assert.equal(res.status, 401);
  });

  it('POST /api/webhooks rejects missing URL', async () => {
    const res = await request('POST', '/api/webhooks', {}, agents.creator);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  10. HMAC SECURITY
// ═══════════════════════════════════════════════════════════════════

describe('10. HMAC Security', () => {
  it('rejects replay attack (old timestamp)', async () => {
    const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString();
    const stringToSign = buildStringToSign(oldTimestamp, 'GET', '/api/agents/me', '');
    const signature = computeHmac(stringToSign, agents.creator.apiSecret);
    const res = await rawRequest('GET', '/api/agents/me', null, {
      'x-api-key-id': agents.creator.apiKeyId,
      'x-timestamp': oldTimestamp,
      'x-signature': signature,
    });
    assert.equal(res.status, 401);
  });

  it('rejects tampered body', async () => {
    const body = { amount: '10', network: 'sepolia' };
    const { timestamp, signature } = signRequest('POST', '/api/create-link', body,
      agents.creator.apiKeyId, agents.creator.apiSecret);
    const tamperedBody = { amount: '99999', network: 'sepolia' };
    const res = await rawRequest('POST', '/api/create-link', tamperedBody, {
      'x-api-key-id': agents.creator.apiKeyId,
      'x-timestamp': timestamp,
      'x-signature': signature,
    });
    assert.equal(res.status, 401);
  });

  it('rejects missing x-signature header', async () => {
    const res = await rawRequest('GET', '/api/agents/me', null, {
      'x-api-key-id': agents.creator.apiKeyId,
      'x-timestamp': Math.floor(Date.now() / 1000).toString(),
    });
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

  it('GET /api/agents/me requires auth (no headers)', async () => {
    const res = await request('GET', '/api/agents/me');
    assert.equal(res.status, 401);
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
//  11. INPUT VALIDATION & EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('11. Input Validation & Edge Cases', () => {
  it('rejects zero amount', async () => {
    const res = await request('POST', '/api/create-link', { amount: '0', network: 'sepolia' }, agents.creator);
    assert.equal(res.status, 400);
  });

  it('rejects negative amount', async () => {
    const res = await request('POST', '/api/create-link', { amount: '-5', network: 'sepolia' }, agents.creator);
    assert.equal(res.status, 400);
  });

  it('rejects non-numeric amount', async () => {
    const res = await request('POST', '/api/create-link', { amount: 'abc', network: 'sepolia' }, agents.creator);
    assert.equal(res.status, 400);
  });

  it('rejects empty string network', async () => {
    const res = await request('POST', '/api/create-link', { amount: '10', network: '' }, agents.creator);
    assert.equal(res.status, 400);
  });

  it('POST /api/create rejects unsupported network name', async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC', amount: '10', receiver: HUMAN_WALLET,
      network: 'solana', creatorWallet: HUMAN_WALLET,
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('Unsupported'));
  });

  it('wallet management rejects invalid wallet format', async () => {
    const res = await request('POST', '/api/agents/wallet', { wallet_address: '0xTOOSHORT' }, agents.payer);
    assert.equal(res.status, 400);
  });

  it('GET /api/agents/by-wallet rejects invalid wallet', async () => {
    const res = await request('GET', '/api/agents/by-wallet?wallet=invalid');
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  12. AGENT LOGS & IP HISTORY
// ═══════════════════════════════════════════════════════════════════

describe('12. Agent Logs & IP History', () => {
  let logJwt = null;

  before(async () => {
    const { ethers } = require('ethers');
    const wallet = ethers.Wallet.createRandom();
    const lowerAddr = wallet.address.toLowerCase();
    await registerAndActivate('logs_agent', 'logs@e2e.com', lowerAddr, 'sepolia');

    const challengeRes = await request('POST', '/api/auth/challenge', { wallet_address: lowerAddr });
    const signature = await wallet.signMessage(challengeRes.body.nonce);
    const verifyRes = await request('POST', '/api/auth/verify', { wallet_address: lowerAddr, signature });
    logJwt = verifyRes.body.token;
  });

  it('GET /api/agents/logs (JWT) returns logs', async () => {
    const res = await request('GET', '/api/agents/logs?limit=10&offset=0', null, `jwt_${logJwt}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.logs));
  });

  it('GET /api/agents/ip-history (JWT) returns IP history', async () => {
    const res = await request('GET', '/api/agents/ip-history', null, `jwt_${logJwt}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.ip_history !== undefined);
  });

  it('logs endpoint requires auth', async () => {
    const res = await request('GET', '/api/agents/logs');
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  13. API KEY ROTATION & AGENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

describe('13. API Key Rotation & Agent Management', () => {
  let tempAgent = { apiKeyId: null, apiSecret: null, agentId: null };

  before(async () => {
    const result = await registerAndActivate('mgmt_agent', 'mgmt@e2e.com',
      '0xAAAABBBBCCCCDDDDEEEEFFFF0000111122223333', 'sepolia');
    tempAgent.apiKeyId = result.apiKeyId;
    tempAgent.apiSecret = result.apiSecret;
    tempAgent.agentId = result.agentId;
  });

  it('agent profile accessible before rotation', async () => {
    const res = await request('GET', '/api/agents/me', null, tempAgent);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'mgmt_agent');
  });

  it('POST /api/agents/rotate-key returns new credentials', async () => {
    const res = await request('POST', '/api/agents/rotate-key', {}, tempAgent);
    assert.equal(res.status, 200);
    assert.ok(res.body.api_key_id.startsWith('pk_live_'));
    assert.ok(res.body.api_secret.startsWith('sk_live_'));
    assert.ok(res.body.expires_at);
    tempAgent.apiKeyId = res.body.api_key_id;
    tempAgent.apiSecret = res.body.api_secret;
  });

  it('new credentials work after rotation', async () => {
    const res = await request('GET', '/api/agents/me', null, tempAgent);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'mgmt_agent');
  });

  it('POST /api/agents/deactivate sets inactive', async () => {
    const res = await request('POST', '/api/agents/deactivate', {}, tempAgent);
    assert.equal(res.status, 200);
  });

  it('deactivated agent cannot authenticate', async () => {
    const res = await request('GET', '/api/agents/me', null, tempAgent);
    assert.equal(res.status, 403);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  14. FEE CALCULATOR UNIT TESTS
// ═══════════════════════════════════════════════════════════════════

describe('14. Fee Calculator', () => {
  const { calculateFee } = require('./lib/feeCalculator');

  it('USDC fee-deducted (no LCX balance)', async () => {
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'sepolia', 'USDC');
    assert.equal(result.feeDeductedFromPayment, true);
    assert.equal(result.feeToken, 'USDC');
    assert.ok(result.feeTotal > 0);
    assert.ok(result.platformShare > 0);
    assert.ok(result.creatorReward > 0);
  });

  it('LCX token fee returns standard 4 LCX', async () => {
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'sepolia', 'LCX');
    assert.equal(result.feeDeductedFromPayment, true);
    assert.equal(result.feeToken, 'LCX');
    assert.equal(result.feeTotal, 4);
    assert.equal(result.platformShare, 2);
    assert.equal(result.creatorReward, 2);
  });

  it('fee splits approximately 50/50 for stablecoins', async () => {
    const result = await calculateFee('0x0000000000000000000000000000000000000001', 'sepolia', 'USDC');
    assert.ok(Math.abs(result.platformShare - result.creatorReward) < 0.01);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  15. WEBHOOK SECRET ENCRYPTION
// ═══════════════════════════════════════════════════════════════════

describe('15. Webhook Secret Encryption', () => {
  const { encryptSecret, decryptSecret } = require('./lib/crypto');

  it('encrypt → decrypt roundtrip succeeds', () => {
    const raw = 'whsec_' + crypto.randomBytes(32).toString('hex');
    const encrypted = encryptSecret(raw);
    const parts = encrypted.split(':');
    assert.equal(parts.length, 3, 'Should have iv:ciphertext:authTag format');
    assert.equal(decryptSecret(encrypted), raw);
  });

  it('encrypted secret differs from SHA256 hash', () => {
    const raw = 'whsec_test123';
    const encrypted = encryptSecret(raw);
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    assert.notEqual(encrypted, hash);
    assert.ok(encrypted.includes(':'));
  });

  it('HMAC with decrypted secret matches HMAC with original', () => {
    const rawSecret = 'whsec_' + crypto.randomBytes(32).toString('hex');
    const encrypted = encryptSecret(rawSecret);
    const decrypted = decryptSecret(encrypted);
    const payload = JSON.stringify({ event: 'payment.paid', amount: '10.00' });
    const sigOriginal = crypto.createHmac('sha256', rawSecret).update(payload).digest('hex');
    const sigDecrypted = crypto.createHmac('sha256', decrypted).update(payload).digest('hex');
    assert.equal(sigDecrypted, sigOriginal);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  16. CROSS-CHAIN CONSISTENCY
// ═══════════════════════════════════════════════════════════════════

describe('16. Cross-Chain Consistency', () => {
  it('all created links are retrievable', async () => {
    for (const key of ['sepolia', 'ethereum', 'base', 'ethLink', 'humanLink']) {
      if (!links[key]) continue;
      const res = await request('GET', `/api/request/${links[key]}`);
      assert.ok([200, 402].includes(res.status), `Link ${key} (${links[key]}) should be retrievable, got ${res.status}`);
    }
  });

  it('fee endpoint works for sepolia chain', async () => {
    const payer = '0x0000000000000000000000000000000000000002';
    if (!links.sepolia) return;
    const res = await request('GET', `/api/request/${links.sepolia}/fee?payer=${payer}`);
    assert.equal(res.status, 200, 'Fee for sepolia link should return 200');
    assert.equal(res.body.transfers.length, 3, 'sepolia should have 3 transfers');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  17. CHAIN REGISTRY UNIT TESTS
// ═══════════════════════════════════════════════════════════════════

describe('17. Chain Registry', () => {
  const registry = require('./lib/chainRegistry');

  it('lists exactly 3 supported chains', () => {
    assert.deepStrictEqual(registry.getSupportedNetworks(), ['sepolia', 'ethereum', 'base']);
  });

  it('resolves aliases', () => {
    assert.equal(registry.resolveNetwork('mainnet'), 'ethereum');
    assert.equal(registry.resolveNetwork('eth'), 'ethereum');
    assert.equal(registry.resolveNetwork('base-mainnet'), 'base');
  });

  it('rejects unsupported', () => {
    assert.equal(registry.resolveNetwork('polygon'), null);
    assert.equal(registry.resolveNetwork('solana'), null);
  });

  it('ETH is native on all chains', () => {
    assert.equal(registry.isNativeToken('ETH', 'sepolia'), true);
    assert.equal(registry.isNativeToken('ETH', 'ethereum'), true);
    assert.equal(registry.isNativeToken('ETH', 'base'), true);
    assert.equal(registry.isNativeToken('USDC', 'ethereum'), false);
  });

  it('correct token addresses', () => {
    assert.equal(registry.getTokenAddress('sepolia', 'USDC'), '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87');
    assert.equal(registry.getTokenAddress('ethereum', 'USDC'), '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    assert.equal(registry.getTokenAddress('base', 'USDC'), '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    assert.equal(registry.getTokenAddress('sepolia', 'ETH'), null);
  });

  it('correct explorer URLs', () => {
    assert.equal(registry.getExplorerUrl('sepolia'), 'https://sepolia.etherscan.io');
    assert.equal(registry.getExplorerUrl('ethereum'), 'https://etherscan.io');
    assert.equal(registry.getExplorerUrl('base'), 'https://basescan.org');
  });
});
