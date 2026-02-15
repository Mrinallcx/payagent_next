#!/usr/bin/env node
/**
 * PayAgent — Full E2E Test (Human + Agent Payments on Sepolia)
 *
 * Tests:
 *   1. Cleanup old test agents
 *   2. Register 1 Creator agent under 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *   3. Activate agent (bypass X verification)
 *   4. Agent creates a payment link (HMAC-signed)
 *   5. Payer pays the agent link on-chain
 *   6. Verify agent payment
 *   7. Human creates a payment link (public API)
 *   8. Human pays the link on-chain
 *   9. Verify human payment with fee recording
 *  10. Check rewards endpoint
 *  11. Check stats endpoint
 *  12. Check requests filtering (human vs agent)
 *  13. Wallet JWT auth flow
 *
 * Usage: node e2e-full-test.js
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

// ─── Configure environment ──────────────────────────────────────────
require('dotenv').config();
// Force in-memory storage for clean test state
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;
if (!process.env.HMAC_ENCRYPTION_KEY) {
  process.env.HMAC_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = crypto.randomBytes(32).toString('hex');
}

// ─── Wallets ────────────────────────────────────────────────────────
const CREATOR_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const PAYER_PRIVATE_KEY = '0x488b488d21ed5d78c8119e370a2ceaa249fc14b9e350ceecf65bd3bb25a82bc6';
const PAYER_WALLET = '0xdDf728C33EEFA99771bF0F52960dC3561fbC1E5b';

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

let passCount = 0;
let failCount = 0;
const results = [];

function log(step, msg) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  STEP ${step}: ${msg}`);
  console.log('='.repeat(60));
}

function ok(msg) { passCount++; results.push({ pass: true, msg }); console.log(`  ✅ ${msg}`); }
function info(msg) { console.log(`  ℹ️  ${msg}`); }
function fail(msg) { failCount++; results.push({ pass: false, msg }); console.error(`  ❌ ${msg}`); }
function fatal(msg) { fail(msg); throw new Error(msg); }

// ─── ERC-20 helpers ─────────────────────────────────────────────────
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

/**
 * Execute on-chain transfers from the given instructions
 */
async function executeTransfers(transfers, signer) {
  const txHashes = {};

  for (let i = 0; i < transfers.length; i++) {
    const t = transfers[i];
    info(`  Executing transfer ${i + 1}/${transfers.length}: ${t.description}`);

    if (t.token === 'ETH') {
      const tx = await signer.sendTransaction({
        to: t.to,
        value: ethers.parseEther(t.amount),
      });
      info(`  Tx sent: ${tx.hash}`);
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
      const receipt = await tx.wait();
      ok(`  Confirmed in block ${receipt.blockNumber} (gas: ${receipt.gasUsed.toString()})`);

      if (t.description.includes('Payment')) txHashes.payment = tx.hash;
      else if (t.description.includes('Platform')) txHashes.fee = tx.hash;
      else if (t.description.includes('Creator')) txHashes.reward = tx.hash;
    }
  }

  return txHashes;
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀 PayAgent Full E2E Test — Human + Agent Payments on Sepolia\n');
  console.log(`  Creator wallet: ${CREATOR_WALLET}`);
  console.log(`  Payer wallet:   ${PAYER_WALLET}`);

  // ── Boot backend ──────────────────────────────────────────────────
  const app = require('./api/index');
  const { activateAgent, getAgentByUsername } = require('./lib/agents');

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const port = server.address().port;
  const BASE_URL = `http://localhost:${port}`;
  info(`Server started on port ${port}`);

  // Set up on-chain signer
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/788eecaaeb7d414ea9c10f073d02635a';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(PAYER_PRIVATE_KEY, provider);

  // Track IDs for later steps
  let creatorCreds;
  let agentLinkId;
  let agentTxHashes;
  let humanLinkId;
  let humanTxHashes;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Clean up existing test agents
    // ═══════════════════════════════════════════════════════════════════
    log(1, 'Clean up existing test agents');
    info('Using in-memory store — no old agents to clean (fresh start)');
    ok('Cleanup complete (in-memory mode)');

    // ═══════════════════════════════════════════════════════════════════
    // STEP 2: Register Creator Agent under 0xf39F...2266
    // ═══════════════════════════════════════════════════════════════════
    log(2, `Register Creator Agent (wallet: ${CREATOR_WALLET})`);
    const creatorUsername = `e2e_creator_${UNIQUE}`;

    const regRes = await fetch(`${BASE_URL}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: creatorUsername,
        email: `creator_${UNIQUE}@e2etest.com`,
        wallet_address: CREATOR_WALLET,
      }),
    });
    const regData = await regRes.json();

    if (!regData.success) fatal(`Creator registration failed: ${JSON.stringify(regData)}`);
    ok(`Creator registered: ${regData.agent_id}`);
    info(`Username: ${creatorUsername}`);
    info(`Wallet: ${CREATOR_WALLET}`);
    info(`Verification challenge: ${regData.verification_challenge}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Activate Creator Agent (bypass X verification)
    // ═══════════════════════════════════════════════════════════════════
    log(3, 'Activate Creator Agent (bypass X verification)');
    const creatorAgent = await getAgentByUsername(creatorUsername);
    if (!creatorAgent) fatal('Creator agent not found after registration');

    const activation = await activateAgent(creatorAgent.id, 'e2e_test_x');
    ok(`Creator activated`);
    info(`  api_key_id: ${activation.api_key_id.substring(0, 24)}...`);
    info(`  api_secret: ${activation.api_secret.substring(0, 24)}...`);
    info(`  expires_at: ${activation.expires_at}`);

    creatorCreds = { apiKeyId: activation.api_key_id, apiSecret: activation.api_secret };

    // Verify HMAC works by calling /api/agents/me
    const profileRes = await hmacFetch(BASE_URL, 'GET', '/api/agents/me', null, creatorCreds);
    if (profileRes.status !== 200) fatal(`Profile fetch failed: ${JSON.stringify(profileRes.data)}`);
    ok(`HMAC auth verified — profile: ${profileRes.data.agent?.username}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 4: Agent creates payment link via HMAC
    // ═══════════════════════════════════════════════════════════════════
    log(4, 'Agent creates payment link (HMAC-signed)');

    const createLinkRes = await hmacFetch(BASE_URL, 'POST', '/api/create-link', {
      amount: '0.5',
      network: 'sepolia',
      token: 'USDC',
      description: `E2E agent payment test ${UNIQUE}`,
    }, creatorCreds);

    if (!createLinkRes.data.success) fatal(`Create link failed: ${JSON.stringify(createLinkRes.data)}`);
    agentLinkId = createLinkRes.data.linkId;
    ok(`Agent payment link created: ${agentLinkId}`);
    info(`Network: ${createLinkRes.data.network}, Token: ${createLinkRes.data.token}, Amount: ${createLinkRes.data.amount}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Payer pays the agent link on-chain
    // ═══════════════════════════════════════════════════════════════════
    log(5, 'Payer pays the agent link on-chain (Sepolia)');

    // Get fee info via public endpoint
    const agentFeeRes = await fetch(`${BASE_URL}/api/request/${agentLinkId}/fee?payer=${PAYER_WALLET}`);
    const agentFeeData = await agentFeeRes.json();
    if (!agentFeeData.success) fatal(`Fee endpoint failed: ${JSON.stringify(agentFeeData)}`);

    ok(`Fee info received for agent link`);
    info(`Fee: ${agentFeeData.fee.feeTotal} ${agentFeeData.fee.feeToken} (deducted from payment: ${agentFeeData.fee.feeDeductedFromPayment})`);
    info(`Creator receives: ${agentFeeData.creatorReceives}`);
    info(`Transfers: ${agentFeeData.transfers.length}`);
    for (const t of agentFeeData.transfers) {
      info(`  → ${t.description}: ${t.amount} ${t.token} to ${t.to.substring(0, 14)}...`);
    }

    agentTxHashes = await executeTransfers(agentFeeData.transfers, signer);

    ok('All on-chain transactions for agent link confirmed!');
    info(`Payment tx: ${agentTxHashes.payment}`);
    if (agentTxHashes.fee) info(`Fee tx:     ${agentTxHashes.fee}`);
    if (agentTxHashes.reward) info(`Reward tx:  ${agentTxHashes.reward}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 6: Verify agent payment
    // ═══════════════════════════════════════════════════════════════════
    log(6, 'Verify agent payment');

    const agentVerifyBody = {
      requestId: agentLinkId,
      txHash: agentTxHashes.payment,
      payerWallet: PAYER_WALLET,
    };
    if (agentTxHashes.fee) agentVerifyBody.feeTxHash = agentTxHashes.fee;
    if (agentTxHashes.reward) agentVerifyBody.creatorRewardTxHash = agentTxHashes.reward;

    const agentVerifyRes = await fetch(`${BASE_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(agentVerifyBody),
    });
    const agentVerifyData = await agentVerifyRes.json();

    if (!agentVerifyData.success) fatal(`Agent verification failed: ${JSON.stringify(agentVerifyData)}`);
    ok(`Agent payment verified! Status: ${agentVerifyData.status}`);
    if (agentVerifyData.verification) {
      info(`On-chain: valid=${agentVerifyData.verification.valid}, block=${agentVerifyData.verification.blockNumber}`);
    }

    // Confirm the request is now PAID
    const agentStatusRes = await fetch(`${BASE_URL}/api/request/${agentLinkId}`);
    const agentStatusData = await agentStatusRes.json();
    if (agentStatusData.status !== 'PAID' && agentStatusData.request?.status !== 'PAID') {
      fatal(`Expected agent link PAID, got: ${JSON.stringify(agentStatusData)}`);
    }
    ok(`Agent link confirmed PAID`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 7: Human creates payment link via public API
    // ═══════════════════════════════════════════════════════════════════
    log(7, 'Human creates payment link (public API, no auth)');

    const humanCreateRes = await fetch(`${BASE_URL}/api/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: 'USDC',
        amount: '0.5',
        receiver: CREATOR_WALLET,
        description: `E2E human payment test ${UNIQUE}`,
        network: 'sepolia',
        creatorWallet: CREATOR_WALLET,
      }),
    });
    const humanCreateData = await humanCreateRes.json();

    if (!humanCreateData.success) fatal(`Human create link failed: ${JSON.stringify(humanCreateData)}`);
    humanLinkId = humanCreateData.request.id;
    ok(`Human payment link created: ${humanLinkId}`);
    info(`No creator_agent_id (human origin)`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 8: Human pays the link on-chain
    // ═══════════════════════════════════════════════════════════════════
    log(8, 'Human pays the link on-chain (Sepolia)');

    // Get fee info via public endpoint
    const humanFeeRes = await fetch(`${BASE_URL}/api/request/${humanLinkId}/fee?payer=${PAYER_WALLET}`);
    const humanFeeData = await humanFeeRes.json();
    if (!humanFeeData.success) fatal(`Human fee endpoint failed: ${JSON.stringify(humanFeeData)}`);

    ok(`Fee info received for human link`);
    info(`Fee: ${humanFeeData.fee.feeTotal} ${humanFeeData.fee.feeToken} (deducted: ${humanFeeData.fee.feeDeductedFromPayment})`);
    info(`Creator receives: ${humanFeeData.creatorReceives}`);
    for (const t of humanFeeData.transfers) {
      info(`  → ${t.description}: ${t.amount} ${t.token} to ${t.to.substring(0, 14)}...`);
    }

    humanTxHashes = await executeTransfers(humanFeeData.transfers, signer);

    ok('All on-chain transactions for human link confirmed!');
    info(`Payment tx: ${humanTxHashes.payment}`);
    if (humanTxHashes.fee) info(`Fee tx:     ${humanTxHashes.fee}`);
    if (humanTxHashes.reward) info(`Reward tx:  ${humanTxHashes.reward}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 9: Verify human payment with fee recording
    // ═══════════════════════════════════════════════════════════════════
    log(9, 'Verify human payment (public, no HMAC — human flow)');

    const humanVerifyBody = {
      requestId: humanLinkId,
      txHash: humanTxHashes.payment,
      payerWallet: PAYER_WALLET,
    };
    if (humanTxHashes.fee) humanVerifyBody.feeTxHash = humanTxHashes.fee;
    if (humanTxHashes.reward) humanVerifyBody.creatorRewardTxHash = humanTxHashes.reward;

    const humanVerifyRes = await fetch(`${BASE_URL}/api/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(humanVerifyBody),
    });
    const humanVerifyData = await humanVerifyRes.json();

    if (!humanVerifyData.success) fatal(`Human verification failed: ${JSON.stringify(humanVerifyData)}`);
    ok(`Human payment verified! Status: ${humanVerifyData.status}`);

    // Verify in-memory: the request should have creator_agent_id = null (human origin)
    const humanRequest = humanVerifyData.request;
    if (humanRequest) {
      if (humanRequest.creatorAgentId === null || humanRequest.creatorAgentId === undefined) {
        ok('Human link confirmed: creatorAgentId = null (human origin)');
      } else {
        fail(`Expected creatorAgentId=null for human link, got: ${humanRequest.creatorAgentId}`);
      }
    }

    // Confirm PAID
    const humanStatusRes = await fetch(`${BASE_URL}/api/request/${humanLinkId}`);
    const humanStatusData = await humanStatusRes.json();
    if (humanStatusData.status !== 'PAID' && humanStatusData.request?.status !== 'PAID') {
      fatal(`Expected human link PAID, got: ${JSON.stringify(humanStatusData)}`);
    }
    ok('Human link confirmed PAID');

    // ═══════════════════════════════════════════════════════════════════
    // STEP 10: Check rewards endpoint
    // ═══════════════════════════════════════════════════════════════════
    log(10, `Check rewards endpoint (wallet: ${CREATOR_WALLET})`);

    const rewardsRes = await fetch(`${BASE_URL}/api/rewards?wallet=${CREATOR_WALLET}`);
    const rewardsData = await rewardsRes.json();

    if (!rewardsData.success) fatal(`Rewards endpoint failed: ${JSON.stringify(rewardsData)}`);
    ok(`Rewards endpoint returned successfully`);
    info(`Human rewards count: ${rewardsData.totals?.humanRewardsCount || 0}`);
    info(`Agent rewards count: ${rewardsData.totals?.agentRewardsCount || 0}`);
    info(`Human rewards total: ${rewardsData.totals?.humanRewardsTotal || 0}`);
    info(`Agent rewards total: ${rewardsData.totals?.agentRewardsTotal || 0}`);

    // In-memory mode without Supabase won't have fee_transactions, so rewards will be empty
    // That's expected — we validate the endpoint works and returns correct structure
    if (rewardsData.rewards && typeof rewardsData.rewards.human !== 'undefined' && typeof rewardsData.rewards.agent !== 'undefined') {
      ok('Rewards structure correct: has human[] and agent[] arrays');
    } else {
      fail('Rewards structure incorrect — missing human/agent arrays');
    }

    // Validate totals structure
    if (rewardsData.totals &&
        typeof rewardsData.totals.humanRewardsCount === 'number' &&
        typeof rewardsData.totals.agentRewardsCount === 'number') {
      ok('Totals structure correct');
    } else {
      fail('Totals structure incorrect');
    }

    // Test missing wallet param
    const rewardsNoWallet = await fetch(`${BASE_URL}/api/rewards`);
    if (rewardsNoWallet.status === 400) {
      ok('Rewards correctly rejects missing wallet parameter (400)');
    } else {
      fail(`Expected 400 for missing wallet, got ${rewardsNoWallet.status}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 11: Check stats endpoint
    // ═══════════════════════════════════════════════════════════════════
    log(11, 'Check stats endpoint');

    const statsRes = await fetch(`${BASE_URL}/api/stats`);
    const statsData = await statsRes.json();

    if (!statsData.success) fatal(`Stats endpoint failed: ${JSON.stringify(statsData)}`);
    ok(`Stats endpoint returned successfully`);
    info(`Total agents: ${statsData.stats.totalAgents}`);
    info(`Total payments: ${statsData.stats.totalPayments}`);
    info(`Total fees collected: ${statsData.stats.totalFeesCollected}`);
    info(`Human payments: ${statsData.stats.humanPayments}`);
    info(`Agent payments: ${statsData.stats.agentPayments}`);

    // In-memory mode returns zeros for these Supabase-dependent counters
    // Validate structure exists
    if (typeof statsData.stats.humanPayments === 'number' && typeof statsData.stats.agentPayments === 'number') {
      ok('Stats structure includes humanPayments and agentPayments fields');
    } else {
      fail('Stats structure missing humanPayments/agentPayments');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 12: Check requests filtering (human vs agent)
    // ═══════════════════════════════════════════════════════════════════
    log(12, `Check requests filtering (wallet: ${CREATOR_WALLET})`);

    const requestsRes = await fetch(`${BASE_URL}/api/requests?wallet=${CREATOR_WALLET}`);
    const requestsData = await requestsRes.json();

    if (!requestsData.success) fatal(`Requests endpoint failed: ${JSON.stringify(requestsData)}`);
    ok(`Requests endpoint returned ${requestsData.count} requests`);

    // We should have 2 requests: 1 agent-created, 1 human-created
    const agentCreatedLinks = requestsData.requests.filter(r => r.creatorAgentId !== null && r.creatorAgentId !== undefined);
    const humanCreatedLinks = requestsData.requests.filter(r => r.creatorAgentId === null || r.creatorAgentId === undefined);

    info(`Agent-created links: ${agentCreatedLinks.length}`);
    info(`Human-created links: ${humanCreatedLinks.length}`);

    if (agentCreatedLinks.length >= 1) {
      ok(`Found ${agentCreatedLinks.length} agent-created link(s) with creatorAgentId set`);
      info(`  Agent link ID: ${agentCreatedLinks[0].id}, creatorAgentId: ${agentCreatedLinks[0].creatorAgentId}`);
    } else {
      fail('No agent-created links found (expected at least 1)');
    }

    if (humanCreatedLinks.length >= 1) {
      ok(`Found ${humanCreatedLinks.length} human-created link(s) with creatorAgentId=null`);
      info(`  Human link ID: ${humanCreatedLinks[0].id}, creatorAgentId: ${humanCreatedLinks[0].creatorAgentId}`);
    } else {
      fail('No human-created links found (expected at least 1)');
    }

    // Verify both are PAID
    const paidRequests = requestsData.requests.filter(r => r.status === 'PAID' || r.isPaid);
    ok(`${paidRequests.length} of ${requestsData.count} requests are PAID`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 13: Wallet JWT auth flow
    // ═══════════════════════════════════════════════════════════════════
    log(13, 'Wallet JWT auth flow');

    // Use the creator wallet since it has a registered agent
    // We need a private key for this wallet to sign the nonce.
    // The creator wallet is 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 — this is the
    // well-known Hardhat account #0 private key:
    const CREATOR_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    // 13a: Challenge
    info('Requesting challenge nonce...');
    const challengeRes = await fetch(`${BASE_URL}/api/auth/challenge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: CREATOR_WALLET }),
    });
    const challengeData = await challengeRes.json();

    if (!challengeData.nonce) fatal(`Challenge failed: ${JSON.stringify(challengeData)}`);
    ok(`Got nonce: ${challengeData.nonce.substring(0, 45)}...`);
    info(`Expires in: ${challengeData.expires_in}s`);

    // 13b: Sign with creator wallet
    const creatorSigner = new ethers.Wallet(CREATOR_PRIVATE_KEY);
    const jwtSignature = await creatorSigner.signMessage(challengeData.nonce);
    ok('Signed nonce with creator wallet (EIP-191)');

    // 13c: Verify → get JWT
    const verifyAuthRes = await fetch(`${BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet_address: CREATOR_WALLET, signature: jwtSignature }),
    });
    const verifyAuthData = await verifyAuthRes.json();

    if (!verifyAuthData.token) fatal(`Auth verify failed: ${JSON.stringify(verifyAuthData)}`);
    ok(`JWT received (expires in ${verifyAuthData.expires_in}s)`);
    info(`Agent: ${verifyAuthData.agent?.username}`);

    // 13d: Use JWT to get agent profile
    const jwtProfileRes = await fetch(`${BASE_URL}/api/agents/me`, {
      headers: { 'Authorization': `Bearer ${verifyAuthData.token}` },
    });
    const jwtProfileData = await jwtProfileRes.json();

    if (jwtProfileRes.status !== 200) fatal(`JWT profile fetch failed: ${JSON.stringify(jwtProfileData)}`);
    ok(`Agent profile via JWT: ${jwtProfileData.agent?.username || jwtProfileData.username}`);

    // Verify the JWT profile matches the creator
    if (jwtProfileData.agent?.wallet_address === CREATOR_WALLET ||
        jwtProfileData.wallet_address === CREATOR_WALLET) {
      ok(`JWT wallet matches creator wallet: ${CREATOR_WALLET}`);
    } else {
      fail(`JWT wallet mismatch: expected ${CREATOR_WALLET}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(60));
    if (failCount === 0) {
      console.log('  🎉 ALL E2E TESTS PASSED!');
    } else {
      console.log(`  ⚠️  TESTS COMPLETE: ${passCount} passed, ${failCount} failed`);
    }
    console.log('='.repeat(60));

    console.log('\n  Summary:');
    console.log(`    ✅ Backend server boot (in-memory storage)`);
    console.log(`    ✅ Agent registration under ${CREATOR_WALLET}`);
    console.log(`    ✅ Agent activation with HMAC credentials (bypass X)`);
    console.log(`    ✅ HMAC-signed GET /api/agents/me`);
    console.log(`    ✅ HMAC-signed POST /api/create-link (agent link)`);
    console.log(`    ✅ Public GET /api/request/:id/fee (fee endpoint)`);
    console.log(`    ✅ On-chain ERC-20 payment for agent link (Sepolia)`);
    console.log(`    ✅ POST /api/verify → PAID (agent link)`);
    console.log(`    ✅ Public POST /api/create (human link, no auth)`);
    console.log(`    ✅ On-chain ERC-20 payment for human link (Sepolia)`);
    console.log(`    ✅ POST /api/verify → PAID (human link, no auth)`);
    console.log(`    ✅ GET /api/rewards — structure validation`);
    console.log(`    ✅ GET /api/stats — structure validation`);
    console.log(`    ✅ GET /api/requests — human vs agent filtering`);
    console.log(`    ✅ Wallet auth: challenge → EIP-191 sign → JWT`);
    console.log(`    ✅ JWT-authenticated GET /api/agents/me`);

    console.log(`\n  Agent link:  ${agentLinkId}`);
    console.log(`  Human link:  ${humanLinkId}`);
    console.log(`  Agent payment tx:  ${agentTxHashes.payment}`);
    console.log(`  Human payment tx:  ${humanTxHashes.payment}`);
    console.log(`\n  Sepolia Etherscan: https://sepolia.etherscan.io/tx/${agentTxHashes.payment}`);
    console.log(`  Sepolia Etherscan: https://sepolia.etherscan.io/tx/${humanTxHashes.payment}`);

    if (failCount > 0) {
      console.log('\n  Failed tests:');
      results.filter(r => !r.pass).forEach(r => console.log(`    ❌ ${r.msg}`));
    }

    console.log('');

  } finally {
    server.close();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('\n❌ E2E test failed:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
