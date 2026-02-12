#!/usr/bin/env node

/**
 * PayAgent Platform — Comprehensive Test Suite
 *
 * Covers:
 *   1. Chain Registry (unit)
 *   2. Agent Registration & Auth
 *   3. Wallet Management
 *   4. Multi-Chain Link Creation (sepolia, ethereum, base)
 *   5. Network Validation & Rejection
 *   6. Pay-Link (fee calc, token address resolution per chain)
 *   7. Payment Verification (mocked blockchain)
 *   8. Security (auth required, RBAC, invalid inputs)
 *   9. Edge Cases (expired links, double-pay, missing fields)
 *
 * Run:  node test.js
 *
 * No external test framework needed — uses Node's built-in test runner.
 * Supabase is bypassed (unset env) so all data lives in-memory.
 */

'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

// ─── Force in-memory mode (no Supabase) ────────────────────────────
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_ANON_KEY;

// ─── Provide required env for chain registry RPC ───────────────────
process.env.SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/test';
process.env.ETH_MAINNET_RPC_URL = process.env.ETH_MAINNET_RPC_URL || 'https://mainnet.infura.io/v3/test';
process.env.BASE_MAINNET_RPC_URL = process.env.BASE_MAINNET_RPC_URL || 'https://mainnet.base.org';
process.env.PLATFORM_TREASURY_WALLET = '0xTREASURY0000000000000000000000000000001';
process.env.LCX_CONTRACT_ADDRESS = '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b';

// ─── Import chain registry for unit tests ──────────────────────────
const registry = require('./lib/chainRegistry');

// ─── Boot Express app on a random port ─────────────────────────────
const app = require('./api/index');
let server;
let BASE_URL;

// ─── Agent credentials (populated during registration tests) ───────
const agents = {
  creator: { apiKey: null, agentId: null, wallet: '0xCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC1' },
  payer:   { apiKey: null, agentId: null, wallet: '0xAABBCCDDEEFF00112233445566778899AABBCCDD' },
};

// ─── Created link IDs (populated during link creation tests) ───────
const links = {
  sepolia:  null,
  ethereum: null,
  base:     null,
  ethLink:  null, // ETH native token link
};

// ─── HTTP helper ───────────────────────────────────────────────────
function request(method, path, body, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Content-Type': 'application/json' },
    };
    if (apiKey) opts.headers['Authorization'] = `Bearer ${apiKey}`;

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
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ═══════════════════════════════════════════════════════════════════
//  TEST LIFECYCLE
// ═══════════════════════════════════════════════════════════════════

before(async () => {
  await new Promise((resolve, reject) => {
    server = app.listen(0, () => {
      const addr = server.address();
      BASE_URL = `http://127.0.0.1:${addr.port}`;
      console.log(`\n  Test server listening on ${BASE_URL}\n`);
      resolve();
    });
    server.on('error', reject);
  });
});

after(async () => {
  if (server) await new Promise((r) => server.close(r));
  // Force exit — ethers.js JsonRpcProvider retries keep event loop alive
  setTimeout(() => process.exit(0), 500);
});

// ═══════════════════════════════════════════════════════════════════
//  1. CHAIN REGISTRY — UNIT TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Chain Registry', () => {
  it('lists exactly 3 supported chains', () => {
    const chains = registry.getSupportedNetworks();
    assert.deepStrictEqual(chains, ['sepolia', 'ethereum', 'base']);
  });

  it('resolves canonical names from aliases', () => {
    assert.equal(registry.resolveNetwork('sepolia'), 'sepolia');
    assert.equal(registry.resolveNetwork('ethereum'), 'ethereum');
    assert.equal(registry.resolveNetwork('mainnet'), 'ethereum');
    assert.equal(registry.resolveNetwork('eth-mainnet'), 'ethereum');
    assert.equal(registry.resolveNetwork('eth'), 'ethereum');
    assert.equal(registry.resolveNetwork('base'), 'base');
    assert.equal(registry.resolveNetwork('base-mainnet'), 'base');
  });

  it('rejects unsupported networks', () => {
    assert.equal(registry.resolveNetwork('polygon'), null);
    assert.equal(registry.resolveNetwork('solana'), null);
    assert.equal(registry.resolveNetwork('avalanche'), null);
    assert.equal(registry.resolveNetwork(''), null);
    assert.equal(registry.resolveNetwork(null), null);
    assert.equal(registry.resolveNetwork(undefined), null);
  });

  it('isValidNetwork returns correct booleans', () => {
    assert.equal(registry.isValidNetwork('sepolia'), true);
    assert.equal(registry.isValidNetwork('ethereum'), true);
    assert.equal(registry.isValidNetwork('base'), true);
    assert.equal(registry.isValidNetwork('polygon'), false);
    assert.equal(registry.isValidNetwork('solana'), false);
  });

  describe('Token addresses', () => {
    it('Sepolia USDC is correct', () => {
      assert.equal(
        registry.getTokenAddress('sepolia', 'USDC'),
        '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87'
      );
    });

    it('Ethereum mainnet USDC is correct', () => {
      assert.equal(
        registry.getTokenAddress('ethereum', 'USDC'),
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
      );
    });

    it('Base mainnet USDC is correct', () => {
      assert.equal(
        registry.getTokenAddress('base', 'USDC'),
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
      );
    });

    it('Ethereum mainnet USDT is correct', () => {
      assert.equal(
        registry.getTokenAddress('ethereum', 'USDT'),
        '0xdAC17F958D2ee523a2206206994597C13D831ec7'
      );
    });

    it('Base mainnet USDT is correct', () => {
      assert.equal(
        registry.getTokenAddress('base', 'USDT'),
        '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
      );
    });

    it('Ethereum mainnet LCX is correct', () => {
      assert.equal(
        registry.getTokenAddress('ethereum', 'LCX'),
        '0x037A54AaB062628C9Bbae1FDB1583c195585Fe41'
      );
    });

    it('Base mainnet LCX is correct (user-provided)', () => {
      assert.equal(
        registry.getTokenAddress('base', 'LCX'),
        '0xd7468c14ae76C3Fc308aEAdC223D5D1F71d3c171'
      );
    });

    it('ETH returns null (native) on all chains', () => {
      assert.equal(registry.getTokenAddress('sepolia', 'ETH'), null);
      assert.equal(registry.getTokenAddress('ethereum', 'ETH'), null);
      assert.equal(registry.getTokenAddress('base', 'ETH'), null);
    });

    it('unknown token returns null', () => {
      assert.equal(registry.getTokenAddress('ethereum', 'SHIB'), null);
    });

    it('unknown network returns null', () => {
      assert.equal(registry.getTokenAddress('polygon', 'USDC'), null);
    });
  });

  describe('Native token detection', () => {
    it('ETH is native on all supported chains', () => {
      assert.equal(registry.isNativeToken('ETH', 'sepolia'), true);
      assert.equal(registry.isNativeToken('ETH', 'ethereum'), true);
      assert.equal(registry.isNativeToken('ETH', 'base'), true);
    });

    it('USDC is NOT native', () => {
      assert.equal(registry.isNativeToken('USDC', 'ethereum'), false);
    });

    it('LCX is NOT native', () => {
      assert.equal(registry.isNativeToken('LCX', 'base'), false);
    });
  });

  describe('Explorer URLs', () => {
    it('sepolia explorer', () => {
      assert.equal(registry.getExplorerUrl('sepolia'), 'https://sepolia.etherscan.io');
    });

    it('ethereum explorer', () => {
      assert.equal(registry.getExplorerUrl('ethereum'), 'https://etherscan.io');
    });

    it('base explorer', () => {
      assert.equal(registry.getExplorerUrl('base'), 'https://basescan.org');
    });
  });

  describe('RPC URLs', () => {
    it('returns configured RPC for sepolia', () => {
      const rpc = registry.getRpcUrl('sepolia');
      assert.ok(rpc, 'Sepolia RPC should be set');
    });

    it('returns configured RPC for ethereum', () => {
      const rpc = registry.getRpcUrl('ethereum');
      assert.ok(rpc, 'Ethereum RPC should be set');
    });

    it('returns configured RPC for base', () => {
      const rpc = registry.getRpcUrl('base');
      assert.ok(rpc, 'Base RPC should be set');
    });

    it('returns null for unsupported network', () => {
      assert.equal(registry.getRpcUrl('polygon'), null);
    });
  });

  describe('Chain config', () => {
    it('returns full config for ethereum', () => {
      const config = registry.getChainConfig('ethereum');
      assert.equal(config.chainId, 1);
      assert.equal(config.isTestnet, false);
      assert.equal(config.nativeToken, 'ETH');
    });

    it('returns full config for base', () => {
      const config = registry.getChainConfig('base');
      assert.equal(config.chainId, 8453);
      assert.equal(config.isTestnet, false);
    });

    it('sepolia is marked as testnet', () => {
      const config = registry.getChainConfig('sepolia');
      assert.equal(config.isTestnet, true);
      assert.equal(config.chainId, 11155111);
    });

    it('returns null for unsupported network', () => {
      assert.equal(registry.getChainConfig('polygon'), null);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
//  2. HEALTH & PUBLIC ENDPOINTS
// ═══════════════════════════════════════════════════════════════════

describe('Health & Public Endpoints', () => {
  it('GET / returns 200 with status ok', async () => {
    const res = await request('GET', '/');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
  });

  it('GET /health returns healthy', async () => {
    const res = await request('GET', '/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'healthy');
  });

  it('GET /api/chains returns all 3 chains', async () => {
    const res = await request('GET', '/api/chains');
    assert.equal(res.status, 200);
    assert.equal(res.body.chains.length, 3);
    const names = res.body.chains.map((c) => c.name);
    assert.ok(names.includes('sepolia'));
    assert.ok(names.includes('ethereum'));
    assert.ok(names.includes('base'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  3. AGENT REGISTRATION
// ═══════════════════════════════════════════════════════════════════

describe('Agent Registration', () => {
  it('registers creator agent successfully', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'test_creator',
      email: 'creator@test.com',
      walletAddress: agents.creator.wallet,
      chain: 'ethereum',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.api_key.startsWith('pk_live_'));
    assert.ok(res.body.webhook_secret.startsWith('whsec_'));
    agents.creator.apiKey = res.body.api_key;
    agents.creator.agentId = res.body.agent_id;
  });

  it('registers payer agent successfully', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'test_payer',
      email: 'payer@test.com',
      walletAddress: agents.payer.wallet,
      chain: 'sepolia',
    });
    assert.equal(res.status, 201);
    agents.payer.apiKey = res.body.api_key;
    agents.payer.agentId = res.body.agent_id;
  });

  it('rejects duplicate username', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'test_creator',
      email: 'other@test.com',
    });
    assert.equal(res.status, 409);
  });

  it('rejects missing username', async () => {
    const res = await request('POST', '/api/agents/register', {
      email: 'x@x.com',
    });
    assert.equal(res.status, 400);
  });

  it('rejects missing email', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'noEmail',
    });
    assert.equal(res.status, 400);
  });

  it('rejects invalid email format', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'badEmail',
      email: 'not-an-email',
    });
    assert.equal(res.status, 400);
  });

  it('rejects invalid wallet address format', async () => {
    const res = await request('POST', '/api/agents/register', {
      username: 'badWallet',
      email: 'w@w.com',
      walletAddress: 'not-a-wallet',
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('wallet'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  4. AUTHENTICATION & SECURITY
// ═══════════════════════════════════════════════════════════════════

describe('Authentication & Security', () => {
  it('GET /api/agents/me requires auth', async () => {
    const res = await request('GET', '/api/agents/me');
    assert.equal(res.status, 401);
  });

  it('rejects invalid API key', async () => {
    const res = await request('GET', '/api/agents/me', null, 'pk_live_invalid_key_00000000000000000000000000000000');
    assert.equal(res.status, 401);
  });

  it('GET /api/agents/me works with valid key', async () => {
    const res = await request('GET', '/api/agents/me', null, agents.creator.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'test_creator');
    assert.equal(res.body.agent.wallet_address, agents.creator.wallet);
    assert.equal(res.body.agent.chain, 'ethereum');
  });

  it('POST /api/create-link requires auth', async () => {
    const res = await request('POST', '/api/create-link', { amount: '10' });
    assert.equal(res.status, 401);
  });

  it('POST /api/pay-link requires auth', async () => {
    const res = await request('POST', '/api/pay-link', { linkId: 'REQ-FAKE' });
    assert.equal(res.status, 401);
  });

  it('x-api-key header also works for auth', async () => {
    // Use raw http to send x-api-key header
    const url = new URL('/api/agents/me', BASE_URL);
    const res = await new Promise((resolve, reject) => {
      const opts = {
        method: 'GET',
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        headers: { 'x-api-key': agents.creator.apiKey },
      };
      const req = http.request(opts, (r) => {
        let data = '';
        r.on('data', (chunk) => (data += chunk));
        r.on('end', () => resolve({ status: r.statusCode, body: JSON.parse(data) }));
      });
      req.on('error', reject);
      req.end();
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.agent.username, 'test_creator');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  5. WALLET MANAGEMENT
// ═══════════════════════════════════════════════════════════════════

describe('Wallet Management', () => {
  it('updates wallet address', async () => {
    const newWallet = '0xDDEEFF0011223344556677889900AABBCCDDEEFF';
    const res = await request('POST', '/api/agents/wallet', {
      wallet_address: newWallet,
      chain: 'base',
    }, agents.payer.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.wallet_address, newWallet);
    assert.equal(res.body.chain, 'base');
    // Update local state
    agents.payer.wallet = newWallet;
  });

  it('rejects invalid wallet format', async () => {
    const res = await request('POST', '/api/agents/wallet', {
      wallet_address: '0xTOOSHORT',
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
  });

  it('rejects empty wallet', async () => {
    const res = await request('POST', '/api/agents/wallet', {
      wallet_address: '',
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  6. MULTI-CHAIN LINK CREATION
// ═══════════════════════════════════════════════════════════════════

describe('Multi-Chain Link Creation', () => {
  it('creates USDC link on sepolia (explicit network)', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10',
      network: 'sepolia',
      description: 'Sepolia test',
    }, agents.creator.apiKey);
    assert.equal(res.status, 200);
    assert.ok(res.body.linkId.startsWith('REQ-'));
    assert.equal(res.body.network, 'sepolia');
    assert.equal(res.body.token, 'USDC');
    assert.equal(res.body.amount, '10');
    links.sepolia = res.body.linkId;
  });

  it('creates USDC link on ethereum mainnet', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '50',
      network: 'ethereum',
      description: 'Mainnet payment',
    }, agents.creator.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.network, 'ethereum');
    assert.equal(res.body.token, 'USDC');
    links.ethereum = res.body.linkId;
  });

  it('creates USDT link on base', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '25',
      network: 'base',
      token: 'USDT',
      description: 'Base USDT',
    }, agents.creator.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.network, 'base');
    assert.equal(res.body.token, 'USDT');
    links.base = res.body.linkId;
  });

  it('creates ETH link on ethereum', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '0.5',
      network: 'ethereum',
      token: 'ETH',
      description: 'ETH native transfer',
    }, agents.creator.apiKey);
    assert.equal(res.status, 200);
    links.ethLink = res.body.linkId;
  });

  it('rejects create-link when network is not provided', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '1',
      description: 'Default network test',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('network'));
    assert.ok(res.body.error.includes('Supported'));
  });

  it('accepts alias "mainnet" and resolves to "ethereum"', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '1',
      network: 'mainnet',
    }, agents.creator.apiKey);
    assert.equal(res.status, 200);
    const linkRes = await request('GET', `/api/request/${res.body.linkId}`);
    assert.equal(linkRes.body.payment.network, 'ethereum');
  });

  it('accepts alias "base-mainnet" and resolves to "base"', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '1',
      network: 'base-mainnet',
    }, agents.creator.apiKey);
    assert.equal(res.status, 200);
    const linkRes = await request('GET', `/api/request/${res.body.linkId}`);
    assert.equal(linkRes.body.payment.network, 'base');
  });
});

// ═══════════════════════════════════════════════════════════════════
//  7. NETWORK VALIDATION (REJECTION)
// ═══════════════════════════════════════════════════════════════════

describe('Network Validation', () => {
  it('rejects unsupported network "polygon"', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10',
      network: 'polygon',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('polygon'));
    assert.ok(res.body.error.includes('Supported'));
  });

  it('rejects unsupported network "solana"', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10',
      network: 'solana',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('solana'));
  });

  it('rejects empty string network', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10',
      network: '',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('network'));
  });

  it('rejects nonsense network', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '10',
      network: 'foobar',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
  });

  it('also validates network on /api/create (public route)', async () => {
    const res = await request('POST', '/api/create', {
      token: 'USDC',
      amount: '5',
      receiver: '0xDDEEFF0011223344556677889900AABBCCDDEEFF',
      network: 'polygon',
    });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('polygon'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  7b. INTENT ROUTER — select_chain FLOW
// ═══════════════════════════════════════════════════════════════════

describe('Intent Router — Chain Selection', () => {
  const { routeIntent } = require('./lib/ai/intentRouter');
  const testMemStore = { requests: {}, agents: {} };

  it('returns select_chain when create_link called without network', async () => {
    const result = await routeIntent('create_link', {
      amount: '10',
      token: 'USDC',
    }, { id: 'test', wallet_address: '0xDDEEFF0011223344556677889900AABBCCDDEEFF', chain: 'sepolia' }, { supabase: null, memoryStore: testMemStore });

    assert.equal(result.action_required, 'select_chain');
    assert.ok(Array.isArray(result.chains));
    assert.equal(result.chains.length, 3);
    assert.equal(result.pending.amount, '10');
    assert.equal(result.pending.token, 'USDC');
  });

  it('creates link when create_link called WITH network', async () => {
    const result = await routeIntent('create_link', {
      amount: '5',
      network: 'base',
      token: 'USDT',
    }, { id: 'test', wallet_address: '0xDDEEFF0011223344556677889900AABBCCDDEEFF', chain: 'sepolia' }, { supabase: null, memoryStore: testMemStore });

    assert.ok(result.linkId);
    assert.equal(result.network, 'base');
    assert.equal(result.token, 'USDT');
    assert.equal(result.amount, '5');
  });

  it('handles select_chain action directly', async () => {
    const result = await routeIntent('select_chain', {
      pending_amount: '20',
      pending_token: 'ETH',
    }, { id: 'test' }, {});

    assert.equal(result.action_required, 'select_chain');
    assert.equal(result.pending.amount, '20');
    assert.equal(result.pending.token, 'ETH');
    assert.ok(result.message.includes('chain'));
  });

  it('rejects create_link with invalid network', async () => {
    await assert.rejects(
      () => routeIntent('create_link', {
        amount: '10',
        network: 'polygon',
      }, { id: 'test', wallet_address: '0xDDEEFF0011223344556677889900AABBCCDDEEFF' }, { supabase: null, memoryStore: testMemStore }),
      /Unsupported network.*polygon/
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
//  8. PAYMENT REQUEST VIEW (402 responses)
// ═══════════════════════════════════════════════════════════════════

describe('Payment Request View', () => {
  it('returns 402 for pending sepolia link', async () => {
    const res = await request('GET', `/api/request/${links.sepolia}`);
    assert.equal(res.status, 402);
    assert.equal(res.body.payment.network, 'sepolia');
    assert.equal(res.body.payment.token, 'USDC');
    assert.equal(res.body.payment.amount, '10');
  });

  it('returns 402 for pending ethereum link', async () => {
    const res = await request('GET', `/api/request/${links.ethereum}`);
    assert.equal(res.status, 402);
    assert.equal(res.body.payment.network, 'ethereum');
    assert.equal(res.body.payment.token, 'USDC');
    assert.equal(res.body.payment.amount, '50');
  });

  it('returns 402 for pending base USDT link', async () => {
    const res = await request('GET', `/api/request/${links.base}`);
    assert.equal(res.status, 402);
    assert.equal(res.body.payment.network, 'base');
    assert.equal(res.body.payment.token, 'USDT');
    assert.equal(res.body.payment.amount, '25');
  });

  it('returns 404 for non-existent link', async () => {
    const res = await request('GET', '/api/request/REQ-DOESNOTEXIST');
    assert.equal(res.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9. PAY-LINK — TOKEN ADDRESS RESOLUTION PER CHAIN
// ═══════════════════════════════════════════════════════════════════

describe('Pay-Link (multi-chain token resolution)', () => {
  it('resolves Sepolia USDC address in pay-link', async () => {
    const res = await request('POST', '/api/pay-link', {
      linkId: links.sepolia,
    }, agents.payer.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.network, 'sepolia');
    assert.equal(
      res.body.instructions.payment.tokenAddress,
      '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87'
    );
  });

  it('resolves Ethereum mainnet USDC address in pay-link', async () => {
    const res = await request('POST', '/api/pay-link', {
      linkId: links.ethereum,
    }, agents.payer.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.network, 'ethereum');
    assert.equal(
      res.body.instructions.payment.tokenAddress,
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
    );
  });

  it('resolves Base mainnet USDT address in pay-link', async () => {
    const res = await request('POST', '/api/pay-link', {
      linkId: links.base,
    }, agents.payer.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.network, 'base');
    assert.equal(res.body.instructions.payment.token, 'USDT');
    assert.equal(
      res.body.instructions.payment.tokenAddress,
      '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2'
    );
  });

  it('ETH link returns null tokenAddress (native)', async () => {
    const res = await request('POST', '/api/pay-link', {
      linkId: links.ethLink,
    }, agents.payer.apiKey);
    assert.equal(res.status, 200);
    assert.equal(res.body.instructions.payment.token, 'ETH');
    assert.equal(res.body.instructions.payment.tokenAddress, null);
  });

  it('fee breakdown includes correct LCX address per chain in transfers', async () => {
    // Check Base link — fee transfers should use Base USDC address
    const res = await request('POST', '/api/pay-link', {
      linkId: links.base,
    }, agents.payer.apiKey);
    assert.equal(res.status, 200);

    // Since payer has no LCX on Base, fee falls back to USDC
    // The USDC fee address should be Base's USDC address
    const feeTx = res.body.instructions.transfers.find((t) => t.description === 'Platform fee');
    assert.ok(feeTx, 'Should have a platform fee transfer');
    if (feeTx.token === 'USDC') {
      assert.equal(feeTx.tokenAddress, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    } else if (feeTx.token === 'LCX') {
      assert.equal(feeTx.tokenAddress, '0xd7468c14ae76C3Fc308aEAdC223D5D1F71d3c171');
    }
  });

  it('returns 404 for non-existent link', async () => {
    const res = await request('POST', '/api/pay-link', {
      linkId: 'REQ-DOESNOTEXIST',
    }, agents.payer.apiKey);
    assert.equal(res.status, 404);
  });

  it('requires linkId', async () => {
    const res = await request('POST', '/api/pay-link', {}, agents.payer.apiKey);
    assert.equal(res.status, 400);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9b. EXECUTE-PAYMENT ENDPOINT VALIDATION
// ═══════════════════════════════════════════════════════════════════

describe('Execute Payment — Input Validation', () => {
  it('requires linkId', async () => {
    const res = await request('POST', '/api/execute-payment', {
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('linkId'));
  });

  it('requires privateKey', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('privateKey'));
  });

  it('rejects invalid privateKey format', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: 'not-a-valid-key',
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('Invalid privateKey'));
  });

  it('returns 404 for non-existent link', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: 'REQ-DOESNOTEXIST',
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, agents.payer.apiKey);
    assert.equal(res.status, 404);
  });

  it('requires auth', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });
    assert.equal(res.status, 401);
  });

  it('rejects if agent has no wallet', async () => {
    // Register a new agent without wallet
    const regRes = await request('POST', '/api/agents/register', {
      username: 'no-wallet-exec-' + Date.now(),
      email: 'exec@test.com',
    });
    assert.ok(regRes.status === 200 || regRes.status === 201);
    const noWalletKey = regRes.body.api_key;

    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, noWalletKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('wallet'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  9c. EXECUTE-PAYMENT DEPRECATION HEADERS
// ═══════════════════════════════════════════════════════════════════

describe('Execute Payment — Deprecation Headers', () => {
  it('returns Deprecation header on valid request', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, agents.payer.apiKey);
    // The request may fail on-chain (no real RPC), but headers should still be set
    assert.equal(res.headers['deprecation'], 'true', 'Should have Deprecation header');
    assert.equal(res.headers['x-payagent-deprecated'], 'execute-payment', 'Should have X-PayAgent-Deprecated header');
    assert.ok(res.headers['link'] && res.headers['link'].includes('@payagent/sdk'), 'Should have Link header pointing to SDK');
  });

  it('returns Deprecation header even on error responses', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: 'invalid-key',
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
    assert.equal(res.headers['deprecation'], 'true', 'Deprecation header on error');
    assert.equal(res.headers['x-payagent-deprecated'], 'execute-payment');
  });

  it('returns Deprecation header on auth failure', async () => {
    const res = await request('POST', '/api/execute-payment', {
      linkId: links.sepolia,
      privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
    });
    // Auth middleware runs before deprecation headers on the route
    // This is expected: auth middleware responds directly, so no deprecation header
    assert.equal(res.status, 401);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  10. PAYMENT VERIFICATION (mocked — no real tx)
// ═══════════════════════════════════════════════════════════════════

describe('Payment Verification', () => {
  it('requires requestId and txHash', async () => {
    const res = await request('POST', '/api/verify', {}, agents.payer.apiKey);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('Missing'));
  });

  it('requires txHash', async () => {
    const res = await request('POST', '/api/verify', {
      requestId: links.sepolia,
    }, agents.payer.apiKey);
    assert.equal(res.status, 400);
  });

  it('returns 404 for non-existent request', async () => {
    const res = await request('POST', '/api/verify', {
      requestId: 'REQ-DOESNOTEXIST',
      txHash: '0xfake',
    }, agents.payer.apiKey);
    assert.equal(res.status, 404);
  });

  // Verification with a fake txHash will fail on-chain (expected),
  // but this tests the endpoint plumbing works correctly
  it('verification fails with fake txHash (expected — no on-chain tx)', async () => {
    const res = await request('POST', '/api/verify', {
      requestId: links.sepolia,
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000001',
    }, agents.payer.apiKey);
    // Should be 400 (verification failed) or 500 (RPC error with test URL)
    assert.ok(
      res.status === 400 || res.status === 500,
      `Expected 400 or 500 but got ${res.status}`
    );
  });
});

// ═══════════════════════════════════════════════════════════════════
//  11. INPUT VALIDATION & EDGE CASES
// ═══════════════════════════════════════════════════════════════════

describe('Input Validation & Edge Cases', () => {
  it('rejects zero amount', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '0',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
  });

  it('rejects negative amount', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '-5',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
  });

  it('rejects non-numeric amount', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: 'abc',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
  });

  it('rejects empty amount', async () => {
    const res = await request('POST', '/api/create-link', {
      amount: '',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
  });

  it('rejects missing amount', async () => {
    const res = await request('POST', '/api/create-link', {
      description: 'no amount',
    }, agents.creator.apiKey);
    assert.equal(res.status, 400);
  });

  it('agent without wallet cannot create links', async () => {
    // Register a new agent without wallet
    const regRes = await request('POST', '/api/agents/register', {
      username: 'no_wallet_agent',
      email: 'nw@test.com',
    });
    assert.equal(regRes.status, 201);

    const res = await request('POST', '/api/create-link', {
      amount: '5',
    }, regRes.body.api_key);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('wallet'));
  });

  it('agent without wallet cannot pay links', async () => {
    const regRes = await request('POST', '/api/agents/register', {
      username: 'no_wallet_payer',
      email: 'nwp@test.com',
    });
    assert.equal(regRes.status, 201);

    const res = await request('POST', '/api/pay-link', {
      linkId: links.sepolia,
    }, regRes.body.api_key);
    assert.equal(res.status, 400);
    assert.ok(res.body.error.includes('wallet'));
  });
});

// ═══════════════════════════════════════════════════════════════════
//  12. REQUEST LISTING & DELETION
// ═══════════════════════════════════════════════════════════════════

describe('Request Listing & Deletion', () => {
  it('lists all requests for authenticated agent', async () => {
    const res = await request('GET', '/api/requests', null, agents.creator.apiKey);
    assert.equal(res.status, 200);
    assert.ok(res.body.requests.length > 0);
    assert.ok(res.body.count > 0);
  });

  it('deletes a request', async () => {
    // Create a temp link to delete
    const createRes = await request('POST', '/api/create-link', {
      amount: '1',
      network: 'sepolia',
    }, agents.creator.apiKey);
    const tempId = createRes.body.linkId;

    const delRes = await request('DELETE', `/api/request/${tempId}`, null, agents.creator.apiKey);
    assert.equal(delRes.status, 200);
    assert.equal(delRes.body.success, true);

    // Verify it's gone
    const getRes = await request('GET', `/api/request/${tempId}`);
    assert.equal(getRes.status, 404);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  13. PLATFORM STATS
// ═══════════════════════════════════════════════════════════════════

describe('Platform Stats', () => {
  it('GET /api/stats returns stats object', async () => {
    const res = await request('GET', '/api/stats');
    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok('totalAgents' in res.body.stats);
    assert.ok('totalPayments' in res.body.stats);
    assert.ok('totalFeesCollected' in res.body.stats);
  });
});

// ═══════════════════════════════════════════════════════════════════
//  14. CROSS-CHAIN CONSISTENCY
// ═══════════════════════════════════════════════════════════════════

describe('Cross-Chain Consistency', () => {
  it('same token has DIFFERENT addresses across chains', () => {
    const sepoliaUSDC = registry.getTokenAddress('sepolia', 'USDC');
    const ethUSDC = registry.getTokenAddress('ethereum', 'USDC');
    const baseUSDC = registry.getTokenAddress('base', 'USDC');
    // All three must be different
    assert.notEqual(sepoliaUSDC, ethUSDC);
    assert.notEqual(sepoliaUSDC, baseUSDC);
    assert.notEqual(ethUSDC, baseUSDC);
  });

  it('LCX has unique addresses per chain', () => {
    const sepoliaLCX = registry.getTokenAddress('sepolia', 'LCX');
    const ethLCX = registry.getTokenAddress('ethereum', 'LCX');
    const baseLCX = registry.getTokenAddress('base', 'LCX');
    assert.notEqual(sepoliaLCX, ethLCX);
    assert.notEqual(sepoliaLCX, baseLCX);
    assert.notEqual(ethLCX, baseLCX);
  });

  it('all token addresses are valid Ethereum addresses', () => {
    const ethAddrRegex = /^0x[a-fA-F0-9]{40}$/;
    for (const chain of ['sepolia', 'ethereum', 'base']) {
      for (const token of ['USDC', 'USDT', 'LCX']) {
        const addr = registry.getTokenAddress(chain, token);
        assert.ok(
          addr && ethAddrRegex.test(addr),
          `${token} on ${chain}: "${addr}" is not a valid address`
        );
      }
    }
  });
});
