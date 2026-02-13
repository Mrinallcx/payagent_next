# @payagent/sdk

SDK for [PayAgent](https://backend-two-chi-56.vercel.app) crypto payments. Uses HMAC-SHA256 request signing — your `api_secret` never leaves your environment.

## Install

```bash
npm install @payagent/sdk ethers
```

> Requires Node.js >= 18 and ethers v6+.

## Quick Start

```javascript
const { PayAgentClient } = require('@payagent/sdk');

const client = new PayAgentClient({
  apiKeyId: 'pk_live_YOUR_KEY_ID',
  apiSecret: 'sk_live_YOUR_SECRET',
  privateKey: process.env.WALLET_PRIVATE_KEY,
  baseUrl: 'https://backend-two-chi-56.vercel.app',
});

// Pay a link in one call
const result = await client.payLink('REQ-ABC123');
console.log(result.status);        // 'PAID'
console.log(result.transactions);  // [{ txHash: '0x...', status: 'confirmed' }, ...]
```

## How It Works

```
Agent                  PayAgent API           Blockchain
  |                       |                      |
  |-- HMAC-signed req --->|                      |
  |<-- transfer list -----|                      |
  |                       |                      |
  |-- sign & broadcast --------------------------->|
  |<-- tx receipts --------------------------------|
  |                       |                      |
  |-- HMAC-signed verify ->|                      |
  |<-- PAID --------------|                      |
```

1. **Fetch instructions** — SDK calls `POST /api/pay-link` with HMAC-signed headers
2. **Sign & broadcast** — SDK signs each transaction locally with ethers.js
3. **Verify** — SDK sends the resulting transaction hashes to `POST /api/verify`

All API requests are authenticated via HMAC-SHA256 (`x-api-key-id`, `x-timestamp`, `x-signature` headers). The `api_secret` is only used locally for signature computation.

## Full Example

```javascript
const { PayAgentClient } = require('@payagent/sdk');

// Initialize
const client = new PayAgentClient({
  apiKeyId: 'pk_live_YOUR_KEY_ID',
  apiSecret: 'sk_live_YOUR_SECRET',
  privateKey: process.env.WALLET_PRIVATE_KEY,
  baseUrl: 'https://backend-two-chi-56.vercel.app',
});

console.log('Wallet address:', client.address);

// Create a payment link
const link = await client.createLink({
  amount: '10',
  network: 'sepolia',      // 'sepolia' | 'ethereum' | 'base'
  token: 'USDC',           // 'USDC' | 'USDT' | 'ETH' | 'LCX'
  description: 'Service fee',
});
console.log('Link created:', link.linkId);

// Pay a link (one call — handles everything)
const result = await client.payLink(link.linkId);
console.log('Status:', result.status);
for (const tx of result.transactions) {
  console.log(`  ${tx.description}: ${tx.txHash} (${tx.status})`);
}

// Or step-by-step for more control:
const instructions = await client.getInstructions('REQ-ABC123');
// ... sign & broadcast yourself ...
const verification = await client.verifyPayment('REQ-ABC123', '0xTxHash');
```

## HMAC Signing

Every request is signed with HMAC-SHA256. The string-to-sign format is:

```
timestamp\nMETHOD\npath\nSHA256(body)
```

The SDK computes this automatically. For manual curl usage, see the [API documentation](https://payagent.vercel.app/agent).

## API Reference

### `new PayAgentClient(options)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `apiKeyId` | string | yes | Your PayAgent API key ID (`pk_live_...`) |
| `apiSecret` | string | yes | Your PayAgent API secret (`sk_live_...`) — used for HMAC signing |
| `privateKey` | string | yes | Your wallet private key |
| `baseUrl` | string | no | API base URL (default: `https://backend-two-chi-56.vercel.app`) |
| `rpcUrl` | string or object | no | Custom RPC URL. String for all chains, or `{ sepolia: '...', ethereum: '...', base: '...' }` |

### `client.payLink(linkId)` -> Promise

Pay a link in one call. Fetches instructions, signs, broadcasts, and verifies.

**Returns:**
```javascript
{
  success: true,
  linkId: 'REQ-ABC123',
  payer: '0xYourAddress',
  network: 'sepolia',
  transactions: [
    { description: 'Payment to creator', txHash: '0x...', token: 'USDC', amount: '10', status: 'confirmed' },
    { description: 'Platform fee', txHash: '0x...', token: 'LCX', amount: '2', status: 'confirmed' },
    { description: 'Creator reward', txHash: '0x...', token: 'LCX', amount: '2', status: 'confirmed' }
  ],
  verification: { success: true, status: 'PAID' },
  status: 'PAID'
}
```

### `client.createLink({ amount, network, token?, description? })` -> Promise

Create a new payment link.

### `client.getInstructions(linkId)` -> Promise

Fetch payment instructions without executing. Use for manual control.

### `client.verifyPayment(requestId, txHash, feeTxHash?, rewardTxHash?)` -> Promise

Verify a payment by transaction hash(es).

### `client.getChains()` -> Promise

Fetch supported chains from the API.

### `client.address` -> string

The wallet address derived from your private key.

## Migration from v0.1.x

v0.2.0 is a **breaking change**. The constructor now requires `apiKeyId` + `apiSecret` instead of `apiKey`:

```javascript
// Before (v0.1.x)
const client = new PayAgentClient({ apiKey: 'pk_live_...', privateKey: '0x...' });

// After (v0.2.0)
const client = new PayAgentClient({ apiKeyId: 'pk_live_...', apiSecret: 'sk_live_...', privateKey: '0x...' });
```

Rotate your key via `POST /api/agents/rotate-key` to get the new `api_key_id` + `api_secret` credentials.

## Custom RPC URLs

For better reliability, provide your own RPC URLs:

```javascript
const client = new PayAgentClient({
  apiKeyId: 'pk_live_...',
  apiSecret: 'sk_live_...',
  privateKey: '0x...',
  rpcUrl: {
    sepolia: 'https://sepolia.infura.io/v3/YOUR_KEY',
    ethereum: 'https://mainnet.infura.io/v3/YOUR_KEY',
    base: 'https://base-mainnet.infura.io/v3/YOUR_KEY',
  },
});
```

## Supported Chains

- **Sepolia** (ETH Testnet) — `sepolia`
- **Ethereum Mainnet** — `ethereum`
- **Base Mainnet** — `base`

Tokens per chain: USDC, USDT, ETH (native), LCX.

## License

MIT
