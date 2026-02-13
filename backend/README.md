# PayAgent Backend — API Documentation

> Crypto payment infrastructure for AI agents. Non-custodial, multi-chain, API-first.

**Base URL (production):** `https://backend-two-chi-56.vercel.app`

---

## Supported Chains

| Chain             | Canonical Name | Chain ID | Type    |
|-------------------|---------------|----------|---------|
| Ethereum Mainnet  | `ethereum`    | 1        | Mainnet |
| Base Mainnet      | `base`        | 8453     | Mainnet |
| Sepolia (Testnet) | `sepolia`     | 11155111 | Testnet |

**Tokens per chain:** USDC, USDT, ETH (native), LCX

Query `GET /api/chains` for full chain details and token addresses.

---

## Authentication

PayAgent supports two authentication methods:

### HMAC-SHA256 (SDK / AI Agents / curl)

All server-to-server requests are authenticated via HMAC-SHA256 signing. Three headers are required:

```
x-api-key-id:  pk_live_YOUR_KEY_ID   (public identifier)
x-timestamp:   1707000000            (unix epoch seconds)
x-signature:   <HMAC-SHA256 hex>     (computed signature)
```

**String-to-sign format:**
```
timestamp\nMETHOD\npath\nSHA256(body)
```

- Replay protection: timestamp must be within 5 minutes of server time
- The `api_secret` is used only for local HMAC computation — never sent over the wire
- The `@payagent/sdk` handles signing automatically

### Wallet Auth / JWT (Browser Dashboard)

The browser dashboard authenticates via wallet signature:

1. `POST /api/auth/challenge` → returns a nonce to sign
2. Sign nonce with wallet (EIP-191)
3. `POST /api/auth/verify` → returns a 1-hour JWT
4. Use `Authorization: Bearer <jwt>` for dashboard API calls

---

## Endpoints

### 1. Register Agent (no auth)

```
POST /api/agents/register
```

| Field           | Type   | Required | Description                  |
|-----------------|--------|----------|------------------------------|
| username        | string | yes      | Unique agent username        |
| email           | string | yes      | Contact email                |
| wallet_address  | string | no       | EVM wallet (0x...)           |

**Response:**
```json
{
  "success": true,
  "agent_id": "agent_my-agent_a1b2c3",
  "verification_challenge": "payagent-verify-my-agent-abc123",
  "instructions": "Post the challenge to X (Twitter), then call POST /api/agents/verify-x"
}
```

After X verification, you receive HMAC credentials:
```json
{
  "api_key_id": "pk_live_abc123...",
  "api_secret": "sk_live_xyz789...",
  "api_key_expires_at": "2026-02-21T..."
}
```

> Save both credentials — they are shown only once.

---

### 2. Create Payment Link (auth required)

```
POST /api/create-link
```

| Field         | Type   | Required | Default | Description                              |
|---------------|--------|----------|---------|------------------------------------------|
| amount        | string | **yes**  | —       | Payment amount (positive number)         |
| network       | string | **yes**  | —       | Chain: `sepolia`, `ethereum`, or `base`  |
| token         | string | no       | `USDC`  | Token: `USDC`, `USDT`, `ETH`, `LCX`     |
| description   | string | no       | `""`    | Description for the payment link         |
| receiver      | string | no       | agent's wallet | Override receiver address        |
| expiresInDays | number | no       | —       | Auto-expire after N days                 |

**Response:**
```json
{
  "success": true,
  "linkId": "REQ-ABC123XYZ",
  "link": "/r/REQ-ABC123XYZ",
  "network": "ethereum",
  "token": "USDC",
  "amount": "10"
}
```

**Error (missing network):**
```json
{
  "error": "Missing required field: network. Supported: sepolia, ethereum, base"
}
```

---

### 3. Pay a Link — SDK (Recommended)

The recommended way to pay a link is with `@payagent/sdk`. The SDK handles fetching instructions, signing, broadcasting, and verification.

```bash
npm install @payagent/sdk ethers
```

```javascript
const { PayAgentClient } = require('@payagent/sdk');

// Initialize with HMAC credentials
const client = new PayAgentClient({
  apiKeyId: process.env.PAYAGENT_KEY_ID,     // pk_live_...
  apiSecret: process.env.PAYAGENT_SECRET,     // sk_live_...
  privateKey: process.env.WALLET_PRIVATE_KEY,
  baseUrl: 'https://backend-two-chi-56.vercel.app',
});

// Create a payment link
const link = await client.createLink({
  amount: '10',
  network: 'sepolia',
  token: 'USDC',
  description: 'Service fee',
});
console.log(link.linkId); // REQ-ABC123

// Pay a link in one call
const result = await client.payLink('REQ-ABC123');
console.log(result.status);       // 'PAID'
console.log(result.transactions); // [{ txHash: '0x...', status: 'confirmed' }, ...]

// Or step-by-step for more control:
const instructions = await client.getInstructions('REQ-ABC123');
// ... sign & broadcast yourself ...
const verification = await client.verifyPayment('REQ-ABC123', '0xTxHash');
```

**How it works:**

1. SDK calls `POST /api/pay-link` to get transfer instructions (addresses, amounts, tokens)
2. SDK signs each transaction using ethers.js
3. Signed transactions are broadcast to the blockchain
4. SDK calls `POST /api/verify` with the resulting transaction hashes

See the [SDK README](../sdk/README.md) for full docs.

---

### 3b. Execute Payment — Legacy (Deprecated)

> **Deprecated.** Use `@payagent/sdk` instead.

```
POST /api/execute-payment
```

| Field      | Type   | Required | Description                                     |
|------------|--------|----------|-------------------------------------------------|
| linkId     | string | **yes**  | Payment link ID                                 |
| privateKey | string | **yes**  | Payer's private key (transmitted to server)      |

Responses include `Deprecation: true` header and a `deprecated: true` field.

---

### 4. Get Payment Instructions (auth required)

```
POST /api/pay-link
```

| Field  | Type   | Required | Description     |
|--------|--------|----------|-----------------|
| linkId | string | **yes**  | Payment link ID |

Returns token addresses, amounts, fee breakdown, and the exact transfers to execute. Used internally by `@payagent/sdk`, or use directly for manual signing.

**Response:**
```json
{
  "success": true,
  "linkId": "REQ-ABC123",
  "instructions": {
    "payment": {
      "token": "USDC",
      "tokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "amount": "10",
      "to": "0xCreatorWallet",
      "network": "ethereum",
      "description": "Payment for REQ-ABC123"
    },
    "fee": {
      "feeToken": "LCX",
      "feeTotal": 4,
      "platformShare": 2,
      "creatorReward": 2,
      "lcxPriceUsd": 0.15,
      "payerLcxBalance": 500
    },
    "transfers": [
      {
        "description": "Payment to creator",
        "token": "USDC",
        "tokenAddress": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "amount": "10",
        "to": "0xCreatorWallet"
      },
      {
        "description": "Platform fee",
        "token": "LCX",
        "tokenAddress": "0x037A54AaB062628C9Bbae1FDB1583c195585Fe41",
        "amount": "2",
        "to": "0xTreasuryWallet"
      },
      {
        "description": "Creator reward",
        "token": "LCX",
        "tokenAddress": "0x037A54AaB062628C9Bbae1FDB1583c195585Fe41",
        "amount": "2",
        "to": "0xCreatorWallet"
      }
    ]
  },
  "message": "Submit the transfers below, then call POST /api/verify with the payment txHash to complete."
}
```

---

### 5. Verify Payment (auth optional)

```
POST /api/verify
```

| Field               | Type   | Required | Description                       |
|---------------------|--------|----------|-----------------------------------|
| requestId           | string | **yes**  | Payment link ID                   |
| txHash              | string | **yes**  | Main payment transaction hash     |
| feeTxHash           | string | no       | Platform fee transaction hash     |
| creatorRewardTxHash | string | no       | Creator reward transaction hash   |

Verifies the payment on-chain and marks the link as PAID. Checks the transaction receipt for correct token, amount, and receiver.

**Response:**
```json
{
  "success": true,
  "status": "PAID",
  "request": {
    "id": "REQ-ABC123",
    "amount": "10",
    "token": "USDC",
    "network": "ethereum",
    "status": "PAID",
    "txHash": "0xabc...",
    "paidAt": "2026-02-12T18:00:00.000Z"
  },
  "verification": {
    "valid": true,
    "txHash": "0xabc...",
    "amount": "10",
    "receiver": "0xcreatorwallet",
    "blockNumber": 12345678,
    "tokenType": "ERC20"
  }
}
```

---

### 6. AI Chat (auth required)

```
POST /api/chat
```

| Field   | Type   | Required | Description              |
|---------|--------|----------|--------------------------|
| message | string | **yes**  | Natural language message |

The AI assistant understands natural language and can create links, check status, pay links, and manage wallets.

**Chain Selection Flow:**

When you ask the AI to create a link without specifying a chain, it will ask which chain to use:

```bash
# Step 1: Request without chain
curl -X POST /api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: pk_live_..." \
  -H "x-timestamp: $(date +%s)" \
  -H "x-signature: <computed HMAC>" \
  -d '{ "message": "Create a 5 USDC payment link" }'
```

Response — AI asks for chain:
```json
{
  "action": "select_chain",
  "result": {
    "action_required": "select_chain",
    "chains": [
      { "name": "sepolia", "displayName": "Sepolia (ETH Testnet)", "isTestnet": true },
      { "name": "ethereum", "displayName": "Ethereum Mainnet", "isTestnet": false },
      { "name": "base", "displayName": "Base Mainnet", "isTestnet": false }
    ],
    "pending": { "amount": "5", "token": "USDC", "description": "" },
    "message": "Which chain would you like to use?\n\n1. Sepolia (ETH Testnet)\n2. Ethereum Mainnet\n3. Base Mainnet"
  }
}
```

```bash
# Step 2: Reply with chain choice
curl -X POST /api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: pk_live_..." \
  -H "x-timestamp: $(date +%s)" \
  -H "x-signature: <computed HMAC>" \
  -d '{ "message": "base" }'
```

Response — link created:
```json
{
  "action": "create_link",
  "result": {
    "linkId": "REQ-XYZ123",
    "link": "/r/REQ-XYZ123",
    "amount": "5",
    "token": "USDC",
    "network": "base"
  }
}
```

**Skip chain prompt** by specifying the chain upfront:
```bash
curl -X POST /api/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: pk_live_..." \
  -H "x-timestamp: $(date +%s)" \
  -H "x-signature: <computed HMAC>" \
  -d '{ "message": "Create a 10 USDT link on ethereum" }'
```

---

### 7. List Supported Chains (public, no auth)

```
GET /api/chains
```

Returns all supported chains with names, chain IDs, and testnet flags.

---

### 8. Other Endpoints

| Method | Path                   | Auth   | Description                       |
|--------|------------------------|--------|-----------------------------------|
| POST   | /api/auth/challenge    | no     | Get wallet login nonce            |
| POST   | /api/auth/verify       | no     | Verify wallet signature → JWT     |
| POST   | /api/agents/verify-x   | no     | X (Twitter) verification          |
| POST   | /api/agents/rotate-key | JWT    | Rotate HMAC credentials           |
| POST   | /api/agents/deactivate | JWT    | Soft-deactivate agent             |
| DELETE | /api/agents/delete     | JWT    | Soft-delete agent                 |
| GET    | /api/agents/me         | HMAC/JWT | Get agent profile               |
| POST   | /api/agents/wallet     | HMAC/JWT | Update wallet address           |
| GET    | /api/agents/logs       | HMAC/JWT | API request logs                |
| GET    | /api/agents/ip-history | HMAC/JWT | IP address history              |
| GET    | /api/requests          | HMAC   | List your payment links           |
| GET    | /api/request/:id       | no     | Get link details (public)         |
| GET    | /api/request/:id/fee   | no     | Fee breakdown for payer (public)  |
| DELETE | /api/request/:id       | HMAC   | Delete a payment link             |
| POST   | /api/webhooks          | HMAC   | Register a webhook                |
| GET    | /api/webhooks          | HMAC   | List your webhooks                |
| GET    | /api/stats             | no     | Platform statistics               |
| GET    | /health                | no     | Health check                      |

---

## SDK Reference (`@payagent/sdk`)

```bash
npm install @payagent/sdk ethers
```

### Constructor

```javascript
const { PayAgentClient } = require('@payagent/sdk');

const client = new PayAgentClient({
  apiKeyId: 'pk_live_...',              // required — public key identifier
  apiSecret: 'sk_live_...',             // required — HMAC signing secret (never sent over the wire)
  privateKey: '0x...',                  // required — wallet private key for signing transactions
  baseUrl: 'https://backend-two-chi-56.vercel.app',  // optional
  rpcUrl: {                             // optional — custom RPC URLs
    sepolia: 'https://sepolia.infura.io/v3/KEY',
    ethereum: 'https://mainnet.infura.io/v3/KEY',
    base: 'https://base-mainnet.infura.io/v3/KEY',
  },
});
```

> **HMAC Signing**: The SDK automatically signs every request using HMAC-SHA256. The `apiSecret` is used only locally to compute the signature — it is never transmitted.

### Methods

| Method | Description |
|--------|-------------|
| `client.payLink(linkId)` | Full payment in one call: fetch instructions, sign locally, broadcast, verify |
| `client.createLink({ amount, network, token?, description? })` | Create a new payment link |
| `client.getInstructions(linkId)` | Fetch payment instructions (for manual control) |
| `client.verifyPayment(requestId, txHash, feeTxHash?, rewardTxHash?)` | Verify a payment by tx hash |
| `client.getChains()` | Fetch supported chains from the API |
| `client.address` | Wallet address derived from the private key |

### Full E2E Example

```javascript
// Creator creates a link
const link = await client.createLink({
  amount: '25',
  network: 'sepolia',
  token: 'USDC',
  description: 'Service fee',
});
console.log(link.linkId); // REQ-ABC123

// Payer pays it (different agent, different credentials)
const payer = new PayAgentClient({
  apiKeyId: 'pk_live_PAYER_KEY_ID',
  apiSecret: 'sk_live_PAYER_SECRET',
  privateKey: '0xPAYER_PRIVATE_KEY',
});

const result = await payer.payLink(link.linkId);
console.log(result.status);       // 'PAID'
console.log(result.transactions); // [{ txHash: '0x...', ... }, ...]
```

See the full [SDK README](../sdk/README.md) for detailed documentation.

---

## Fee Model

The **payer** covers the fee. Fee is paid in LCX (preferred) or deducted from the payment token (fallback).

| Condition             | Fee                                                   | Creator Receives     |
|-----------------------|-------------------------------------------------------|----------------------|
| Payer holds >= 4 LCX  | 4 LCX (2 platform + 2 creator reward)                | Full payment amount  |
| Payer holds < 4 LCX   | Fee deducted from payment token (50/50 split)        | Amount minus fee     |

**Fallback logic by token:**
- **USDC / USDT**: Fee = LCX fee amount × LCX price (stablecoins ≈ $1)
- **ETH**: Fee = (LCX fee amount × LCX price) / ETH price (converted via CoinGecko)
- **LCX (as payment token)**: Fee = 4 LCX deducted from payment amount

### Public Fee Endpoint (for human payers)

```
GET /api/request/:id/fee?payer=0xPayerWalletAddress
```

Returns fee-adjusted transfer instructions for any payer. No auth required.

```json
{
  "success": true,
  "payment": { "token": "USDT", "amount": "100", "network": "base" },
  "fee": { "feeToken": "USDT", "feeTotal": 0.60, "platformShare": 0.30, "creatorReward": 0.30, "feeDeductedFromPayment": true },
  "transfers": [
    { "description": "Payment to creator", "to": "0x...", "token": "USDT", "amount": "99.40" },
    { "description": "Platform fee", "to": "0x...", "token": "USDT", "amount": "0.30" },
    { "description": "Creator reward", "to": "0x...", "token": "USDT", "amount": "0.30" }
  ],
  "creatorReceives": "99.40"
}

---

## Webhooks

Register a webhook URL to receive events:

```bash
curl -X POST /api/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key-id: pk_live_..." \
  -H "x-timestamp: $(date +%s)" \
  -H "x-signature: <computed HMAC>" \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["payment.created", "payment.paid"]
  }'
```

Events: `payment.created`, `payment.paid`, `payment.expired`

Payloads include HMAC-SHA256 signature in the `X-PayAgent-Signature` header (use your `webhook_secret` to verify).

---

## Running Tests

```bash
cd backend
npm test
```

Runs 100 test cases covering chain registry, multi-chain link creation, network validation, payment flow, fee resolution, security, deprecation headers, and cross-chain consistency.

SDK tests (separate):

```bash
cd sdk
npm test
```

Runs 30 unit tests for the SDK client (mocked fetch, mocked providers).
