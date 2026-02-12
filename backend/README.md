# PayMe Backend — API Documentation

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

All authenticated endpoints require the `x-api-key` header (or `Authorization: Bearer <key>`).

```
x-api-key: pk_live_YOUR_API_KEY
```

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
  "api_key": "pk_live_abc123...",
  "webhook_secret": "whsec_xyz789..."
}
```

> Save these credentials — they are shown only once.

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

### 3. Execute Payment — One Step (auth required)

```
POST /api/execute-payment
```

| Field      | Type   | Required | Description                                     |
|------------|--------|----------|-------------------------------------------------|
| linkId     | string | **yes**  | Payment link ID                                 |
| privateKey | string | **yes**  | Payer's private key (used transiently, never stored) |

Executes all on-chain transfers (payment + platform fee + creator reward) in one call and marks the link as PAID.

**Response:**
```json
{
  "success": true,
  "message": "Payment executed and verified on-chain",
  "linkId": "REQ-ABC123",
  "payer": "0xPayerAddress",
  "network": "sepolia",
  "transactions": [
    { "description": "Payment to creator", "txHash": "0xabc...", "token": "USDC", "amount": "10", "status": "confirmed" },
    { "description": "Platform fee", "txHash": "0xdef...", "token": "LCX", "amount": "2", "status": "confirmed" },
    { "description": "Creator reward", "txHash": "0xghi...", "token": "LCX", "amount": "2", "status": "confirmed" }
  ],
  "status": "PAID"
}
```

> The private key is used only to sign the on-chain transactions. It is never logged, stored, or persisted. All communication is over HTTPS.

---

### 4. Get Payment Instructions — Manual Flow (auth required)

```
POST /api/pay-link
```

| Field  | Type   | Required | Description     |
|--------|--------|----------|-----------------|
| linkId | string | **yes**  | Payment link ID |

Returns token addresses, amounts, and fee breakdown. Use this if you prefer to sign and broadcast transactions yourself (e.g. MetaMask, local script).

---

### 5. Verify Payment — Manual Flow (auth required)

```
POST /api/verify
```

| Field     | Type   | Required | Description             |
|-----------|--------|----------|-------------------------|
| requestId | string | **yes**  | Payment link ID         |
| txHash    | string | **yes**  | On-chain transaction hash |

Use after manually executing transfers to mark the payment as PAID.

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
  -H "x-api-key: pk_live_..." \
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
  -H "x-api-key: pk_live_..." \
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
  -H "x-api-key: pk_live_..." \
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

| Method | Path              | Auth | Description              |
|--------|-------------------|------|--------------------------|
| GET    | /api/agents/me    | yes  | Get agent profile        |
| POST   | /api/agents/wallet| yes  | Update wallet address    |
| GET    | /api/requests     | yes  | List your payment links  |
| GET    | /api/request/:id  | no   | Get link details (public)|
| DELETE | /api/request/:id  | yes  | Delete a payment link    |
| POST   | /api/webhooks     | yes  | Register a webhook       |
| GET    | /api/webhooks     | yes  | List your webhooks       |
| GET    | /api/stats        | no   | Platform statistics      |
| GET    | /health           | no   | Health check             |

---

## Fee Model

The **payer** covers the fee. Fee can be paid in LCX (preferred) or USDC equivalent.

| Condition           | Fee                                    |
|---------------------|----------------------------------------|
| Payer holds >= 4 LCX | 4 LCX (2 platform + 2 creator reward) |
| Payer holds < 4 LCX  | USDC equivalent of 4 LCX (50/50)     |

---

## Webhooks

Register a webhook URL to receive events:

```bash
curl -X POST /api/webhooks \
  -H "x-api-key: pk_live_..." \
  -d '{
    "url": "https://your-server.com/webhook",
    "events": ["payment.created", "payment.paid"]
  }'
```

Events: `payment.created`, `payment.paid`, `payment.expired`

Payloads include HMAC-SHA256 signature in the `X-PayMe-Signature` header (use your `webhook_secret` to verify).

---

## Running Tests

```bash
cd backend
npm test
```

Runs 87 test cases covering chain registry, multi-chain link creation, network validation, payment flow, fee resolution, security, and cross-chain consistency.
