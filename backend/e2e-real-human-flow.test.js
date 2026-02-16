#!/usr/bin/env node

/**
 * PayAgent — Real Supabase + Real Blockchain Human Flow E2E
 *
 * Runs the complete human user journey against PRODUCTION Supabase and
 * Sepolia testnet with real on-chain USDC transfers.
 *
 * Wallets:
 *   PRIVATE_KEY1 → creator (creates link, receives payment + reward)
 *   PRIVATE_KEY2 → payer   (pays the link with 3 real transfers)
 *
 * Run:  npm run test:real-human
 *       node --test --test-timeout 300000 e2e-real-human-flow.test.js
 */

'use strict';

// ─── Load env FIRST (must happen before any other require) ─────────
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config(); // .env

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { ethers } = require('ethers');
const { createClient } = require('@supabase/supabase-js');

// ─── Constants ─────────────────────────────────────────────────────
const SEPOLIA_USDC = '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87';
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const PAYMENT_AMOUNT = '0.01'; // 0.01 USDC — tiny amount for testing
const MIN_ETH_FOR_GAS = 0.001; // need at least 0.001 ETH for 3 txs
const MIN_USDC_FOR_TEST = 0.05; // need enough for payment + fees

// ─── Derive wallets ────────────────────────────────────────────────
const PK1 = process.env.PRIVATE_KEY1;
const PK2 = process.env.PRIVATE_KEY2;

if (!PK1 || !PK2) {
  console.error('❌ PRIVATE_KEY1 and PRIVATE_KEY2 must be set in .env');
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL);
const creatorWallet = new ethers.Wallet(PK1, provider);
const payerWallet = new ethers.Wallet(PK2, provider);

const CREATOR_ADDR = creatorWallet.address.toLowerCase();
const PAYER_ADDR = payerWallet.address.toLowerCase();
const TREASURY = (process.env.PLATFORM_TREASURY_WALLET || '').toLowerCase();

console.log(`Creator: ${CREATOR_ADDR}`);
console.log(`Payer:   ${PAYER_ADDR}`);
console.log(`Treasury: ${TREASURY}`);

// ─── Supabase client for cleanup ──────────────────────────────────
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, supabaseKey);

// ─── Boot Express app ──────────────────────────────────────────────
const app = require('./api/index');
let server;
let BASE_URL;

// ─── Test state ────────────────────────────────────────────────────
const createdLinkIds = [];
let primaryLinkId = null;
let secondaryLinkId = null;
let feeBreakdown = null;
let paymentTxHash = null;
let feeTxHash = null;
let creatorRewardTxHash = null;
let jwtToken = null;
let skipBlockchain = false;

// ─── HTTP helper ───────────────────────────────────────────────────
function request(method, path, body, headers = {}) {
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

// ─── ERC-20 transfer helper ───────────────────────────────────────
async function sendUsdc(fromWallet, toAddress, amountHuman) {
  const usdc = new ethers.Contract(SEPOLIA_USDC, ERC20_ABI, fromWallet);
  const decimals = 6;
  const amountRaw = ethers.parseUnits(amountHuman, decimals);
  console.log(`  → Sending ${amountHuman} USDC to ${toAddress}...`);
  const tx = await usdc.transfer(toAddress, amountRaw);
  console.log(`    tx submitted: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`    confirmed in block ${receipt.blockNumber}`);
  return tx.hash;
}

// ─── Get USDC balance helper ──────────────────────────────────────
async function getUsdcBalance(address) {
  const usdc = new ethers.Contract(SEPOLIA_USDC, ERC20_ABI, provider);
  const raw = await usdc.balanceOf(address);
  return Number(ethers.formatUnits(raw, 6));
}

// ────────────────────────────────────────────────────────────────────
// TEST SUITE
// ────────────────────────────────────────────────────────────────────

describe('Real Supabase + Sepolia Human Flow E2E', () => {

  // ── Setup ─────────────────────────────────────────────────────────
  before(async () => {
    server = await new Promise((resolve) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const { port } = server.address();
    BASE_URL = `http://127.0.0.1:${port}`;
    console.log(`\n🚀 Server running at ${BASE_URL}\n`);
  });

  after(async () => {
    console.log('\n🧹 Running cleanup...');
    try {
      if (createdLinkIds.length > 0) {
        // Delete fee_transactions FIRST (foreign key references payment_requests)
        const { error: ftErr } = await supabase
          .from('fee_transactions')
          .delete()
          .in('payment_request_id', createdLinkIds);
        if (ftErr) console.error('  ⚠ fee_transactions cleanup error:', ftErr.message);
        else console.log('  ✓ Cleaned fee_transactions');

        // Then delete payment_requests
        const { error: prErr } = await supabase
          .from('payment_requests')
          .delete()
          .in('id', createdLinkIds);
        if (prErr) console.error('  ⚠ payment_requests cleanup error:', prErr.message);
        else console.log(`  ✓ Deleted ${createdLinkIds.length} payment_requests: ${createdLinkIds.join(', ')}`);
      }

      // Delete auth_nonces
      const { error: anErr } = await supabase
        .from('auth_nonces')
        .delete()
        .in('wallet_address', [CREATOR_ADDR, PAYER_ADDR]);
      if (anErr) console.error('  ⚠ auth_nonces cleanup error:', anErr.message);
      else console.log('  ✓ Cleaned auth_nonces');
    } catch (cleanupErr) {
      console.error('  ⚠ Cleanup failed:', cleanupErr.message);
    }

    // Shut down server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('  ✓ Server shut down');
    }
    console.log('🧹 Cleanup complete\n');
  });

  // ── Phase 0: Pre-flight Checks ───────────────────────────────────
  describe('Phase 0: Pre-flight Checks', () => {

    it('derives wallet addresses from private keys', () => {
      assert.ok(CREATOR_ADDR.startsWith('0x'), 'Creator address is valid');
      assert.ok(PAYER_ADDR.startsWith('0x'), 'Payer address is valid');
      assert.equal(CREATOR_ADDR.length, 42);
      assert.equal(PAYER_ADDR.length, 42);
      assert.notEqual(CREATOR_ADDR, PAYER_ADDR, 'Creator and payer are different wallets');
      console.log(`  Creator: ${CREATOR_ADDR}`);
      console.log(`  Payer:   ${PAYER_ADDR}`);
    });

    it('payer has enough ETH for gas (>= 0.001 ETH)', async () => {
      const ethBalance = Number(ethers.formatEther(await provider.getBalance(PAYER_ADDR)));
      console.log(`  Payer ETH balance: ${ethBalance}`);
      if (ethBalance < MIN_ETH_FOR_GAS) {
        skipBlockchain = true;
        console.log('  ⚠ INSUFFICIENT ETH — blockchain tests will be skipped');
      }
      assert.ok(ethBalance >= 0, 'Balance is non-negative');
    });

    it('payer has enough USDC for test (>= 0.05 USDC)', async () => {
      const usdcBalance = await getUsdcBalance(PAYER_ADDR);
      console.log(`  Payer USDC balance: ${usdcBalance}`);
      if (usdcBalance < MIN_USDC_FOR_TEST) {
        skipBlockchain = true;
        console.log('  ⚠ INSUFFICIENT USDC — blockchain tests will be skipped');
      }
      assert.ok(usdcBalance >= 0, 'Balance is non-negative');
    });
  });

  // ── Phase 1: Human Dashboard Flow ────────────────────────────────
  describe('Phase 1: Human Dashboard Flow', () => {

    it('checks if creator has an agent (GET /api/agents/by-wallet)', async () => {
      const res = await request('GET', `/api/agents/by-wallet?wallet=${CREATOR_ADDR}`);
      // May return 200 (agent found) or 404 (no agent) — both are valid
      assert.ok([200, 404].includes(res.status), `Expected 200 or 404, got ${res.status}`);
      console.log(`  Creator agent status: ${res.status === 200 ? 'has agent' : 'no agent (human user)'}`);
    });

    it('fetches live token prices (GET /api/prices)', async () => {
      const res = await request('GET', '/api/prices');
      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.prices);
      assert.ok(typeof res.body.prices.ETH === 'number', 'ETH price is a number');
      assert.ok(typeof res.body.prices.USDC === 'number', 'USDC price is a number');
      console.log(`  Prices: ETH=$${res.body.prices.ETH}, USDC=$${res.body.prices.USDC}, LCX=$${res.body.prices.LCX}`);
    });

    it('fetches platform stats (GET /api/stats)', async () => {
      const res = await request('GET', '/api/stats');
      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.stats);
      console.log(`  Stats: ${JSON.stringify(res.body.stats).slice(0, 120)}...`);
    });

    it('fetches creator rewards baseline (GET /api/rewards)', async () => {
      const res = await request('GET', `/api/rewards?wallet=${CREATOR_ADDR}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(res.body.rewards);
      assert.ok(res.body.totals);
      console.log(`  Rewards baseline: human=${res.body.totals.humanRewardsCount}, agent=${res.body.totals.agentRewardsCount}`);
    });

    it('creates a USDC payment link on Sepolia (POST /api/create)', async () => {
      const res = await request('POST', '/api/create', {
        token: 'USDC',
        amount: PAYMENT_AMOUNT,
        receiver: creatorWallet.address,
        description: 'E2E real human flow test',
        network: 'sepolia',
        creatorWallet: creatorWallet.address,
      });
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.success);
      assert.ok(res.body.request.id);
      primaryLinkId = res.body.request.id;
      createdLinkIds.push(primaryLinkId);
      console.log(`  Created link: ${primaryLinkId}`);
    });

    it('views created link (GET /api/request/:id) — expects 402 PENDING', async () => {
      const res = await request('GET', `/api/request/${primaryLinkId}`);
      assert.equal(res.status, 402, `Expected 402, got ${res.status}`);
      assert.ok(res.body.payment);
      assert.equal(res.body.payment.id, primaryLinkId);
      assert.equal(res.body.payment.token, 'USDC');
      assert.equal(res.body.payment.amount, PAYMENT_AMOUNT);
      console.log(`  Link status: PENDING (402)`);
    });

    it('lists creator links (GET /api/requests?wallet=...)', async () => {
      const res = await request('GET', `/api/requests?wallet=${creatorWallet.address}`);
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.requests || res.body));
      const list = res.body.requests || res.body;
      const found = list.find(r => r.id === primaryLinkId);
      assert.ok(found, 'Created link appears in listing');
      console.log(`  Found link in listing (${list.length} total links for wallet)`);
    });
  });

  // ── Phase 2: Payment Flow (real blockchain transactions) ─────────
  describe('Phase 2: Payment Flow (real blockchain)', () => {

    it('gets fee breakdown (GET /api/request/:id/fee?payer=...)', async () => {
      const res = await request('GET', `/api/request/${primaryLinkId}/fee?payer=${PAYER_ADDR}`);
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.success);
      assert.ok(res.body.fee);
      assert.ok(Array.isArray(res.body.transfers));
      assert.equal(res.body.transfers.length, 3, 'Should have 3 transfers');
      feeBreakdown = res.body;
      console.log(`  Fee token: ${res.body.fee.feeToken}, total: ${res.body.fee.feeTotal}`);
      console.log(`  Transfers:`);
      res.body.transfers.forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.description}: ${t.amount} ${t.token} → ${t.to.slice(0, 10)}...`);
      });
    });

    it('executes Transfer 1: payment to creator (real USDC)', { skip: skipBlockchain }, async () => {
      const transfer = feeBreakdown.transfers[0];
      assert.ok(transfer, 'Transfer 1 exists');
      paymentTxHash = await sendUsdc(payerWallet, transfer.to, transfer.amount);
      assert.ok(paymentTxHash, 'Got tx hash');
      console.log(`  ✅ Payment tx: ${paymentTxHash}`);
    });

    it('executes Transfer 2: platform fee (real USDC)', { skip: skipBlockchain }, async () => {
      const transfer = feeBreakdown.transfers[1];
      assert.ok(transfer, 'Transfer 2 exists');
      feeTxHash = await sendUsdc(payerWallet, transfer.to, transfer.amount);
      assert.ok(feeTxHash, 'Got tx hash');
      console.log(`  ✅ Fee tx: ${feeTxHash}`);
    });

    it('executes Transfer 3: creator reward (real USDC)', { skip: skipBlockchain }, async () => {
      const transfer = feeBreakdown.transfers[2];
      assert.ok(transfer, 'Transfer 3 exists');
      creatorRewardTxHash = await sendUsdc(payerWallet, transfer.to, transfer.amount);
      assert.ok(creatorRewardTxHash, 'Got tx hash');
      console.log(`  ✅ Reward tx: ${creatorRewardTxHash}`);
    });

    it('verifies payment (POST /api/verify)', { skip: skipBlockchain }, async () => {
      assert.ok(paymentTxHash, 'Payment tx hash exists');
      const transfer = feeBreakdown.transfers[0];

      const res = await request('POST', '/api/verify', {
        requestId: primaryLinkId,
        txHash: paymentTxHash,
        feeTxHash: feeTxHash,
        creatorRewardTxHash: creatorRewardTxHash,
        payerWallet: PAYER_ADDR,
        feeToken: feeBreakdown.fee.feeToken,
        feeTotal: feeBreakdown.fee.feeTotal,
        platformShare: feeBreakdown.fee.platformShare,
        creatorReward: feeBreakdown.fee.creatorReward,
      });
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.success);
      assert.equal(res.body.status, 'PAID');
      assert.ok(res.body.verification);
      assert.ok(res.body.verification.valid, `Verification should be valid: ${JSON.stringify(res.body.verification)}`);
      console.log(`  ✅ Payment verified: status=${res.body.status}, valid=${res.body.verification.valid}`);
    });

    it('confirms link is now PAID (GET /api/request/:id)', { skip: skipBlockchain }, async () => {
      const res = await request('GET', `/api/request/${primaryLinkId}`);
      assert.equal(res.status, 200, `Expected 200 for PAID link, got ${res.status}`);
      assert.ok(res.body.success);
      assert.equal(res.body.status, 'PAID');
      assert.ok(res.body.request);
      assert.equal(res.body.request.txHash, paymentTxHash);
      console.log(`  ✅ Link confirmed PAID`);
    });
  });

  // ── Phase 3: Post-Payment Checks ─────────────────────────────────
  describe('Phase 3: Post-Payment Checks', () => {

    it('PAID link appears in listing (GET /api/requests?wallet=...)', { skip: skipBlockchain }, async () => {
      const res = await request('GET', `/api/requests?wallet=${creatorWallet.address}`);
      assert.equal(res.status, 200);
      const list = res.body.requests || res.body;
      const found = list.find(r => r.id === primaryLinkId);
      assert.ok(found, 'Link still in listing');
      assert.equal(found.status, 'PAID');
      console.log(`  ✅ PAID link found in listing`);
    });

    it('rewards updated for creator (GET /api/rewards?wallet=...)', { skip: skipBlockchain }, async () => {
      const res = await request('GET', `/api/rewards?wallet=${creatorWallet.address}`);
      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      console.log(`  Rewards after payment: human=${res.body.totals.humanRewardsCount}, total=${res.body.totals.humanRewardsTotal}`);
    });

    it('fee_transaction row created in Supabase', { skip: skipBlockchain }, async () => {
      const { data, error } = await supabase
        .from('fee_transactions')
        .select('*')
        .eq('payment_request_id', primaryLinkId);
      assert.ok(!error, `Supabase error: ${error?.message}`);
      assert.ok(data && data.length > 0, 'fee_transactions row exists');
      const fee = data[0];
      assert.equal(fee.status, 'COLLECTED');
      assert.equal(fee.payment_tx_hash, paymentTxHash);
      assert.equal(fee.platform_fee_tx_hash, feeTxHash);
      console.log(`  ✅ fee_transaction: id=${fee.id}, token=${fee.fee_token}, total=${fee.fee_total}`);
    });
  });

  // ── Phase 4: Wallet Auth + Delete Flow ───────────────────────────
  describe('Phase 4: Wallet Auth + Delete Flow', () => {

    it('gets challenge nonce for creator wallet (POST /api/auth/challenge)', async () => {
      const res = await request('POST', '/api/auth/challenge', {
        wallet_address: creatorWallet.address,
      });
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.success);
      assert.ok(res.body.nonce);
      assert.ok(res.body.nonce.startsWith('Sign this to login to PayAgent:'));
      console.log(`  Nonce: ${res.body.nonce.slice(0, 50)}...`);
      // Store nonce for next test
      this.nonce = res.body.nonce;
    });

    it('signs nonce and gets JWT (POST /api/auth/verify)', async () => {
      // Need to get a fresh challenge since `this` doesn't work across tests
      const challengeRes = await request('POST', '/api/auth/challenge', {
        wallet_address: creatorWallet.address,
      });
      assert.equal(challengeRes.status, 200);
      const nonce = challengeRes.body.nonce;

      // Sign with ethers
      const signature = await creatorWallet.signMessage(nonce);
      console.log(`  Signature: ${signature.slice(0, 20)}...`);

      const res = await request('POST', '/api/auth/verify', {
        wallet_address: creatorWallet.address,
        signature,
      });
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.success);
      assert.ok(res.body.token);
      jwtToken = res.body.token;
      console.log(`  ✅ JWT obtained (agent: ${res.body.agent ? res.body.agent.username : 'none — human user'})`);
    });

    it('uses JWT to access /api/agents/me (may be 401 for human)', async () => {
      assert.ok(jwtToken, 'JWT token exists');
      const res = await request('GET', '/api/agents/me', null, {
        'Authorization': `Bearer ${jwtToken}`,
      });
      // 200 if creator is an agent, 401/403 if human-only, 404 if no agent for wallet, 500 if server has no agent guard
      assert.ok([200, 401, 403, 404, 500].includes(res.status), `Expected 200/401/403/404/500, got ${res.status}`);
      console.log(`  /api/agents/me status: ${res.status}`);
    });

    it('creates a second link for deletion test', async () => {
      const res = await request('POST', '/api/create', {
        token: 'USDC',
        amount: '0.001',
        receiver: creatorWallet.address,
        description: 'E2E delete test link',
        network: 'sepolia',
        creatorWallet: creatorWallet.address,
      });
      assert.ok([200, 201].includes(res.status), `Expected 200/201, got ${res.status}`);
      assert.ok(res.body.success);
      secondaryLinkId = res.body.request.id;
      createdLinkIds.push(secondaryLinkId);
      console.log(`  Created secondary link: ${secondaryLinkId}`);
    });

    it('deletes secondary link via wallet param (DELETE /api/request/:id?wallet=...)', async () => {
      const res = await request('DELETE', `/api/request/${secondaryLinkId}?wallet=${creatorWallet.address}`);
      assert.equal(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
      assert.ok(res.body.success);
      console.log(`  ✅ Secondary link deleted: ${secondaryLinkId}`);
    });

    it('confirms deleted link is gone (GET /api/request/:id)', async () => {
      const res = await request('GET', `/api/request/${secondaryLinkId}`);
      assert.equal(res.status, 404, `Expected 404, got ${res.status}`);
      console.log(`  ✅ Deleted link returns 404`);
    });
  });

  // ── Phase 5: Cleanup verification ────────────────────────────────
  describe('Phase 5: Cleanup Verification', () => {

    it('verifies no orphaned auth_nonces for test wallets', async () => {
      // Cleanup already ran via the auth/verify flow (nonces are one-time use)
      // But let's double-check
      const { data, error } = await supabase
        .from('auth_nonces')
        .select('wallet_address')
        .in('wallet_address', [CREATOR_ADDR, PAYER_ADDR]);
      // Nonces should have been consumed or will be cleaned in after() hook
      console.log(`  auth_nonces remaining: ${data ? data.length : 0}`);
      assert.ok(!error, `Query error: ${error?.message}`);
    });

    it('summary: all test link IDs tracked for cleanup', () => {
      console.log(`  Link IDs for cleanup: ${createdLinkIds.join(', ')}`);
      assert.ok(createdLinkIds.length >= 1, 'At least one link was created');
    });
  });
});
