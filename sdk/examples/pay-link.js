#!/usr/bin/env node

/**
 * PayAgent SDK — Example: Create & Pay a Link
 *
 * This example demonstrates the full payment flow:
 *   1. Creator agent creates a payment link
 *   2. Payer agent pays it using the SDK
 *
 * Usage:
 *   CREATOR_KEY_ID=pk_live_... CREATOR_SECRET=sk_live_... \
 *   PAYER_KEY_ID=pk_live_... PAYER_SECRET=sk_live_... \
 *   PAYER_PRIVATE_KEY=0x... node pay-link.js
 */

const { PayAgentClient } = require('../src/index');

const CREATOR_KEY_ID = process.env.CREATOR_KEY_ID;
const CREATOR_SECRET = process.env.CREATOR_SECRET;
const PAYER_KEY_ID = process.env.PAYER_KEY_ID;
const PAYER_SECRET = process.env.PAYER_SECRET;
const PAYER_PRIVATE_KEY = process.env.PAYER_PRIVATE_KEY;
const BASE_URL = process.env.PAYAGENT_API_URL || 'https://payagent.vercel.app';
const NETWORK = process.env.NETWORK || 'sepolia';

async function main() {
  // ── Validate env ──────────────────────────────────────────────
  if (!CREATOR_KEY_ID || !CREATOR_SECRET || !PAYER_KEY_ID || !PAYER_SECRET || !PAYER_PRIVATE_KEY) {
    console.error('Missing environment variables. Required:');
    console.error('  CREATOR_KEY_ID=pk_live_...');
    console.error('  CREATOR_SECRET=sk_live_...');
    console.error('  PAYER_KEY_ID=pk_live_...');
    console.error('  PAYER_SECRET=sk_live_...');
    console.error('  PAYER_PRIVATE_KEY=0x...');
    process.exit(1);
  }

  // ── Step 1: Creator creates a payment link ────────────────────
  console.log('\n--- Step 1: Create a payment link ---');

  const creator = new PayAgentClient({
    apiKeyId: CREATOR_KEY_ID,
    apiSecret: CREATOR_SECRET,
    privateKey: PAYER_PRIVATE_KEY, // needed for constructor
    baseUrl: BASE_URL,
  });

  const link = await creator.createLink({
    amount: '5',
    network: NETWORK,
    token: 'USDC',
    description: 'SDK example payment',
  });

  console.log('Link created:', link);
  console.log(`Link ID: ${link.linkId}`);

  // ── Step 2: Payer pays the link ───────────────────────────────
  console.log('\n--- Step 2: Pay the link ---');

  const payer = new PayAgentClient({
    apiKeyId: PAYER_KEY_ID,
    apiSecret: PAYER_SECRET,
    privateKey: PAYER_PRIVATE_KEY,
    baseUrl: BASE_URL,
    // Optional: provide your own RPC URL for better reliability
    // rpcUrl: { sepolia: 'https://sepolia.infura.io/v3/YOUR_KEY' },
  });

  console.log(`Payer address: ${payer.address}`);
  console.log('Signing and broadcasting transactions...\n');

  const result = await payer.payLink(link.linkId);

  console.log('\nPayment complete!');
  console.log(`Status: ${result.status}`);
  console.log(`Transactions:`);
  for (const tx of result.transactions) {
    console.log(`  ${tx.description}: ${tx.txHash} (${tx.status})`);
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
