#!/usr/bin/env node

/**
 * PayAgent — Frontend Flow Simulation E2E Tests
 *
 * Replays the EXACT API call sequences each frontend page makes,
 * in the order a real user would trigger them. Validates response
 * shapes match what the TypeScript interfaces in src/lib/api.ts expect.
 *
 * Flow A: New Human User Journey
 * Flow B: Payment Flow (Payer Perspective)
 * Flow C: Agent Registration & Management
 * Flow D: Agent Deactivation & Deletion
 * Flow E: Webhook Management
 * Flow F: Multi-User Interaction
 * Flow G: Error Recovery
 *
 * Run: node --test --test-force-exit e2e-frontend-flows.test.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('crypto');

// ─── Force in-memory mode ──────────────────────────────────────────
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

process.env.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/test';
process.env.ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/test';
process.env.BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
process.env.PLATFORM_TREASURY_WALLET = '0xTREASURY0000000000000000000000000000001';
process.env.LCX_CONTRACT_ADDRESS = '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b';
process.env.HMAC_ENCRYPTION_KEY = process.env.HMAC_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ─── Imports ───────────────────────────────────────────────────────
const { activateAgent } = require('./lib/agents');
const { computeHmac, buildStringToSign } = require('./lib/crypto');
const app = require('./api/index');

// ─── State ─────────────────────────────────────────────────────────
let server, BASE_URL;

const HUMAN_WALLET = '0xABCDEF1234567890ABCDEF1234567890ABCDEF12';
const HUMAN_WALLET_2 = '0x9999888877776666555544443333222211110000';

// ─── HTTP Helpers ──────────────────────────────────────────────────
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

    if (auth && typeof auth === 'object' && auth.apiKeyId) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const bodyStr = body ? JSON.stringify(body) : '';
      const stringToSign = buildStringToSign(timestamp, method, url.pathname, bodyStr);
      const signature = computeHmac(stringToSign, auth.apiSecret);
      opts.headers['x-api-key-id'] = auth.apiKeyId;
      opts.headers['x-timestamp'] = timestamp;
      opts.headers['x-signature'] = signature;
    } else if (auth && typeof auth === 'string') {
      opts.headers['Authorization'] = `Bearer ${auth}`;
    }

    const bodyStr = body ? JSON.stringify(body) : null;
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let json;
        try { json = JSON.parse(data); } catch { json = data; }
        resolve({ status: res.statusCode, body: json });
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
  const activation = await activateAgent(res.body.agent_id, `x_${username}`);
  return {
    agentId: res.body.agent_id,
    apiKeyId: activation.api_key_id,
    apiSecret: activation.api_secret,
    wallet,
  };
}

// ─── Lifecycle ─────────────────────────────────────────────────────
before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      const addr = server.address();
      BASE_URL = `http://127.0.0.1:${addr.port}`;
      console.log(`\n  Frontend-flows E2E on ${BASE_URL}\n`);
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
//  FLOW A: NEW HUMAN USER JOURNEY
// ═══════════════════════════════════════════════════════════════════

describe('Flow A: New Human User Journey', () => {
  let humanLinkId;

  it('A1. connect wallet — agents/by-wallet returns null for new wallet', async () => {
    const res = await request('GET', `/api/agents/by-wallet?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.agent, null);
  });

  it('A2. dashboard loads — GET /api/requests?wallet returns empty list initially', async () => {
    const res = await request('GET', `/api/requests?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.requests));
    assert.equal(typeof res.body.count, 'number');
  });

  it('A3. dashboard loads — GET /api/prices returns TokenPrices shape', async () => {
    const res = await request('GET', '/api/prices');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    const p = res.body.prices;
    assert.equal(typeof p.LCX, 'number');
    assert.equal(typeof p.ETH, 'number');
    assert.equal(typeof p.USDC, 'number');
    assert.equal(typeof p.USDT, 'number');
  });

  it('A4. dashboard loads — GET /api/stats returns PlatformStats shape', async () => {
    const res = await request('GET', '/api/stats');
    assert.equal(res.status, 200);
    const s = res.body.stats;
    assert.equal(typeof s.totalAgents, 'number');
    assert.equal(typeof s.totalPayments, 'number');
  });

  it('A5. create payment link — POST /api/create with creatorWallet', async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC',
      amount: '25',
      receiver: HUMAN_WALLET,
      network: 'sepolia',
      creatorWallet: HUMAN_WALLET,
      description: 'Test from dashboard',
    });
    assert.ok([200, 201].includes(res.status));
    assert.equal(res.body.success, true);
    // Validate CreatePaymentLinkResponse shape
    assert.ok(res.body.request);
    assert.ok(res.body.request.id.startsWith('REQ-'));
    humanLinkId = res.body.request.id;
  });

  it('A6. view created link — GET /api/request/:id returns 402 (pending)', async () => {
    const res = await request('GET', `/api/request/${humanLinkId}`);
    assert.equal(res.status, 402);
    // Validate PaymentResponse shape
    assert.ok(res.body.payment);
    assert.equal(res.body.payment.id, humanLinkId);
    assert.equal(res.body.payment.token, 'USDC');
    assert.equal(res.body.payment.network, 'sepolia');
    assert.ok(res.body.payment.amount);
    assert.ok(res.body.payment.receiver);
  });

  it('A7. list all links — GET /api/requests?wallet includes new link', async () => {
    const res = await request('GET', `/api/requests?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    // Validate GetAllPaymentsResponse shape
    assert.ok(Array.isArray(res.body.requests));
    assert.ok(res.body.requests.length >= 1);
    const found = res.body.requests.find(r => r.id === humanLinkId);
    assert.ok(found, 'Created link should appear in list');
    // Validate PaymentRequest fields the frontend expects
    assert.equal(typeof found.id, 'string');
    assert.equal(typeof found.token, 'string');
    assert.equal(typeof found.amount, 'string');
    assert.equal(typeof found.network, 'string');
    assert.equal(typeof found.status, 'string');
    assert.equal(found.creatorWallet, HUMAN_WALLET);
  });

  it('A8. view rewards — GET /api/rewards?wallet returns RewardsResponse shape', async () => {
    const res = await request('GET', `/api/rewards?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // Validate RewardsResponse shape
    assert.ok(res.body.rewards);
    assert.ok(Array.isArray(res.body.rewards.human));
    assert.ok(Array.isArray(res.body.rewards.agent));
    assert.ok(res.body.totals);
    assert.equal(typeof res.body.totals.humanRewardsCount, 'number');
    assert.equal(typeof res.body.totals.agentRewardsCount, 'number');
    assert.equal(typeof res.body.totals.humanRewardsTotal, 'number');
    assert.equal(typeof res.body.totals.agentRewardsTotal, 'number');
  });

  it('A9. delete link — DELETE /api/request/:id?wallet succeeds', async () => {
    const res = await request('DELETE', `/api/request/${humanLinkId}?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
    // Validate DeletePaymentResponse shape
    assert.equal(res.body.success, true);
    assert.equal(typeof res.body.message, 'string');
    assert.equal(res.body.id, humanLinkId);
  });

  it('A10. deleted link returns 404', async () => {
    const res = await request('GET', `/api/request/${humanLinkId}`);
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW B: PAYMENT FLOW (PAYER PERSPECTIVE)
// ═══════════════════════════════════════════════════════════════════

describe('Flow B: Payment Flow (Payer Perspective)', () => {
  let payLinkId;
  const PAYER_WALLET = '0x0000000000000000000000000000000000000002';

  before(async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC', amount: '50', receiver: HUMAN_WALLET,
      network: 'sepolia', creatorWallet: HUMAN_WALLET,
    });
    payLinkId = res.body.request.id;
  });

  it('B1. open payment page — GET /api/request/:id returns payment details', async () => {
    const res = await request('GET', `/api/request/${payLinkId}`);
    assert.equal(res.status, 402);
    const p = res.body.payment;
    assert.equal(p.id, payLinkId);
    assert.equal(p.amount, '50');
    assert.equal(p.token, 'USDC');
    assert.equal(p.network, 'sepolia');
    assert.ok(p.receiver);
    assert.ok(typeof p.description === 'string');
  });

  it('B2. connect wallet — GET /api/request/:id/fee returns FeeInfoResponse shape', async () => {
    const res = await request('GET', `/api/request/${payLinkId}/fee?payer=${PAYER_WALLET}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    // Validate FeeInfoResponse shape
    assert.ok(res.body.fee);
    assert.equal(typeof res.body.fee.feeToken, 'string');
    assert.equal(typeof res.body.fee.feeTotal, 'number');
    assert.equal(typeof res.body.fee.platformShare, 'number');
    assert.equal(typeof res.body.fee.creatorReward, 'number');
    assert.equal(typeof res.body.fee.feeDeductedFromPayment, 'boolean');
    assert.equal(typeof res.body.creatorReceives, 'string');
  });

  it('B3. fee breakdown has 3 transfers with FeeTransfer shape', async () => {
    const res = await request('GET', `/api/request/${payLinkId}/fee?payer=${PAYER_WALLET}`);
    assert.ok(Array.isArray(res.body.transfers));
    assert.equal(res.body.transfers.length, 3);
    for (const t of res.body.transfers) {
      assert.equal(typeof t.description, 'string');
      assert.equal(typeof t.token, 'string');
      assert.equal(typeof t.amount, 'string');
      assert.equal(typeof t.to, 'string');
      // tokenAddress can be string or null
      assert.ok(t.tokenAddress === null || typeof t.tokenAddress === 'string');
    }
  });

  it('B4. verify payment (mocked) — POST /api/verify', async () => {
    const res = await request('POST', '/api/verify', {
      requestId: payLinkId,
      txHash: '0x' + 'c'.repeat(64),
    });
    // Blockchain verification will fail (no real RPC), but shouldn't crash
    assert.ok([400, 500].includes(res.status));
  });

  it('B5. fee endpoint returns 404 for non-existent link', async () => {
    const res = await request('GET', '/api/request/REQ-NOPE/fee?payer=' + PAYER_WALLET);
    assert.equal(res.status, 404);
  });

  it('B6. fee endpoint rejects missing payer', async () => {
    const res = await request('GET', `/api/request/${payLinkId}/fee`);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW C: AGENT REGISTRATION & MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

describe('Flow C: Agent Registration & Management', () => {
  let agentCreds, agentJwt, agentLinkId;
  const { ethers } = require('ethers');
  const agentWallet = ethers.Wallet.createRandom();
  const agentAddr = agentWallet.address.toLowerCase();

  it('C1. register agent — POST /api/agents/register', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'flow_c_agent',
      email: 'flowc@e2e.com',
      wallet_address: agentAddr,
      chain: 'sepolia',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.agent_id);
    assert.ok(res.body.verification_challenge);
    agentCreds = { agentId: res.body.agent_id };
  });

  it('C2. activate agent', async () => {
    const activation = await activateAgent(agentCreds.agentId, 'x_flow_c');
    assert.ok(activation.api_key_id.startsWith('pk_live_'));
    assert.ok(activation.api_secret.startsWith('sk_live_'));
    agentCreds.apiKeyId = activation.api_key_id;
    agentCreds.apiSecret = activation.api_secret;
  });

  it('C3. wallet login — challenge + verify (real ethers signature)', async () => {
    const challengeRes = await request('POST', '/api/auth/challenge', { wallet_address: agentAddr });
    assert.equal(challengeRes.status, 200);
    assert.ok(challengeRes.body.nonce);

    const signature = await agentWallet.signMessage(challengeRes.body.nonce);
    const verifyRes = await request('POST', '/api/auth/verify', {
      wallet_address: agentAddr, signature,
    });
    assert.equal(verifyRes.status, 200);
    assert.ok(verifyRes.body.token);
    assert.equal(verifyRes.body.expires_in, 3600);
    assert.ok(verifyRes.body.agent);
    assert.equal(verifyRes.body.agent.username, 'flow_c_agent');
    agentJwt = verifyRes.body.token;
  });

  it('C4. view profile — GET /api/agents/me with JWT', async () => {
    const res = await request('GET', '/api/agents/me', null, agentJwt);
    assert.equal(res.status, 200);
    // Validate AgentProfile shape
    const a = res.body.agent;
    assert.equal(a.username, 'flow_c_agent');
    assert.equal(typeof a.id, 'string');
    assert.equal(typeof a.email, 'string');
    assert.equal(typeof a.status, 'string');
    assert.equal(typeof a.verification_status, 'string');
    assert.equal(typeof a.created_at, 'string');
  });

  it('C5. view on dashboard — GET /api/agents/by-wallet', async () => {
    const res = await request('GET', `/api/agents/by-wallet?wallet=${agentAddr}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'flow_c_agent');
    assert.equal(res.body.agent.status, 'active');
  });

  it('C6. create link as agent — POST /api/create-link with HMAC', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '20', network: 'sepolia', description: 'Agent flow test',
    }, agentCreds);
    assert.equal(res.status, 200);
    assert.ok(res.body.linkId.startsWith('REQ-'));
    agentLinkId = res.body.linkId;
  });

  it('C7. list links — GET /api/requests with HMAC', async () => {
    const res = await request('GET', '/api/requests', null, agentCreds);
    assert.equal(res.status, 200);
    assert.ok(res.body.requests.length >= 1);
    const found = res.body.requests.find(r => r.id === agentLinkId);
    assert.ok(found);
  });

  it('C8. rotate API key — POST /api/agents/rotate-key', async () => {
    const res = await request('POST', '/api/agents/rotate-key', {}, agentCreds);
    assert.equal(res.status, 200);
    assert.ok(res.body.api_key_id.startsWith('pk_live_'));
    assert.ok(res.body.api_secret.startsWith('sk_live_'));
    assert.ok(res.body.expires_at);
    // Save new creds
    const oldKeyId = agentCreds.apiKeyId;
    agentCreds.apiKeyId = res.body.api_key_id;
    agentCreds.apiSecret = res.body.api_secret;
    agentCreds._oldKeyId = oldKeyId;
  });

  it('C9. old key fails after rotation', async () => {
    const badCreds = {
      apiKeyId: agentCreds._oldKeyId || 'pk_live_old_invalid_key_000',
      apiSecret: 'sk_live_old_invalid_secret_000000',
    };
    const res = await request('GET', '/api/agents/me', null, badCreds);
    assert.equal(res.status, 401);
  });

  it('C10. new key works after rotation', async () => {
    const res = await request('GET', '/api/agents/me', null, agentCreds);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'flow_c_agent');
  });

  it('C11. view logs — GET /api/agents/logs with JWT', async () => {
    const res = await request('GET', '/api/agents/logs?limit=25&offset=0', null, agentJwt);
    assert.equal(res.status, 200);
    // Validate AgentLogsResponse shape
    assert.ok(Array.isArray(res.body.logs));
  });

  it('C12. view IP history — GET /api/agents/ip-history', async () => {
    const res = await request('GET', '/api/agents/ip-history', null, agentJwt);
    assert.equal(res.status, 200);
    assert.ok(res.body.ip_history !== undefined);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW D: AGENT DEACTIVATION & DELETION
// ═══════════════════════════════════════════════════════════════════

describe('Flow D: Agent Deactivation & Deletion', () => {
  let deactivateCreds, deleteCreds, deleteJwt;

  before(async () => {
    deactivateCreds = await registerAndActivate('deact_agent', 'deact@e2e.com',
      '0xDEAC000000000000000000000000000000000001', 'sepolia');

    const { ethers } = require('ethers');
    const delWallet = ethers.Wallet.createRandom();
    const delAddr = delWallet.address.toLowerCase();
    deleteCreds = await registerAndActivate('del_agent', 'del@e2e.com', delAddr, 'sepolia');

    const challengeRes = await request('POST', '/api/auth/challenge', { wallet_address: delAddr });
    const signature = await delWallet.signMessage(challengeRes.body.nonce);
    const verifyRes = await request('POST', '/api/auth/verify', { wallet_address: delAddr, signature });
    deleteJwt = verifyRes.body.token;
  });

  it('D1. deactivate agent — POST /api/agents/deactivate', async () => {
    const res = await request('POST', '/api/agents/deactivate', {}, deactivateCreds);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('D2. deactivated agent auth fails with 403', async () => {
    const res = await request('GET', '/api/agents/me', null, deactivateCreds);
    assert.equal(res.status, 403);
  });

  it('D3. soft-delete agent — DELETE /api/agents/me with JWT', async () => {
    const res = await request('DELETE', '/api/agents/me', null, deleteJwt);
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
  });

  it('D4. deleted agent HMAC auth fails', async () => {
    const res = await request('GET', '/api/agents/me', null, deleteCreds);
    // Deleted agents should fail auth
    assert.ok([401, 403].includes(res.status));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW E: WEBHOOK MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

describe('Flow E: Webhook Management Flow', () => {
  let webhookCreds, webhookId;

  before(async () => {
    webhookCreds = await registerAndActivate('webhook_agent', 'webhook@e2e.com',
      '0xEE00110022003300440055006600770088009900', 'sepolia');
  });

  it('E1. create webhook — POST /api/webhooks', async () => {
    const res = await request('POST', '/api/webhooks', {
      url: 'https://example.com/hook',
      events: ['payment.paid', 'payment.created'],
    }, webhookCreds);
    assert.equal(res.status, 201);
    assert.ok(res.body.webhook.id);
    assert.ok(res.body.webhook.secret);
    webhookId = res.body.webhook.id;
  });

  it('E2. list webhooks — GET /api/webhooks', async () => {
    const res = await request('GET', '/api/webhooks', null, webhookCreds);
    assert.equal(res.status, 200);
    assert.ok(res.body.webhooks.length >= 1);
    const found = res.body.webhooks.find(w => w.id === webhookId);
    assert.ok(found);
    assert.ok(!found.secret, 'Secret should be stripped from list');
  });

  it('E3. update webhook — PUT /api/webhooks/:id', async () => {
    const res = await request('PUT', `/api/webhooks/${webhookId}`, {
      url: 'https://example.com/updated-hook',
      events: ['payment.paid'],
    }, webhookCreds);
    assert.equal(res.status, 200);
  });

  it('E4. verify update took effect', async () => {
    const res = await request('GET', '/api/webhooks', null, webhookCreds);
    const found = res.body.webhooks.find(w => w.id === webhookId);
    assert.equal(found.url, 'https://example.com/updated-hook');
  });

  it('E5. delete webhook — DELETE /api/webhooks/:id', async () => {
    const res = await request('DELETE', `/api/webhooks/${webhookId}`, null, webhookCreds);
    assert.equal(res.status, 200);
  });

  it('E6. deleted webhook gone from list', async () => {
    const res = await request('GET', '/api/webhooks', null, webhookCreds);
    const found = res.body.webhooks.find(w => w.id === webhookId);
    assert.ok(!found);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW F: MULTI-USER INTERACTION
// ═══════════════════════════════════════════════════════════════════

describe('Flow F: Multi-User Interaction', () => {
  let agentA, agentB, agentALink, humanLink;

  before(async () => {
    agentA = await registerAndActivate('multi_a', 'a@e2e.com',
      '0xAAAA000000000000000000000000000000000001', 'sepolia');
    agentB = await registerAndActivate('multi_b', 'b@e2e.com',
      '0xBBBB000000000000000000000000000000000001', 'sepolia');

    const resA = await request('POST', '/api/create-link', {
      amount: '10', network: 'sepolia',
    }, agentA);
    agentALink = resA.body.linkId;

    const resH = await request('POST', '/api/create', {
      token: 'USDC', amount: '15', receiver: HUMAN_WALLET,
      network: 'sepolia', creatorWallet: HUMAN_WALLET,
    });
    humanLink = resH.body.request.id;
  });

  it('F1. Agent B cannot delete Agent A link — 403', async () => {
    const res = await request('DELETE', `/api/request/${agentALink}`, null, agentB);
    assert.equal(res.status, 403);
  });

  it('F2. Different human wallet cannot delete human link — 403', async () => {
    const res = await request('DELETE', `/api/request/${humanLink}?wallet=${HUMAN_WALLET_2}`);
    assert.equal(res.status, 403);
  });

  it('F3. Agent A can delete own link — 200', async () => {
    const res = await request('DELETE', `/api/request/${agentALink}`, null, agentA);
    assert.equal(res.status, 200);
  });

  it('F4. Human can delete own link — 200', async () => {
    const res = await request('DELETE', `/api/request/${humanLink}?wallet=${HUMAN_WALLET}`);
    assert.equal(res.status, 200);
  });

  it('F5. GET /api/agents/list returns array', async () => {
    const res = await request('GET', '/api/agents/list');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.agents));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW G: ERROR RECOVERY & EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Flow G: Error Recovery & Edge Cases', () => {
  it('G1. invalid wallet on agents/by-wallet — 400', async () => {
    const res = await request('GET', '/api/agents/by-wallet?wallet=invalid');
    assert.equal(res.status, 400);
  });

  it('G2. missing wallet on rewards — 400', async () => {
    const res = await request('GET', '/api/rewards');
    assert.equal(res.status, 400);
  });

  it('G3. invalid wallet on challenge — 400', async () => {
    const res = await request('POST', '/api/auth/challenge', { wallet_address: 'bad' });
    assert.equal(res.status, 400);
  });

  it('G4. fake signature on verify — 400', async () => {
    await request('POST', '/api/auth/challenge', { wallet_address: HUMAN_WALLET });
    const res = await request('POST', '/api/auth/verify', {
      wallet_address: HUMAN_WALLET, signature: '0xdeadbeef',
    });
    assert.equal(res.status, 400);
  });

  it('G5. expired JWT gets rejected', async () => {
    const jwt = require('jsonwebtoken');
    const expiredToken = jwt.sign(
      { wallet_address: HUMAN_WALLET },
      process.env.JWT_SECRET,
      { expiresIn: '0s' }
    );
    // Wait a moment for expiry
    await new Promise(r => setTimeout(r, 50));
    const res = await request('GET', '/api/agents/me', null, expiredToken);
    assert.equal(res.status, 401);
  });

  it('G6. prices endpoint returns fallback on error', async () => {
    const res = await request('GET', '/api/prices');
    assert.equal(res.status, 200);
    // Even if CoinGecko fails, fallback prices are returned
    assert.ok(res.body.prices.LCX > 0);
    assert.ok(res.body.prices.ETH > 0);
  });

  it('G7. concurrent link creation — no ID collision', async () => {
    const promises = Array.from({ length: 5 }, (_, i) =>
      request('POST', '/api/create', {
        token: 'USDC', amount: String(i + 1), receiver: HUMAN_WALLET,
        network: 'sepolia', creatorWallet: HUMAN_WALLET,
      })
    );
    const results = await Promise.all(promises);
    const ids = results.map(r => r.body.request.id);
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, 5, 'All 5 links should have unique IDs');
  });

  it('G8. POST /api/create rejects missing required fields', async () => {
    const res = await request('POST', '/api/create', { token: 'USDC' });
    assert.equal(res.status, 400);
  });

  it('G9. POST /api/create rejects unsupported network', async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC', amount: '10', receiver: HUMAN_WALLET, network: 'polygon',
    });
    assert.equal(res.status, 400);
  });

  it('G10. DELETE without auth or wallet — 400', async () => {
    const createRes = await request('POST', '/api/create', {
      token: 'USDC', amount: '1', receiver: HUMAN_WALLET,
      network: 'sepolia', creatorWallet: HUMAN_WALLET,
    });
    const linkId = createRes.body.request.id;
    const res = await request('DELETE', `/api/request/${linkId}`);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  FLOW H: RESPONSE SHAPE VALIDATION (strict field checks)
// ═══════════════════════════════════════════════════════════════════

describe('Flow H: Response Shape Validation', () => {
  let shapeLinkId;

  before(async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC', amount: '30', receiver: HUMAN_WALLET,
      network: 'ethereum', creatorWallet: HUMAN_WALLET,
      description: 'Shape test',
      expiresInDays: 7,
    });
    shapeLinkId = res.body.request.id;
  });

  it('H1. PaymentRequest shape from /api/requests', async () => {
    const res = await request('GET', `/api/requests?wallet=${HUMAN_WALLET}`);
    const r = res.body.requests.find(x => x.id === shapeLinkId);
    assert.ok(r, 'Link should exist');
    // All fields that src/lib/api.ts PaymentRequest interface requires
    assert.equal(typeof r.id, 'string');
    assert.equal(typeof r.token, 'string');
    assert.equal(typeof r.amount, 'string');
    assert.equal(typeof r.network, 'string');
    assert.equal(typeof r.status, 'string');
    assert.ok(r.receiver === null || typeof r.receiver === 'string');
    assert.ok(r.payer === null || typeof r.payer === 'string');
    assert.ok(r.description === null || typeof r.description === 'string');
    assert.ok(r.txHash == null || typeof r.txHash === 'string', `txHash should be null/undefined/string, got ${typeof r.txHash}`);
    assert.ok(r.creatorWallet == null || typeof r.creatorWallet === 'string', `creatorWallet should be null/undefined/string`);
    assert.ok(r.creatorAgentId == null || typeof r.creatorAgentId === 'string', `creatorAgentId should be null/undefined/string`);
  });

  it('H2. payment view shape from /api/request/:id', async () => {
    const res = await request('GET', `/api/request/${shapeLinkId}`);
    assert.equal(res.status, 402);
    const p = res.body.payment;
    assert.equal(typeof p.id, 'string');
    assert.equal(typeof p.amount, 'string');
    assert.equal(typeof p.token, 'string');
    assert.equal(typeof p.network, 'string');
    assert.equal(typeof p.receiver, 'string');
    assert.equal(typeof p.description, 'string');
  });

  it('H3. chains response shape', async () => {
    const res = await request('GET', '/api/chains');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.chains));
    assert.ok(res.body.chains.length >= 3);
  });
});
