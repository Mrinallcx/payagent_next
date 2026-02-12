/**
 * PayAgent SDK — Unit Tests
 *
 * Tests the PayAgentClient with mocked fetch and mocked ethers provider
 * to avoid real network/chain calls.
 *
 * Run: node --test --test-force-exit test/client.test.js
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');

// ─── Mock fetch globally ────────────────────────────────────────────

let fetchCalls = [];
let fetchResponses = {};

function mockFetch(url, options) {
  fetchCalls.push({ url, options });

  // Find matching response by URL pattern
  for (const [pattern, response] of Object.entries(fetchResponses)) {
    if (url.includes(pattern)) {
      return Promise.resolve({
        ok: response.ok !== false,
        status: response.status || 200,
        json: () => Promise.resolve(response.body),
      });
    }
  }

  // Default 404
  return Promise.resolve({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Not found' }),
  });
}

// Replace global fetch
const originalFetch = globalThis.fetch;

// ─── Tests ──────────────────────────────────────────────────────────

describe('PayAgentClient', () => {
  let PayAgentClient;

  beforeEach(() => {
    fetchCalls = [];
    fetchResponses = {};
    globalThis.fetch = mockFetch;
    // Fresh require to pick up mocked fetch
    delete require.cache[require.resolve('../src/PayAgentClient')];
    delete require.cache[require.resolve('../src/index')];
    ({ PayAgentClient } = require('../src/PayAgentClient'));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // ── Constructor ───────────────────────────────────────────────

  describe('constructor', () => {
    it('requires apiKey', () => {
      assert.throws(
        () => new PayAgentClient({ privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001' }),
        /apiKey is required/
      );
    });

    it('requires privateKey', () => {
      assert.throws(
        () => new PayAgentClient({ apiKey: 'pk_live_test' }),
        /privateKey is required/
      );
    });

    it('rejects invalid privateKey', () => {
      assert.throws(
        () => new PayAgentClient({ apiKey: 'pk_live_test', privateKey: 'not-a-key' }),
        /invalid/i
      );
    });

    it('creates client with valid params', () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });
      assert.ok(client);
      assert.equal(typeof client.address, 'string');
      assert.ok(client.address.startsWith('0x'));
    });

    it('derives correct wallet address from private key', () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });
      // Known address for private key 0x...01
      assert.equal(client.address, '0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf');
    });

    it('strips trailing slash from baseUrl', () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
        baseUrl: 'https://example.com/',
      });
      assert.equal(client.baseUrl, 'https://example.com');
    });
  });

  // ── getInstructions ───────────────────────────────────────────

  describe('getInstructions()', () => {
    it('calls POST /api/pay-link with correct body', async () => {
      fetchResponses['/api/pay-link'] = {
        body: {
          success: true,
          linkId: 'REQ-TEST1',
          instructions: {
            payment: { token: 'USDC', tokenAddress: '0xUSDC', amount: '10', to: '0xCreator', network: 'sepolia' },
            fee: { feeToken: 'LCX', feeTotal: 4, platformShare: 2, creatorReward: 2 },
            transfers: [
              { description: 'Payment to creator', token: 'USDC', tokenAddress: '0xUSDC', amount: '10', to: '0xCreator' },
            ],
          },
        },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      const result = await client.getInstructions('REQ-TEST1');

      assert.equal(result.success, true);
      assert.equal(result.instructions.payment.network, 'sepolia');

      // Verify the request was made correctly
      const call = fetchCalls.find(c => c.url.includes('/api/pay-link'));
      assert.ok(call, 'Should have called /api/pay-link');
      const body = JSON.parse(call.options.body);
      assert.equal(body.linkId, 'REQ-TEST1');
    });

    it('sends API key in x-api-key header', async () => {
      fetchResponses['/api/pay-link'] = {
        body: { success: true, instructions: { payment: {}, transfers: [] } },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_secret123',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await client.getInstructions('REQ-TEST1');

      const call = fetchCalls.find(c => c.url.includes('/api/pay-link'));
      assert.equal(call.options.headers['x-api-key'], 'pk_live_secret123');
    });

    it('never includes private key in any HTTP request', async () => {
      fetchResponses['/api/pay-link'] = {
        body: { success: true, instructions: { payment: {}, transfers: [] } },
      };

      const PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: PRIVATE_KEY,
      });

      await client.getInstructions('REQ-TEST1');

      // Check every fetch call — private key must never appear
      for (const call of fetchCalls) {
        const bodyStr = call.options.body || '';
        const headerStr = JSON.stringify(call.options.headers || {});
        assert.ok(!bodyStr.includes(PRIVATE_KEY), 'Private key must not be in request body');
        assert.ok(!headerStr.includes(PRIVATE_KEY), 'Private key must not be in request headers');
        assert.ok(!call.url.includes(PRIVATE_KEY), 'Private key must not be in URL');
      }
    });

    it('requires linkId', async () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.getInstructions(),
        /linkId is required/
      );
    });
  });

  // ── createLink ────────────────────────────────────────────────

  describe('createLink()', () => {
    it('calls POST /api/create-link with correct params', async () => {
      fetchResponses['/api/create-link'] = {
        body: {
          success: true,
          linkId: 'REQ-NEW1',
          link: '/r/REQ-NEW1',
          network: 'sepolia',
          token: 'USDC',
          amount: '25',
        },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      const result = await client.createLink({
        amount: '25',
        network: 'sepolia',
        token: 'USDC',
        description: 'Test payment',
      });

      assert.equal(result.success, true);
      assert.equal(result.linkId, 'REQ-NEW1');

      const call = fetchCalls.find(c => c.url.includes('/api/create-link'));
      const body = JSON.parse(call.options.body);
      assert.equal(body.amount, '25');
      assert.equal(body.network, 'sepolia');
      assert.equal(body.token, 'USDC');
      assert.equal(body.description, 'Test payment');
    });

    it('requires amount', async () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.createLink({ network: 'sepolia' }),
        /amount is required/
      );
    });

    it('requires network', async () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.createLink({ amount: '10' }),
        /network is required/
      );
    });

    it('private key never in createLink request', async () => {
      fetchResponses['/api/create-link'] = {
        body: { success: true, linkId: 'REQ-NEW1' },
      };

      const PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: PRIVATE_KEY,
      });

      await client.createLink({ amount: '10', network: 'sepolia' });

      for (const call of fetchCalls) {
        const bodyStr = call.options.body || '';
        assert.ok(!bodyStr.includes(PRIVATE_KEY), 'Private key must not appear in createLink request');
      }
    });
  });

  // ── verifyPayment ─────────────────────────────────────────────

  describe('verifyPayment()', () => {
    it('calls POST /api/verify with correct body', async () => {
      fetchResponses['/api/verify'] = {
        body: { success: true, status: 'PAID' },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      const result = await client.verifyPayment('REQ-TEST1', '0xTxHash1', '0xFeeTx', '0xRewardTx');

      assert.equal(result.success, true);

      const call = fetchCalls.find(c => c.url.includes('/api/verify'));
      const body = JSON.parse(call.options.body);
      assert.equal(body.requestId, 'REQ-TEST1');
      assert.equal(body.txHash, '0xTxHash1');
      assert.equal(body.feeTxHash, '0xFeeTx');
      assert.equal(body.creatorRewardTxHash, '0xRewardTx');
    });

    it('omits optional tx hashes when not provided', async () => {
      fetchResponses['/api/verify'] = {
        body: { success: true, status: 'PAID' },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await client.verifyPayment('REQ-TEST1', '0xTxHash1');

      const call = fetchCalls.find(c => c.url.includes('/api/verify'));
      const body = JSON.parse(call.options.body);
      assert.equal(body.feeTxHash, undefined);
      assert.equal(body.creatorRewardTxHash, undefined);
    });

    it('requires requestId', async () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.verifyPayment(null, '0xTxHash'),
        /requestId is required/
      );
    });

    it('requires txHash', async () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.verifyPayment('REQ-TEST1'),
        /txHash is required/
      );
    });
  });

  // ── getChains ─────────────────────────────────────────────────

  describe('getChains()', () => {
    it('calls GET /api/chains', async () => {
      fetchResponses['/api/chains'] = {
        body: {
          success: true,
          chains: [
            { name: 'sepolia', displayName: 'Sepolia (ETH Testnet)', chainId: 11155111, isTestnet: true },
            { name: 'ethereum', displayName: 'Ethereum Mainnet', chainId: 1, isTestnet: false },
            { name: 'base', displayName: 'Base Mainnet', chainId: 8453, isTestnet: false },
          ],
        },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      const result = await client.getChains();
      assert.equal(result.chains.length, 3);

      const call = fetchCalls.find(c => c.url.includes('/api/chains'));
      assert.equal(call.options.method, 'GET');
    });
  });

  // ── payLink (full flow with mocked chain) ─────────────────────

  describe('payLink() — full flow', () => {
    it('handles already-paid links', async () => {
      fetchResponses['/api/pay-link'] = {
        body: { success: true, alreadyPaid: true, message: 'This link is already paid' },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      const result = await client.payLink('REQ-PAID');
      assert.equal(result.alreadyPaid, true);
      assert.equal(result.status, 'PAID');

      // No verify call should be made for already-paid links
      const verifyCall = fetchCalls.find(c => c.url.includes('/api/verify'));
      assert.equal(verifyCall, undefined, 'Should not call verify for already-paid link');
    });

    it('throws on failed instructions fetch', async () => {
      fetchResponses['/api/pay-link'] = {
        ok: false,
        status: 404,
        body: { error: 'Payment request not found' },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.payLink('REQ-NOTFOUND'),
        /Payment request not found/
      );
    });

    it('throws on empty transfers', async () => {
      fetchResponses['/api/pay-link'] = {
        body: {
          success: true,
          instructions: {
            payment: { network: 'sepolia' },
            transfers: [],
          },
        },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.payLink('REQ-EMPTY'),
        /No transfers found/
      );
    });

    it('requires linkId', async () => {
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      await assert.rejects(
        () => client.payLink(),
        /linkId is required/
      );
    });

    it('never sends private key during the full payLink flow', async () => {
      // This test verifies security across all API calls made during payLink
      fetchResponses['/api/pay-link'] = {
        body: {
          success: true,
          alreadyPaid: true,
          message: 'Already paid',
        },
      };

      const PRIVATE_KEY = '0x0000000000000000000000000000000000000000000000000000000000000001';
      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: PRIVATE_KEY,
      });

      await client.payLink('REQ-SEC');

      for (const call of fetchCalls) {
        const bodyStr = call.options.body || '';
        const headerStr = JSON.stringify(call.options.headers || {});
        const urlStr = call.url;
        assert.ok(!bodyStr.includes(PRIVATE_KEY), `Private key leaked in body of ${urlStr}`);
        assert.ok(!headerStr.includes(PRIVATE_KEY), `Private key leaked in headers of ${urlStr}`);
        assert.ok(!urlStr.includes(PRIVATE_KEY), `Private key leaked in URL: ${urlStr}`);
      }
    });
  });

  // ── Error handling ────────────────────────────────────────────

  describe('error handling', () => {
    it('throws on API error with status', async () => {
      fetchResponses['/api/pay-link'] = {
        ok: false,
        status: 401,
        body: { error: 'Authentication required' },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_bad',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      try {
        await client.getInstructions('REQ-TEST1');
        assert.fail('Should have thrown');
      } catch (err) {
        assert.equal(err.status, 401);
        assert.ok(err.message.includes('Authentication required'));
      }
    });

    it('includes response data in error', async () => {
      fetchResponses['/api/create-link'] = {
        ok: false,
        status: 400,
        body: { error: 'Missing required field: network' },
      };

      const client = new PayAgentClient({
        apiKey: 'pk_live_test',
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001',
      });

      try {
        await client.createLink({ amount: '10', network: 'sepolia' });
        assert.fail('Should have thrown');
      } catch (err) {
        assert.equal(err.response.error, 'Missing required field: network');
      }
    });
  });

  // ── Constants ─────────────────────────────────────────────────

  describe('exported constants', () => {
    it('exports CHAINS with correct networks', () => {
      const { CHAINS } = require('../src/constants');
      assert.ok(CHAINS.sepolia);
      assert.ok(CHAINS.ethereum);
      assert.ok(CHAINS.base);
      assert.equal(CHAINS.sepolia.chainId, 11155111);
      assert.equal(CHAINS.ethereum.chainId, 1);
      assert.equal(CHAINS.base.chainId, 8453);
    });

    it('exports TOKEN_DECIMALS', () => {
      const { TOKEN_DECIMALS } = require('../src/constants');
      assert.equal(TOKEN_DECIMALS.USDC, 6);
      assert.equal(TOKEN_DECIMALS.USDT, 6);
      assert.equal(TOKEN_DECIMALS.LCX, 18);
      assert.equal(TOKEN_DECIMALS.ETH, 18);
    });

    it('exports DEFAULT_RPC_URLS', () => {
      const { DEFAULT_RPC_URLS } = require('../src/constants');
      assert.ok(DEFAULT_RPC_URLS.sepolia);
      assert.ok(DEFAULT_RPC_URLS.ethereum);
      assert.ok(DEFAULT_RPC_URLS.base);
    });

    it('index.js re-exports all', () => {
      const sdk = require('../src/index');
      assert.ok(sdk.PayAgentClient);
      assert.ok(sdk.CHAINS);
      assert.ok(sdk.TOKEN_DECIMALS);
      assert.ok(sdk.DEFAULT_RPC_URLS);
    });
  });
});
