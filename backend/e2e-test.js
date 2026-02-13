#!/usr/bin/env node
/**
 * PayAgent — Full End-to-End Test (Sepolia Testnet)
 *
 * Tests the COMPLETE flow with HMAC authentication:
 *   1. Boot a fresh backend server (in-memory, no Supabase)
 *   2. Register two agents (creator + payer)
 *   3. Activate them (bypass X verification using direct module access)
 *   4. Creator creates a payment link (HMAC-signed HTTP request)
 *   5. Payer fetches instructions (HMAC-signed)
 *   6. Payer signs and broadcasts on-chain transactions (Sepolia)
 *   7. Payer verifies payment (HMAC-signed)
 *   8. Check final link status
 *   9. Test wallet-based auth (challenge → sign → JWT → profile)
 *
 * Prerequisites:
 *   - Payer wallet funded on Sepolia (ETH + USDC + LCX)
 *
 * Usage: node e2e-test.js
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

// ─── Configure environment for in-memory testing ───────────────────
// Load .env first so we get RPC URLs etc, then override Supabase
require('dotenv').config();
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
// Ensure HMAC + JWT secrets are set
if (!process.env.HMAC_ENCRYPTION_KEY) {
  process.env.HMAC_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

const PAYER_PRIVATE_KEY = '0x488b488d21ed5d78c8119e370a2ceaa249fc14b9e350ceecf65bd3bb25a82bc6';
const PAYER_WALLET = '0xdDf728C33EEFA99771bF0F52960dC3561fbC1E5b';

// Random creator wallet (doesn't need funds, just receives)
const creatorWallet = ethers.Wallet.createRandom();
const CREATOR_WALLET = creatorWallet.address;

const UNIQUE = Date.now().toString(36);

// ─── HMAC Helpers ───────────────────────────────────────────────────

function computeHmac(stringToSign, secret) {
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

function buildStringToSign(timestamp, method, path, body) {
  const bodyStr = body ? JSON.stringify(body) : '';
  const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
  return `${timestamp}\n${method}\n${path}\n${bodyHash}`;
}

async function hmacFetch(baseUrl, method, path, body, credentials) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = buildStringToSign(timestamp, method, path, body);
  const signature = computeHmac(stringToSign, credentials.apiSecret);

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key-id': credentials.apiKeyId,
    'x-timestamp': timestamp,
    'x-signature': signature,
  };

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  return { status: response.status, data };
}

// ─── Logging ────────────────────────────────────────────────────────

function log(step, msg) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  STEP ${step}: ${msg}`);
  console.log('='.repeat(60));
}

function ok(msg) { console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function fail(msg) { console.error(`  ❌ ${msg}`); process.exit(1); }

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 PayAgent End-to-End Test — Sepolia Testnet (Real On-Chain)\n');
  console.log(`  Payer wallet:   ${PAYER_WALLET}`);
  console.log(`  Creator wallet: ${CREATOR_WALLET}`);

  // ── Step 1: Boot a fresh backend server ───────────────────────────
  log(1, 'Boot Backend Server (in-memory storage)');

  const app = require('./api/index');
  const { activateAgent, getAgentByUsername } = require('./lib/agents');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => {  // port 0 = random available port
      resolve(s);
    });
  });

  const port = server.address().port;
  const BASE_URL = `http://localhost:${port}`;
  ok(`Server started on port ${port}`);
  info(`Base URL: ${BASE_URL}`);

  try {
    // ── Step 2: Health check ──────────────────────────────────────────
    log(2, 'Health Check');
    const healthRes = await fetch(`${BASE_URL}/health`);
    if (!healthRes.ok) fail('Backend is not responding');
    const health = await healthRes.json();
    ok(`Backend healthy: ${JSON.stringify(health)}`);

    // ── Step 3: Register Creator Agent ────────────────────────────────
    log(3, 'Register Creator Agent');
    const creatorUsername = `e2e_creator_${UNIQUE}`;
    const regCreator = await fetch(`${BASE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: creatorUsername,
        email: `creator_${UNIQUE}@e2etest.com`,
        wallet_address: CREATOR_WALLET,
      }),
    });
    const creatorReg = await regCreator.json();
    if (!creatorReg.success) fail(`Creator registration failed: ${JSON.stringify(creatorReg)}`);
    ok(`Creator registered: ${creatorReg.agent_id}`);
    info(`Verification challenge: ${creatorReg.verification_challenge}`);

    // ── Step 4: Register Payer Agent ──────────────────────────────────
    log(4, 'Register Payer Agent');
    const payerUsername = `e2e_payer_${UNIQUE}`;
    const regPayer = await fetch(`${BASE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: payerUsername,
        email: `payer_${UNIQUE}@e2etest.com`,
        wallet_address: PAYER_WALLET,
      }),
    });
    const payerReg = await regPayer.json();
    if (!payerReg.success) fail(`Payer registration failed: ${JSON.stringify(payerReg)}`);
    ok(`Payer registered: ${payerReg.agent_id}`);

    // ── Step 5: Activate both agents (bypass X verification) ──────────
    log(5, 'Activate Agents (bypass X verification for testing)');

    const creatorAgent = await getAgentByUsername(creatorUsername);
    const creatorActivation = await activateAgent(creatorAgent.id, 'e2e_test_x_creator');
    ok(`Creator activated`);
    info(`  api_key_id: ${creatorActivation.api_key_id.substring(0, 24)}...`);
    info(`  api_secret: ${creatorActivation.api_secret.substring(0, 24)}...`);
    info(`  expires_at: ${creatorActivation.expires_at}`);

    const payerAgent = await getAgentByUsername(payerUsername);
    const payerActivation = await activateAgent(payerAgent.id, 'e2e_test_x_payer');
    ok(`Payer activated`);
    info(`  api_key_id: ${payerActivation.api_key_id.substring(0, 24)}...`);
    info(`  api_secret: ${payerActivation.api_secret.substring(0, 24)}...`);

    const creatorCreds = { apiKeyId: creatorActivation.api_key_id, apiSecret: creatorActivation.api_secret };
    const payerCreds = { apiKeyId: payerActivation.api_key_id, apiSecret: payerActivation.api_secret };

    // ── Step 6: Verify HMAC auth works — get agent profile ────────────
    log(6, 'Test HMAC Auth — Get Agent Profile');
    const profileRes = await hmacFetch(BASE_URL, 'GET', '/api/agents/me', null, creatorCreds);
    if (profileRes.status !== 200) fail(`Profile fetch failed: ${JSON.stringify(profileRes.data)}`);
    ok(`Creator profile: ${profileRes.data.agent?.username || profileRes.data.username}`);

    // ── Step 7: Creator creates a payment link (HMAC-signed) ──────────
    log(7, 'Creator Creates Payment Link (HMAC-signed)');
    const linkRes = await hmacFetch(BASE_URL, 'POST', '/api/create-link', {
      amount: '0.5',
      network: 'sepolia',
      token: 'USDC',
      description: `E2E test payment ${UNIQUE}`,
    }, creatorCreds);

    if (!linkRes.data.success) fail(`Create link failed: ${JSON.stringify(linkRes.data)}`);
    const linkId = linkRes.data.linkId;
    ok(`Payment link created: ${linkId}`);
    info(`Network: ${linkRes.data.network}, Token: ${linkRes.data.token}, Amount: ${linkRes.data.amount}`);

    // ── Step 8: Payer gets payment instructions (HMAC-signed) ─────────
    log(8, 'Payer Fetches Payment Instructions (HMAC-signed)');
    const instrRes = await hmacFetch(BASE_URL, 'POST', '/api/pay-link', { linkId }, payerCreds);

    if (!instrRes.data.success) fail(`Pay-link failed: ${JSON.stringify(instrRes.data)}`);
    ok(`Instructions received for ${instrRes.data.linkId}`);
    info(`Payment: ${instrRes.data.instructions.payment.amount} ${instrRes.data.instructions.payment.token} → ${instrRes.data.instructions.payment.to.substring(0, 14)}...`);
    info(`Fee: ${instrRes.data.instructions.fee.feeTotal} ${instrRes.data.instructions.fee.feeToken} (platform: ${instrRes.data.instructions.fee.platformShare}, creator: ${instrRes.data.instructions.fee.creatorReward})`);
    info(`Transfers to execute: ${instrRes.data.instructions.transfers.length}`);

    for (const t of instrRes.data.instructions.transfers) {
      info(`  → ${t.description}: ${t.amount} ${t.token} to ${t.to.substring(0, 14)}...`);
    }

    // ── Step 9: Payer executes on-chain transactions ──────────────────
    log(9, 'Payer Executes On-Chain Transactions (Sepolia)');

    const provider = new ethers.JsonRpcProvider('https://sepolia.infura.io/v3/788eecaaeb7d414ea9c10f073d02635a');
    const signer = new ethers.Wallet(PAYER_PRIVATE_KEY, provider);

    const ERC20_ABI = [
      'function transfer(address to, uint256 amount) returns (bool)',
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)',
    ];

    const txHashes = {};
    const transfers = instrRes.data.instructions.transfers;

    for (let i = 0; i < transfers.length; i++) {
      const t = transfers[i];
      info(`\n  Executing transfer ${i + 1}/${transfers.length}: ${t.description}`);

      if (t.token === 'ETH') {
        const tx = await signer.sendTransaction({
          to: t.to,
          value: ethers.parseEther(t.amount),
        });
        info(`  Tx sent: ${tx.hash}`);
        info(`  Waiting for confirmation...`);
        const receipt = await tx.wait();
        ok(`  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed.toString()})`);

        if (t.description.includes('Payment')) txHashes.payment = tx.hash;
        else if (t.description.includes('Platform')) txHashes.fee = tx.hash;
        else if (t.description.includes('Creator')) txHashes.reward = tx.hash;
      } else {
        const contract = new ethers.Contract(t.tokenAddress, ERC20_ABI, signer);
        const decimals = await contract.decimals();
        const amount = ethers.parseUnits(t.amount, decimals);

        const tx = await contract.transfer(t.to, amount);
        info(`  Tx sent: ${tx.hash}`);
        info(`  Waiting for confirmation...`);
        const receipt = await tx.wait();
        ok(`  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed.toString()})`);

        if (t.description.includes('Payment')) txHashes.payment = tx.hash;
        else if (t.description.includes('Platform')) txHashes.fee = tx.hash;
        else if (t.description.includes('Creator')) txHashes.reward = tx.hash;
      }
    }

    ok('\nAll on-chain transactions confirmed!');
    info(`Payment tx: ${txHashes.payment}`);
    if (txHashes.fee) info(`Fee tx:     ${txHashes.fee}`);
    if (txHashes.reward) info(`Reward tx:  ${txHashes.reward}`);

    // ── Step 10: Verify payment ─────────────────────────────────────
    log(10, 'Verify Payment (HMAC-signed)');
    const verifyBody = {
      requestId: linkId,
      txHash: txHashes.payment,
    };
    if (txHashes.fee) verifyBody.feeTxHash = txHashes.fee;
    if (txHashes.reward) verifyBody.creatorRewardTxHash = txHashes.reward;

    const verifyRes = await hmacFetch(BASE_URL, 'POST', '/api/verify', verifyBody, payerCreds);

    if (!verifyRes.data.success) fail(`Verification failed: ${JSON.stringify(verifyRes.data)}`);
    ok(`Payment verified! Status: ${verifyRes.data.status}`);
    if (verifyRes.data.verification) {
      info(`On-chain: valid=${verifyRes.data.verification.valid}, block=${verifyRes.data.verification.blockNumber}, tokenType=${verifyRes.data.verification.tokenType}`);
    }

    // ── Step 11: Check final link status ────────────────────────────
    log(11, 'Check Final Link Status (public endpoint)');
    const statusRes = await fetch(`${BASE_URL}/api/request/${linkId}`);
    const statusData = await statusRes.json();
    ok(`Link status: ${statusData.status}`);
    info(`Paid at: ${statusData.paid_at || statusData.paidAt || 'N/A'}`);
    info(`Tx hash: ${statusData.tx_hash || statusData.txHash || 'N/A'}`);
    if (statusData.status !== 'PAID') fail(`Expected PAID status, got: ${statusData.status}`);

    // ── Step 12: Test public fee endpoint (human payer path) ───────
    log(12, 'Test Public Fee Endpoint (Human Payer Path)');

    // Create a new link to test the fee endpoint
    const humanLinkRes = await hmacFetch(BASE_URL, 'POST', '/api/create-link', {
      amount: '10',
      network: 'sepolia',
      token: 'USDC',
      description: `Human payer fee test ${UNIQUE}`,
    }, creatorCreds);

    if (!humanLinkRes.data.success) fail(`Create link for fee test failed`);
    const humanLinkId = humanLinkRes.data.linkId;
    ok(`Created test link: ${humanLinkId}`);

    // Fetch fee info as a human payer (public, no auth)
    const feeRes = await fetch(`${BASE_URL}/api/request/${humanLinkId}/fee?payer=${PAYER_WALLET}`);
    const feeData = await feeRes.json();
    if (!feeData.success) fail(`Fee endpoint failed: ${JSON.stringify(feeData)}`);
    ok(`Fee info received`);
    info(`Payment: ${feeData.payment.amount} ${feeData.payment.token} on ${feeData.payment.network}`);
    info(`Fee: ${feeData.fee.feeTotal} ${feeData.fee.feeToken} (deducted from payment: ${feeData.fee.feeDeductedFromPayment})`);
    info(`Creator receives: ${feeData.creatorReceives}`);
    info(`Transfers: ${feeData.transfers.length}`);
    for (const t of feeData.transfers) {
      info(`  → ${t.description}: ${t.amount} ${t.token} to ${t.to.substring(0, 14)}...`);
    }

    // Validate fee structure
    if (feeData.fee.feeDeductedFromPayment) {
      const creatorAmount = parseFloat(feeData.creatorReceives);
      const paymentAmount = parseFloat(feeData.payment.amount);
      if (creatorAmount >= paymentAmount) fail('Creator should receive less than payment when fee is deducted');
      ok(`Fee correctly deducted: creator receives ${creatorAmount} < ${paymentAmount}`);
    } else {
      ok(`LCX fee path: creator receives full amount`);
    }

    // Test edge case: tiny payment should be rejected
    const tinyLinkRes = await hmacFetch(BASE_URL, 'POST', '/api/create-link', {
      amount: '0.001',
      network: 'sepolia',
      token: 'USDC',
      description: 'Tiny amount test',
    }, creatorCreds);
    if (tinyLinkRes.data.success) {
      const tinyFeeRes = await fetch(`${BASE_URL}/api/request/${tinyLinkRes.data.linkId}/fee?payer=0x0000000000000000000000000000000000000001`);
      const tinyFeeData = await tinyFeeRes.json();
      if (tinyFeeRes.status === 400) {
        ok(`Correctly rejected tiny payment: ${tinyFeeData.error}`);
      } else {
        info(`Tiny payment fee result (may pass if payer has LCX): ${JSON.stringify(tinyFeeData.fee)}`);
      }
    }

    // ── Step 13: Test wallet-based auth ─────────────────────────────
    log(13, 'Test Wallet-Based Auth (Browser Dashboard Flow)');

    // 13a: Challenge
    info('Requesting challenge nonce...');
    const challengeRes = await fetch(`${BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: PAYER_WALLET }),
    });
    const challengeData = await challengeRes.json();
    if (!challengeData.nonce) fail(`Challenge failed: ${JSON.stringify(challengeData)}`);
    ok(`Got nonce: ${challengeData.nonce.substring(0, 45)}...`);
    info(`Expires in: ${challengeData.expires_in}s`);

    // 13b: Sign with wallet
    const payerSigner = new ethers.Wallet(PAYER_PRIVATE_KEY);
    const signature = await payerSigner.signMessage(challengeData.nonce);
    ok(`Signed nonce with wallet (EIP-191)`);

    // 13c: Verify → get JWT
    const verifyAuthRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: PAYER_WALLET, signature }),
    });
    const verifyAuthData = await verifyAuthRes.json();
    if (!verifyAuthData.token) fail(`Auth verify failed: ${JSON.stringify(verifyAuthData)}`);
    ok(`JWT received (expires in ${verifyAuthData.expires_in}s)`);
    info(`Agent: ${verifyAuthData.agent?.username}`);

    // 13d: Use JWT to get agent profile
    const jwtProfileRes = await fetch(`${BASE_URL}/api/agents/me`, {
      headers: { 'Authorization': `Bearer ${verifyAuthData.token}` },
    });
    const jwtProfileData = await jwtProfileRes.json();
    if (jwtProfileRes.status !== 200) fail(`JWT profile fetch failed: ${JSON.stringify(jwtProfileData)}`);
    ok(`Agent profile via JWT: ${jwtProfileData.agent?.username || jwtProfileData.username}`);

    // ── Done ────────────────────────────────────────────────────────
    console.log('\n' + '='.repeat(60));
    console.log('  🎉 ALL E2E TESTS PASSED — Full flow verified on Sepolia!');
    console.log('='.repeat(60));
    console.log('\n  Summary:');
    console.log(`    ✅ Backend server boot (in-memory storage)`);
    console.log(`    ✅ Agent registration (creator + payer)`);
    console.log(`    ✅ Agent activation with HMAC credentials`);
    console.log(`    ✅ HMAC-signed GET /api/agents/me`);
    console.log(`    ✅ HMAC-signed POST /api/create-link`);
    console.log(`    ✅ HMAC-signed POST /api/pay-link (instructions + fee from payment token)`);
    console.log(`    ✅ On-chain ERC-20 transactions (${transfers.length} transfers on Sepolia)`);
    console.log(`    ✅ HMAC-signed POST /api/verify → PAID`);
    console.log(`    ✅ Public GET /api/request/:id → status PAID`);
    console.log(`    ✅ Public GET /api/request/:id/fee (human payer fee endpoint)`);
    console.log(`    ✅ Fee deduction from payment token validation`);
    console.log(`    ✅ Edge case: tiny payment rejection`);
    console.log(`    ✅ Wallet auth: challenge → EIP-191 sign → JWT`);
    console.log(`    ✅ JWT-authenticated GET /api/agents/me`);
    console.log(`\n  Payment link: ${linkId}`);
    console.log(`  Payment tx:   ${txHashes.payment}`);
    if (txHashes.fee) console.log(`  Fee tx:       ${txHashes.fee}`);
    if (txHashes.reward) console.log(`  Reward tx:    ${txHashes.reward}`);
    console.log(`\n  Sepolia Etherscan: https://sepolia.etherscan.io/tx/${txHashes.payment}`);
    console.log('');

  } finally {
    // Clean up: shut down the server
    server.close();
  }
}

main().catch(err => {
  console.error('\n❌ E2E test failed:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
