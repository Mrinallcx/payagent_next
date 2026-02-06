#!/usr/bin/env node
/**
 * Agent 1 (Payer): Request a payment link from Agent 2, then pay it.
 * Usage: npm run pay [amount]
 *        node scripts/run-payment.js [amount]
 * Default amount: 1 USDC
 */

import 'dotenv/config';
import { requestPaymentLink } from '../src/agent2Client.js';
import { payLink } from '../src/paymentServiceClient.js';

const amount = process.argv[2] || '1';

async function main() {
  console.log('Agent 1 (Payer): Requesting payment link from Agent 2 for', amount, 'USDC...');
  const linkData = await requestPaymentLink({ amount, description: 'Payment from Agent 1 to Agent 2' });
  console.log('  Link ID:', linkData.link_id);
  console.log('  Payment link:', linkData.payment_link);

  console.log('Agent 1: Paying link via agent payment service (agentId: 1)...');
  const payResult = await payLink(linkData.link_id, 1);
  if (payResult.alreadyPaid) {
    console.log('  Already paid.');
    console.log('  Request:', payResult.request);
    return;
  }
  console.log('  Success:', payResult.success);
  console.log('  Tx hash:', payResult.txHash);
  console.log('  Explorer:', payResult.explorerUrl);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
