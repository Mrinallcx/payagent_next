#!/usr/bin/env node

/**
 * PayAgent SDK — E2E Integration Test
 *
 * Boots the REAL backend (in-memory mode), creates a real PayAgentClient
 * with valid HMAC credentials, and exercises every SDK method against the
 * live server. This tests the full SDK-to-backend integration.
 *
 * Run: node --test --test-force-exit test/e2e-integration.test.js
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const path = require('path');

// ─── Force in-memory mode (no Supabase) ────────────────────────────
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

process.env.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/test';
process.env.ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/test';
process.env.BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
process.env.PLATFORM_TREASURY_WALLET = '0xTREASURY0000000000000000000000000000001';
process.env.LCX_CONTRACT_ADDRESS = '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b';
process.env.HMAC_ENCRYPTION_KEY = process.env.HMAC_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// ─── Import backend + SDK ──────────────────────────────────────────
const backendPath = path.resolve(__dirname, '../../backend');
const { activateAgent } = require(path.join(backendPath, 'lib/agents'));
const app = require(path.join(backendPath, 'api/index'));
const { PayAgentClient, CHAINS, TOKEN_DECIMALS, DEFAULT_RPC_URLS } = require('../src/index');

// ─── State ─────────────────────────────────────────────────────────
let server, BASE_URL;
let client; // the main SDK client under test
const links = {};

// ─── Lifecycle ─────────────────────────────────────────────────────
before(async () => {
  // Boot backend
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      const addr = server.address();
      BASE_URL = `http://127.0.0.1:${addr.port}`;
      console.log(`\n  SDK E2E server on ${BASE_URL}\n`);
      resolve();
    });
    server.on('error', reject);
  });

  // Register + activate an agent via backend helpers
  const { ethers } = require('ethers');
  const wallet = ethers.Wallet.createRandom();

  const regRes = await fetch(`${BASE_URL}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'sdk_e2e_agent',
      email: 'sdk@e2e.com',
      wallet_address: wallet.address.toLowerCase(),
      chain: 'sepolia',
    }),
  });
  assert.equal(regRes.status, 201);
  const regData = await regRes.json();

  const activation = await activateAgent(regData.agent_id, 'x_sdk_e2e');

  // Create the SDK client pointing at our test server
  client = new PayAgentClient({
    apiKeyId: activation.api_key_id,
    apiSecret: activation.api_secret,
    privateKey: wallet.privateKey,
    baseUrl: BASE_URL,
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  setTimeout(() => process.exit(0), 500);
});

// ═══════════════════════════════════════════════════════════════════
//  1. CONSTRUCTOR & SETUP
// ═══════════════════════════════════════════════════════════════════

describe('1. Constructor & Setup', () => {
  it('client.address returns correct wallet address', () => {
    assert.ok(client.address.startsWith('0x'));
    assert.equal(client.address.length, 42);
  });

  it('throws without apiKeyId', () => {
    assert.throws(() => new PayAgentClient({ apiSecret: 'x', privateKey: '0x' + 'a'.repeat(64) }), /apiKeyId/);
  });

  it('throws without apiSecret', () => {
    assert.throws(() => new PayAgentClient({ apiKeyId: 'x', privateKey: '0x' + 'a'.repeat(64) }), /apiSecret/);
  });

  it('throws without privateKey', () => {
    assert.throws(() => new PayAgentClient({ apiKeyId: 'x', apiSecret: 'y' }), /privateKey/);
  });

  it('throws helpful error for old apiKey format', () => {
    assert.throws(
      () => new PayAgentClient({ apiKey: 'old_key', privateKey: '0x' + 'a'.repeat(64) }),
      /breaking change/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
//  2. CONSTANTS EXPORTS
// ═══════════════════════════════════════════════════════════════════

describe('2. Constants', () => {
  it('CHAINS includes sepolia, ethereum, base', () => {
    assert.ok(CHAINS.sepolia);
    assert.ok(CHAINS.ethereum);
    assert.ok(CHAINS.base);
    assert.equal(CHAINS.sepolia.chainId, 11155111);
    assert.equal(CHAINS.ethereum.chainId, 1);
    assert.equal(CHAINS.base.chainId, 8453);
  });

  it('TOKEN_DECIMALS has correct values', () => {
    assert.equal(TOKEN_DECIMALS.USDC, 6);
    assert.equal(TOKEN_DECIMALS.USDT, 6);
    assert.equal(TOKEN_DECIMALS.ETH, 18);
    assert.equal(TOKEN_DECIMALS.LCX, 18);
  });

  it('DEFAULT_RPC_URLS has all chains', () => {
    assert.ok(DEFAULT_RPC_URLS.sepolia);
    assert.ok(DEFAULT_RPC_URLS.ethereum);
    assert.ok(DEFAULT_RPC_URLS.base);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  3. getChains()
// ═══════════════════════════════════════════════════════════════════

describe('3. getChains()', () => {
  it('returns 3 supported chains from API', async () => {
    const res = await client.getChains();
    assert.equal(res.success, true);
    assert.equal(res.chains.length, 3);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  4. createLink()
// ═══════════════════════════════════════════════════════════════════

describe('4. createLink()', () => {
  it('creates USDC link on sepolia', async () => {
    const res = await client.createLink({ amount: '10', network: 'sepolia' });
    assert.ok(res.linkId.startsWith('REQ-'));
    assert.equal(res.network, 'sepolia');
    assert.equal(res.token, 'USDC');
    links.sepolia = res.linkId;
  });

  it('creates USDC link on ethereum', async () => {
    const res = await client.createLink({ amount: '50', network: 'ethereum' });
    assert.equal(res.network, 'ethereum');
    links.ethereum = res.linkId;
  });

  it('creates USDT link on base', async () => {
    const res = await client.createLink({ amount: '25', network: 'base', token: 'USDT' });
    assert.equal(res.network, 'base');
    assert.equal(res.token, 'USDT');
    links.base = res.linkId;
  });

  it('creates ETH link on ethereum', async () => {
    const res = await client.createLink({ amount: '0.5', network: 'ethereum', token: 'ETH' });
    assert.equal(res.token, 'ETH');
    links.ethLink = res.linkId;
  });

  it('creates LCX link on sepolia', async () => {
    const res = await client.createLink({ amount: '100', network: 'sepolia', token: 'LCX' });
    assert.equal(res.token, 'LCX');
    links.lcxLink = res.linkId;
  });

  it('creates link with description', async () => {
    const res = await client.createLink({
      amount: '5', network: 'sepolia', description: 'SDK E2E test payment',
    });
    assert.ok(res.linkId);
    links.withDescription = res.linkId;
  });

  it('rejects missing amount', async () => {
    await assert.rejects(
      () => client.createLink({ network: 'sepolia' }),
      /amount/
    );
  });

  it('rejects missing network', async () => {
    await assert.rejects(
      () => client.createLink({ amount: '10' }),
      /network/
    );
  });

  it('rejects unsupported network', async () => {
    await assert.rejects(
      () => client.createLink({ amount: '10', network: 'polygon' }),
      (err) => err.status === 400
    );
  });

  it('rejects zero amount', async () => {
    await assert.rejects(
      () => client.createLink({ amount: '0', network: 'sepolia' }),
      (err) => err.status === 400
    );
  });

  it('rejects negative amount', async () => {
    await assert.rejects(
      () => client.createLink({ amount: '-5', network: 'sepolia' }),
      (err) => err.status === 400
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
//  5. getInstructions()
// ═══════════════════════════════════════════════════════════════════

describe('5. getInstructions()', () => {
  it('returns payment instructions for sepolia USDC link', async () => {
    const res = await client.getInstructions(links.sepolia);
    assert.equal(res.success, true);
    assert.ok(res.instructions);
    assert.ok(res.instructions.payment);
    assert.equal(res.instructions.payment.network, 'sepolia');
    assert.equal(res.instructions.payment.tokenAddress, '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87');
  });

  it('returns transfers array', async () => {
    const res = await client.getInstructions(links.sepolia);
    assert.ok(Array.isArray(res.instructions.transfers));
    assert.ok(res.instructions.transfers.length >= 1);
    const first = res.instructions.transfers[0];
    assert.ok(first.to);
    assert.ok(first.amount);
    assert.ok(first.token);
  });

  it('ETH link returns null tokenAddress', async () => {
    const res = await client.getInstructions(links.ethLink);
    assert.equal(res.instructions.payment.tokenAddress, null);
  });

  it('rejects non-existent link', async () => {
    await assert.rejects(
      () => client.getInstructions('REQ-DOESNOTEXIST'),
      (err) => err.status === 404
    );
  });

  it('throws without linkId', async () => {
    await assert.rejects(() => client.getInstructions(), /linkId/);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  6. verifyPayment()
// ═══════════════════════════════════════════════════════════════════

describe('6. verifyPayment()', () => {
  it('rejects non-existent requestId', async () => {
    await assert.rejects(
      () => client.verifyPayment('REQ-DOESNOTEXIST', '0x' + 'a'.repeat(64)),
      (err) => err.status === 404
    );
  });

  it('handles blockchain verification failure gracefully', async () => {
    await assert.rejects(
      () => client.verifyPayment(links.sepolia, '0x' + 'b'.repeat(64)),
      (err) => [400, 500].includes(err.status)
    );
  });

  it('throws without requestId', async () => {
    await assert.rejects(() => client.verifyPayment(null, '0xabc'), /requestId/);
  });

  it('throws without txHash', async () => {
    await assert.rejects(() => client.verifyPayment('REQ-123'), /txHash/);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  7. payLink() (mocked blockchain — will fail at broadcast)
// ═══════════════════════════════════════════════════════════════════

describe('7. payLink()', () => {
  it('fetches instructions stage succeeds, broadcast fails (no real RPC)', async () => {
    await assert.rejects(
      () => client.payLink(links.sepolia),
      (err) => {
        // Should fail at the provider/broadcast stage, not at the API stage
        return err.message !== 'Failed to fetch payment instructions';
      }
    );
  });

  it('rejects non-existent link', async () => {
    await assert.rejects(
      () => client.payLink('REQ-DOESNOTEXIST'),
      (err) => err.message.includes('404') || err.status === 404 || err.message.includes('not found')
    );
  });

  it('throws without linkId', async () => {
    await assert.rejects(() => client.payLink(), /linkId/);
  });

  it('throws without linkId (empty string)', async () => {
    await assert.rejects(() => client.payLink(''), /linkId/);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  8. HMAC AUTHENTICATION INTEGRITY
// ═══════════════════════════════════════════════════════════════════

describe('8. HMAC Authentication Integrity', () => {
  it('SDK-signed requests pass backend HMAC verification (implicit)', async () => {
    // Every successful createLink/getInstructions/getChains call above
    // proves HMAC signing works. This test explicitly confirms it.
    const res = await client.getChains();
    assert.equal(res.success, true);
  });

  it('client with wrong apiSecret fails on auth-required endpoint', async () => {
    const badClient = new PayAgentClient({
      apiKeyId: client.apiKeyId,
      apiSecret: 'sk_live_wrong_secret_' + 'x'.repeat(20),
      privateKey: '0x' + 'a'.repeat(64),
      baseUrl: BASE_URL,
    });

    await assert.rejects(
      () => badClient.createLink({ amount: '1', network: 'sepolia' }),
      (err) => err.status === 401
    );
  });

  it('client with wrong apiKeyId fails', async () => {
    const badClient = new PayAgentClient({
      apiKeyId: 'pk_live_wrong_key_id_' + 'x'.repeat(15),
      apiSecret: 'sk_live_fake_' + 'x'.repeat(25),
      privateKey: '0x' + 'a'.repeat(64),
      baseUrl: BASE_URL,
    });

    await assert.rejects(
      () => badClient.createLink({ amount: '1', network: 'sepolia' }),
      (err) => err.status === 401
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9. CROSS-CHAIN LINK RETRIEVAL
// ═══════════════════════════════════════════════════════════════════

describe('9. Cross-Chain Link Retrieval', () => {
  it('all created links are retrievable via getInstructions', async () => {
    for (const key of ['sepolia', 'ethereum', 'base', 'ethLink', 'lcxLink']) {
      if (!links[key]) continue;
      const res = await client.getInstructions(links[key]);
      assert.equal(res.success, true, `Link ${key} should be retrievable`);
      assert.ok(res.instructions, `Link ${key} should have instructions`);
    }
  });
});
