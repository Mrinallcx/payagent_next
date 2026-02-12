#!/usr/bin/env node

/**
 * PayAgent Agent Registration CLI
 *
 * Usage: node scripts/register-agent.js
 *
 * Registers a new agent and displays credentials.
 */

const readline = require('readline');

const API_BASE = process.env.PAYAGENT_API_URL || process.env.PAYME_API_URL || 'http://localhost:3000';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

async function main() {
  console.log('');
  console.log('====================================');
  console.log('  PayAgent — Agent Registration');
  console.log('====================================');
  console.log('');

  const username = await ask('Agent username: ');
  if (!username) {
    console.error('Username is required');
    process.exit(1);
  }

  const email = await ask('Email: ');
  if (!email || !email.includes('@')) {
    console.error('Valid email is required');
    process.exit(1);
  }

  const wallet_address = await ask('Wallet address (0x..., or press Enter to skip): ');
  if (wallet_address && !/^0x[a-fA-F0-9]{40}$/.test(wallet_address)) {
    console.error('Invalid wallet address format');
    process.exit(1);
  }

  console.log('');
  console.log('Registering agent...');
  console.log('');

  try {
    const body = { username, email };
    if (wallet_address) body.wallet_address = wallet_address;

    const response = await fetch(`${API_BASE}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Registration failed:', data.error || 'Unknown error');
      process.exit(1);
    }

    console.log('========================================');
    console.log('  AGENT REGISTERED SUCCESSFULLY');
    console.log('========================================');
    console.log('');
    console.log('  Agent ID:       ', data.agent_id);
    console.log('  API Key:        ', data.api_key);
    console.log('  Webhook Secret: ', data.webhook_secret);
    console.log('');
    console.log('  ⚠️  SAVE THESE NOW — they will NOT be shown again!');
    console.log('');
    console.log('========================================');
    console.log('');
    console.log('Quick start:');
    console.log('');
    console.log(`  # Create a payment link:`);
    console.log(`  curl -X POST ${API_BASE}/api/create-link \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -H "x-api-key: ${data.api_key}" \\`);
    console.log(`    -d '{"amount": "5", "description": "Test payment"}'`);
    console.log('');
    console.log(`  # Chat with AI:`);
    console.log(`  curl -X POST ${API_BASE}/api/chat \\`);
    console.log(`    -H "Content-Type: application/json" \\`);
    console.log(`    -H "x-api-key: ${data.api_key}" \\`);
    console.log(`    -d '{"message": "Create a 10 USDC payment link"}'`);
    console.log('');
  } catch (err) {
    console.error('Registration error:', err.message);
    process.exit(1);
  }

  rl.close();
}

main();
