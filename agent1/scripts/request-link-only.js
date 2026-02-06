#!/usr/bin/env node
/**
 * Agent 1: Only request a payment link from Agent 2 (do not pay).
 * Usage: npm run request [amount]
 *        node scripts/request-link-only.js [amount]
 */

import 'dotenv/config';
import { requestPaymentLink } from '../src/agent2Client.js';

const amount = process.argv[2] || '1';

async function main() {
  console.log('Requesting payment link from Agent 2 for', amount, 'USDC...');
  const data = await requestPaymentLink({ amount, description: 'Payment from Agent 1' });
  console.log('Link ID:', data.link_id);
  console.log('Link:', data.link);
  console.log('Payment link:', data.payment_link);
  console.log('To pay: POST', process.env.AGENT_SERVICE_URL || 'http://localhost:3001', '/pay-link with { "linkId": "' + data.link_id + '", "agentId": 1 }');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
