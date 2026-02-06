#!/usr/bin/env node
/**
 * Agent 1: Pay an existing link by linkId (no request to Agent 2).
 * Usage: npm run pay-link -- <linkId> [agentId]
 *        node scripts/pay-link-only.js <linkId> [agentId]
 * Example: npm run pay-link -- REQ-CP9DWMBGV
 *          npm run pay-link -- REQ-CP9DWMBGV 1
 */

import 'dotenv/config';
import { payLink } from '../src/paymentServiceClient.js';

const linkId = process.argv[2];
const agentId = process.argv[3] === '2' ? 2 : 1;

if (!linkId) {
  console.error('Usage: npm run pay-link -- <linkId> [agentId]');
  console.error('Example: npm run pay-link -- REQ-CP9DWMBGV');
  process.exit(1);
}

async function main() {
  console.log(`Paying link ${linkId} with Agent ${agentId}...`);
  const result = await payLink(linkId, agentId);
  if (result.alreadyPaid) {
    console.log('Already paid.');
    console.log('Request:', result.request);
    return;
  }
  console.log('Success:', result.success);
  console.log('Tx hash:', result.txHash);
  console.log('Explorer:', result.explorerUrl);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
