#!/usr/bin/env node
/**
 * PayAgent — Live E2E Test (Real Supabase + Sepolia On-Chain)
 *
 * Same as e2e-full-test.js but runs against REAL Supabase database,
 * so all data (agents, payments, fees, rewards) persists and appears
 * on the frontend dashboard.
 *
 * Tests:
 *   1. Cleanup old e2e test agents from Supabase
 *   2. Register 1 Creator agent under 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
 *   3. Activate agent (bypass X verification)
 *   4. Agent creates a payment link (HMAC-signed)
 *   5. Payer pays the agent link on-chain
 *   6. Verify agent payment + fee_transaction recorded
 *   7. Human creates a payment link (public API)
 *   8. Human pays the link on-chain
 *   9. Verify human payment + fee_transaction recorded
 *  10. Check rewards endpoint (real data)
 *  11. Check stats endpoint (real counts)
 *  12. Check requests filtering (human vs agent)
 *  13. Wallet JWT auth flow
 *
 * Usage: node e2e-live-test.js
 */

const crypto = require('crypto');
const { ethers } = require('ethers');

// ─── Configure environment (KEEP Supabase credentials!) ─────────────
require('dotenv').config();
// DO NOT delete SUPABASE_URL / SUPABASE_ANON_KEY — we want real persistence
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env for live test');
  process.exit(1);
}
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
// Hardhat account #0 private key for signing wallet auth challenges
const CREATOR_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

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
  console.log('\n🚀 PayAgent LIVE E2E Test — Real Supabase + Sepolia On-Chain\n');
  console.log(`  Creator wallet: ${CREATOR_WALLET}`);
  console.log(`  Payer wallet:   ${PAYER_WALLET}`);
  console.log(`  Supabase URL:   ${process.env.SUPABASE_URL}`);
  console.log(`  Mode:           LIVE (data persists to Supabase → appears on dashboard)\n`);

  // ── Boot backend ──────────────────────────────────────────────────
  const app = require('./api/index');
  const { activateAgent, getAgentByUsername, getAgentByWallet, softDeleteAgent } = require('./lib/agents');
  const { supabase } = require('./lib/supabase');

  if (!supabase) {
    console.error('❌ Supabase client not initialized. Check your .env credentials.');
    process.exit(1);
  }

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });

  const port = server.address().port;
  const BASE_URL = `http://localhost:${port}`;
  info(`Server started on port ${port} (with real Supabase)`);

  // Set up on-chain signer
  const rpcUrl = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/788eecaaeb7d414ea9c10f073d02635a';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const signer = new ethers.Wallet(PAYER_PRIVATE_KEY, provider);

  let creatorCreds;
  let agentLinkId;
  let agentTxHashes;
  let humanLinkId;
  let humanTxHashes;
  let creatorAgentId;

  try {
    // ═══════════════════════════════════════════════════════════════════
    // STEP 1: Clean up old test agents from Supabase
    // ═══════════════════════════════════════════════════════════════════
    log(1, 'Clean up old test agents from Supabase');

    // Soft-delete any agents with e2e_ prefix
    const { data: e2eAgents } = await supabase
      .from('agents')
      .select('id, username, wallet_address, status')
      .like('username', 'e2e_%')
      .neq('status', 'inactive');

    if (e2eAgents && e2eAgents.length > 0) {
      info(`Found ${e2eAgents.length} existing e2e agents to clean up`);
      for (const agent of e2eAgents) {
        await softDeleteAgent(agent.id);
        info(`  Soft-deleted: ${agent.username} (${agent.id})`);
      }
      ok(`Cleaned up ${e2eAgents.length} old e2e agents`);
    } else {
      info('No old e2e agents found');
    }

    // Also soft-delete any active agents with the creator wallet
    const { data: walletAgents } = await supabase
      .from('agents')
      .select('id, username, wallet_address, status')
      .eq('wallet_address', CREATOR_WALLET)
      .neq('status', 'inactive');

    if (walletAgents && walletAgents.length > 0) {
      info(`Found ${walletAgents.length} agents with creator wallet to clean up`);
      for (const agent of walletAgents) {
        await softDeleteAgent(agent.id);
        info(`  Soft-deleted: ${agent.username} (${agent.id})`);
      }
      ok(`Cleaned up ${walletAgents.length} agents with wallet ${CREATOR_WALLET.substring(0, 10)}...`);
    } else {
      info('No agents with creator wallet found');
    }

    ok('Cleanup complete');

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
    creatorAgentId = regData.agent_id;
    ok(`Creator registered: ${creatorAgentId}`);
    info(`Username: ${creatorUsername}`);
    info(`Wallet: ${CREATOR_WALLET}`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 3: Activate Creator Agent (bypass X verification)
    // ═══════════════════════════════════════════════════════════════════
    log(3, 'Activate Creator Agent (bypass X verification)');
    const creatorAgent = await getAgentByUsername(creatorUsername);
    if (!creatorAgent) fatal('Creator agent not found after registration');

    const activation = await activateAgent(creatorAgent.id, 'e2e_test_x');
    ok('Creator activated');
    info(`  api_key_id: ${activation.api_key_id.substring(0, 24)}...`);
    info(`  expires_at: ${activation.expires_at}`);

    creatorCreds = { apiKeyId: activation.api_key_id, apiSecret: activation.api_secret };

    // Verify HMAC works
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

    // Verify link is in Supabase
    const { data: linkCheck } = await supabase.from('payment_requests').select('*').eq('id', agentLinkId).single();
    if (linkCheck) {
      ok(`Link found in Supabase with creator_agent_id: ${linkCheck.creator_agent_id}`);
    } else {
      fail('Link not found in Supabase after creation');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 5: Payer pays the agent link on-chain
    // ═══════════════════════════════════════════════════════════════════
    log(5, 'Payer pays the agent link on-chain (Sepolia)');

    const agentFeeRes = await fetch(`${BASE_URL}/api/request/${agentLinkId}/fee?payer=${PAYER_WALLET}`);
    const agentFeeData = await agentFeeRes.json();
    if (!agentFeeData.success) fatal(`Fee endpoint failed: ${JSON.stringify(agentFeeData)}`);

    ok('Fee info received for agent link');
    info(`Fee: ${agentFeeData.fee.feeTotal} ${agentFeeData.fee.feeToken} (deducted: ${agentFeeData.fee.feeDeductedFromPayment})`);
    info(`Creator receives: ${agentFeeData.creatorReceives}`);
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

    // Verify fee_transaction was recorded in Supabase
    const { data: agentFeeRecord } = await supabase
      .from('fee_transactions')
      .select('*')
      .eq('payment_request_id', agentLinkId)
      .single();

    if (agentFeeRecord) {
      ok(`Fee transaction recorded in Supabase: ${agentFeeRecord.id}`);
      info(`  creator_agent_id: ${agentFeeRecord.creator_agent_id}`);
      info(`  creator_wallet: ${agentFeeRecord.creator_wallet}`);
      info(`  payer_wallet: ${agentFeeRecord.payer_wallet}`);
      info(`  fee_token: ${agentFeeRecord.fee_token}, fee_total: ${agentFeeRecord.fee_total}`);
      info(`  creator_reward: ${agentFeeRecord.creator_reward}`);

      if (agentFeeRecord.creator_agent_id) {
        ok('Fee record has creator_agent_id set (agent origin)');
      } else {
        fail('Fee record missing creator_agent_id for agent-created link');
      }
    } else {
      fail('Fee transaction NOT recorded in Supabase for agent link');
    }

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

    // Verify in Supabase — creator_agent_id should be null
    const { data: humanLinkCheck } = await supabase.from('payment_requests').select('*').eq('id', humanLinkId).single();
    if (humanLinkCheck) {
      if (humanLinkCheck.creator_agent_id === null) {
        ok('Human link in Supabase with creator_agent_id = null (human origin)');
      } else {
        fail(`Human link has creator_agent_id: ${humanLinkCheck.creator_agent_id} (expected null)`);
      }
    } else {
      fail('Human link not found in Supabase');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 8: Human pays the link on-chain
    // ═══════════════════════════════════════════════════════════════════
    log(8, 'Human pays the link on-chain (Sepolia)');

    const humanFeeRes = await fetch(`${BASE_URL}/api/request/${humanLinkId}/fee?payer=${PAYER_WALLET}`);
    const humanFeeData = await humanFeeRes.json();
    if (!humanFeeData.success) fatal(`Human fee endpoint failed: ${JSON.stringify(humanFeeData)}`);

    ok('Fee info received for human link');
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
    log(9, 'Verify human payment (public, no HMAC)');

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

    // Verify fee_transaction was recorded for human payment
    const { data: humanFeeRecord } = await supabase
      .from('fee_transactions')
      .select('*')
      .eq('payment_request_id', humanLinkId)
      .single();

    if (humanFeeRecord) {
      ok(`Fee transaction recorded in Supabase: ${humanFeeRecord.id}`);
      info(`  creator_agent_id: ${humanFeeRecord.creator_agent_id}`);
      info(`  creator_wallet: ${humanFeeRecord.creator_wallet}`);
      info(`  payer_wallet: ${humanFeeRecord.payer_wallet}`);
      info(`  fee_token: ${humanFeeRecord.fee_token}, fee_total: ${humanFeeRecord.fee_total}`);
      info(`  creator_reward: ${humanFeeRecord.creator_reward}`);

      if (humanFeeRecord.creator_agent_id === null) {
        ok('Human fee record has creator_agent_id = null (human origin) — dashboard separation works!');
      } else {
        fail(`Human fee record has creator_agent_id: ${humanFeeRecord.creator_agent_id} (expected null)`);
      }

      if (humanFeeRecord.creator_wallet === CREATOR_WALLET) {
        ok(`Human fee record has correct creator_wallet: ${CREATOR_WALLET}`);
      } else {
        fail(`Human fee record creator_wallet mismatch: ${humanFeeRecord.creator_wallet}`);
      }
    } else {
      fail('Fee transaction NOT recorded for human payment — this is critical for dashboard rewards!');
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 10: Check rewards endpoint (real Supabase data)
    // ═══════════════════════════════════════════════════════════════════
    log(10, `Check rewards endpoint (wallet: ${CREATOR_WALLET})`);

    const rewardsRes = await fetch(`${BASE_URL}/api/rewards?wallet=${CREATOR_WALLET}`);
    const rewardsData = await rewardsRes.json();

    if (!rewardsData.success) fatal(`Rewards endpoint failed: ${JSON.stringify(rewardsData)}`);
    ok('Rewards endpoint returned successfully');
    info(`Human rewards count: ${rewardsData.totals?.humanRewardsCount}`);
    info(`Agent rewards count: ${rewardsData.totals?.agentRewardsCount}`);
    info(`Human rewards total: ${rewardsData.totals?.humanRewardsTotal}`);
    info(`Agent rewards total: ${rewardsData.totals?.agentRewardsTotal}`);

    // With real Supabase, we should have rewards from our payments
    if (rewardsData.totals?.humanRewardsCount >= 1) {
      ok(`Human rewards found: ${rewardsData.totals.humanRewardsCount} entries`);
    } else {
      fail(`Expected at least 1 human reward, got: ${rewardsData.totals?.humanRewardsCount}`);
    }

    if (rewardsData.totals?.agentRewardsCount >= 1) {
      ok(`Agent rewards found: ${rewardsData.totals.agentRewardsCount} entries`);
    } else {
      fail(`Expected at least 1 agent reward, got: ${rewardsData.totals?.agentRewardsCount}`);
    }

    // Log individual rewards for debugging
    if (rewardsData.rewards?.human?.length > 0) {
      info('  Human rewards:');
      for (const r of rewardsData.rewards.human) {
        info(`    ${r.paymentId}: ${r.creatorReward} ${r.feeToken} (payment: ${r.paymentAmount} ${r.paymentToken})`);
      }
    }
    if (rewardsData.rewards?.agent?.length > 0) {
      info('  Agent rewards:');
      for (const r of rewardsData.rewards.agent) {
        info(`    ${r.paymentId}: ${r.creatorReward} ${r.feeToken} (payment: ${r.paymentAmount} ${r.paymentToken})`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 11: Check stats endpoint (real Supabase counts)
    // ═══════════════════════════════════════════════════════════════════
    log(11, 'Check stats endpoint');

    const statsRes = await fetch(`${BASE_URL}/api/stats`);
    const statsData = await statsRes.json();

    if (!statsData.success) fatal(`Stats endpoint failed: ${JSON.stringify(statsData)}`);
    ok('Stats endpoint returned successfully');
    info(`Total agents: ${statsData.stats.totalAgents}`);
    info(`Total payments: ${statsData.stats.totalPayments}`);
    info(`Human payments: ${statsData.stats.humanPayments}`);
    info(`Agent payments: ${statsData.stats.agentPayments}`);
    info(`Total fees collected: ${statsData.stats.totalFeesCollected}`);

    if (statsData.stats.humanPayments >= 1) {
      ok(`Human payments count >= 1: ${statsData.stats.humanPayments}`);
    } else {
      fail(`Expected humanPayments >= 1, got: ${statsData.stats.humanPayments}`);
    }

    if (statsData.stats.agentPayments >= 1) {
      ok(`Agent payments count >= 1: ${statsData.stats.agentPayments}`);
    } else {
      fail(`Expected agentPayments >= 1, got: ${statsData.stats.agentPayments}`);
    }

    if (statsData.stats.totalPayments >= 2) {
      ok(`Total payments >= 2: ${statsData.stats.totalPayments}`);
    } else {
      fail(`Expected totalPayments >= 2, got: ${statsData.stats.totalPayments}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // STEP 12: Check requests filtering (human vs agent)
    // ═══════════════════════════════════════════════════════════════════
    log(12, `Check requests filtering (wallet: ${CREATOR_WALLET})`);

    const requestsRes = await fetch(`${BASE_URL}/api/requests?wallet=${CREATOR_WALLET}`);
    const requestsData = await requestsRes.json();

    if (!requestsData.success) fatal(`Requests endpoint failed: ${JSON.stringify(requestsData)}`);
    ok(`Requests endpoint returned ${requestsData.count} requests`);

    const agentCreatedLinks = requestsData.requests.filter(r => r.creatorAgentId !== null && r.creatorAgentId !== undefined);
    const humanCreatedLinks = requestsData.requests.filter(r => r.creatorAgentId === null || r.creatorAgentId === undefined);

    info(`Agent-created links: ${agentCreatedLinks.length}`);
    info(`Human-created links: ${humanCreatedLinks.length}`);

    if (agentCreatedLinks.length >= 1) {
      ok(`Found agent-created link(s) with creatorAgentId set`);
    } else {
      fail('No agent-created links found');
    }

    if (humanCreatedLinks.length >= 1) {
      ok(`Found human-created link(s) with creatorAgentId=null`);
    } else {
      fail('No human-created links found');
    }

    const paidRequests = requestsData.requests.filter(r => r.status === 'PAID' || r.isPaid);
    ok(`${paidRequests.length} of ${requestsData.count} requests are PAID`);

    // ═══════════════════════════════════════════════════════════════════
    // STEP 13: Wallet JWT auth flow
    // ═══════════════════════════════════════════════════════════════════
    log(13, 'Wallet JWT auth flow');

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

    // 13b: Sign with creator wallet (Hardhat account #0)
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
    ok(`Agent profile via JWT: ${jwtProfileData.agent?.username}`);

    if (jwtProfileData.agent?.wallet_address === CREATOR_WALLET) {
      ok(`JWT wallet matches: ${CREATOR_WALLET}`);
    } else {
      fail(`JWT wallet mismatch`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════════════════════════════════════
    console.log('\n' + '='.repeat(60));
    if (failCount === 0) {
      console.log('  🎉 ALL LIVE E2E TESTS PASSED!');
    } else {
      console.log(`  ⚠️  TESTS COMPLETE: ${passCount} passed, ${failCount} failed`);
    }
    console.log('='.repeat(60));

    console.log('\n  Summary:');
    console.log(`    ✅ Real Supabase database — all data persisted`);
    console.log(`    ✅ Agent registered: ${creatorUsername} (${CREATOR_WALLET})`);
    console.log(`    ✅ Agent link created + paid on-chain + verified`);
    console.log(`    ✅ Human link created + paid on-chain + verified`);
    console.log(`    ✅ Fee transactions recorded in Supabase for BOTH`);
    console.log(`    ✅ Rewards endpoint returns real human + agent rewards`);
    console.log(`    ✅ Stats endpoint shows real counts`);
    console.log(`    ✅ Request filtering: human vs agent separation works`);
    console.log(`    ✅ Wallet JWT auth flow works`);

    console.log(`\n  📊 Dashboard should now show:`);
    console.log(`    - Payment links: ${agentLinkId} (agent) + ${humanLinkId} (human)`);
    console.log(`    - Transactions: 2 PAID payments`);
    console.log(`    - Rewards: creator rewards from both payments`);
    console.log(`    - Human vs Agent separation on all pages`);

    console.log(`\n  Agent link:  ${agentLinkId}`);
    console.log(`  Human link:  ${humanLinkId}`);
    console.log(`  Agent payment tx:  ${agentTxHashes.payment}`);
    console.log(`  Human payment tx:  ${humanTxHashes.payment}`);
    console.log(`\n  Sepolia Etherscan:`);
    console.log(`    https://sepolia.etherscan.io/tx/${agentTxHashes.payment}`);
    console.log(`    https://sepolia.etherscan.io/tx/${humanTxHashes.payment}`);

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
  console.error('\n❌ Live E2E test failed:', err.message || err);
  console.error(err.stack);
  process.exit(1);
});
