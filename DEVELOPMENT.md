# PayAgent — Development Document

> **Internal reference for the engineering team.**
> Last updated: February 12, 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Tech Stack](#3-tech-stack)
4. [Repository Structure](#4-repository-structure)
5. [Backend — API Server](#5-backend--api-server)
   - 5.1 [API Endpoints](#51-api-endpoints)
   - 5.2 [Authentication & Middleware](#52-authentication--middleware)
   - 5.3 [Chain Registry (Multi-Chain)](#53-chain-registry-multi-chain)
   - 5.4 [Fee Engine](#54-fee-engine)
   - 5.5 [Blockchain Layer](#55-blockchain-layer)
   - 5.6 [AI Chat System (Grok)](#56-ai-chat-system-grok)
   - 5.7 [Webhook System](#57-webhook-system)
   - 5.8 [Database & Storage](#58-database--storage)
6. [Frontend — React Dashboard](#6-frontend--react-dashboard)
7. [SDK — @payagent/sdk (npm)](#7-sdk--payagentsdk-npm)
8. [Payment Flow (End-to-End)](#8-payment-flow-end-to-end)
9. [Database Schema](#9-database-schema)
10. [Deployment](#10-deployment)
11. [Testing](#11-testing)
12. [Security Model](#12-security-model)
13. [What Has Been Built (Chronological)](#13-what-has-been-built-chronological)
14. [What's Pending](#14-whats-pending)

---

## 1. Project Overview

**PayAgent** is a crypto payment infrastructure platform designed for both humans and AI agents. Think of it as "Stripe for AI Agents" — agents can register, get API keys, create payment links, pay each other, and receive webhook notifications, all programmatically.

### Core Value Proposition

- **API-first**: Every action is available via REST API — no UI required
- **Multi-chain**: Supports Ethereum Mainnet, Base Mainnet, and Sepolia Testnet
- **AI-native**: Built-in Grok-powered AI chat that understands natural language payment commands
- **Non-custodial**: The SDK signs transactions locally; the server never handles private keys
- **LCX fee model**: Flat 4 LCX fee per transaction (or USDC equivalent), split between platform and creator

### Live URLs

| Service | URL |
|---------|-----|
| Backend API | `https://backend-two-chi-56.vercel.app` |
| Frontend | Deployed alongside (Vercel / same origin) |
| npm SDK | `https://www.npmjs.com/package/@payagent/sdk` |
| GitHub | `https://github.com/pri-21mar/payme-your-simple-payment-hub` |

---

## 2. Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           CLIENTS                                        │
├──────────────┬──────────────────┬───────────────────┬────────────────────┤
│  React       │  AI Agent        │  @payagent/sdk    │  cURL / HTTP       │
│  Dashboard   │  (any language)  │  (Node.js)        │  Client            │
│  (wagmi +    │                  │                   │                    │
│  RainbowKit) │                  │  ┌─────────────┐  │                    │
│              │                  │  │ ethers.js    │  │                    │
│              │                  │  │ local sign   │  │                    │
│              │                  │  │ broadcast    │  │                    │
│              │                  │  └──────┬──────┘  │                    │
└──────┬───────┴────────┬─────────┴────────┬──────────┴──────────┬─────────┘
       │                │                  │                     │
       │    REST API (x-api-key header)    │                     │
       ▼                ▼                  ▼                     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      PAYAGENT BACKEND (Express.js)                       │
│                      Deployed on Vercel (Serverless)                     │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │ Auth         │  │ Chain        │  │ Fee          │  │ Webhook     │ │
│  │ Middleware   │  │ Registry     │  │ Calculator   │  │ Dispatcher  │ │
│  │              │  │              │  │              │  │             │ │
│  │ API key      │  │ Sepolia      │  │ LCX balance  │  │ HMAC-SHA256 │ │
│  │ bcrypt hash  │  │ Ethereum     │  │ check →      │  │ signatures  │ │
│  │ prefix       │  │ Base         │  │ LCX or USDC  │  │ retries     │ │
│  │ lookup       │  │              │  │ fee calc     │  │             │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └─────────────┘ │
│                                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │
│  │ AI Chat      │  │ Blockchain   │  │ x402         │                   │
│  │ System       │  │ Layer        │  │ Protocol     │                   │
│  │              │  │              │  │              │                   │
│  │ Grok 3 Fast  │  │ ethers.js    │  │ HTTP 402     │                   │
│  │ Intent       │  │ verify tx    │  │ Payment      │                   │
│  │ Router       │  │ execute tx   │  │ Required     │                   │
│  │ Memory       │  │ balances     │  │              │                   │
│  └──────────────┘  └──────────────┘  └──────────────┘                   │
│                                                                          │
└─────────────────────────────┬────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌──────────────────┐ ┌──────────────┐ ┌──────────────────┐
│  Supabase        │ │ Blockchain   │ │ External APIs    │
│  (PostgreSQL)    │ │ Networks     │ │                  │
│                  │ │              │ │ - CoinGecko      │
│  - agents        │ │ - Sepolia    │ │   (LCX price)    │
│  - payment_reqs  │ │ - Ethereum   │ │ - xAI / Grok     │
│  - fee_config    │ │ - Base       │ │   (AI chat)      │
│  - fee_txns      │ │              │ │                  │
│  - webhooks      │ │ via Infura   │ │                  │
│  - conversations │ │ RPC          │ │                  │
└──────────────────┘ └──────────────┘ └──────────────────┘
```

---

## 3. Tech Stack

### Backend
| Component | Technology | Version |
|-----------|-----------|---------|
| Runtime | Node.js | >= 18 |
| Framework | Express.js | 4.x |
| Blockchain | ethers.js | 6.x |
| Database | Supabase (PostgreSQL) | — |
| AI | xAI Grok 3 Fast (OpenAI-compatible) | — |
| Auth | bcrypt (API key hashing) | — |
| Deployment | Vercel (Serverless) | — |

### Frontend
| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | React | 18.3.1 |
| Language | TypeScript | — |
| Build Tool | Vite | 5.4.19 |
| UI Library | shadcn/ui + Radix UI | — |
| Styling | Tailwind CSS | — |
| Wallet | wagmi + RainbowKit | 2.x |
| State | TanStack React Query | 5.x |
| Forms | react-hook-form + zod | — |

### SDK
| Component | Technology | Version |
|-----------|-----------|---------|
| Package | @payagent/sdk | 0.1.0 |
| Runtime | Node.js | >= 18 |
| Blockchain | ethers.js (peer dep) | >= 6.0 |
| Published | npm (public) | — |

---

## 4. Repository Structure

```
payme-your-simple-payment-hub/
├── backend/                      # Backend API server
│   ├── api/
│   │   └── index.js              # All Express routes (1,097 lines)
│   ├── lib/
│   │   ├── chainRegistry.js      # Multi-chain config (single source of truth)
│   │   ├── blockchain.js         # On-chain interactions (verify, execute, balances)
│   │   ├── feeCalculator.js      # LCX/USDC fee calculation
│   │   ├── feeConfig.js          # Fee configuration (DB + cache)
│   │   ├── lcxPrice.js           # CoinGecko LCX price (5-min cache)
│   │   ├── agents.js             # Agent CRUD operations
│   │   ├── store.js              # In-memory storage fallback
│   │   ├── supabase.js           # Supabase client
│   │   ├── webhooks.js           # Webhook CRUD
│   │   ├── webhookDispatcher.js  # Webhook delivery + retries
│   │   ├── x402.js               # HTTP 402 protocol
│   │   └── ai/
│   │       ├── grokClient.js     # xAI Grok API client
│   │       ├── systemPrompt.js   # Context-aware prompt builder
│   │       ├── intentRouter.js   # AI action → backend handler
│   │       └── conversationMemory.js  # Chat history storage
│   ├── middleware/
│   │   └── auth.js               # API key authentication
│   ├── server.js                 # Express server entry
│   ├── schema.sql                # Supabase database schema
│   ├── test.js                   # Backend test suite (1,089 lines, 100 tests)
│   ├── vercel.json               # Vercel serverless config
│   └── .env                      # Environment variables
│
├── sdk/                          # @payagent/sdk npm package
│   ├── src/
│   │   ├── index.js              # Package entry point
│   │   ├── PayAgentClient.js     # Main SDK class (292 lines)
│   │   └── constants.js          # Embedded chain constants
│   ├── test/
│   │   └── client.test.js        # SDK unit tests (30 tests)
│   ├── examples/
│   │   └── pay-link.js           # Runnable E2E example
│   ├── package.json              # npm package config
│   ├── README.md                 # SDK documentation
│   ├── LICENSE                   # MIT license
│   └── .npmignore                # Publish exclusions
│
├── src/                          # Frontend React app
│   ├── pages/
│   │   ├── Index.tsx             # Dashboard / homepage
│   │   ├── PayAsAgent.tsx        # API documentation (/agent)
│   │   ├── PaymentLinks.tsx      # Payment links list
│   │   ├── PaymentView.tsx       # Payment page (402 flow)
│   │   ├── Transactions.tsx      # Transaction history
│   │   ├── Wallets.tsx           # Wallet management
│   │   ├── AgentsDashboard.tsx   # Agent management
│   │   └── Login.tsx             # Authentication
│   ├── components/
│   │   ├── CreateLinkModal.tsx   # Multi-step link creation (495 lines)
│   │   ├── PaymentLinkItem.tsx   # Payment link card
│   │   ├── TransactionItem.tsx   # Transaction card
│   │   ├── AppNavbar.tsx         # Top navigation
│   │   ├── AppSidebar.tsx        # Side navigation
│   │   └── ui/                   # 40+ shadcn components
│   └── lib/
│       ├── api.ts                # API client functions
│       ├── contracts.ts          # Frontend chain/token configs
│       └── utils.ts              # Utilities
│
├── index.html                    # HTML template (SEO meta tags)
├── package.json                  # Frontend dependencies
├── BLUEPRINT.md                  # Project blueprint
└── DEVELOPMENT.md                # This document
```

---

## 5. Backend — API Server

### 5.1 API Endpoints

#### Public Endpoints (No Authentication)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Health check |
| `GET` | `/health` | Service health |
| `POST` | `/api/agents/register` | Register new agent |
| `GET` | `/api/request/:id` | Get payment request (402 if pending) |
| `GET` | `/api/chains` | List supported chains |
| `GET` | `/api/stats` | Platform statistics |

#### Authenticated Endpoints (API Key Required)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/agents/me` | Agent profile |
| `POST` | `/api/agents/wallet` | Update wallet address |
| `POST` | `/api/create-link` | Create payment link |
| `POST` | `/api/pay-link` | Get payment instructions + fee breakdown |
| `POST` | `/api/verify` | Verify payment by tx hash |
| `POST` | `/api/chat` | AI chat (natural language) |
| `GET` | `/api/requests` | List payment links |
| `DELETE` | `/api/request/:id` | Delete payment link |
| `POST` | `/api/webhooks` | Register webhook |
| `GET` | `/api/webhooks` | List webhooks |
| `PUT` | `/api/webhooks/:id` | Update webhook |
| `DELETE` | `/api/webhooks/:id` | Delete webhook |
| `POST` | `/api/webhooks/:id/test` | Send test webhook |
| `POST` | `/api/execute-payment` | **DEPRECATED** — Execute payment (server-side) |

#### Key Endpoint Details

**`POST /api/agents/register`**
```
Request:  { username, email, wallet_address?, chain? }
Response: { agent_id, api_key, webhook_secret }
```
- Generates `pk_live_` prefixed API key
- Generates `whsec_` prefixed webhook secret
- Hashes both with bcrypt (12 rounds)
- Stores first 12 chars of key as `api_key_prefix` for fast lookup

**`POST /api/create-link`**
```
Request:  { amount, network (required), token?, description?, expiresInDays? }
Response: { linkId: "REQ-XXXXXXXXX", link, network, token, amount }
```
- Validates network against chain registry
- Defaults token to USDC
- Dispatches `payment.created` webhook

**`POST /api/pay-link`**
```
Request:  { linkId }
Response: { instructions: { payment, fee, transfers[] } }
```
- Returns exactly which transfers the payer needs to make
- Calculates fee based on payer's LCX balance on the payment network
- Returns 3 transfers: payment to creator, platform fee, creator reward

**`POST /api/verify`**
```
Request:  { requestId, txHash, feeTxHash?, creatorRewardTxHash? }
Response: { status: "PAID", verification: { valid, txHash, amount, blockNumber } }
```
- Verifies transaction on-chain using ethers.js
- Marks payment as PAID
- Records fee transaction
- Dispatches `payment.paid` webhook

---

### 5.2 Authentication & Middleware

```
┌─────────────────────────────────────────────────────┐
│  Incoming Request                                    │
│  Header: x-api-key: pk_live_abc123def456...         │
└─────────────────────┬───────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────┐
│  1. Extract first 12 chars → "pk_live_abc1"         │
│  2. Query agents table by api_key_prefix            │
│  3. bcrypt.compare(full_key, stored_hash)           │
│  4. Check agent.status === 'active'                 │
│  5. Attach agent to req.agent                       │
│  6. Update last_active_at timestamp                 │
└─────────────────────────────────────────────────────┘
```

Two middleware variants:
- **`authMiddleware`**: Rejects with 401 if invalid
- **`optionalAuthMiddleware`**: Passes through without `req.agent` if no key

---

### 5.3 Chain Registry (Multi-Chain)

**File**: `backend/lib/chainRegistry.js` — Single source of truth for all chain/token configuration.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHAIN REGISTRY                               │
├──────────────────┬──────────────────────┬───────────────────────────┤
│ Sepolia          │ Ethereum Mainnet     │ Base Mainnet              │
│ Chain ID: 11155111│ Chain ID: 1          │ Chain ID: 8453            │
│ Testnet          │ Mainnet              │ Mainnet                   │
├──────────────────┼──────────────────────┼───────────────────────────┤
│ USDC             │ USDC                 │ USDC                      │
│ 0x3402d41a...    │ 0xA0b8699...         │ 0x833589f...              │
│ (6 decimals)     │ (6 decimals)         │ (6 decimals)              │
├──────────────────┼──────────────────────┼───────────────────────────┤
│ USDT             │ USDT                 │ USDT                      │
│ 0xF9E0643B...    │ 0xdAC17F9...         │ 0xfde4C96...              │
│ (6 decimals)     │ (6 decimals)         │ (6 decimals)              │
├──────────────────┼──────────────────────┼───────────────────────────┤
│ LCX              │ LCX                  │ LCX                       │
│ 0x98d99c88...    │ 0x037A54A...         │ 0xd7468c1...              │
│ (18 decimals)    │ (18 decimals)        │ (18 decimals)             │
├──────────────────┼──────────────────────┼───────────────────────────┤
│ ETH (native)     │ ETH (native)         │ ETH (native)              │
│ 18 decimals      │ 18 decimals          │ 18 decimals               │
└──────────────────┴──────────────────────┴───────────────────────────┘
```

**Network Aliases** — The registry resolves fuzzy input:
- `"mainnet"`, `"eth"`, `"eth-mainnet"` → `"ethereum"`
- `"eth-sepolia"`, `"sepolia-testnet"` → `"sepolia"`
- `"base-mainnet"` → `"base"`

**Key Functions**:
| Function | Description |
|----------|-------------|
| `resolveNetwork(input)` | Resolve alias → canonical name |
| `getTokenAddress(network, symbol)` | Get contract address (null for native) |
| `getTokenDecimals(network, symbol)` | Get decimals (default 18) |
| `getRpcUrl(network)` | Get RPC URL from env vars |
| `isNativeToken(symbol, network)` | Check if token is native ETH |
| `getSupportedNetworkList()` | Get display-friendly chain list |

---

### 5.4 Fee Engine

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FEE CALCULATION FLOW                        │
│                                                                     │
│  Input: payer wallet address + network                              │
│                                                                     │
│  1. Get LCX token address for the network (chain registry)         │
│  2. Query payer's LCX balance on-chain                             │
│                                                                     │
│  ┌──────────────────────┐     ┌──────────────────────────────────┐  │
│  │ LCX balance >= 4?    │     │                                  │  │
│  │                      │     │                                  │  │
│  │  YES ─────────────────────▶│  Fee: 4 LCX                     │  │
│  │                      │     │  Platform: 2 LCX → Treasury     │  │
│  │                      │     │  Creator:  2 LCX → Creator      │  │
│  │                      │     │                                  │  │
│  │  NO ──────────────────────▶│  Fetch LCX price (CoinGecko)    │  │
│  │                      │     │  Fee: USDC equiv of 4 LCX       │  │
│  │                      │     │  Platform: 50% → Treasury       │  │
│  │                      │     │  Creator:  50% → Creator        │  │
│  └──────────────────────┘     └──────────────────────────────────┘  │
│                                                                     │
│  Output: { feeToken, feeTotal, platformShare, creatorReward,        │
│            lcxPriceUsd, payerLcxBalance }                           │
└─────────────────────────────────────────────────────────────────────┘
```

**Three files involved:**
| File | Role |
|------|------|
| `feeCalculator.js` | Orchestrates: checks balance → picks token → calculates amounts |
| `feeConfig.js` | Reads config from DB (cached 60s). Defaults: 4 LCX total, 2/2 split |
| `lcxPrice.js` | Fetches LCX/USD from CoinGecko (cached 5 min). Fallback: $0.15 |

---

### 5.5 Blockchain Layer

**File**: `backend/lib/blockchain.js`

| Function | Description |
|----------|-------------|
| `getProvider(network)` | Create ethers.js `JsonRpcProvider` for a network |
| `verifyTransaction(txHash, amount, token, receiver, symbol, network)` | Verify an on-chain transfer (ERC-20 or native) |
| `executePayment(privateKey, transfers[], network)` | Execute multiple transfers on-chain (deprecated path) |
| `getTokenBalance(address, tokenAddress, provider)` | Query ERC-20 balance |

**Verification logic**:
1. Fetch transaction receipt from RPC
2. Check `receipt.status === 1` (success)
3. For ERC-20: parse `Transfer` event logs, validate amount + receiver
4. For native: check `tx.value` and `tx.to`
5. Return `{ valid, txHash, amount, blockNumber }`

---

### 5.6 AI Chat System (Grok)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         AI CHAT FLOW                                 │
│                                                                      │
│  User: "Create a 5 USDC payment link"                               │
│                                                                      │
│  ┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐  │
│  │ /api/chat   │──▶│ Load history │──▶│ Build system prompt      │  │
│  │             │   │ (last 10)    │   │ with agent context,      │  │
│  │             │   │              │   │ supported chains,        │  │
│  │             │   │              │   │ action schemas           │  │
│  └─────────────┘   └──────────────┘   └───────────┬──────────────┘  │
│                                                    │                 │
│                                                    ▼                 │
│                                       ┌──────────────────────────┐  │
│                                       │ Call Grok 3 Fast         │  │
│                                       │ (xAI API, JSON mode)     │  │
│                                       │ temp=0.3, max=1024       │  │
│                                       └───────────┬──────────────┘  │
│                                                    │                 │
│                                                    ▼                 │
│                                       ┌──────────────────────────┐  │
│  Grok returns:                        │ Parse JSON response      │  │
│  { action: "select_chain",            │ Route via intentRouter   │  │
│    amount: "5", token: "USDC" }       │                          │  │
│                                       └───────────┬──────────────┘  │
│                                                    │                 │
│                                                    ▼                 │
│  User: "sepolia"                      ┌──────────────────────────┐  │
│                                       │ intentRouter:            │  │
│  Grok returns:                        │  create_link handler     │  │
│  { action: "create_link",             │  → creates payment link  │  │
│    amount: "5", network: "sepolia",   │  → returns linkId        │  │
│    token: "USDC" }                    └──────────────────────────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Four components:**

| File | Role |
|------|------|
| `grokClient.js` | OpenAI-compatible client → xAI endpoint. Model: `grok-3-fast` |
| `systemPrompt.js` | Builds context-aware prompt with agent details, chains, action schemas |
| `intentRouter.js` | Maps AI actions to handlers: `create_link`, `select_chain`, `check_status`, `pay_link`, `register_wallet`, `list_payments`, `clarify` |
| `conversationMemory.js` | Chat history per agent. Supabase primary, in-memory fallback. Last 50 msgs |

---

### 5.7 Webhook System

```
┌──────────────────────────────────────────────────────────────────────┐
│                       WEBHOOK DELIVERY                               │
│                                                                      │
│  Event: payment.paid                                                 │
│                                                                      │
│  1. Find all webhooks subscribed to "payment.paid" for this agent   │
│  2. For each webhook:                                                │
│     ┌─────────────────────────────────────────────────────────────┐  │
│     │  Build payload:                                              │  │
│     │  { event, payment: { id, amount, token, status, txHash } }  │  │
│     │                                                              │  │
│     │  Sign: HMAC-SHA256(payload, webhook_secret)                  │  │
│     │                                                              │  │
│     │  POST → agent's URL                                          │  │
│     │  Headers:                                                    │  │
│     │    X-PayAgent-Event: payment.paid                            │  │
│     │    X-PayAgent-Signature: sha256=abc123...                    │  │
│     │    X-PayAgent-Delivery: unique-id                            │  │
│     │    X-PayAgent-Timestamp: ISO timestamp                       │  │
│     │                                                              │  │
│     │  Timeout: 15 seconds                                         │  │
│     │  Retry: 30s → 5min → 30min                                  │  │
│     │  Auto-deactivate after 5 consecutive failures                │  │
│     └─────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Events: payment.created, payment.paid, payment.expired              │
└──────────────────────────────────────────────────────────────────────┘
```

---

### 5.8 Database & Storage

**Primary**: Supabase (hosted PostgreSQL)
**Fallback**: In-memory storage (for serverless/testing)

The system automatically falls back to in-memory when `SUPABASE_URL` or `SUPABASE_ANON_KEY` is missing. This allows the backend to run in any environment without a database dependency.

| Table | Records |
|-------|---------|
| `agents` | Registered agents with hashed API keys |
| `payment_requests` | Payment links with status tracking |
| `fee_config` | Single-row fee configuration |
| `fee_transactions` | Fee audit trail |
| `webhooks` | Registered webhook URLs |
| `conversations` | AI chat history |

---

## 6. Frontend — React Dashboard

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND PAGES                                │
│                                                                      │
│  /               → Index.tsx          Dashboard, stats, recent links │
│  /login          → Login.tsx          Authentication                 │
│  /links          → PaymentLinks.tsx   All payment links              │
│  /pay/:id        → PaymentView.tsx    Payment page (402 flow)        │
│  /transactions   → Transactions.tsx   Transaction history            │
│  /wallets        → Wallets.tsx        Wallet management              │
│  /agents         → AgentsDashboard.tsx Agent management              │
│  /agent          → PayAsAgent.tsx     API documentation              │
│                                                                      │
│  Key Components:                                                     │
│  ├── CreateLinkModal.tsx   Multi-step wizard (5 steps)               │
│  │   Step 1: Amount + Token selection                                │
│  │   Step 2: Network selection (Ethereum, Base, Sepolia)             │
│  │   Step 3: Expiration (24h, 7d, 30d)                              │
│  │   Step 4: Details (wallet, description)                           │
│  │   Step 5: Generated link with copy button                        │
│  ├── PaymentLinkItem.tsx   Link card with status badge               │
│  ├── TransactionItem.tsx   Tx card with explorer link                │
│  ├── AppNavbar.tsx         Top navigation                            │
│  └── AppSidebar.tsx        Side navigation                           │
│                                                                      │
│  Wallet Integration:                                                 │
│  ├── wagmi (wallet state management)                                 │
│  ├── RainbowKit (connect modal)                                     │
│  └── viem (blockchain primitives)                                    │
└──────────────────────────────────────────────────────────────────────┘
```

The **`/agent` page** (`PayAsAgent.tsx`) serves as the primary API documentation, showing:
- Agent registration with cURL examples
- Payment link creation
- SDK installation + full implementation template
- Manual payment flow (pay-link → verify)
- AI chat interaction examples
- Webhook setup
- Fee model explanation
- Complete endpoint reference table
- Live npm badge linking to `@payagent/sdk`

---

## 7. SDK — @payagent/sdk (npm)

**Published**: `@payagent/sdk@0.1.0` on npm (public)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     @payagent/sdk INTERNALS                          │
│                                                                      │
│  const client = new PayAgentClient({                                │
│    apiKey: 'pk_live_...',                                           │
│    privateKey: '0x...',                                             │
│    baseUrl: 'https://backend-two-chi-56.vercel.app',               │
│    rpcUrl: { sepolia: '...' }   // optional                        │
│  });                                                                 │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │  client.payLink('REQ-ABC123')                                   │ │
│  │                                                                  │ │
│  │  Step 1: POST /api/pay-link { linkId }                          │ │
│  │          → receives transfer instructions                        │ │
│  │                                                                  │ │
│  │  Step 2: For each transfer:                                      │ │
│  │          - Native ETH → wallet.sendTransaction({ to, value })   │ │
│  │          - ERC-20 → contract.transfer(to, amount)               │ │
│  │          - Wait for receipt                                      │ │
│  │                                                                  │ │
│  │  Step 3: POST /api/verify { requestId, txHash, feeTxHash,       │ │
│  │          creatorRewardTxHash }                                   │ │
│  │          → server confirms on-chain, marks PAID                 │ │
│  │                                                                  │ │
│  │  Returns: { status: 'PAID', transactions: [...], payer, ... }   │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  Methods:                                                            │
│  ├── payLink(linkId)           → Full payment in one call           │
│  ├── createLink({...})         → Create payment link                │
│  ├── getInstructions(linkId)   → Fetch instructions only            │
│  ├── verifyPayment(id, tx...)  → Verify by tx hash                 │
│  ├── getChains()               → List supported chains              │
│  └── .address                  → Wallet address (getter)            │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 8. Payment Flow (End-to-End)

```
┌────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE PAYMENT FLOW                                 │
│                                                                            │
│  CREATOR AGENT                    PAYAGENT API                   PAYER     │
│  ─────────────                    ────────────                   ─────     │
│                                                                            │
│  1. Register                                                               │
│  POST /api/agents/register  ────▶ Create agent record                     │
│                              ◀──── { agent_id, api_key, webhook_secret }  │
│                                                                            │
│  2. Create Link                                                            │
│  POST /api/create-link      ────▶ Validate network + token                │
│  { amount: "10",                   Create payment_request                  │
│    network: "sepolia",             Dispatch payment.created webhook        │
│    token: "USDC" }           ◀──── { linkId: "REQ-ABC123" }              │
│                                                                            │
│  ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
│                                                                            │
│  3. Payer gets instructions                                     PAYER SDK  │
│                                    POST /api/pay-link  ◀─────── payLink() │
│                                    { linkId }                              │
│                                    Calculate fees (LCX balance check)      │
│                                    Return 3 transfers:                     │
│                                    - Payment → Creator wallet              │
│                                    - Fee → Treasury wallet                 │
│                                    - Reward → Creator wallet               │
│                                                        ────────▶           │
│                                                                            │
│  4. Payer signs & broadcasts                                    PAYER SDK  │
│                                                                            │
│                                    BLOCKCHAIN                              │
│                                    ──────────                              │
│                              ◀──── tx1: 10 USDC → Creator     ◀─── sign  │
│                              ◀──── tx2: 2 LCX → Treasury      ◀─── sign  │
│                              ◀──── tx3: 2 LCX → Creator       ◀─── sign  │
│                                                                            │
│  5. Payer verifies                                              PAYER SDK  │
│                                    POST /api/verify    ◀─────── verify()  │
│                                    { requestId, txHash,                    │
│                                      feeTxHash,                            │
│                                      creatorRewardTxHash }                 │
│                                    Verify on-chain                         │
│                                    Mark PAID                               │
│                                    Record fee_transaction                  │
│                                    Dispatch payment.paid webhook           │
│                                                        ────────▶           │
│                                                                            │
│  6. Creator receives webhook                                               │
│  ◀──── POST creator's URL ◀──── Webhook: payment.paid                    │
│         X-PayAgent-Signature: sha256=...                                   │
│                                                                            │
│  ══════════════════════════════════════════════════════════════════════════ │
│  RESULT: Creator got 10 USDC + 2 LCX reward. Platform got 2 LCX fee.     │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 9. Database Schema

```sql
-- 6 tables, 13 indexes, 2 helper functions, 1 trigger

agents
├── id (PK)                 -- "agent_my-agent_a1b2c3"
├── username (UNIQUE)
├── email
├── api_key_hash            -- bcrypt hash
├── api_key_prefix          -- first 12 chars (fast lookup index)
├── webhook_secret_hash     -- bcrypt hash
├── wallet_address
├── chain                   -- default 'sepolia'
├── status                  -- 'active' | 'inactive' | 'suspended'
├── created_at
├── last_active_at
├── total_payments_sent
├── total_payments_received
└── total_fees_paid

payment_requests
├── id (PK)                 -- "REQ-XXXXXXXXX"
├── token                   -- 'USDC', 'USDT', 'ETH', 'LCX'
├── amount
├── receiver                -- creator wallet
├── payer                   -- payer wallet (set on payment)
├── description
├── network                 -- 'sepolia', 'ethereum', 'base'
├── status                  -- 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED'
├── created_at
├── expires_at
├── tx_hash                 -- set on verification
├── paid_at
├── creator_wallet
├── creator_agent_id (FK)
├── payer_agent_id (FK)
└── updated_at              -- auto-trigger

fee_config (single row)
├── id = 'default'
├── lcx_fee_amount = 4.00
├── lcx_platform_share = 2.00
├── lcx_creator_reward = 2.00
├── lcx_contract_address
├── treasury_wallet
└── price_cache_ttl_sec = 300

fee_transactions
├── id (PK)
├── payment_request_id (FK)
├── payer_agent_id (FK)
├── creator_agent_id (FK)
├── fee_token               -- 'LCX' or 'USDC'
├── fee_total
├── platform_share
├── creator_reward
├── lcx_price_usd
├── payment_amount
├── payment_token
├── treasury_wallet
├── platform_fee_tx_hash
├── creator_reward_tx_hash
├── payment_tx_hash
├── status                  -- 'PENDING' | 'COLLECTED' | 'FAILED'
└── created_at

webhooks
├── id (PK)
├── agent_id (FK)
├── url
├── secret
├── events[]                -- ['payment.paid', 'payment.created']
├── active
├── failure_count
├── last_failure_at
├── last_success_at
└── created_at

conversations
├── id (PK)
├── agent_id (FK)
├── role                    -- 'system' | 'user' | 'assistant'
├── content
└── created_at
```

---

## 10. Deployment

### Backend (Vercel Serverless)

```json
// backend/vercel.json
{
  "builds": [{ "src": "api/index.js", "use": "@vercel/node" }],
  "rewrites": [{ "source": "/(.*)", "destination": "/api" }]
}
```

All routes are handled by a single serverless function (`api/index.js`). The rewrite catches all paths and routes them to Express.

### Environment Variables Required

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `XAI_API_KEY` | xAI Grok API key |
| `SEPOLIA_RPC_URL` | Sepolia RPC (Infura) |
| `ETH_MAINNET_RPC_URL` | Ethereum mainnet RPC |
| `BASE_MAINNET_RPC_URL` | Base mainnet RPC |
| `PLATFORM_TREASURY_WALLET` | Treasury wallet for fee collection |
| `LCX_CONTRACT_ADDRESS` | LCX token address (Sepolia) |

### Frontend (Vite Build)

Standard Vite build, deployable on Vercel/Netlify. Uses `VITE_API_URL` to point at the backend.

---

## 11. Testing

### Backend Test Suite (`backend/test.js`)

**100 tests** across 1,089 lines using Node.js built-in test runner (`node:test`).

| Category | Tests | What's Covered |
|----------|-------|----------------|
| Chain Registry | ~20 | Network resolution, aliases, token addresses, decimals, RPC URLs, explorer URLs, native token detection |
| Agent Registration | ~10 | Registration flow, duplicate rejection, input validation |
| Auth Middleware | ~8 | API key validation, missing key, invalid key, bearer format |
| Link Creation | ~15 | Multi-chain creation, token validation, network validation, alias resolution |
| Payment Flow | ~20 | Pay-link instructions, fee calculation, verification, double-pay prevention |
| Execute Payment (Deprecated) | ~8 | Deprecation headers, missing fields, error handling |
| Webhooks | ~8 | Registration, listing, test delivery |
| Stats & Misc | ~11 | Platform stats, health check, edge cases |

**Test Infrastructure:**
- Forces in-memory mode (no Supabase dependency)
- Spins up Express server on random port
- Custom HTTP helper for API calls
- `--test-force-exit` to prevent hangs from ethers.js providers

### SDK Test Suite (`sdk/test/client.test.js`)

**30 tests** using Node.js built-in test runner.

| Category | What's Covered |
|----------|----------------|
| Constructor | Validation (missing apiKey, missing privateKey) |
| getInstructions | API call, response parsing |
| createLink | Payload construction, response handling |
| verifyPayment | Multiple tx hashes, error handling |
| getChains | API call |
| payLink | Full flow (mock: fetch → sign → broadcast → verify) |
| Error handling | API errors, non-JSON responses |

---

## 12. Security Model

| Aspect | Implementation |
|--------|---------------|
| API Keys | `pk_live_` prefixed, bcrypt-hashed, prefix-indexed lookup |
| Webhook Secrets | `whsec_` prefixed, bcrypt-hashed, HMAC-SHA256 signatures |
| SDK Signing | Transactions signed locally with ethers.js |
| CORS | Open (`*`) for API access |
| Input Validation | Wallet address format (0x + 40 hex), network validation, amount > 0 |
| Rate Limiting | Not yet implemented (pending) |
| Agent Status | Active/inactive/suspended status checks |

---

## 13. What Has Been Built (Chronological)

### Phase 1: Core Platform
- Express.js backend with REST API
- Supabase database schema (6 tables)
- Agent registration with API key generation
- Payment link creation and management
- Frontend React dashboard with wallet connection (wagmi + RainbowKit)
- Multi-step link creation modal

### Phase 2: Blockchain Integration
- On-chain payment execution (ethers.js)
- Transaction verification (ERC-20 + native)
- Fee calculation engine (LCX balance check → LCX or USDC fees)
- LCX price oracle (CoinGecko with caching)
- HTTP 402 Payment Required protocol

### Phase 3: Multi-Chain Support
- Chain registry module (single source of truth)
- Added Ethereum Mainnet + Base Mainnet alongside Sepolia
- Official USDC, USDT, LCX token addresses per chain
- Network alias resolution
- Network-aware fee calculation

### Phase 4: AI Chat System
- Grok 3 Fast integration (xAI API)
- System prompt builder with agent context
- Intent router (7 action types)
- Conversation memory (Supabase + in-memory)
- Chain-aware link creation via natural language

### Phase 5: Webhook System
- Webhook registration and management
- HMAC-SHA256 signed deliveries
- Retry logic (3 attempts with backoff)
- Auto-deactivation after 5 failures
- Test webhook endpoint

### Phase 6: Security & SDK
- Identified security concern with private key transmission
- Designed and implemented `@payagent/sdk` for local signing
- SDK handles: fetch instructions → sign locally → broadcast → verify
- Deprecated `execute-payment` endpoint (with headers + migration message)
- Published `@payagent/sdk@0.1.0` to npm

### Phase 7: Documentation & Polish
- Comprehensive `/agent` page with SDK implementation template
- Live npm badge
- Backend README with full API reference
- SDK README with examples
- Brand rename from PayMe → PayAgent
- SEO meta tags (title, description, Open Graph)
- 100 backend tests + 30 SDK tests
- This development document

### Verified E2E Payment (Sepolia)
```
Link:       REQ-I5Y3G7LOK (0.001 USDC)
Payment tx: 0x0aff311d6c009a2d86c3781ac21a0a8f628d80e78dbc2b3759d7a7fdea20596e
Fee tx:     0x7303699845d24f7d117b7476d41e73a0c5a3f4308e718943216bc195d8472255
Reward tx:  0x434d5534502e152a51b8af9c15c5b0e80a2caa3858269839d27bf0dcf02a6c2a
Status:     PAID ✓
```

---

## 14. What's Pending

### SEO & Meta
- [ ] Open Graph image, `og:url`, `og:site_name`
- [ ] Twitter card meta tags
- [ ] Canonical link, favicon, theme-color
- [ ] `robots.txt`, `sitemap.xml`
- [ ] JSON-LD structured data

### Features (Next Phase)
- [ ] Invoice generation and payment via invoice link
- [ ] Recurring payments / subscriptions
- [ ] Escrow and multi-party payments
- [ ] Cross-chain / bridge support
- [ ] Batch payments
- [ ] Gasless meta-transactions
- [ ] Rate limiting

### Integrations
- [ ] Fiat on/off-ramp (Stripe, bank transfers)
- [ ] Plugin for Cursor, OpenAI GPTs, LangChain
- [ ] Telegram / Discord bot
- [ ] Zapier integration
- [ ] Shopify / WooCommerce plugin

### SDK Improvements
- [ ] TypeScript type definitions (`.d.ts`)
- [ ] ESM support alongside CommonJS
- [ ] Python SDK
- [ ] Browser/frontend SDK variant

---

*End of document.*
