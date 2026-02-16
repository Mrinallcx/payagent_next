# PayAgent - Technical Architecture & System Design Document

**Version:** 2.0
**Last Updated:** February 2026
**Audience:** CEO, CTO, Engineering Leads, Senior Developers
**Classification:** Internal - Confidential

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [High-Level System Design](#3-high-level-system-design)
4. [Component Deep-Dive](#4-component-deep-dive)
5. [Authentication & Security Architecture](#5-authentication--security-architecture)
6. [Payment Flow — Complete Lifecycle](#6-payment-flow--complete-lifecycle)
7. [Fee Engine Architecture](#7-fee-engine-architecture)
8. [Blockchain Integration Layer](#8-blockchain-integration-layer)
9. [Webhook & Event System](#9-webhook--event-system)
10. [Database Schema & Data Model](#10-database-schema--data-model)
11. [SDK Architecture](#11-sdk-architecture)
12. [Frontend Architecture](#12-frontend-architecture)
13. [Agent Onboarding Pipeline](#13-agent-onboarding-pipeline)
14. [Monitoring, Logging & Anomaly Detection](#14-monitoring-logging--anomaly-detection)
15. [Deployment Architecture](#15-deployment-architecture)
16. [Supported Chains & Tokens](#16-supported-chains--tokens)
17. [API Reference Summary](#17-api-reference-summary)
18. [Design Decisions & Trade-offs](#18-design-decisions--trade-offs)
19. [Scalability Roadmap](#19-scalability-roadmap)

---

## 1. Executive Summary

**PayAgent** is a **non-custodial crypto payment platform** designed for both AI agents and human users. It enables anyone to create payment links, collect payments in USDC/USDT/ETH/LCX across multiple EVM chains, and receive real-time webhook notifications — all without the platform ever holding user funds.

### Key Architectural Principles

| Principle | Implementation |
|-----------|---------------|
| **Non-custodial** | Platform never holds private keys or funds. All transactions signed client-side. |
| **Multi-chain** | Supports Ethereum, Base, and Sepolia (testnet) with unified API |
| **Dual-audience** | Serves both AI agents (via SDK + HMAC auth) and humans (via browser + wallet auth) |
| **LCX-incentivized** | Fee structure rewards LCX token holders with lower fees |
| **Event-driven** | Real-time webhooks for payment lifecycle events |
| **Audit-complete** | Every API call logged with IP tracking and anomaly detection |

### Tech Stack

```
Frontend:   React 18 + Vite + TailwindCSS + RainbowKit (wallet UI)
Backend:    Express 5 (Vercel Serverless Functions)
Database:   Supabase (PostgreSQL)
Blockchain: ethers.js v6 (EVM interaction)
SDK:        @payagent/sdk (npm, Node.js)
Auth:       HMAC-SHA256 (agents) + JWT (dashboard) + EIP-191 (wallet)
Encryption: AES-256-GCM (secrets at rest)
```

---

## 2. System Architecture Overview

```
+------------------------------------------------------------------+
|                        PAYAGENT PLATFORM                          |
+------------------------------------------------------------------+
|                                                                    |
|  +-----------+     +-----------+     +-------------+              |
|  |  Frontend |     |    SDK    |     | Third-Party |              |
|  |  (React)  |     | (Node.js)|     |   Agents    |              |
|  +-----+-----+     +-----+-----+     +------+------+             |
|        |                  |                   |                    |
|        | JWT Auth         | HMAC Auth         | HMAC Auth         |
|        |                  |                   |                    |
|  +-----v------------------v-------------------v------+            |
|  |              API GATEWAY (Express)                |            |
|  |  +------------+ +----------+ +-----------+        |            |
|  |  | Rate Limit | | CORS     | | Req Logger|        |            |
|  |  +------------+ +----------+ +-----------+        |            |
|  +-------------------+---+---+---+-------------------+            |
|                      |   |   |   |                                |
|          +-----------+   |   |   +-----------+                    |
|          v               v   v               v                    |
|  +-------+----+  +------+---+---+  +--------+-----+              |
|  |   Agent    |  |   Payment    |  |   Webhook    |              |
|  |   Module   |  |   Module     |  |   Module     |              |
|  +-------+----+  +------+---+---+  +--------+-----+              |
|          |               |   |               |                    |
|          v               |   v               v                    |
|  +-------+----+          |  ++-------+  +----+-------+            |
|  |   Auth     |          |  |  Fee   |  |  Webhook   |            |
|  |   Layer    |          |  | Engine |  | Dispatcher |            |
|  | HMAC + JWT |          |  +---+----+  +----+-------+            |
|  +-------+----+          |      |            |                    |
|          |               |      v            v                    |
|          |               |  +---+----+  +----+-------+            |
|          |               |  |  Price |  |  External  |            |
|          |               |  |  Feed  |  |  Webhook   |            |
|          |               |  |CoinGeko|  |  Endpoints |            |
|          |               |  +--------+  +------------+            |
|          |               |                                        |
|  +-------v---------------v---+     +------------------+           |
|  |     Supabase (PostgreSQL) |     |   EVM Chains     |           |
|  |  +--------+ +----------+  |     | +------+------+  |           |
|  |  | Agents | | Payments |  |     | |Sepolia|Base  |  |           |
|  |  +--------+ +----------+  |     | +------+------+  |           |
|  |  +--------+ +----------+  |     | |  Ethereum   |  |           |
|  |  |  Fees  | | Webhooks |  |     | +-------------+  |           |
|  |  +--------+ +----------+  |     +------------------+           |
|  |  +--------+ +----------+  |                                    |
|  |  |  Logs  | | IP Hist  |  |                                    |
|  |  +--------+ +----------+  |                                    |
|  +----------------------------+                                   |
+------------------------------------------------------------------+
```

---

## 3. High-Level System Design

### 3.1 Request Flow Architecture

```
                              INTERNET
                                 |
                    +------------v------------+
                    |    Vercel Edge Network   |
                    |    (CDN + SSL + Routing) |
                    +------------+------------+
                                 |
                    +------------v------------+
                    |   Express.js Serverless  |
                    +------------+------------+
                                 |
              +------------------+------------------+
              |                  |                   |
    +---------v-------+  +------v--------+  +-------v--------+
    | Middleware Stack |  | Route Handler |  | Error Handler  |
    |                 |  |               |  |                |
    | 1. CORS Filter  |  | /api/create   |  | Catch-all 500  |
    | 2. Body Parser  |  | /api/verify   |  | Structured JSON|
    | 3. Rate Limiter |  | /api/agents/* |  +----------------+
    | 4. Req Logger   |  | /api/webhooks |
    | 5. Auth (opt)   |  | /api/auth/*   |
    +-----------------+  +---------------+
```

### 3.2 Data Flow — Payment Creation to Completion

```
  CREATOR                    PAYAGENT                    PAYER
  (Agent/User)               (Platform)                  (Agent/User)
      |                          |                          |
      |  1. Create Payment Link  |                          |
      |------------------------->|                          |
      |                          |                          |
      |  { linkId, payUrl }      |                          |
      |<-------------------------|                          |
      |                          |                          |
      |      Share link          |                          |
      |---------------------------------------------->      |
      |                          |                          |
      |                          |  2. Open Link / Get Info |
      |                          |<-------------------------|
      |                          |                          |
      |                          |  3. Calculate Fees       |
      |                          |<-------------------------|
      |                          |                          |
      |                          |  { transfers[] }         |
      |                          |------------------------->|
      |                          |                          |
      |                          |  4. Sign & Broadcast     |
      |                          |          (CLIENT-SIDE)   |
      |                          |                    +-----+-----+
      |                          |                    | Wallet    |
      |                          |                    | Signs Tx  |
      |                          |                    +-----------+
      |                          |                          |
      |                          |                    +-----+-----+
      |                          |                    | Broadcast |
      |                          |                    | to Chain  |
      |                          |                    +-----------+
      |                          |                          |
      |                          |  5. Verify Tx Hash       |
      |                          |<-------------------------|
      |                          |                          |
      |                    +-----+-----+                    |
      |                    | Verify on |                    |
      |                    | Blockchain|                    |
      |                    +-----------+                    |
      |                          |                          |
      |                    +-----+-----+                    |
      |                    | Mark PAID |                    |
      |                    | Record Fee|                    |
      |                    +-----------+                    |
      |                          |                          |
      |  6. Webhook: payment.paid|                          |
      |<-------------------------|                          |
      |                          |  6. Webhook: payment.paid|
      |                          |------------------------->|
      |                          |                          |
```

---

## 4. Component Deep-Dive

### 4.1 Backend Module Dependency Graph

```
                     api/index.js
                    (Main Router)
                         |
        +----------------+------------------+
        |                |                  |
   middleware/       lib/agents.js      lib/webhooks.js
        |                |                  |
   +----+----+      +----+----+        +----+----+
   |auth.js  |      |crypto.js|        |webhook  |
   |walletAuth|     |         |        |Dispatcher|
   |rateLimit|      +----+----+        +----+----+
   |reqLogger|           |                  |
   +----+----+      +----+----+             |
        |           |supabase |        External
        +---------->|  .js    |<-------Webhook
                    +----+----+        Endpoints
                         |
                    +----+----+
                    |store.js |
                    |(fallback)|
                    +---------+

   lib/blockchain.js <----> EVM RPC Nodes
        |
   lib/chainRegistry.js (chain configs)
        |
   lib/feeCalculator.js
        |
   +----+----+
   |feeConfig|
   |lcxPrice |
   +---------+
```

### 4.2 Module Responsibility Matrix

| Module | Responsibility | Dependencies | State |
|--------|---------------|-------------|-------|
| `api/index.js` | Route definitions, request handling | All modules | Stateless |
| `lib/agents.js` | Agent CRUD, credential generation | crypto, supabase | DB-backed |
| `lib/blockchain.js` | Tx verification, balance checks | chainRegistry, ethers | Stateless |
| `lib/chainRegistry.js` | Chain/token/RPC configuration | Environment vars | Static config |
| `lib/crypto.js` | AES-256-GCM, HMAC-SHA256, timing-safe | Node crypto | Stateless |
| `lib/feeCalculator.js` | Dynamic fee computation | feeConfig, lcxPrice, chainRegistry | Cached |
| `lib/feeConfig.js` | Platform fee parameters | supabase | 1-min cache |
| `lib/lcxPrice.js` | Token price feeds | CoinGecko API | 5-min cache |
| `lib/webhooks.js` | Webhook CRUD | supabase | DB-backed |
| `lib/webhookDispatcher.js` | Event delivery + retries | webhooks | Fire-and-forget |
| `lib/xVerification.js` | Twitter/X tweet verification | HTTP fetch | Stateless |
| `lib/ipMonitor.js` | IP anomaly detection | supabase | DB-backed |
| `lib/apiLogs.js` | Request audit trail | supabase | Async write |
| `middleware/auth.js` | Dual-mode auth (HMAC + JWT) | agents, crypto | Stateless |
| `middleware/walletAuth.js` | EIP-191 wallet login | ethers, supabase | Nonce-based |
| `middleware/rateLimit.js` | Request throttling | express-rate-limit | In-memory |

---

## 5. Authentication & Security Architecture

### 5.1 Three Authentication Paths

```
+-------------------------------------------------------------------+
|                   AUTHENTICATION ARCHITECTURE                      |
+-------------------------------------------------------------------+
|                                                                     |
|  PATH A: HMAC-SHA256              PATH B: JWT                      |
|  (SDK / AI Agents / curl)         (Browser Dashboard)              |
|                                                                     |
|  +-------------------+           +-------------------+             |
|  | x-api-key-id      |           | Authorization:    |             |
|  | x-timestamp       |           | Bearer eyJ...     |             |
|  | x-signature       |           +--------+----------+             |
|  +--------+----------+                    |                        |
|           |                               |                        |
|  +--------v----------+           +--------v----------+             |
|  | 1. Lookup agent   |           | 1. Verify JWT     |             |
|  |    by key_id      |           |    signature      |             |
|  | 2. Check expiry   |           | 2. Extract wallet |             |
|  | 3. Decrypt secret |           | 3. Lookup agent   |             |
|  |    (AES-256-GCM)  |           |    by wallet      |             |
|  | 4. Build string   |           | 4. Check status   |             |
|  |    to sign        |           +--------+----------+             |
|  | 5. HMAC-SHA256    |                    |                        |
|  | 6. Constant-time  |                    |                        |
|  |    compare        |                    |                        |
|  +--------+----------+                    |                        |
|           |                               |                        |
|  +--------v-------------------------------v----------+             |
|  |              req.agent = { id, wallet, ... }      |             |
|  +---------------------------------------------------+             |
|                                                                     |
|  PATH C: Wallet Signature (Login Flow)                             |
|                                                                     |
|  +------------------+    +------------------+                      |
|  | 1. Challenge     |    | 2. Verify        |                     |
|  | POST /auth/      |--->| POST /auth/      |                     |
|  |   challenge      |    |   verify         |                     |
|  |                  |    |                  |                      |
|  | Generate nonce   |    | Recover signer   |                     |
|  | Store in DB      |    | from EIP-191 sig |                     |
|  | 5-min expiry     |    | Match wallet     |                     |
|  | One-time use     |    | Issue JWT (1hr)  |                     |
|  +------------------+    +------------------+                      |
+-------------------------------------------------------------------+
```

### 5.2 HMAC Signature Construction

```
String to Sign:
  ┌─────────────────────────────────┐
  │ {unix_timestamp}                │  ← Replay protection (5-min window)
  │ \n                              │
  │ {HTTP_METHOD}                   │  ← GET, POST, DELETE, etc.
  │ \n                              │
  │ {path}                          │  ← /api/create-link (no query string)
  │ \n                              │
  │ {SHA256(request_body)}          │  ← Body integrity check
  └─────────────────────────────────┘
                  |
                  v
  HMAC-SHA256(api_secret, string_to_sign)
                  |
                  v
  ┌─────────────────────────────────┐
  │ x-signature: a1b2c3d4e5f6...   │  ← Sent in request header
  └─────────────────────────────────┘
```

### 5.3 Encryption at Rest

```
API Secret Storage:

  sk_live_abc123...  (plaintext, shown once to user)
         |
         v
  ┌──────────────────┐
  │  AES-256-GCM     │
  │  Key: ENV var     │  ← HMAC_ENCRYPTION_KEY (32 bytes)
  │  IV: 16 random   │  ← Unique per encryption
  │  Auth Tag: 16    │  ← Integrity verification
  └──────────────────┘
         |
         v
  {iv_hex}:{ciphertext_hex}:{authTag_hex}  (stored in DB)
         |
         v
  Only decrypted during HMAC signature verification
```

### 5.4 Security Layer Stack

```
  REQUEST ARRIVES
       |
  [1. TLS Termination]     ← Vercel Edge (HTTPS enforced)
       |
  [2. CORS Validation]     ← Whitelist: api.payagent.co + env
       |
  [3. Security Headers]    ← HSTS, X-Frame-Options, nosniff, Referrer-Policy
       |
  [4. Body Size Limit]     ← 50KB max (prevents memory exhaustion)
       |
  [5. Rate Limiting]       ← 100/min global, 30/min sensitive endpoints
       |
  [6. Authentication]      ← HMAC or JWT (constant-time comparison)
       |
  [7. Agent Status Check]  ← Active? Not deleted? Not suspended?
       |
  [8. Input Validation]    ← Wallet format, network whitelist, amount checks
       |
  [9. Business Logic]      ← Route handler
       |
  [10. Audit Logging]      ← Async: IP, agent, endpoint, status, timing
       |
  [11. IP Anomaly Check]   ← Background: unique IP count per 24h
       |
  RESPONSE SENT
```

---

## 6. Payment Flow — Complete Lifecycle

### 6.1 Payment States

```
  ┌─────────┐     Create      ┌─────────┐
  │  (none) │ ───────────────> │ PENDING │
  └─────────┘                  └────+────┘
                                    |
                    +---------------+---------------+
                    |               |               |
              Verified &       Expired         Cancelled
              On-chain          (TTL)          (Creator)
                    |               |               |
               +----v----+    +----v----+    +-----v-----+
               │  PAID   │    │ EXPIRED │    │ CANCELLED │
               └─────────┘    └─────────┘    └───────────┘
                    |
              Webhook dispatched
              Fee recorded
              Counters updated
```

### 6.2 Payment Creation (Detailed)

```
  Creator (Agent or Browser User)
       |
       | POST /api/create-link (authenticated)
       | or POST /api/create (optional auth)
       |
       v
  ┌──────────────────────────────────┐
  │ VALIDATE INPUT                    │
  │                                   │
  │ - amount: must be positive number │
  │ - network: must resolve via       │
  │   chainRegistry (strict match)    │
  │ - token: USDC|USDT|ETH|LCX       │
  │ - receiver: valid 0x address      │
  │   (or agent's own wallet)         │
  │ - description: optional string    │
  │ - expiresIn: optional (minutes)   │
  └──────────────┬───────────────────┘
                 |
                 v
  ┌──────────────────────────────────┐
  │ GENERATE PAYMENT REQUEST          │
  │                                   │
  │ id: REQ-{random9}                 │
  │ status: PENDING                   │
  │ created_at: NOW()                 │
  │ expires_at: NOW() + expiresIn     │
  │ creator_agent_id: agent.id        │
  │ creator_wallet: agent.wallet      │
  └──────────────┬───────────────────┘
                 |
                 v
  ┌──────────────────────────────────┐
  │ INSERT INTO payment_requests      │
  │ DISPATCH webhook: payment.created │
  └──────────────┬───────────────────┘
                 |
                 v
  ┌──────────────────────────────────┐
  │ RETURN                            │
  │ { success: true,                  │
  │   request: {                      │
  │     id: "REQ-ABC123",             │
  │     link: "/r/REQ-ABC123",        │
  │     amount: "10",                 │
  │     token: "USDC",               │
  │     network: "sepolia",           │
  │     status: "PENDING" } }         │
  └──────────────────────────────────┘
```

### 6.3 Payment Execution & Verification (Detailed)

```
  Payer (SDK or Browser)
       |
       | POST /api/pay-link { linkId }     (SDK flow)
       | GET /api/request/:id/fee?payer=   (Browser flow)
       |
       v
  ┌──────────────────────────────────────────┐
  │ FEE CALCULATION ENGINE                    │
  │                                           │
  │ 1. Check payer's LCX balance on-chain     │
  │    via ethers.Contract.balanceOf()        │
  │                                           │
  │ 2. IF balance >= 4 LCX:                   │
  │    ┌─────────────────────────────┐        │
  │    │ Fee: 4 LCX total            │        │
  │    │ - 2 LCX → Platform Treasury │        │
  │    │ - 2 LCX → Payment Creator   │        │
  │    │ Creator gets FULL payment   │        │
  │    └─────────────────────────────┘        │
  │                                           │
  │ 3. IF balance < 4 LCX:                    │
  │    ┌─────────────────────────────┐        │
  │    │ Fee deducted from payment   │        │
  │    │ Fetch LCX price (CoinGecko) │        │
  │    │ Convert: 4 LCX * $price     │        │
  │    │ - USDC: fee ≈ $0.60        │        │
  │    │ - ETH: fee = $0.60/ethPrice │        │
  │    │ Creator gets amount - fee   │        │
  │    └─────────────────────────────┘        │
  └──────────────────┬───────────────────────┘
                     |
                     v
  ┌──────────────────────────────────────────┐
  │ RETURN TRANSFER INSTRUCTIONS              │
  │                                           │
  │ transfers: [                              │
  │   { "Payment to creator"                  │
  │     token: USDC, to: 0xCreator,           │
  │     amount: "9.40" },                     │
  │   { "Platform fee"                        │
  │     token: USDC, to: 0xTreasury,          │
  │     amount: "0.30" },                     │
  │   { "Creator reward"                      │
  │     token: USDC, to: 0xCreator,           │
  │     amount: "0.30" }                      │
  │ ]                                         │
  └──────────────────┬───────────────────────┘
                     |
                     v
  ┌──────────────────────────────────────────┐
  │ CLIENT-SIDE SIGNING (Non-Custodial)       │
  │                                           │
  │ For each transfer:                        │
  │   if native (ETH):                        │
  │     wallet.sendTransaction({to, value})   │
  │   if ERC20:                               │
  │     contract.transfer(to, amount)         │
  │                                           │
  │ Wait for all receipts                     │
  └──────────────────┬───────────────────────┘
                     |
                     v
  ┌──────────────────────────────────────────┐
  │ POST /api/verify                          │
  │ { requestId, txHash, feeTxHash }          │
  │                                           │
  │ Backend Verification:                     │
  │ 1. Fetch receipt from blockchain RPC      │
  │ 2. Check receipt.status === 1             │
  │ 3. Parse Transfer event logs              │
  │ 4. Verify amount >= expected              │
  │ 5. Verify receiver matches               │
  │ 6. Mark payment_request → PAID            │
  │ 7. Record fee_transactions entry          │
  │ 8. Increment agent counters (RPC)         │
  │ 9. Dispatch webhook: payment.paid         │
  └──────────────────────────────────────────┘
```

---

## 7. Fee Engine Architecture

### 7.1 Fee Decision Tree

```
                    Payer initiates payment
                           |
                           v
                ┌─────────────────────┐
                │ Check payer's LCX   │
                │ balance on-chain    │
                │ (correct network)   │
                └──────────┬──────────┘
                           |
                  ┌────────+────────┐
                  |                 |
           >= 4 LCX            < 4 LCX
                  |                 |
                  v                 v
         ┌───────────────┐  ┌────────────────────────┐
         │ LCX FEE PATH  │  │ PAYMENT TOKEN FEE PATH │
         │               │  │                        │
         │ Fee: 4 LCX    │  │ Fetch LCX price (API)  │
         │ Platform: 2   │  │                        │
         │ Creator: 2    │  │    ┌──────┬──────┐     │
         │               │  │    │USDC/ │ ETH  │     │
         │ Creator gets  │  │    │USDT  │      │     │
         │ FULL payment  │  │    │      │      │     │
         │               │  │ $0.60│ $0.60/│     │
         │ Deducted: NO  │  │ USDC │ ETH$  │     │
         └───────────────┘  │    │      │      │     │
                            │    └──────┴──────┘     │
                            │                        │
                            │ Creator gets:          │
                            │ payment - fee          │
                            │                        │
                            │ Deducted: YES          │
                            └────────────────────────┘
```

### 7.2 Fee Distribution Model

```
  SCENARIO A: Payer holds LCX (>= 4 LCX)
  ┌─────────────────────────────────────────────────┐
  │                                                   │
  │  10 USDC Payment                                  │
  │  ┌────────────────────────────────┐               │
  │  │ Transfer 1: 10 USDC → Creator │  (full amount)│
  │  └────────────────────────────────┘               │
  │  ┌────────────────────────────────┐               │
  │  │ Transfer 2: 2 LCX → Treasury  │  (platform)   │
  │  └────────────────────────────────┘               │
  │  ┌────────────────────────────────┐               │
  │  │ Transfer 3: 2 LCX → Creator   │  (reward)     │
  │  └────────────────────────────────┘               │
  └─────────────────────────────────────────────────┘

  SCENARIO B: Payer does NOT hold LCX
  ┌─────────────────────────────────────────────────┐
  │                                                   │
  │  10 USDC Payment (fee ≈ $0.60 USDC)              │
  │  ┌────────────────────────────────┐               │
  │  │ Transfer 1: 9.40 USDC → Creator│ (minus fee)  │
  │  └────────────────────────────────┘               │
  │  ┌────────────────────────────────┐               │
  │  │ Transfer 2: 0.30 USDC → Treasury│ (platform)  │
  │  └────────────────────────────────┘               │
  │  ┌────────────────────────────────┐               │
  │  │ Transfer 3: 0.30 USDC → Creator│ (reward)     │
  │  └────────────────────────────────┘               │
  └─────────────────────────────────────────────────┘
```

### 7.3 Price Feed Architecture

```
  ┌─────────────┐        ┌──────────────┐
  │ CoinGecko   │ ------>│ In-Memory    │
  │ API         │        │ Cache        │
  │             │        │              │
  │ LCX/USD    │        │ TTL: 5 min   │
  │ ETH/USD    │        │ Stale: serve │
  └─────────────┘        │ if API down  │
                         └──────┬───────┘
                                |
                    ┌───────────+───────────┐
                    |                       |
              Cache HIT                Cache MISS
              (< 5 min)               (>= 5 min)
                    |                       |
              Return cached          Fetch from API
              price instantly        Update cache
                    |                Return fresh
                    v                       |
              ┌─────────────┐               v
              │ Fee Calc    │         ┌─────────────┐
              │ uses price  │         │ Fee Calc    │
              └─────────────┘         │ uses price  │
                                      └─────────────┘

  FALLBACK (API completely down, no cache):
    LCX: $0.15 (hardcoded)
    ETH: $2500 (hardcoded)
```

---

## 8. Blockchain Integration Layer

### 8.1 Multi-Chain Support Architecture

```
  ┌─────────────────────────────────────────────┐
  │              CHAIN REGISTRY                  │
  │         (Single Source of Truth)              │
  │                                               │
  │  ┌───────────┐  ┌───────────┐  ┌──────────┐ │
  │  │  SEPOLIA   │  │ ETHEREUM  │  │   BASE   │ │
  │  │ (Testnet)  │  │ (Mainnet) │  │(Mainnet) │ │
  │  │           │  │           │  │          │ │
  │  │ Chain: 11M│  │ Chain: 1  │  │Chain:8453│ │
  │  │           │  │           │  │          │ │
  │  │ USDC: 0x..│  │ USDC: 0x..│  │USDC: 0x..│ │
  │  │ USDT: 0x..│  │ USDT: 0x..│  │USDT: 0x..│ │
  │  │ LCX:  0x..│  │ LCX:  0x..│  │LCX:  0x..│ │
  │  │ ETH:native│  │ ETH:native│  │ETH:native│ │
  │  │           │  │           │  │          │ │
  │  │ RPC: env  │  │ RPC: env  │  │RPC: env  │ │
  │  └───────────┘  └───────────┘  └──────────┘ │
  │                                               │
  │  Aliases:                                     │
  │  eth-sepolia, sepolia-testnet → sepolia       │
  │  mainnet, eth-mainnet, eth → ethereum         │
  │  base-mainnet → base                          │
  └─────────────────────────────────────────────┘
           |                    |
           v                    v
  ┌─────────────────┐  ┌─────────────────┐
  │ ethers.js v6    │  │ ERC20 ABI       │
  │ JsonRpcProvider │  │ Transfer event  │
  │                 │  │ balanceOf()     │
  │ Per-request     │  │ decimals()      │
  │ (no persistent  │  │ transfer()      │
  │  connections)   │  │ allowance()     │
  └─────────────────┘  └─────────────────┘
```

### 8.2 Transaction Verification Flow

```
  POST /api/verify { requestId, txHash }
              |
              v
  ┌───────────────────────────────────┐
  │ 1. Get transaction receipt         │
  │    provider.getTransactionReceipt  │
  │    (txHash)                        │
  └──────────────┬────────────────────┘
                 |
                 v
  ┌───────────────────────────────────┐
  │ 2. Check receipt.status === 1      │
  │    (transaction succeeded on-chain)│
  └──────────────┬────────────────────┘
                 |
          ┌──────+──────┐
          |             |
     Native ETH    ERC20 Token
          |             |
          v             v
  ┌──────────────┐ ┌──────────────────────┐
  │ Get tx.value │ │ Parse receipt.logs    │
  │ formatEther  │ │ Filter by token addr  │
  │              │ │ Find Transfer event    │
  │ Compare:     │ │ Decode: from, to, val │
  │ value >= exp │ │ formatUnits(decimals) │
  │ to === recv  │ │                        │
  └──────────────┘ │ Compare:               │
                   │ value >= expected       │
                   │ to === receiver         │
                   └──────────────────────┘
                         |
                         v
                 ┌───────────────┐
                 │ Return:       │
                 │ { valid: T/F, │
                 │   amount,     │
                 │   receiver,   │
                 │   blockNumber}│
                 └───────────────┘
```

---

## 9. Webhook & Event System

### 9.1 Event Flow Architecture

```
  ┌──────────────┐
  │ Payment Event │  (payment.created or payment.paid)
  └───────┬──────┘
          |
          v
  ┌───────────────────────────────────┐
  │ dispatchEvent(eventType, data)     │
  │                                    │
  │ 1. Collect agent IDs involved:     │
  │    - creatorAgentId                │
  │    - payerAgentId                  │
  │                                    │
  │ 2. Query webhooks table:           │
  │    SELECT * FROM webhooks          │
  │    WHERE agent_id IN (...)         │
  │    AND active = true               │
  │    AND events @> [eventType]       │
  └───────────┬───────────────────────┘
              |
              v
  ┌───────────────────────────────────┐
  │ For each matched webhook:          │
  │                                    │
  │   Build payload:                   │
  │   { event, payment: {...},         │
  │     fee: {...}, timestamp }        │
  │                                    │
  │   Sign: HMAC-SHA256(secret, body)  │
  │                                    │
  │   POST webhook.url                 │
  │   Headers:                         │
  │     X-PayAgent-Event: type         │
  │     X-PayAgent-Timestamp: ms       │
  │     X-PayAgent-Signature: sha256=  │
  └───────────┬───────────────────────┘
              |
         ┌────+────┐
         |         |
      2xx OK    Error
         |         |
         v         v
  ┌──────────┐ ┌──────────────────────┐
  │ Success  │ │ Retry with backoff   │
  │ Reset    │ │                      │
  │ failures │ │ Attempt 1: +30s      │
  └──────────┘ │ Attempt 2: +5min     │
               │ Attempt 3: +30min    │
               │                      │
               │ After 5 consecutive  │
               │ failures:            │
               │ → auto-deactivate    │
               └──────────────────────┘
```

### 9.2 Webhook Signature Verification (Receiver's Side)

```
  Webhook Receiver's Code:

  ┌──────────────────────────────────────────┐
  │ const payload = JSON.stringify(req.body); │
  │ const expected = crypto                   │
  │   .createHmac('sha256', webhookSecret)    │
  │   .update(payload)                        │
  │   .digest('hex');                         │
  │                                           │
  │ const received = req.headers              │
  │   ['x-payagent-signature']                │
  │   .replace('sha256=', '');                │
  │                                           │
  │ if (expected === received) {              │
  │   // Authentic PayAgent webhook           │
  │ }                                         │
  └──────────────────────────────────────────┘
```

---

## 10. Database Schema & Data Model

### 10.1 Entity Relationship Diagram

```
  ┌──────────────────┐       ┌──────────────────────┐
  │     AGENTS       │       │   PAYMENT_REQUESTS    │
  ├──────────────────┤       ├──────────────────────┤
  │ id (PK)          │──┐    │ id (PK)              │
  │ username (UQ)    │  │    │ token                │
  │ email            │  │    │ amount               │
  │ api_key_id (UQ)  │  │    │ receiver             │
  │ api_secret_enc   │  ├───>│ creator_agent_id(FK) │
  │ webhook_secret   │  │    │ payer_agent_id (FK)  │
  │ wallet_address   │  │    │ creator_wallet       │
  │ chain            │  │    │ payer                │
  │ status           │  │    │ description          │
  │ verification_*   │  │    │ network              │
  │ x_username       │  │    │ status               │
  │ ip tracking      │  │    │ tx_hash              │
  │ counters         │  │    │ expires_at           │
  │ deleted_at       │  │    │ paid_at              │
  └──────────────────┘  │    └──────────┬───────────┘
          |              │               |
          |              │               |
  ┌───────v──────────┐  │    ┌──────────v───────────┐
  │    WEBHOOKS      │  │    │  FEE_TRANSACTIONS    │
  ├──────────────────┤  │    ├──────────────────────┤
  │ id (PK)          │  │    │ id (PK)              │
  │ agent_id (FK)  ──┤──┘    │ payment_req_id (FK)  │
  │ url              │       │ payer_agent_id (FK)  │
  │ secret           │       │ creator_agent_id(FK) │
  │ events[]         │       │ fee_token            │
  │ active           │       │ fee_total            │
  │ failure_count    │       │ platform_share       │
  │ last_success_at  │       │ creator_reward       │
  │ last_failure_at  │       │ lcx_price_usd        │
  └──────────────────┘       │ tx hashes            │
                             │ status               │
  ┌──────────────────┐       └──────────────────────┘
  │    API_LOGS      │
  ├──────────────────┤       ┌──────────────────────┐
  │ id (PK)          │       │    IP_HISTORY        │
  │ agent_id (FK)    │       ├──────────────────────┤
  │ endpoint         │       │ id (PK)              │
  │ method           │       │ agent_id (FK)        │
  │ ip_address       │       │ ip_address           │
  │ status_code      │       │ first_seen_at        │
  │ response_time_ms │       │ last_seen_at         │
  │ error            │       │ request_count        │
  └──────────────────┘       │ (UQ: agent+ip)       │
                             └──────────────────────┘
  ┌──────────────────┐
  │   AUTH_NONCES    │       ┌──────────────────────┐
  ├──────────────────┤       │   FEE_CONFIG         │
  │ wallet_addr (PK) │       ├──────────────────────┤
  │ nonce            │       │ id = 'default' (PK)  │
  │ expires_at       │       │ lcx_fee_amount: 4    │
  └──────────────────┘       │ lcx_platform_share:2 │
                             │ lcx_creator_reward:2 │
                             │ treasury_wallet      │
                             │ price_cache_ttl: 300 │
                             └──────────────────────┘
```

### 10.2 Table Statistics

| Table | Purpose | Growth Rate | Indexes |
|-------|---------|-------------|---------|
| agents | User/agent accounts | Slow (registrations) | api_key_id, username, status |
| payment_requests | Payment links | Medium (per payment) | status, receiver, created_at, creator_agent |
| fee_transactions | Fee audit trail | Medium (per payment) | payment_id, payer_agent, status |
| webhooks | Event subscriptions | Slow (per agent) | agent_id, active |
| api_logs | Request audit trail | **High** (every request) | agent_id, created_at, ip |
| ip_history | IP tracking | Medium (unique IPs) | agent_id |
| auth_nonces | Temp login challenges | Transient (auto-deleted) | wallet_address (PK) |
| conversations | AI chat history | Low (optional feature) | agent_id, created_at |
| fee_config | Platform config | Static (1 row) | id (PK) |

---

## 11. SDK Architecture

### 11.1 SDK Class Design

```
  ┌─────────────────────────────────────────────┐
  │           PayAgentClient                     │
  ├─────────────────────────────────────────────┤
  │                                               │
  │  Constructor:                                 │
  │  ┌─────────────────────────────────────────┐ │
  │  │ apiKeyId:  pk_live_...  (public)        │ │
  │  │ apiSecret: sk_live_...  (private)       │ │
  │  │ privateKey: 0x...       (wallet key)    │ │
  │  │ baseUrl:   https://...  (API server)    │ │
  │  │ rpcUrl:    string | { chain: url }      │ │
  │  └─────────────────────────────────────────┘ │
  │                                               │
  │  Public Methods:                              │
  │  ┌─────────────────────────────────────────┐ │
  │  │ payLink(linkId)                         │ │
  │  │   → Fetch instructions → Sign → Verify │ │
  │  │                                         │ │
  │  │ getInstructions(linkId)                 │ │
  │  │   → Fetch transfer instructions only    │ │
  │  │                                         │ │
  │  │ verifyPayment(requestId, txHash, ...)   │ │
  │  │   → Confirm payment on backend          │ │
  │  │                                         │ │
  │  │ createLink({ amount, network, ... })    │ │
  │  │   → Create new payment link             │ │
  │  │                                         │ │
  │  │ getChains()                             │ │
  │  │   → List supported chains               │ │
  │  │                                         │ │
  │  │ get address                             │ │
  │  │   → Derived wallet address              │ │
  │  └─────────────────────────────────────────┘ │
  │                                               │
  │  Private Methods:                             │
  │  ┌─────────────────────────────────────────┐ │
  │  │ _sign(method, path, body)               │ │
  │  │   → HMAC-SHA256 signature               │ │
  │  │                                         │ │
  │  │ _fetch(method, path, body)              │ │
  │  │   → Authenticated HTTP request          │ │
  │  │                                         │ │
  │  │ _getProvider(network)                   │ │
  │  │   → ethers JsonRpcProvider              │ │
  │  │                                         │ │
  │  │ _isNativeToken(symbol, network)         │ │
  │  │   → ETH check per chain                │ │
  │  │                                         │ │
  │  │ _getDecimals(symbol)                    │ │
  │  │   → Token decimal lookup                │ │
  │  └─────────────────────────────────────────┘ │
  └─────────────────────────────────────────────┘
```

### 11.2 SDK Payment Flow (One-Call)

```
  const result = await client.payLink("REQ-ABC123");

  Internally:
  ┌──────────────────────────────────────────┐
  │ Step 1: _fetch('POST', '/api/pay-link',  │
  │         { linkId: 'REQ-ABC123' })         │
  │ → Returns: { instructions: {              │
  │     transfers: [ ... ] } }                │
  │                                           │
  │ Step 2: For each transfer:                │
  │   if native → wallet.sendTransaction()    │
  │   if ERC20  → contract.transfer()         │
  │   await tx.wait() for receipt             │
  │                                           │
  │ Step 3: _fetch('POST', '/api/verify',     │
  │         { requestId, txHash, feeTxHash }) │
  │ → Returns: { status: 'PAID' }            │
  │                                           │
  │ Step 4: Return combined result:           │
  │ { success, linkId, payer, network,        │
  │   transactions: [...], verification,      │
  │   status: 'PAID' }                        │
  └──────────────────────────────────────────┘
```

---

## 12. Frontend Architecture

### 12.1 Page Routing Structure

```
  ┌──────────────────────────────────────────────┐
  │                  App.tsx                       │
  │               (BrowserRouter)                  │
  ├──────────────────────────────────────────────┤
  │                                                │
  │  PUBLIC ROUTES:                                │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │ /        │───>│ Login.tsx                │  │
  │  │          │    │ Wallet connection        │  │
  │  └──────────┘    └─────────────────────────┘  │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │/pay/:id  │───>│ PaymentView.tsx          │  │
  │  │/r/:id    │    │ Payment form for payer   │  │
  │  └──────────┘    └─────────────────────────┘  │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │ /agent   │───>│ PayAsAgent.tsx           │  │
  │  │          │    │ AI agent interface       │  │
  │  └──────────┘    └─────────────────────────┘  │
  │                                                │
  │  PROTECTED ROUTES (wallet required):           │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │/dashboard│───>│ Index.tsx                │  │
  │  │          │    │ Overview, stats, actions │  │
  │  └──────────┘    └─────────────────────────┘  │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │/payment- │───>│ PaymentLinks.tsx         │  │
  │  │  links   │    │ Create & manage links    │  │
  │  └──────────┘    └─────────────────────────┘  │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │/transact-│───>│ Transactions.tsx         │  │
  │  │  ions    │    │ Payment history          │  │
  │  └──────────┘    └─────────────────────────┘  │
  │  ┌──────────┐    ┌─────────────────────────┐  │
  │  │/rewards  │───>│ Rewards.tsx              │  │
  │  │          │    │ Fee earnings & rewards   │  │
  │  └──────────┘    └─────────────────────────┘  │
  └──────────────────────────────────────────────┘
```

### 12.2 Wallet Connection Stack

```
  ┌────────────────────────────────────────────┐
  │            WalletProvider.tsx                │
  │                                             │
  │  ┌──────────────────────────────────────┐  │
  │  │         WagmiProvider                 │  │
  │  │  Chains: ETH, Polygon, Optimism,     │  │
  │  │          Arbitrum, Base, Sepolia, BSC │  │
  │  │                                       │  │
  │  │  ┌────────────────────────────────┐  │  │
  │  │  │    QueryClientProvider         │  │  │
  │  │  │    (React Query)               │  │  │
  │  │  │                                │  │  │
  │  │  │  ┌──────────────────────────┐ │  │  │
  │  │  │  │   RainbowKitProvider    │ │  │  │
  │  │  │  │                          │ │  │  │
  │  │  │  │   Wallet Connect Modal   │ │  │  │
  │  │  │  │   MetaMask, Coinbase,   │ │  │  │
  │  │  │  │   Rainbow, WalletConnect│ │  │  │
  │  │  │  │                          │ │  │  │
  │  │  │  │   { children }           │ │  │  │
  │  │  │  └──────────────────────────┘ │  │  │
  │  │  └────────────────────────────────┘  │  │
  │  └──────────────────────────────────────┘  │
  └────────────────────────────────────────────┘
```

### 12.3 JWT Session Flow (In-Memory Only)

```
  ┌──────────────────────────────────────────────┐
  │   Browser Memory (NOT localStorage)           │
  │                                                │
  │   _jwtToken = "eyJ..."                        │
  │   _jwtExpiresAt = 1708012345000               │
  │                                                │
  │   ┌──────────────────────────────────────┐    │
  │   │ On wallet connect:                    │    │
  │   │   1. POST /api/auth/challenge         │    │
  │   │   2. Sign nonce with wallet           │    │
  │   │   3. POST /api/auth/verify            │    │
  │   │   4. Store JWT in memory              │    │
  │   │   5. All API calls use Bearer token   │    │
  │   └──────────────────────────────────────┘    │
  │                                                │
  │   ┌──────────────────────────────────────┐    │
  │   │ On page refresh / tab close:          │    │
  │   │   JWT is GONE (memory cleared)        │    │
  │   │   User must re-connect wallet         │    │
  │   │   This is INTENTIONAL for security    │    │
  │   └──────────────────────────────────────┘    │
  │                                                │
  │   ┌──────────────────────────────────────┐    │
  │   │ On JWT expiry (1 hour):               │    │
  │   │   isJwtValid() returns false          │    │
  │   │   clearJwt() called                   │    │
  │   │   Redirect to /login                  │    │
  │   └──────────────────────────────────────┘    │
  └──────────────────────────────────────────────┘
```

---

## 13. Agent Onboarding Pipeline

```
  ┌─────────────────────────────────────────────────────────────┐
  │                  AGENT ONBOARDING PIPELINE                   │
  ├─────────────────────────────────────────────────────────────┤
  │                                                               │
  │  STEP 1: REGISTRATION                                        │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │ POST /api/agents/register                                │ │
  │  │ { username, email, wallet_address, chain }               │ │
  │  │                                                          │ │
  │  │ → Validate username uniqueness                           │ │
  │  │ → Generate verification_challenge:                       │ │
  │  │   "payagent-verify-myagent-a1b2c3"                      │ │
  │  │ → Create agent: status = "pending_verification"         │ │
  │  │ → Return: { agent_id, verification_challenge }          │ │
  │  └─────────────────────────────────────────────────────────┘ │
  │                           |                                   │
  │                           v                                   │
  │  STEP 2: X (TWITTER) VERIFICATION                            │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │ User posts tweet containing the challenge string         │ │
  │  │                                                          │ │
  │  │ Tweet: "I'm verifying my @PayAgent account              │ │
  │  │         payagent-verify-myagent-a1b2c3"                 │ │
  │  └─────────────────────────────────────────────────────────┘ │
  │                           |                                   │
  │                           v                                   │
  │  STEP 3: VERIFY TWEET                                        │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │ POST /api/agents/verify-x                                │ │
  │  │ { username, tweet_url }                                  │ │
  │  │                                                          │ │
  │  │ → Fetch tweet HTML (x.com or nitter.net fallback)       │ │
  │  │ → Search HTML for challenge string                       │ │
  │  │ → Extract X username from tweet URL                      │ │
  │  │ → If found: activate agent!                              │ │
  │  └─────────────────────────────────────────────────────────┘ │
  │                           |                                   │
  │                           v                                   │
  │  STEP 4: ACTIVATION (Automatic)                               │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │ Generate production API credentials:                     │ │
  │  │                                                          │ │
  │  │ api_key_id:  pk_live_a1b2c3d4e5f6...  (public)         │ │
  │  │ api_secret:  sk_live_x7y8z9w0...      (shown ONCE)     │ │
  │  │                                                          │ │
  │  │ Secret encrypted with AES-256-GCM before storage        │ │
  │  │ Expiry set: 10 days from activation                     │ │
  │  │ Status → "active"                                       │ │
  │  │ verification_status → "verified"                        │ │
  │  │                                                          │ │
  │  │ Return: { api_key_id, api_secret, expires_at }          │ │
  │  │                                                          │ │
  │  │ ⚠ api_secret is NEVER returned again!                   │ │
  │  │   User must store it securely.                           │ │
  │  └─────────────────────────────────────────────────────────┘ │
  │                           |                                   │
  │                           v                                   │
  │  STEP 5: READY TO USE                                        │
  │  ┌─────────────────────────────────────────────────────────┐ │
  │  │ Agent can now:                                           │ │
  │  │ - Create payment links (POST /api/create-link)          │ │
  │  │ - Pay links (POST /api/pay-link)                        │ │
  │  │ - Verify payments (POST /api/verify)                    │ │
  │  │ - Register webhooks (POST /api/webhooks)                │ │
  │  │ - Use @payagent/sdk for automated payments              │ │
  │  └─────────────────────────────────────────────────────────┘ │
  └─────────────────────────────────────────────────────────────┘
```

---

## 14. Monitoring, Logging & Anomaly Detection

### 14.1 Audit Trail Architecture

```
  Every API Request
       |
       v
  ┌──────────────────────────────────┐
  │ requestLogger middleware          │
  │                                   │
  │ Captures on res.finish:           │
  │ - agent_id (if authenticated)     │
  │ - endpoint (originalUrl)          │
  │ - method (GET/POST/etc)           │
  │ - ip_address (X-Forwarded-For)    │
  │ - user_agent                      │
  │ - status_code                     │
  │ - response_time_ms                │
  │ - error (if 4xx/5xx)              │
  └──────────────┬───────────────────┘
                 |
        Async (non-blocking)
                 |
        +--------+--------+
        |                 |
        v                 v
  ┌──────────┐    ┌──────────────┐
  │ api_logs │    │  ip_history  │
  │ table    │    │  table       │
  │          │    │              │
  │ Full     │    │ Per-agent    │
  │ request  │    │ IP tracking  │
  │ history  │    │ first_seen   │
  └──────────┘    │ last_seen    │
                  │ req_count    │
                  └──────┬───────┘
                         |
                         v
                  ┌──────────────┐
                  │ IP Anomaly   │
                  │ Detector     │
                  │              │
                  │ > 5 IPs/24h  │
                  │  → WARNING   │
                  │              │
                  │ >= 10 events │
                  │  → SUSPEND   │
                  └──────────────┘
```

---

## 15. Deployment Architecture

```
  ┌───────────────────────────────────────────────────┐
  │                   VERCEL                           │
  │                                                     │
  │  ┌─────────────────────────────────────────────┐  │
  │  │  Edge Network (Global CDN)                   │  │
  │  │  - TLS termination                           │  │
  │  │  - Static asset serving (React SPA)          │  │
  │  │  - Route rewriting (SPA fallback → /)        │  │
  │  └──────────────────────┬──────────────────────┘  │
  │                          |                          │
  │  ┌──────────────────────v──────────────────────┐  │
  │  │  Serverless Functions                        │  │
  │  │  backend/api/index.js                        │  │
  │  │  - Express app wrapped as Vercel function    │  │
  │  │  - Auto-scales to 0 when idle                │  │
  │  │  - Cold start: ~500ms                        │  │
  │  └──────────────────────┬──────────────────────┘  │
  │                          |                          │
  └──────────────────────────|──────────────────────────┘
                             |
              ┌──────────────+──────────────┐
              |                              |
     ┌────────v─────────┐        ┌──────────v────────┐
     │   Supabase        │        │  EVM RPC Nodes    │
     │   (PostgreSQL)    │        │                    │
     │                    │        │  Sepolia           │
     │   Hosted DB        │        │  Ethereum          │
     │   + REST API       │        │  Base              │
     │   + Realtime       │        │                    │
     └────────────────────┘        └────────────────────┘
```

---

## 16. Supported Chains & Tokens

| Chain | Chain ID | Type | Native Token | ERC20 Tokens |
|-------|----------|------|-------------|-------------|
| **Sepolia** | 11155111 | Testnet | ETH | USDC (6d), USDT (6d), LCX (18d) |
| **Ethereum** | 1 | Mainnet | ETH | USDC (6d), USDT (6d), LCX (18d) |
| **Base** | 8453 | Mainnet | ETH | USDC (6d), USDT (6d), LCX (18d) |

**Token Decimal Reference:**
- USDC/USDT: 6 decimals (1 USDC = 1,000,000 units)
- LCX/ETH: 18 decimals (1 ETH = 10^18 wei)

---

## 17. API Reference Summary

### Public Endpoints (No Auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | Health check |
| POST | `/api/auth/challenge` | Generate wallet login nonce |
| POST | `/api/auth/verify` | Verify wallet signature, issue JWT |
| POST | `/api/agents/register` | Register new agent (rate-limited) |
| POST | `/api/agents/verify-x` | Verify X tweet, activate agent |
| GET | `/api/request/:id` | Get payment request details |
| GET | `/api/request/:id/fee` | Calculate fees for payer |
| GET | `/api/agents/by-wallet` | Lookup agent by wallet |
| GET | `/api/chains` | List supported chains |
| GET | `/api/stats` | Platform statistics |

### Authenticated Endpoints (HMAC or JWT)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/agents/me` | Agent profile |
| POST | `/api/agents/wallet` | Update wallet address |
| POST | `/api/agents/rotate-key` | Regenerate API key |
| POST | `/api/agents/deactivate` | Deactivate account |
| DELETE | `/api/agents/me` | Soft delete account |
| GET | `/api/agents/logs` | Paginated audit logs |
| GET | `/api/agents/ip-history` | IP access history |
| POST | `/api/create-link` | Create payment link |
| POST | `/api/create` | Create payment (frontend) |
| GET | `/api/requests` | List payment requests |
| DELETE | `/api/request/:id` | Delete request |
| POST | `/api/pay-link` | Get payment instructions |
| POST | `/api/verify` | Verify payment on blockchain |
| POST | `/api/webhooks` | Register webhook |
| GET | `/api/webhooks` | List webhooks |
| PUT | `/api/webhooks/:id` | Update webhook |
| DELETE | `/api/webhooks/:id` | Delete webhook |
| POST | `/api/webhooks/:id/test` | Test webhook delivery |

---

## 18. Design Decisions & Trade-offs

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| **Non-custodial** | No regulatory burden; users trust their own wallets | More complex payment flow (client-side signing) |
| **Vercel Serverless** | Zero-ops, auto-scale, global CDN | Cold starts, no persistent connections, no WebSocket |
| **Supabase** | Instant PostgreSQL + REST API + auth | Vendor lock-in, limited connection pooling |
| **HMAC over API Key** | Never transmits secret; replay-protected | More complex SDK integration |
| **JWT in memory** | Prevents XSS token theft from localStorage | Session lost on page refresh |
| **LCX-based fees** | Incentivizes LCX ecosystem adoption | Price volatility affects fee consistency |
| **X verification** | Spam prevention + identity verification | HTML scraping is fragile |
| **In-memory rate limiter** | Simple, no Redis dependency | Resets on cold start; shared across all users behind proxy |

---

## 19. Scalability Roadmap

### Current Bottlenecks

| Component | Current | Limit | Mitigation |
|-----------|---------|-------|------------|
| Rate Limiter | In-memory | Resets per instance | Upgrade to Redis |
| Price Cache | In-memory | Per-instance | Redis or shared cache |
| Webhook Retries | setTimeout | Lost on restart | Queue (SQS/BullMQ) |
| API Logs | Sync write | DB bottleneck at scale | Batch writes or stream |
| Fee Config | 1-min cache | DB query per minute | Longer TTL or webhook update |

### Recommended Architecture at Scale

```
  Current:                        Future:
  ┌──────────┐                   ┌──────────┐
  │ Vercel   │                   │ K8s/ECS  │
  │ Function │                   │ Cluster  │
  └────┬─────┘                   └────┬─────┘
       |                              |
  ┌────v─────┐                   ┌────v─────┐   ┌─────────┐
  │ Supabase │                   │ PostgreSQL│   │  Redis   │
  │ (hosted) │                   │ (managed) │   │ (cache + │
  └──────────┘                   └──────────┘   │  rate    │
                                                 │  limit)  │
                                                 └─────────┘
                                                      +
                                                 ┌─────────┐
                                                 │ BullMQ / │
                                                 │ SQS      │
                                                 │ (webhooks│
                                                 │  + async)│
                                                 └─────────┘
```

---

*This document is a living artifact. Update it as the architecture evolves.*
