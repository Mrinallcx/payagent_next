## PayMe: The Complete Blueprint

---

## 1. What You're Building

A **crypto payment infrastructure platform for AI agents** — the "Stripe for AI." Any AI agent developer can register, get an API key, and let their agents send/receive crypto payments through your platform. You earn a fee on every transaction.

### The Problem

AI agents are increasingly autonomous — they book flights, write code, manage portfolios, hire other agents. But when Agent A needs to pay Agent B for a service, there's no standard infrastructure. Agents can't use Stripe (requires human identity). They can't use Venmo (requires bank accounts). Crypto is the natural payment rail for machine-to-machine transactions, but there's no "plug-and-play" payment API designed for agents.

### The Solution

PayMe is the missing layer. It provides:
- **Identity**: Every agent gets a unique ID and API key (like Stripe's `sk_live_`)
- **Payment Rails**: Create payment links, pay them on-chain, verify automatically
- **Intelligence**: An AI layer (Grok 4) that lets agents request payments in natural language
- **Notifications**: Webhooks notify agents in real-time when payments complete
- **Revenue**: A dual-token fee model (LCX/USDC) that generates platform revenue on every transaction

### Who Uses This

| User Type | What They Do | How They Interact |
|-----------|-------------|-------------------|
| **Agent Developer** | Builds AI agents (bots, assistants, services) | Registers agents via CLI, integrates API |
| **Link Creator Agent** | Provides a service and wants payment | Calls `POST /api/create-link` or `POST /api/chat` |
| **Payee Agent** | Consumes a service and needs to pay | Calls `POST /api/pay-link`, submits tx, calls `POST /api/verify` |
| **Platform Operator (You)** | Runs the PayMe infrastructure | Collects fees, monitors dashboard, manages fee_config |

### Key Design Principles

1. **Non-Custodial** — The platform never holds agent private keys. Agents sign their own transactions. PayMe returns payment instructions; the agent submits the tx and PayMe verifies on-chain.
2. **API-First** — No UI required for agents. Everything works via REST API and optional AI chat. The frontend dashboard is for the platform operator only.
3. **Fee Transparency** — Every fee is recorded with full audit trail (fee_transactions table), including the LCX/USD price at the time of the transaction.
4. **Stateless Auth** — API key authentication on every request. No sessions, no cookies, no JWT refresh tokens. Simple and reliable for machine clients.
5. **Graceful Degradation** — If Supabase is unavailable, the system falls back to in-memory storage. If CoinGecko is down, stale cached price is used. If xAI API is down, the REST endpoints still work (only `/api/chat` fails).

---

## 2. Platform Architecture (Full System Diagram)

```
                        ┌──────────────────────────────────┐
                        │      AGENT DEVELOPERS            │
                        │                                  │
                        │  WriterBot  CodeBot  ResearchBot │
                        │  DataBot    TraderBot  AnyBot    │
                        └──────────┬───────────────────────┘
                                   │
                    Register via CLI / cURL
                    Then use API Key for all calls
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│                    YOUR PAYME PLATFORM                                │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                     API GATEWAY                                │  │
│  │                                                                │  │
│  │  Auth Middleware (validates API Key on every request)          │  │
│  │                                                                │  │
│  │  POST /api/agents/register     ← Agent registration (no key) │  │
│  │  POST /api/chat                ← AI conversational endpoint   │  │
│  │  POST /api/create-link         ← Create payment link          │  │
│  │  POST /api/pay-link            ← Pay a link                   │  │
│  │  GET  /api/request/:id         ← Check payment status         │  │
│  │  POST /api/webhooks            ← Register webhook URL         │  │
│  │  POST /api/agents/wallet       ← Update wallet address        │  │
│  │  POST /api/agents/regenerate   ← Regenerate lost keys         │  │
│  └─────────────────┬──────────────────────────────────────────────┘  │
│                    │                                                  │
│       ┌────────────┼─────────────────┐                               │
│       │            │                 │                                │
│       ▼            ▼                 ▼                                │
│  ┌─────────┐ ┌──────────┐ ┌──────────────────┐                      │
│  │  AI     │ │ Payment  │ │   Webhook        │                      │
│  │  Layer  │ │ Engine   │ │   Dispatcher     │                      │
│  │ (Grok4) │ │          │ │                  │                      │
│  └────┬────┘ └────┬─────┘ └────────┬─────────┘                      │
│       │           │                │                                  │
│       │           │                │                                  │
│       ▼           ▼                ▼                                  │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                      SUPABASE (PostgreSQL)                    │   │
│  │                                                               │   │
│  │  agents             payment_requests    webhooks              │   │
│  │  fee_config         fee_transactions    conversations         │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
│       │ (Payment Engine sends transactions)                          │
│       ▼                                                              │
│  ┌───────────────────────────────────────────────────────────────┐   │
│  │                      BLOCKCHAIN                               │   │
│  │                                                               │   │
│  │  Sepolia / Base / Arbitrum / BNB Chain                        │   │
│  │                                                               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐            │   │
│  │  │ Agent A  │  │ Agent B  │  │ Platform Treasury │            │   │
│  │  │ Wallet   │  │ Wallet   │  │ Wallet (your fee) │            │   │
│  │  └──────────┘  └──────────┘  └──────────────────┘            │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. The Six Components to Build

### Component 1: Agent Registration System

```
PURPOSE: Onboard new agents — no UI, CLI/cURL only

┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  INPUT (from agent developer):                               │
│  • username (unique)                                         │
│  • email                                                     │
│  • wallet_address (0x...)                                    │
│                                                              │
│  PROCESS:                                                    │
│  1. Validate username not taken                              │
│  2. Validate email format                                    │
│  3. Validate wallet address (0x + 40 hex chars)              │
│  4. Generate API Key (pk_live_<random32>)                    │
│  5. Generate Agent ID (agent_<username>_<random6>)           │
│  6. Generate Webhook Secret (whsec_<random32>)               │
│  7. Store in Supabase (key/secret as bcrypt hashes)          │
│                                                              │
│  OUTPUT (shown ONCE, never again):                           │
│  • Agent ID                                                  │
│  • API Key                                                   │
│  • Webhook Secret                                            │
│                                                              │
│  DATABASE TABLE: agents                                      │
│  ┌────────────────────────────────────────────────────┐      │
│  │ id                  TEXT PRIMARY KEY                │      │
│  │ username            TEXT UNIQUE NOT NULL            │      │
│  │ email               TEXT NOT NULL                   │      │
│  │ api_key_hash        TEXT NOT NULL (bcrypt)          │      │
│  │ api_key_prefix      TEXT NOT NULL (first 12 chars)  │      │
│  │ webhook_secret_hash TEXT NOT NULL (bcrypt)          │      │
│  │ wallet_address      TEXT NOT NULL                   │      │
│  │ chain               TEXT DEFAULT 'sepolia'          │      │
│  │ status              TEXT DEFAULT 'active'           │      │
│  │ created_at          TIMESTAMPTZ                     │      │
│  │ last_active_at      TIMESTAMPTZ                     │      │
│  │ total_payments_sent INTEGER DEFAULT 0               │      │
│  │ total_payments_received INTEGER DEFAULT 0           │      │
│  │ total_fees_paid     NUMERIC DEFAULT 0               │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ENDPOINTS:                                                  │
│  POST /api/agents/register          (no auth — signup)       │
│  POST /api/agents/wallet            (auth — update wallet)   │
│  POST /api/agents/regenerate-key    (email verification)     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Component 2: API Authentication Middleware

```
PURPOSE: Verify every API call comes from a registered agent

FLOW:
┌─────────────────────────────────────────────┐
│  Incoming request                           │
│  Header: Authorization: Bearer pk_live_...  │
└──────────────┬──────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────┐
│  1. Extract API key from header             │
│  2. Extract prefix (first 12 chars)         │
│  3. Look up agent by prefix in DB           │
│  4. bcrypt.compare(full_key, stored_hash)   │
│  5. Check agent status === 'active'         │
└──────────────┬──────────────────────────────┘
               │
        ┌──────┴──────┐
        │             │
     MATCH         NO MATCH
        │             │
        ▼             ▼
   Attach agent    401 Unauthorized
   to request      "Invalid or missing API key"
   Continue ──▶
```

### Component 3: AI Conversation Layer (Grok 4 Fast Thinking)

```
PURPOSE: Parse natural language from agents into structured actions

TECH:
• openai npm package → xAI API (https://api.x.ai/v1)
• Model: grok-4-fast
• Stateful conversations stored in DB per agent

FLOW:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  POST /api/chat                                              │
│  { "message": "Create a payment link for 5 USDC" }          │
│  Header: Authorization: Bearer pk_live_...                   │
│                                                              │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  GATE 1: AUTH MIDDLEWARE (Component 2)               │     │
│  │                                                     │     │
│  │  Is the agent registered?                           │     │
│  │  • Extract API key from header                      │     │
│  │  • Look up agent by key prefix in DB                │     │
│  │  • bcrypt.compare(full_key, stored_hash)            │     │
│  │  • Check agent status === 'active'                  │     │
│  │                                                     │     │
│  │  ❌ NOT registered / bad key / inactive              │     │
│  │     → 401 Unauthorized                              │     │
│  │     → STOP. Request never reaches AI layer.         │     │
│  │                                                     │     │
│  │  ✅ Registered + valid key                           │     │
│  │     → Attach agent profile to request               │     │
│  │     → Continue to AI layer                          │     │
│  └──────────────┬──────────────────────────────────────┘     │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  GATE 2: WALLET CHECK                               │     │
│  │                                                     │     │
│  │  Does this agent have a wallet address?             │     │
│  │  • Read agent.wallet_address from attached profile  │     │
│  │                                                     │     │
│  │  ❌ NO wallet registered                             │     │
│  │     → Skip Grok entirely                            │     │
│  │     → Return immediately:                           │     │
│  │       {                                             │     │
│  │         "action_required": "provide_wallet",        │     │
│  │         "message": "You don't have a wallet         │     │
│  │           address registered. Please share your     │     │
│  │           wallet address (0x...) to get started."   │     │
│  │       }                                             │     │
│  │     → IF the message itself contains a 0x address,  │     │
│  │       extract it and register it automatically,     │     │
│  │       then continue to AI layer.                    │     │
│  │                                                     │     │
│  │  ✅ Wallet exists                                    │     │
│  │     → Continue to Context Builder                   │     │
│  └──────────────┬──────────────────────────────────────┘     │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  CONTEXT BUILDER                                    │     │
│  │                                                     │     │
│  │  1. Load agent profile from DB:                     │     │
│  │     • username, wallet_address, chain, agent_id     │     │
│  │  2. Load last 10 messages (conversation memory)     │     │
│  │  3. Build system prompt with agent context:          │     │
│  │     • Include wallet address                        │     │
│  │     • Include agent name                            │     │
│  │     • Include supported actions                     │     │
│  └──────────────┬──────────────────────────────────────┘     │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  GROK 4 FAST THINKING                               │     │
│  │                                                     │     │
│  │  System: "You are PayMe AI assistant..."            │     │
│  │  Context: "Agent 'codebot' has wallet 0x742d..."    │     │
│  │  User: "Create a payment link for 5 USDC"          │     │
│  │                                                     │     │
│  │  Returns JSON:                                      │     │
│  │  {                                                  │     │
│  │    "action": "create_link",                         │     │
│  │    "params": { "amount": "5", "token": "USDC" },   │     │
│  │    "message": "Creating a 5 USDC payment link..."   │     │
│  │  }                                                  │     │
│  └──────────────┬──────────────────────────────────────┘     │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  GATE 3: ACTION VALIDATION                          │     │
│  │                                                     │     │
│  │  Before executing, validate the action:             │     │
│  │                                                     │     │
│  │  • "create_link" or "pay_link"                      │     │
│  │    → Requires wallet. Double-check agent has one.   │     │
│  │    → If wallet missing (edge case), ask for it.     │     │
│  │                                                     │     │
│  │  • "register_wallet"                                │     │
│  │    → Validate 0x address format (0x + 40 hex)       │     │
│  │    → Check not already taken by another agent       │     │
│  │                                                     │     │
│  │  • "pay_link"                                       │     │
│  │    → Verify link exists and is PENDING              │     │
│  │    → Verify agent has sufficient balance            │     │
│  │                                                     │     │
│  │  ❌ Validation fails → return error message          │     │
│  │  ✅ Validation passes → continue to executor        │     │
│  └──────────────┬──────────────────────────────────────┘     │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  ACTION EXECUTOR                                    │     │
│  │                                                     │     │
│  │  Switch on action:                                  │     │
│  │  • "create_link"     → call createRequest()         │     │
│  │  • "pay_link"        → call payLink()               │     │
│  │  • "check_status"    → call getRequest()            │     │
│  │  • "register_wallet" → update agent in DB           │     │
│  │  • "ask_wallet"      → return message asking for it │     │
│  │  • "clarify"         → return help message          │     │
│  └──────────────┬──────────────────────────────────────┘     │
│                 │                                            │
│                 ▼                                            │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  RESPONSE                                           │     │
│  │                                                     │     │
│  │  {                                                  │     │
│  │    "message": "Payment link created!...",           │     │
│  │    "data": { "linkId": "REQ-xxx", ... }             │     │
│  │  }                                                  │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  SECURITY SUMMARY (3 gates before any action executes):      │
│  ┌─────────────────────────────────────────────────────┐     │
│  │                                                     │     │
│  │  Gate 1: AUTH     → Is the agent registered?        │     │
│  │                     No → 401, blocked.              │     │
│  │                                                     │     │
│  │  Gate 2: WALLET   → Does agent have a wallet?       │     │
│  │                     No → ask for wallet first.      │     │
│  │                                                     │     │
│  │  Gate 3: VALIDATE → Is the action valid?            │     │
│  │                     No → return error message.      │     │
│  │                                                     │     │
│  │  All 3 pass → execute action safely.                │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  SMART BEHAVIORS:                                            │
│  • Agent says "5 USDC" but has no wallet                     │
│    → Gate 2 catches it, asks for wallet address              │
│  • Agent pastes "0x742d..." with no context                  │
│    → Gate 2 detects wallet in message, registers it          │
│      automatically, then asks what they'd like to do         │
│  • Agent says "pay 0x742d 10 USDC"                           │
│    → AI extracts wallet + amount, creates link immediately   │
│  • Agent says "hello"                                        │
│    → AI explains what it can do                              │
│  • Unregistered agent tries /api/chat                        │
│    → Gate 1 blocks with 401, never reaches AI                │
│  • Registered agent with wallet tries to pay expired link    │
│    → Gate 3 catches it, returns "link expired" error         │
│                                                              │
│  DATABASE TABLE: conversations                               │
│  ┌────────────────────────────────────────────────────┐      │
│  │ id            TEXT PRIMARY KEY                      │      │
│  │ agent_id      TEXT REFERENCES agents(id)            │      │
│  │ role          TEXT (system/user/assistant)           │      │
│  │ content       TEXT                                  │      │
│  │ created_at    TIMESTAMPTZ                           │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Component 4: Fee Collection (LCX / USDC Dual-Token Model)

```
PURPOSE: Collect fees on every payment. Payee (the agent who pays
the link) covers the fee. Fee can be paid in LCX token or USDC.
Part of the fee is rewarded to the link creator.

LCX TOKEN: https://www.coingecko.com/en/coins/lcx
  • ERC-20 token by LCX (Liechtenstein Cryptoassets Exchange)
  • Used as the preferred fee token on PayMe
  • Incentivizes LCX adoption — link creators earn LCX rewards

═══════════════════════════════════════════════════════════════
  FEE MODEL OVERVIEW
═══════════════════════════════════════════════════════════════

  WHO PAYS THE FEE?  → The PAYEE (agent who pays the link)
  WHO GETS REWARDED? → The LINK CREATOR (agent who created the link)

  Two options for the payee:

  ┌─────────────────────────────────────────────────────────┐
  │  OPTION A: Pay fee in LCX (preferred)                   │
  │                                                         │
  │  Payee pays: 4 LCX                                     │
  │    ├─ 2 LCX → Platform treasury (your revenue)         │
  │    └─ 2 LCX → Link creator (reward for using PayMe)    │
  │                                                         │
  │  The payment amount (e.g., 10 USDC) goes to the link   │
  │  creator in FULL. Fee is separate, paid in LCX.        │
  └─────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  OPTION B: Pay fee in USDC (fallback if no LCX)         │
  │                                                         │
  │  If payee has no LCX balance:                           │
  │  • Fetch current LCX price from CoinGecko/oracle       │
  │  • Calculate: 4 LCX equivalent in USDC                 │
  │    e.g., if 1 LCX = $0.15, then 4 LCX = $0.60 USDC   │
  │                                                         │
  │  Payee pays: 0.60 USDC (equivalent of 4 LCX)           │
  │    ├─ 0.30 USDC → Platform treasury (your revenue)     │
  │    └─ 0.30 USDC → Link creator (reward)                │
  │                                                         │
  │  The payment amount (e.g., 10 USDC) goes to the link   │
  │  creator in FULL. Fee is separate, deducted in USDC.   │
  └─────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
  DETAILED FLOW
═══════════════════════════════════════════════════════════════

  Agent A (payee) pays a 10 USDC link created by Agent B

         │
         ▼
  ┌─────────────────────────────────────────────────────┐
  │  STEP 1: CHECK PAYEE'S LCX BALANCE                  │
  │                                                     │
  │  Read payee's LCX token balance on-chain            │
  │  (using ERC20 balanceOf on LCX contract)            │
  │                                                     │
  │  Does payee have >= 4 LCX?                          │
  │                                                     │
  │  ✅ YES (has LCX) → OPTION A (LCX fee)              │
  │  ❌ NO  (no LCX)  → OPTION B (USDC fee)             │
  └──────────────┬──────────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
  ┌──────────────┐  ┌──────────────────────────────────┐
  │  OPTION A    │  │  OPTION B                        │
  │  LCX FEE     │  │  USDC FEE (LCX equivalent)       │
  │              │  │                                  │
  │  Transfers:  │  │  1. Fetch LCX/USD price from     │
  │              │  │     CoinGecko API or on-chain     │
  │  1. 10 USDC  │  │     oracle                       │
  │     → Agent B│  │                                  │
  │     (full    │  │  2. Calculate USDC equivalent:    │
  │      amount) │  │     4 LCX × $0.15 = $0.60 USDC  │
  │              │  │                                  │
  │  2. 2 LCX    │  │  Transfers:                      │
  │     → Platform│  │                                  │
  │     treasury │  │  1. 10 USDC → Agent B (full amt) │
  │              │  │  2. 0.30 USDC → Platform treasury│
  │  3. 2 LCX    │  │  3. 0.30 USDC → Agent B (reward)│
  │     → Agent B│  │                                  │
  │     (reward) │  │  Total payee sends:              │
  │              │  │  10 USDC + 0.60 USDC = 10.60 USDC│
  │  Total payee │  │                                  │
  │  sends:      │  └──────────────────────────────────┘
  │  10 USDC     │
  │  + 4 LCX     │
  └──────────────┘

═══════════════════════════════════════════════════════════════
  EXAMPLES
═══════════════════════════════════════════════════════════════

  EXAMPLE 1: Payee HAS LCX
  ─────────────────────────
  Link: 10 USDC, created by Agent B
  Payee: Agent A (has 50 LCX in wallet)

  Agent A sends:
    • 10 USDC → Agent B (payment)
    • 2 LCX  → Platform treasury (fee)
    • 2 LCX  → Agent B (reward)

  Result:
    Agent B receives: 10 USDC + 2 LCX
    Platform keeps:   2 LCX
    Agent A spent:    10 USDC + 4 LCX


  EXAMPLE 2: Payee has NO LCX
  ────────────────────────────
  Link: 10 USDC, created by Agent B
  Payee: Agent A (has 0 LCX, only USDC)
  LCX price: $0.15

  Fee calculation:
    4 LCX × $0.15 = $0.60 USDC total fee
    Platform fee:   $0.30 USDC (half)
    Creator reward: $0.30 USDC (half)

  Agent A sends:
    • 10 USDC  → Agent B (payment)
    • 0.30 USDC → Platform treasury (fee)
    • 0.30 USDC → Agent B (reward)

  Result:
    Agent B receives: 10 USDC + 0.30 USDC = 10.30 USDC
    Platform keeps:   0.30 USDC
    Agent A spent:    10.60 USDC


  EXAMPLE 3: Payee has SOME LCX (less than 4)
  ─────────────────────────────────────────────
  Payee has 2 LCX → NOT enough (need 4)
  → Falls back to OPTION B (USDC fee)
  → Same as Example 2

  NOTE: Partial LCX payment is NOT supported.
  Either payee has >= 4 LCX (pay in LCX) or
  the entire fee is paid in USDC equivalent.

═══════════════════════════════════════════════════════════════
  LCX PRICE FETCHING
═══════════════════════════════════════════════════════════════

  To calculate the USDC equivalent of 4 LCX, fetch live price:

  Primary: CoinGecko API
    GET https://api.coingecko.com/api/v3/simple/price
        ?ids=lcx&vs_currencies=usd
    Response: { "lcx": { "usd": 0.15 } }

  Fallback: On-chain DEX oracle (Uniswap/Chainlink)
    → If CoinGecko is down, read price from on-chain

  Cache: Cache price for 5 minutes to avoid rate limits
    → Store in memory or Redis
    → Refresh every 5 min

═══════════════════════════════════════════════════════════════
  DATABASE TABLES
═══════════════════════════════════════════════════════════════

  fee_config
  ┌────────────────────────────────────────────────────┐
  │ id                   TEXT DEFAULT 'default'         │
  │ lcx_fee_amount       NUMERIC DEFAULT 4.00           │
  │ lcx_platform_share   NUMERIC DEFAULT 2.00 (50%)     │
  │ lcx_creator_reward   NUMERIC DEFAULT 2.00 (50%)     │
  │ lcx_contract_address TEXT NOT NULL                   │
  │ treasury_wallet      TEXT NOT NULL                   │
  │ price_cache_ttl_sec  INTEGER DEFAULT 300 (5 min)     │
  │ updated_at           TIMESTAMPTZ                     │
  └────────────────────────────────────────────────────┘

  fee_transactions
  ┌────────────────────────────────────────────────────┐
  │ id                    TEXT PRIMARY KEY               │
  │ payment_request_id    TEXT REFERENCES payment_reqs   │
  │ payer_agent_id        TEXT REFERENCES agents(id)     │
  │ creator_agent_id      TEXT REFERENCES agents(id)     │
  │ fee_token             TEXT (LCX or USDC)             │
  │ fee_total             NUMERIC (4 LCX or USDC equiv)  │
  │ platform_share        NUMERIC (2 LCX or USDC half)   │
  │ creator_reward        NUMERIC (2 LCX or USDC half)   │
  │ lcx_price_usd         NUMERIC (LCX/USD at tx time)   │
  │ payment_amount        NUMERIC (original link amount)  │
  │ payment_token         TEXT (USDC)                     │
  │ treasury_wallet       TEXT                            │
  │ platform_fee_tx_hash  TEXT (tx hash for platform fee) │
  │ creator_reward_tx_hash TEXT (tx hash for reward)      │
  │ payment_tx_hash       TEXT (tx hash for payment)      │
  │ status                TEXT (PENDING/COLLECTED/FAILED)  │
  │ created_at            TIMESTAMPTZ                     │
  └────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════
  API RESPONSE (when paying a link)
═══════════════════════════════════════════════════════════════

  POST /api/pay-link response includes fee details:

  // Option A (LCX fee):
  {
    "success": true,
    "txHash": "0xabc...",
    "payment": {
      "amount": "10",
      "token": "USDC",
      "receiver": "0x742d..."
    },
    "fee": {
      "token": "LCX",
      "total": "4",
      "platformShare": "2",
      "creatorReward": "2",
      "lcxPriceUsd": "0.15"
    }
  }

  // Option B (USDC fee):
  {
    "success": true,
    "txHash": "0xabc...",
    "payment": {
      "amount": "10",
      "token": "USDC",
      "receiver": "0x742d..."
    },
    "fee": {
      "token": "USDC",
      "total": "0.60",
      "platformShare": "0.30",
      "creatorReward": "0.30",
      "lcxPriceUsd": "0.15",
      "note": "Paid in USDC (equivalent of 4 LCX)"
    }
  }

└──────────────────────────────────────────────────────────────┘
```

### Component 5: Webhook System

```
PURPOSE: Notify agents when payment events happen

FLOW:
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  Payment status changes (e.g., PENDING → PAID)               │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  WEBHOOK DISPATCHER                                 │     │
│  │                                                     │     │
│  │  1. Find all agents involved (sender + receiver)    │     │
│  │  2. Look up their registered webhooks               │     │
│  │  3. Filter by event type (payment.paid)             │     │
│  │  4. For each matching webhook:                      │     │
│  │     a. Build payload                                │     │
│  │     b. Generate HMAC signature                      │     │
│  │     c. POST to agent's webhook URL                  │     │
│  │     d. If fails → queue for retry                   │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  WHAT GETS SENT:                                             │
│  ┌─────────────────────────────────────────────────────┐     │
│  │  POST https://agent-server.com/webhook              │     │
│  │                                                     │     │
│  │  Headers:                                           │     │
│  │    X-PayMe-Event: payment.paid                      │     │
│  │    X-PayMe-Timestamp: 1707654321                    │     │
│  │    X-PayMe-Signature: sha256=abc123...              │     │
│  │                                                     │     │
│  │  Body:                                              │     │
│  │  {                                                  │     │
│  │    "event": "payment.paid",                         │     │
│  │    "payment": {                                     │     │
│  │      "id": "REQ-ABC123",                            │     │
│  │      "amount": "10.00",                             │     │
│  │      "fee": "0.30",                                 │     │
│  │      "receiverGot": "9.70",                         │     │
│  │      "txHash": "0xdef...",                          │     │
│  │      "paidBy": "agent_codebot_7x8y9z",             │     │
│  │      "paidTo": "agent_writer_abc123"                │     │
│  │    }                                                │     │
│  │  }                                                  │     │
│  └─────────────────────────────────────────────────────┘     │
│                                                              │
│  RETRY SCHEDULE (on failure):                                │
│  Retry 1: 30 seconds                                        │
│  Retry 2: 5 minutes                                         │
│  Retry 3: 30 minutes                                        │
│  Retry 4: 2 hours                                           │
│  Retry 5: 24 hours                                          │
│  After 5 failures: mark webhook inactive                     │
│                                                              │
│  EVENTS:                                                     │
│  • payment.created                                           │
│  • payment.paid                                              │
│  • payment.expired                                           │
│  • payment.cancelled                                         │
│  • agent.wallet_updated                                      │
│                                                              │
│  DATABASE TABLE: webhooks                                    │
│  ┌────────────────────────────────────────────────────┐      │
│  │ id              TEXT PRIMARY KEY                    │      │
│  │ agent_id        TEXT REFERENCES agents(id)          │      │
│  │ url             TEXT NOT NULL                       │      │
│  │ secret          TEXT NOT NULL (for HMAC)            │      │
│  │ events          TEXT[] (array of event names)       │      │
│  │ active          BOOLEAN DEFAULT true                │      │
│  │ failure_count   INTEGER DEFAULT 0                   │      │
│  │ last_failure_at TIMESTAMPTZ                         │      │
│  │ last_success_at TIMESTAMPTZ                         │      │
│  │ created_at      TIMESTAMPTZ                         │      │
│  └────────────────────────────────────────────────────┘      │
│                                                              │
│  ENDPOINTS:                                                  │
│  POST   /api/webhooks            (register)                  │
│  GET    /api/webhooks            (list mine)                 │
│  PUT    /api/webhooks/:id        (update)                    │
│  DELETE /api/webhooks/:id        (remove)                    │
│  POST   /api/webhooks/:id/test   (send test event)           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Component 6: Cleanup (Remove OpenClaw/Moltbook/Hardcoded Agents)

```
PURPOSE: Strip out project-specific code, make it generic

REMOVE:
├── openclaw-payme/          ← delete entire folder
├── openclaw-moltbook/       ← delete entire folder  
├── agent1/                  ← delete (or move to examples/)
├── agent2/                  ← delete (or move to examples/)
├── agent-payment-service/   ← delete (replaced by your platform)
├── skills/                  ← delete (replaced by docs)
├── docs/moltbook-*.md       ← delete all moltbook docs

MODIFY:
├── backend/api/index.js     ← remove AGENT_1_PRIVATE_KEY / AGENT_2_PRIVATE_KEY
│                               replace with dynamic agent lookup from DB
├── backend/server.js        ← remove Moltbook identity middleware
├── src/pages/PayAsAgent.tsx  ← remove Moltbook references
```

---

## 4. Complete Database Schema

```
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE TABLES                          │
│                                                                 │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │     agents            │    │     payment_requests            │ │
│  │                      │    │     (EXISTING, modified)         │ │
│  │ id                   │◄──┤ creator_agent_id                 │ │
│  │ username              │    │ payer_agent_id                  │ │
│  │ email                │    │ id                              │ │
│  │ api_key_hash         │    │ token                           │ │
│  │ api_key_prefix       │    │ amount                          │ │
│  │ webhook_secret_hash  │    │ receiver                        │ │
│  │ wallet_address       │    │ status                          │ │
│  │ chain                │    │ tx_hash                         │ │
│  │ status               │    │ network                         │ │
│  │ created_at           │    │ created_at                      │ │
│  │ last_active_at       │    │ description                     │ │
│  │ total_payments_sent  │    │ expires_at                      │ │
│  │ total_payments_recv  │    │ paid_at                         │ │
│  │ total_fees_paid      │    │ creator_wallet                  │ │
│  └────────┬─────────────┘    └────────────────────────────────┘ │
│           │                                                      │
│     ┌─────┴──────┐                                              │
│     │            │                                              │
│     ▼            ▼                                              │
│  ┌──────────┐ ┌───────────────┐  ┌──────────────────────────┐  │
│  │ webhooks │ │ conversations │  │ fee_transactions         │  │
│  │          │ │               │  │                          │  │
│  │ id       │ │ id            │  │ id                       │  │
│  │ agent_id │ │ agent_id      │  │ payment_request_id       │  │
│  │ url      │ │ role          │  │ payer_agent_id           │  │
│  │ secret   │ │ content       │  │ creator_agent_id         │  │
│  │ events[] │ │ created_at    │  │ fee_token (LCX/USDC)     │  │
│  │ active   │ └───────────────┘  │ fee_total               │  │
│  │ failures │                    │ platform_share           │  │
│  │ created  │                    │ creator_reward           │  │
│  └──────────┘                    │ lcx_price_usd            │  │
│                                  │ payment_amount           │  │
│               ┌────────────────┐ │ payment_token            │  │
│               │ fee_config     │ │ treasury_wallet          │  │
│               │                │ │ platform_fee_tx_hash     │  │
│               │ id             │ │ creator_reward_tx_hash   │  │
│               │ lcx_fee_amount │ │ payment_tx_hash          │  │
│               │ lcx_platform   │ │ status                   │  │
│               │   _share       │ │ created_at               │  │
│               │ lcx_creator    │ └──────────────────────────┘  │
│               │   _reward      │                                │
│               │ lcx_contract   │                                │
│               │   _address     │                                │
│               │ treasury_wallet│                                │
│               │ price_cache    │                                │
│               │   _ttl_sec     │                                │
│               │ updated_at     │                                │
│               └────────────────┘                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Complete API Endpoint Map

```
PUBLIC (no auth):
  POST /api/agents/register              ← Sign up, get API key

AUTHENTICATED (requires Bearer token):
  
  Agent Management:
  POST /api/agents/wallet                ← Update wallet address
  POST /api/agents/regenerate-key        ← Request new keys (email verify)
  GET  /api/agents/me                    ← Get my agent profile

  AI Conversation:
  POST /api/chat                         ← Talk to Grok (smart endpoint)

  Payment Links:
  POST /api/create-link                  ← Create payment link
  POST /api/pay-link                     ← Pay a link
  GET  /api/request/:id                  ← Get link status (402 if unpaid)
  GET  /api/requests                     ← List my links
  DELETE /api/request/:id                ← Delete a link

  Verification:
  POST /api/verify                       ← Verify on-chain payment

  Webhooks:
  POST   /api/webhooks                   ← Register webhook
  GET    /api/webhooks                   ← List my webhooks
  PUT    /api/webhooks/:id               ← Update webhook
  DELETE /api/webhooks/:id               ← Remove webhook
  POST   /api/webhooks/:id/test          ← Send test event

  Health:
  GET /health                            ← Platform status
```

---

## 6. Complete Payment Flow (End-to-End)

```
AGENT A (CodeBot)                YOUR PLATFORM                AGENT B (ClientBot)
 = link creator                   (PayMe)                    = payee
       │                                                            │
       │  POST /agents/register                                     │
       │  { username, email,     ──────────────────▶                │
       │    wallet }                                                │
       │                         Generates keys                     │
       │  ◀──────────────────── { agent_id,                         │
       │                          api_key,                          │
       │                          webhook_secret }                  │
       │                                                            │
       │                                                            │  POST /agents/register
       │                                                            │  { username, email,
       │                         ◀──────────────────────────────────│    wallet }
       │                         Generates keys ──────────────────▶ │
       │                                                            │
       │  POST /webhooks                                            │  POST /webhooks
       │  { url: "...", events } ──▶ Stores ◀── { url, events } ───│
       │                                                            │
       │                                                            │
═══════╪════════════════════════ PAYMENT TIME ══════════════════════╪══════
       │                                                            │
       │  POST /api/chat                                            │
       │  "Create a 10 USDC     ──────────────────▶                │
       │   payment link"                                            │
       │                         Gate 1: Auth ✅ (valid API key)     │
       │                         Gate 2: Wallet ✅ (has wallet)      │
       │                         Grok parses intent                 │
       │                         Gate 3: Validate ✅                 │
       │                         Creates link REQ-XYZ               │
       │  ◀──────────────────── "Link created!                      │
       │                          REQ-XYZ, 10 USDC"                │
       │                                                            │
       │  ═══ CodeBot sends REQ-XYZ to ClientBot (their channel) ══│
       │                                                            │
       │                                                            │  POST /api/pay-link
       │                                                            │  { linkId: "REQ-XYZ" }
       │                         ◀──────────────────────────────────│
       │                                                            │
       │                         1. Auth middleware validates key    │
       │                         2. Look up REQ-XYZ                 │
       │                         3. Check ClientBot's LCX balance   │
       │                                                            │
       │                         ┌─── Has >= 4 LCX? ───┐           │
       │                         │                      │           │
       │                        YES                    NO           │
       │                         │                      │           │
       │                         ▼                      ▼           │
       │                    FEE IN LCX            FEE IN USDC       │
       │                                                            │
       │                    4. Send 10 USDC       4. Fetch LCX      │
       │                       → CodeBot             price from     │
       │                       (full amount)         CoinGecko      │
       │                                             (e.g. $0.15)   │
       │                    5. Send 2 LCX                           │
       │                       → Treasury         5. Send 10 USDC   │
       │                       (platform fee)        → CodeBot      │
       │                                             (full amount)  │
       │                    6. Send 2 LCX                           │
       │                       → CodeBot          6. Send 0.30 USDC │
       │                       (creator reward)      → Treasury     │
       │                                             (platform fee) │
       │                                                            │
       │                                          7. Send 0.30 USDC │
       │                                             → CodeBot      │
       │                                             (creator reward)│
       │                                                            │
       │                         8. Verify all txs on-chain         │
       │                         9. Record fee_transaction          │
       │                        10. Update status → PAID            │
       │                        11. Fire webhooks to both agents    │
       │                                                            │
       │  WEBHOOK ◀────────────  payment.paid  ──────────────▶ WEBHOOK
       │                                                            │
       │  IF FEE WAS LCX:                                          │
       │  { event: "payment.paid",                                  │
       │    txHash: "0x...",                                        │
       │    amount: "10", token: "USDC",                            │
       │    fee: { token: "LCX", total: "4",                       │
       │           platformShare: "2",                              │
       │           creatorReward: "2" } }                           │
       │                                                            │
       │  IF FEE WAS USDC:                                         │
       │  { event: "payment.paid",                                  │
       │    txHash: "0x...",                                        │
       │    amount: "10", token: "USDC",                            │
       │    fee: { token: "USDC", total: "0.60",                   │
       │           platformShare: "0.30",                           │
       │           creatorReward: "0.30",                           │
       │           lcxPriceUsd: "0.15" } }                         │
       │                                                            │
       ▼                                                            ▼
  CodeBot receives:                                        ClientBot paid:
  IF LCX fee:  10 USDC + 2 LCX reward                     IF LCX fee:  10 USDC + 4 LCX
  IF USDC fee: 10 USDC + 0.30 USDC reward                 IF USDC fee: 10.60 USDC
```

---

## 7. Tech Stack Summary

```
┌────────────────────────────────────────────┐
│  TECH STACK                                │
│                                            │
│  Backend:                                  │
│  • Node.js + Express (existing)            │
│  • ethers.js (blockchain transactions)     │
│  • openai SDK (for Grok 4 Fast Thinking)   │
│  • bcrypt (API key hashing)                │
│  • crypto (HMAC signatures for webhooks)   │
│                                            │
│  AI:                                       │
│  • Grok 4 Fast Thinking via xAI API        │
│  • Base URL: https://api.x.ai/v1          │
│  • openai npm package (compatible)         │
│                                            │
│  Database:                                 │
│  • Supabase (PostgreSQL)                   │
│  • 6 tables (agents, payment_requests,     │
│    webhooks, conversations, fee_config,    │
│    fee_transactions)                       │
│                                            │
│  Frontend:                                 │
│  • React + Vite + Tailwind (existing)      │
│  • shadcn/ui components                    │
│  • RainbowKit for wallet connection        │
│                                            │
│  Blockchain:                               │
│  • Sepolia (testnet first)                 │
│  • USDC as primary token                   │
│  • On-chain verification via ethers.js     │
│                                            │
│  Deployment:                               │
│  • Vercel (existing setup)                 │
│  • Railway (alternative)                   │
│                                            │
│  Registration:                             │
│  • CLI script (npx payme-register)         │
│  • cURL endpoint                           │
│                                            │
│  Environment Variables:                    │
│  • XAI_API_KEY (Grok)                      │
│  • SUPABASE_URL + SUPABASE_ANON_KEY       │
│  • SEPOLIA_RPC_URL                         │
│  • PLATFORM_TREASURY_WALLET               │
│  • PLATFORM_FEE_PERCENTAGE                │
│                                            │
└────────────────────────────────────────────┘
```

---

## 8. Build Order

```
PHASE 1: Foundation                          
┌─────────────────────────────────────────────┐  
│ 1. Cleanup                                 │  ← Week 1
│    • Remove OpenClaw, Moltbook refs        │
│    • Remove hardcoded agent1/agent2 wallets│
│    • Remove skills/ folder                 │
│    • Clean .env of old secrets             │
│                                            │
│ 2. Agent Registration System               │
│    • agents table in Supabase              │
│    • POST /api/agents/register             │
│    • API key generation (crypto.randomBytes)│
│    • bcrypt hash storage (api_key_hash)    │
│    • CLI registration script (scripts/)    │
│    • Show credentials once, never again    │
│                                            │
│ 3. API Auth Middleware                     │
│    • Validate x-api-key header             │
│    • Look up agent by api_key_prefix       │
│    • bcrypt.compare full key vs hash       │
│    • Attach req.agent context              │
│    • Reject 401 on invalid/missing key     │
└─────────────────────────────────────────────┘  

PHASE 2: Revenue (LCX / USDC Dual-Token Fees)
┌─────────────────────────────────────────────┐  
│ 4. Fee Config                              │  ← Week 2
│    • fee_config table (single row)         │
│      - lcx_fee_amount: 4                   │
│      - lcx_platform_share: 2               │
│      - lcx_creator_reward: 2               │
│      - lcx_contract_address: "0x..."       │
│      - treasury_wallet: "0x..."            │
│      - price_cache_ttl_sec: 300            │
│                                            │
│ 5. LCX Price Service                      │
│    • CoinGecko API: GET /simple/price      │
│      ?ids=lcx&vs_currencies=usd            │
│    • 5-minute in-memory cache              │
│    • Fallback: on-chain oracle (optional)  │
│                                            │
│ 6. Fee Calculation in /api/pay-link        │
│    • Check payee LCX balance (ethers.js    │
│      ERC-20 balanceOf call)                │
│    • If >= 4 LCX → LCX fee path:          │
│      - Transfer payment USDC → creator     │
│      - Transfer 2 LCX → treasury           │
│      - Transfer 2 LCX → creator (reward)   │
│    • If < 4 LCX → USDC fee path:          │
│      - Fetch LCX price from cache/API      │
│      - USDC fee = 4 * lcx_price_usd        │
│      - 50% USDC fee → treasury             │
│      - 50% USDC fee → creator (reward)     │
│      - Transfer (amount + fee) USDC        │
│                                            │
│ 7. fee_transactions table                  │
│    • Record every fee: token, total,       │
│      platform_share, creator_reward,       │
│      lcx_price_usd, all tx hashes         │
└─────────────────────────────────────────────┘  

PHASE 3: Notifications                       
┌─────────────────────────────────────────────┐  
│ 8. Webhook System                          │  ← Week 2-3
│    • webhooks table                        │
│    • CRUD: POST/GET/DELETE /api/webhooks   │
│    • Events: payment.created,              │
│      payment.paid, payment.expired,        │
│      payment.failed                        │
│    • Dispatcher with HMAC-SHA256 signing   │
│    • Exponential backoff retry (3 attempts)│
│    • Include fee breakdown in payload      │
└─────────────────────────────────────────────┘  

PHASE 4: Intelligence                        
┌─────────────────────────────────────────────┐  
│ 9. AI Conversation Layer                   │  ← Week 3
│    • Grok 4 Fast Thinking via openai SDK   │
│    • POST /api/chat endpoint               │
│    • Gate 1 (AUTH): auth middleware         │
│    • Gate 2 (WALLET): check/ask/detect     │
│      wallet address                        │
│    • Gate 3 (VALIDATE): validate params    │
│    • System prompt engineering              │
│    • conversations table for memory        │
│    • Intent → action routing:              │
│      create-link, check-status, pay-link   │
└─────────────────────────────────────────────┘  

PHASE 5: Polish                              
┌─────────────────────────────────────────────┐  
│ 10. Update Frontend Dashboard              │  ← Week 4
│     • Registered agents overview           │
│     • Fee analytics (LCX vs USDC breakdown)│
│     • Webhook delivery logs                │
│     • Platform revenue (treasury balance)  │
│     • Payment history with fee details     │
└─────────────────────────────────────────────┘  
```

---

## 9. Security Model

```
═══════════════════════════════════════════════════════════════
  THREAT MODEL & MITIGATIONS
═══════════════════════════════════════════════════════════════

  PRINCIPLE: Defense in depth — every layer validates independently

  ┌────────────────────────────────────────────────────────────┐
  │  LAYER 1: TRANSPORT SECURITY                               │
  │                                                            │
  │  • All API calls over HTTPS (TLS 1.2+)                     │
  │  • Vercel/Railway enforce HTTPS by default                 │
  │  • No HTTP fallback — reject plaintext connections          │
  │  • HSTS headers enabled                                    │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  LAYER 2: AUTHENTICATION                                   │
  │                                                            │
  │  API Key Structure:                                        │
  │    pk_live_<32 random bytes as hex> = 73 chars total        │
  │    Prefix: pk_live_<first 12 chars> used for DB lookup     │
  │    Full key: bcrypt-hashed (cost factor 12) before storage │
  │                                                            │
  │  Why bcrypt for API keys?                                  │
  │  • If DB is breached, attacker gets hashes, not keys       │
  │  • bcrypt is intentionally slow → brute-force resistant    │
  │  • Cost factor 12 ≈ ~250ms per hash on modern hardware     │
  │  • Even with prefix leak, full key cannot be derived       │
  │                                                            │
  │  Auth Flow (every request):                                │
  │  1. Extract key from Authorization: Bearer pk_live_...     │
  │     OR from x-api-key header (both supported)              │
  │  2. Extract prefix (first 12 chars after "pk_live_")       │
  │  3. SELECT * FROM agents WHERE api_key_prefix = $1         │
  │  4. bcrypt.compare(submitted_key, stored_hash)             │
  │  5. Check agent.status === 'active'                        │
  │  6. Update agent.last_active_at timestamp                  │
  │                                                            │
  │  Timing Attack Mitigation:                                 │
  │  • bcrypt.compare is constant-time by design               │
  │  • Even invalid prefixes execute in similar time           │
  │    (bcrypt runs on a dummy hash if agent not found)        │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  LAYER 3: WEBHOOK INTEGRITY (HMAC-SHA256)                  │
  │                                                            │
  │  Every webhook delivery is signed:                         │
  │                                                            │
  │  Signature = HMAC-SHA256(                                  │
  │    key:  webhook_secret (whsec_<32 random bytes>),         │
  │    data: JSON.stringify(payload)                           │
  │  )                                                         │
  │                                                            │
  │  Headers sent with every webhook:                          │
  │    X-PayMe-Signature:  sha256=<hex signature>              │
  │    X-PayMe-Timestamp:  <unix epoch seconds>                │
  │    X-PayMe-Event:      <event name>                        │
  │    X-PayMe-Delivery:   <unique delivery ID>                │
  │                                                            │
  │  Agent-side verification (pseudo-code):                    │
  │    expected = hmac_sha256(webhook_secret, raw_body)        │
  │    actual   = request.headers['x-payme-signature']         │
  │    if (expected !== actual) → reject                       │
  │    if (timestamp older than 5 min) → reject (replay)      │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  LAYER 4: INPUT VALIDATION                                 │
  │                                                            │
  │  Every endpoint validates:                                 │
  │  • Wallet addresses: /^0x[a-fA-F0-9]{40}$/                │
  │  • Amounts: positive numbers, max 18 decimals              │
  │  • Token names: whitelist (USDC, ETH, LCX)                │
  │  • Chain names: whitelist (sepolia, base, arbitrum, bnb)   │
  │  • Email: standard RFC 5322 regex                          │
  │  • Username: /^[a-zA-Z0-9_-]{3,30}$/                      │
  │  • URLs (webhook): must start with https://                │
  │  • SQL injection: Supabase parameterized queries           │
  │  • XSS: no HTML rendering of user input                   │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  LAYER 5: NON-CUSTODIAL ARCHITECTURE                       │
  │                                                            │
  │  Critical security property:                               │
  │  THE PLATFORM NEVER HOLDS AGENT PRIVATE KEYS               │
  │                                                            │
  │  • Agents register with a wallet address (public key only) │
  │  • When paying, agents sign transactions themselves        │
  │  • The platform returns payment instructions:              │
  │    "Send X USDC to address Y, send Z LCX to address W"    │
  │  • The agent submits the transaction to the blockchain     │
  │  • The platform verifies the transaction on-chain          │
  │                                                            │
  │  Why this matters:                                         │
  │  • If PayMe is hacked, no private keys are exposed         │
  │  • No regulatory burden of holding customer funds          │
  │  • Agents maintain full custody of their assets            │
  │  • Platform liability is limited to data, not funds        │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  LAYER 6: RATE LIMITING                                    │
  │                                                            │
  │  Per-Agent Limits:                                         │
  │  • /api/chat:           20 requests / minute               │
  │  • /api/create-link:    60 requests / minute               │
  │  • /api/pay-link:       30 requests / minute               │
  │  • /api/verify:         60 requests / minute               │
  │  • /api/webhooks:       10 requests / minute               │
  │                                                            │
  │  Global Limits:                                            │
  │  • /api/agents/register: 5 requests / minute / IP          │
  │  • /api/stats:           30 requests / minute              │
  │                                                            │
  │  Implementation:                                           │
  │  • In-memory sliding window counter per agent ID           │
  │  • Returns 429 Too Many Requests with Retry-After header   │
  │  • Webhook test endpoint: 1 request / 10 seconds / agent   │
  └────────────────────────────────────────────────────────────┘

  ┌────────────────────────────────────────────────────────────┐
  │  COMMON ATTACK VECTORS & DEFENSES                          │
  │                                                            │
  │  Attack: Replay webhook event                              │
  │  Defense: Timestamp check (reject if > 5 min old)          │
  │                                                            │
  │  Attack: Brute-force API keys                              │
  │  Defense: bcrypt hashing + rate limiting on auth failures   │
  │                                                            │
  │  Attack: Register many agents to spam                      │
  │  Defense: Rate limit /register by IP, email verification   │
  │                                                            │
  │  Attack: Fake on-chain verification                        │
  │  Defense: Platform reads tx directly from RPC (not agent)  │
  │                                                            │
  │  Attack: Pay with insufficient funds (front-run)           │
  │  Defense: Verify actual on-chain balances before accepting  │
  │                                                            │
  │  Attack: Create links to exhaust DB                        │
  │  Defense: Rate limit + auto-expire links after 24 hours    │
  │                                                            │
  │  Attack: Webhook URL pointing to internal IPs (SSRF)       │
  │  Defense: Validate URL is public (block 10.x, 192.168.x,  │
  │           127.x, 169.254.x, fd00::/8, etc.)               │
  └────────────────────────────────────────────────────────────┘
```

---

## 10. Non-Custodial Payment Architecture

```
═══════════════════════════════════════════════════════════════
  HOW PAYMENTS ACTUALLY WORK (NON-CUSTODIAL)
═══════════════════════════════════════════════════════════════

  Key concept: PayMe is an ORCHESTRATOR, not a CUSTODIAN.
  It tells agents WHAT to do, agents DO it themselves.

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  STEP 1: CREATE LINK                                     │
  │                                                          │
  │  Creator Agent → POST /api/create-link                   │
  │  {                                                       │
  │    "amount": "10",                                       │
  │    "token": "USDC",                                      │
  │    "description": "Payment for code review"              │
  │  }                                                       │
  │                                                          │
  │  Platform Response:                                      │
  │  {                                                       │
  │    "id": "REQ-a7f3b2",                                   │
  │    "amount": "10",                                       │
  │    "token": "USDC",                                      │
  │    "receiver": "0x742d...abc1",  // creator's wallet     │
  │    "status": "PENDING",                                  │
  │    "expiresAt": "2026-02-12T12:00:00Z"                   │
  │  }                                                       │
  │                                                          │
  │  → At this point, NO money has moved. The platform has   │
  │    only recorded the INTENT to be paid.                  │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  STEP 2: PAY LINK (get instructions)                     │
  │                                                          │
  │  Payee Agent → POST /api/pay-link                        │
  │  { "linkId": "REQ-a7f3b2" }                              │
  │                                                          │
  │  Platform does NOT execute the payment.                  │
  │  Instead, it returns PAYMENT INSTRUCTIONS:               │
  │                                                          │
  │  Response (if payee has LCX):                            │
  │  {                                                       │
  │    "status": "awaiting_payment",                         │
  │    "instructions": {                                     │
  │      "transfers": [                                      │
  │        {                                                 │
  │          "to": "0x742d...abc1",   // creator wallet      │
  │          "token": "USDC",                                │
  │          "amount": "10",                                 │
  │          "purpose": "payment"                            │
  │        },                                                │
  │        {                                                 │
  │          "to": "0xTREASURY...",   // platform treasury   │
  │          "token": "LCX",                                 │
  │          "amount": "2",                                  │
  │          "purpose": "platform_fee"                       │
  │        },                                                │
  │        {                                                 │
  │          "to": "0x742d...abc1",   // creator wallet      │
  │          "token": "LCX",                                 │
  │          "amount": "2",                                  │
  │          "purpose": "creator_reward"                     │
  │        }                                                 │
  │      ],                                                  │
  │      "deadline": "2026-02-12T12:00:00Z"                  │
  │    },                                                    │
  │    "fee": {                                              │
  │      "token": "LCX",                                     │
  │      "total": "4",                                       │
  │      "platformShare": "2",                               │
  │      "creatorReward": "2"                                │
  │    }                                                     │
  │  }                                                       │
  │                                                          │
  │  → The AGENT now executes these transfers using its own  │
  │    wallet and private key. The platform never touches     │
  │    the private key.                                      │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  STEP 3: VERIFY ON-CHAIN                                 │
  │                                                          │
  │  After the agent submits the transaction(s), it calls:   │
  │                                                          │
  │  Payee Agent → POST /api/verify                          │
  │  {                                                       │
  │    "requestId": "REQ-a7f3b2",                            │
  │    "txHash": "0xdef456...",                               │
  │    "feeTxHash": "0xabc789..."  // optional, fee tx       │
  │  }                                                       │
  │                                                          │
  │  Platform verification steps:                            │
  │  1. Fetch transaction receipt from RPC node               │
  │  2. Decode ERC-20 Transfer events from the tx logs       │
  │  3. Verify:                                              │
  │     a. Correct token contract was called                 │
  │     b. Correct amount was transferred                    │
  │     c. Correct receiver address received funds           │
  │     d. Transaction was successful (status = 1)           │
  │     e. Transaction is on the expected chain/network      │
  │  4. If fee tx provided, verify fee transfers similarly   │
  │  5. Update payment_request.status → "PAID"               │
  │  6. Record fee_transaction with all hashes               │
  │  7. Increment agent counters                             │
  │  8. Dispatch webhook events to both agents               │
  │                                                          │
  │  Response:                                               │
  │  {                                                       │
  │    "verified": true,                                     │
  │    "status": "PAID",                                     │
  │    "txHash": "0xdef456...",                               │
  │    "blockNumber": 12345678,                              │
  │    "timestamp": "2026-02-11T15:30:00Z"                   │
  │  }                                                       │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │                                                          │
  │  WHY NON-CUSTODIAL?                                      │
  │                                                          │
  │  Custodial (PayMe holds keys):                           │
  │  ✗ Huge security liability                               │
  │  ✗ Regulatory burden (money transmitter license)         │
  │  ✗ Single point of failure                               │
  │  ✗ Agent developers must trust the platform              │
  │                                                          │
  │  Non-Custodial (agents hold keys):                       │
  │  ✓ Platform breach doesn't expose funds                  │
  │  ✓ No money transmitter license needed                   │
  │  ✓ Agents maintain sovereignty                           │
  │  ✓ Platform is just an orchestration layer               │
  │  ✓ Trust-minimized by design                             │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

---

## 11. AI System Prompt Specification

```
═══════════════════════════════════════════════════════════════
  GROK 4 FAST THINKING — SYSTEM PROMPT ENGINEERING
═══════════════════════════════════════════════════════════════

  The system prompt is dynamically constructed per-request,
  injecting the authenticated agent's context.

  ┌──────────────────────────────────────────────────────────┐
  │  SYSTEM PROMPT TEMPLATE                                  │
  │                                                          │
  │  "You are the PayMe AI Payment Assistant.                │
  │   You help AI agents create, pay, and manage crypto      │
  │   payment links.                                         │
  │                                                          │
  │   CURRENT AGENT CONTEXT:                                 │
  │   - Agent ID: {{agent_id}}                               │
  │   - Username: {{username}}                               │
  │   - Wallet: {{wallet_address}}                           │
  │   - Chain: {{chain}}                                     │
  │                                                          │
  │   You MUST respond in valid JSON with this structure:     │
  │   {                                                      │
  │     "action": "<action_name>",                           │
  │     "params": { ... },                                   │
  │     "message": "<human-readable response>"               │
  │   }                                                      │
  │                                                          │
  │   SUPPORTED ACTIONS:                                     │
  │                                                          │
  │   1. create_link                                         │
  │      params: { amount, token, description? }             │
  │      When the agent wants to create a payment link.      │
  │      Extract amount and token from natural language.      │
  │      Default token is USDC if not specified.             │
  │                                                          │
  │   2. pay_link                                            │
  │      params: { linkId }                                  │
  │      When the agent wants to pay an existing link.       │
  │      Extract the link ID (REQ-xxx format).               │
  │                                                          │
  │   3. check_status                                        │
  │      params: { linkId }                                  │
  │      When the agent asks about a payment's status.       │
  │                                                          │
  │   4. register_wallet                                     │
  │      params: { walletAddress, chain? }                   │
  │      When the agent provides a wallet address.           │
  │      Validate: must be 0x + 40 hex characters.           │
  │                                                          │
  │   5. list_payments                                       │
  │      params: { status?, limit? }                         │
  │      When the agent wants to see their payment history.  │
  │                                                          │
  │   6. clarify                                             │
  │      params: {}                                          │
  │      When the message is unclear or you need more info.  │
  │      Use the message field to ask for clarification."    │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  INTENT PARSING EXAMPLES                                 │
  │                                                          │
  │  User: "I need to charge someone 25 USDC for my API"     │
  │  →  action: "create_link"                                │
  │     params: { amount: "25", token: "USDC",               │
  │              description: "API usage charge" }            │
  │                                                          │
  │  User: "pay REQ-abc123"                                  │
  │  →  action: "pay_link"                                   │
  │     params: { linkId: "REQ-abc123" }                     │
  │                                                          │
  │  User: "what's happening with REQ-xyz789?"               │
  │  →  action: "check_status"                               │
  │     params: { linkId: "REQ-xyz789" }                     │
  │                                                          │
  │  User: "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e"      │
  │  →  action: "register_wallet"                            │
  │     params: { walletAddress: "0x742d...bD1e" }           │
  │                                                          │
  │  User: "show me my recent payments"                      │
  │  →  action: "list_payments"                              │
  │     params: { limit: 10 }                                │
  │                                                          │
  │  User: "hello"                                           │
  │  →  action: "clarify"                                    │
  │     params: {}                                           │
  │     message: "Hi! I'm the PayMe assistant. I can help    │
  │              you create payment links, pay existing       │
  │              links, or check payment status. What would   │
  │              you like to do?"                             │
  │                                                          │
  │  User: "send 50 bucks to 0x123...abc"                    │
  │  →  action: "create_link"                                │
  │     params: { amount: "50", token: "USDC",               │
  │              description: "Payment to 0x123...abc" }      │
  │     message: "I'll create a 50 USDC payment link. Note   │
  │              that the recipient address you mentioned     │
  │              will need to pay this link."                 │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CONVERSATION MEMORY                                     │
  │                                                          │
  │  Storage: conversations table in Supabase                │
  │                                                          │
  │  • Each message stored with agent_id + role + content    │
  │  • Last 10 messages loaded as context for each request   │
  │  • Roles: "system", "user", "assistant"                  │
  │  • Enables multi-turn conversations:                     │
  │                                                          │
  │    Turn 1: "Create a link for 10 USDC"                   │
  │    → AI creates link REQ-abc123                          │
  │                                                          │
  │    Turn 2: "Make another one but for 20"                  │
  │    → AI understands context: 20 USDC, creates new link   │
  │                                                          │
  │    Turn 3: "What's the status of the first one?"          │
  │    → AI recalls REQ-abc123 from memory, checks status    │
  │                                                          │
  │  Memory Window: 10 messages                              │
  │  • Prevents unbounded token usage                        │
  │  • Most recent context is most relevant                  │
  │  • Older context naturally falls off                     │
  │  • Agent can call POST /api/chat/clear to reset          │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  MODEL CONFIGURATION                                     │
  │                                                          │
  │  Provider:    xAI                                        │
  │  Model:       grok-4-fast (or grok-3-fast fallback)      │
  │  API Base:    https://api.x.ai/v1                        │
  │  SDK:         openai npm package (compatible)             │
  │  Auth:        XAI_API_KEY env variable                    │
  │                                                          │
  │  Parameters:                                             │
  │  • temperature: 0         (deterministic for actions)    │
  │  • max_tokens: 1024       (actions are concise)          │
  │  • response_format: json  (structured output)            │
  │                                                          │
  │  Why Grok 4 Fast Thinking?                               │
  │  • Fast inference (< 2 seconds typical)                  │
  │  • Good at structured JSON output                        │
  │  • "Thinking" capability helps with ambiguous requests   │
  │  • OpenAI SDK compatible (easy to integrate)             │
  │  • Competitive pricing for high-volume agent traffic     │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

---

## 12. Webhook Verification Guide (For Agent Developers)

```
═══════════════════════════════════════════════════════════════
  HOW AGENTS VERIFY WEBHOOK AUTHENTICITY
═══════════════════════════════════════════════════════════════

  When your agent receives a webhook from PayMe, it MUST
  verify the signature before trusting the payload.

  ┌──────────────────────────────────────────────────────────┐
  │  INCOMING WEBHOOK                                        │
  │                                                          │
  │  POST https://your-agent-server.com/webhook              │
  │                                                          │
  │  Headers:                                                │
  │    Content-Type:        application/json                  │
  │    X-PayMe-Event:       payment.paid                     │
  │    X-PayMe-Timestamp:   1707654321                       │
  │    X-PayMe-Signature:   sha256=a1b2c3d4e5f6...           │
  │    X-PayMe-Delivery:    del_7x8y9z                       │
  │                                                          │
  │  Body:                                                   │
  │  {                                                       │
  │    "event": "payment.paid",                              │
  │    "timestamp": 1707654321,                              │
  │    "data": {                                             │
  │      "id": "REQ-ABC123",                                 │
  │      "amount": "10.00",                                  │
  │      "token": "USDC",                                    │
  │      "txHash": "0xdef...",                               │
  │      "paidBy": "agent_codebot_7x8y9z",                  │
  │      "paidTo": "agent_writer_abc123",                    │
  │      "fee": {                                            │
  │        "token": "LCX",                                   │
  │        "total": "4",                                     │
  │        "platformShare": "2",                             │
  │        "creatorReward": "2",                             │
  │        "lcxPriceUsd": "0.15"                             │
  │      }                                                   │
  │    }                                                     │
  │  }                                                       │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  VERIFICATION CODE (Node.js)                             │
  │                                                          │
  │  const crypto = require('crypto');                       │
  │                                                          │
  │  function verifyWebhook(req, webhookSecret) {            │
  │    const signature = req.headers['x-payme-signature'];   │
  │    const timestamp = req.headers['x-payme-timestamp'];   │
  │    const body = JSON.stringify(req.body);                 │
  │                                                          │
  │    // 1. Check timestamp (reject if > 5 min old)         │
  │    const now = Math.floor(Date.now() / 1000);            │
  │    if (now - parseInt(timestamp) > 300) {                │
  │      throw new Error('Webhook too old (replay attack)'); │
  │    }                                                     │
  │                                                          │
  │    // 2. Compute expected signature                      │
  │    const expected = 'sha256=' + crypto                   │
  │      .createHmac('sha256', webhookSecret)                │
  │      .update(body)                                       │
  │      .digest('hex');                                     │
  │                                                          │
  │    // 3. Constant-time comparison                        │
  │    if (!crypto.timingSafeEqual(                          │
  │      Buffer.from(signature),                             │
  │      Buffer.from(expected)                               │
  │    )) {                                                  │
  │      throw new Error('Invalid signature');               │
  │    }                                                     │
  │                                                          │
  │    return true; // Webhook is authentic                  │
  │  }                                                       │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  VERIFICATION CODE (Python)                              │
  │                                                          │
  │  import hmac, hashlib, time                              │
  │                                                          │
  │  def verify_webhook(headers, body, webhook_secret):      │
  │      signature = headers.get('X-PayMe-Signature')        │
  │      timestamp = headers.get('X-PayMe-Timestamp')        │
  │                                                          │
  │      # 1. Check timestamp                                │
  │      if time.time() - int(timestamp) > 300:              │
  │          raise ValueError('Webhook too old')             │
  │                                                          │
  │      # 2. Compute expected signature                     │
  │      expected = 'sha256=' + hmac.new(                    │
  │          webhook_secret.encode(),                        │
  │          body.encode(),                                  │
  │          hashlib.sha256                                  │
  │      ).hexdigest()                                       │
  │                                                          │
  │      # 3. Compare                                        │
  │      if not hmac.compare_digest(signature, expected):    │
  │          raise ValueError('Invalid signature')           │
  │                                                          │
  │      return True                                         │
  │                                                          │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  BEST PRACTICES FOR WEBHOOK CONSUMERS                    │
  │                                                          │
  │  1. Always verify signatures before processing           │
  │  2. Return 200 OK quickly (< 5 seconds)                  │
  │  3. Process async — queue the event, respond 200 first   │
  │  4. Handle idempotency — same event may arrive twice     │
  │     (use X-PayMe-Delivery ID as dedup key)               │
  │  5. Store the webhook_secret securely (env variable)     │
  │  6. Log all webhook deliveries for debugging             │
  │  7. Test with POST /api/webhooks/:id/test first          │
  │                                                          │
  └──────────────────────────────────────────────────────────┘
```

---

## 13. Error Handling & Edge Cases

```
═══════════════════════════════════════════════════════════════
  ERROR CODES & RESPONSES
═══════════════════════════════════════════════════════════════

  HTTP    Code                Meaning
  ─────   ──────────────────  ─────────────────────────────────
  200     success             Request succeeded
  201     created             Resource created (agent, link)
  400     bad_request         Invalid parameters
  401     unauthorized        Missing/invalid API key
  402     payment_required    Payment link exists but unpaid
  403     forbidden           Agent doesn't own this resource
  404     not_found           Resource doesn't exist
  409     conflict            Username/email already taken
  410     gone                Payment link expired
  429     rate_limited        Too many requests
  500     internal_error      Server error (DB, RPC, etc.)

═══════════════════════════════════════════════════════════════
  ERROR RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

  All errors follow a consistent JSON structure:

  {
    "error": true,
    "code": "unauthorized",
    "message": "Invalid or missing API key",
    "details": {                          // optional
      "hint": "Include Authorization: Bearer pk_live_... header"
    }
  }

═══════════════════════════════════════════════════════════════
  EDGE CASES & HANDLING
═══════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Agent tries to pay their own link                 │
  │                                                          │
  │  Behavior: Allowed (no restriction)                      │
  │  Rationale: Some agents may use self-payment for testing │
  │  Fee: Still collected normally                           │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Payment link expires while agent is paying        │
  │                                                          │
  │  Behavior: If tx is submitted before expiry but verified │
  │  after, the platform checks the tx timestamp (block      │
  │  time). If the on-chain tx occurred before the link      │
  │  expired, the payment is accepted. If after, rejected.   │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: LCX price changes between /pay-link and /verify   │
  │                                                          │
  │  Behavior: The fee is locked at the time /pay-link is    │
  │  called. The fee amount returned by /pay-link is what    │
  │  gets verified. If the price changes dramatically, the   │
  │  platform still accepts the originally quoted fee.       │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: CoinGecko API is down                             │
  │                                                          │
  │  Behavior:                                               │
  │  1. Use stale cached price (even if > 5 min old)         │
  │  2. If no cache exists at all, use hardcoded fallback    │
  │     price from fee_config table                          │
  │  3. Log warning for platform operator                    │
  │  4. Webhook payload includes lcxPriceUsd so agents       │
  │     can see which price was used                         │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Supabase is unavailable                           │
  │                                                          │
  │  Behavior:                                               │
  │  • Agent registration: Falls back to in-memory map       │
  │  • Auth: Falls back to in-memory agent lookup            │
  │  • Conversations: Falls back to in-memory history        │
  │  • Payments: Will fail (cannot create without DB)        │
  │  • Webhooks: Will fail (cannot look up URLs without DB)  │
  │                                                          │
  │  Recovery: When DB comes back, in-memory data is NOT     │
  │  synced (by design — stateless serverless functions).     │
  │  Agents must re-register if they registered during       │
  │  the outage.                                             │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Agent submits wrong tx hash for verification      │
  │                                                          │
  │  Behavior: Platform reads the tx from the RPC node.      │
  │  If the tx doesn't transfer the correct token/amount     │
  │  to the correct address, verification fails with:        │
  │                                                          │
  │  { "verified": false,                                    │
  │    "error": "Transaction does not match payment" }       │
  │                                                          │
  │  The payment remains in PENDING status.                  │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Multiple agents try to pay the same link          │
  │                                                          │
  │  Behavior: First verified payment wins.                  │
  │  Once status is PAID, subsequent /pay-link calls return: │
  │                                                          │
  │  { "error": true,                                        │
  │    "code": "already_paid",                               │
  │    "message": "This payment link has already been paid" } │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Agent loses API key                               │
  │                                                          │
  │  Behavior: Agent cannot recover the key (bcrypt hashed). │
  │  Must use POST /api/agents/regenerate-key with email     │
  │  verification to generate a new API key.                 │
  │  Old key is immediately invalidated.                     │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CASE: Webhook endpoint consistently fails               │
  │                                                          │
  │  Behavior:                                               │
  │  • Retry 1: 30 seconds after failure                     │
  │  • Retry 2: 5 minutes after Retry 1 failure              │
  │  • Retry 3: 30 minutes after Retry 2 failure             │
  │  • Retry 4: 2 hours after Retry 3 failure                │
  │  • Retry 5: 24 hours after Retry 4 failure               │
  │  • After Retry 5: webhook.active = false                 │
  │  • Agent is NOT notified (no meta-webhook)               │
  │  • Agent can re-enable via PUT /api/webhooks/:id         │
  │    { "active": true } — resets failure_count to 0        │
  └──────────────────────────────────────────────────────────┘
```

---

## 14. Agent Developer Quickstart Guide

```
═══════════════════════════════════════════════════════════════
  GETTING STARTED IN 5 MINUTES
═══════════════════════════════════════════════════════════════

  STEP 1: REGISTER YOUR AGENT
  ─────────────────────────────

  curl -X POST https://payme.example.com/api/agents/register \
    -H "Content-Type: application/json" \
    -d '{
      "username": "my-awesome-bot",
      "email": "dev@example.com",
      "walletAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e"
    }'

  Response (SAVE THESE — shown only once):
  {
    "agentId": "agent_my-awesome-bot_a7f3b2",
    "apiKey": "pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
    "webhookSecret": "whsec_x1y2z3a4b5c6d7e8f9g0h1i2j3k4l5m6",
    "message": "Save these credentials. They will not be shown again."
  }

  STEP 2: CREATE A PAYMENT LINK
  ──────────────────────────────

  Option A — Direct API:

  curl -X POST https://payme.example.com/api/create-link \
    -H "Authorization: Bearer pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
    -H "Content-Type: application/json" \
    -d '{
      "amount": "10",
      "token": "USDC",
      "description": "Code review for PR #42"
    }'

  Option B — AI Chat (natural language):

  curl -X POST https://payme.example.com/api/chat \
    -H "Authorization: Bearer pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
    -H "Content-Type: application/json" \
    -d '{
      "message": "Create a payment link for 10 USDC for code review"
    }'


  STEP 3: SHARE THE LINK ID
  ──────────────────────────

  Send the link ID (REQ-xxx) to the payee through any channel:
  • Direct API call between agents
  • Messaging protocol
  • Email
  • Any inter-agent communication


  STEP 4: PAYEE PAYS THE LINK
  ────────────────────────────

  The payee agent calls:

  curl -X POST https://payme.example.com/api/pay-link \
    -H "Authorization: Bearer pk_live_PAYEE_KEY_HERE" \
    -H "Content-Type: application/json" \
    -d '{ "linkId": "REQ-abc123" }'

  This returns payment INSTRUCTIONS (transfers to execute).
  The payee agent executes these transfers using its wallet.


  STEP 5: VERIFY PAYMENT
  ───────────────────────

  After submitting the on-chain transaction:

  curl -X POST https://payme.example.com/api/verify \
    -H "Authorization: Bearer pk_live_PAYEE_KEY_HERE" \
    -H "Content-Type: application/json" \
    -d '{
      "requestId": "REQ-abc123",
      "txHash": "0xdef456789..."
    }'


  STEP 6: SET UP WEBHOOKS (optional but recommended)
  ───────────────────────────────────────────────────

  curl -X POST https://payme.example.com/api/webhooks \
    -H "Authorization: Bearer pk_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" \
    -H "Content-Type: application/json" \
    -d '{
      "url": "https://my-agent-server.com/webhook",
      "events": ["payment.paid", "payment.expired"]
    }'

  Now your agent will be notified in real-time when payments
  are completed or expire. Don't forget to verify signatures!

═══════════════════════════════════════════════════════════════
  COMPLETE NODE.JS AGENT EXAMPLE
═══════════════════════════════════════════════════════════════

  // agent.js — A minimal PayMe-integrated agent

  const API_KEY = process.env.PAYME_API_KEY;
  const BASE_URL = 'https://payme.example.com';

  async function createPaymentLink(amount, token, description) {
    const res = await fetch(`${BASE_URL}/api/create-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ amount, token, description }),
    });
    return res.json();
  }

  async function chatWithPayMe(message) {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    return res.json();
  }

  async function payLink(linkId) {
    const res = await fetch(`${BASE_URL}/api/pay-link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ linkId }),
    });
    return res.json();
    // Returns instructions → agent executes transfers
  }

  async function verifyPayment(requestId, txHash) {
    const res = await fetch(`${BASE_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requestId, txHash }),
    });
    return res.json();
  }

  // Example usage:
  (async () => {
    // Create a link
    const link = await createPaymentLink('10', 'USDC', 'API access');
    console.log('Link created:', link.id);

    // Or use AI chat
    const chat = await chatWithPayMe('create a 25 USDC link for data');
    console.log('AI response:', chat.message);
  })();

═══════════════════════════════════════════════════════════════
  COMPLETE PYTHON AGENT EXAMPLE
═══════════════════════════════════════════════════════════════

  # agent.py — A minimal PayMe-integrated agent

  import os, requests

  API_KEY = os.environ['PAYME_API_KEY']
  BASE_URL = 'https://payme.example.com'
  HEADERS = {
      'Authorization': f'Bearer {API_KEY}',
      'Content-Type': 'application/json',
  }

  def create_payment_link(amount, token='USDC', description=''):
      res = requests.post(f'{BASE_URL}/api/create-link',
          headers=HEADERS,
          json={'amount': amount, 'token': token,
                'description': description})
      return res.json()

  def chat_with_payme(message):
      res = requests.post(f'{BASE_URL}/api/chat',
          headers=HEADERS,
          json={'message': message})
      return res.json()

  def pay_link(link_id):
      res = requests.post(f'{BASE_URL}/api/pay-link',
          headers=HEADERS,
          json={'linkId': link_id})
      return res.json()

  def verify_payment(request_id, tx_hash):
      res = requests.post(f'{BASE_URL}/api/verify',
          headers=HEADERS,
          json={'requestId': request_id, 'txHash': tx_hash})
      return res.json()

  # Example usage:
  link = create_payment_link('10', 'USDC', 'Data analysis')
  print(f"Link created: {link['id']}")

  response = chat_with_payme('create a 5 USDC link for API calls')
  print(f"AI: {response['message']}")
```

---

## 15. Full Conversation Examples

```
═══════════════════════════════════════════════════════════════
  EXAMPLE 1: New Agent with No Wallet
═══════════════════════════════════════════════════════════════

  Agent "DataBot" just registered but without a wallet address.

  Agent:  "Create a payment link for 5 USDC"
  ─────
  GATE 1 (Auth): ✅ Valid API key, agent is active
  GATE 2 (Wallet): ❌ No wallet registered

  PayMe:  {
            "action_required": "provide_wallet",
            "message": "You don't have a wallet address
              registered. Please share your wallet address
              (0x...) to get started."
          }

  Agent:  "0x742d35Cc6634C0532925a3b844Bc9e7595f2bD1e"
  ─────
  GATE 2 (Wallet): Detected 0x address in message!
    → Auto-registers wallet
    → Asks what agent wants to do

  PayMe:  {
            "message": "Wallet registered! Your address
              0x742d...bD1e is now linked to your account.
              What would you like to do?"
          }

  Agent:  "Now create that 5 USDC link"
  ─────
  GATE 2 (Wallet): ✅ Has wallet
  AI: Parses intent → create_link
  GATE 3: ✅ Valid params

  PayMe:  {
            "message": "Payment link created!",
            "data": {
              "id": "REQ-d4e5f6",
              "amount": "5",
              "token": "USDC",
              "status": "PENDING"
            }
          }

═══════════════════════════════════════════════════════════════
  EXAMPLE 2: Multi-Turn Payment Flow
═══════════════════════════════════════════════════════════════

  Agent "CodeBot" has a wallet registered.

  Agent:  "I need to charge 50 USDC for my code review service"
  ─────
  PayMe:  {
            "message": "I've created a 50 USDC payment link
              for your code review service.",
            "data": {
              "id": "REQ-x7y8z9",
              "amount": "50",
              "token": "USDC",
              "receiver": "0x742d...abc1",
              "status": "PENDING"
            }
          }

  Agent:  "What's the status?"
  ─────
  PayMe:  {
            "message": "Payment link REQ-x7y8z9 is still
              PENDING. No one has paid it yet.",
            "data": {
              "id": "REQ-x7y8z9",
              "status": "PENDING",
              "createdAt": "2026-02-11T10:30:00Z",
              "expiresAt": "2026-02-12T10:30:00Z"
            }
          }

  [4 hours later, ClientBot pays the link]

  Agent:  "Is my payment done yet?"
  ─────
  PayMe:  {
            "message": "Great news! REQ-x7y8z9 has been paid!
              You received 50 USDC + 2 LCX creator reward.
              The payee paid 4 LCX in fees.",
            "data": {
              "id": "REQ-x7y8z9",
              "status": "PAID",
              "txHash": "0xdef456...",
              "fee": { "token": "LCX", "creatorReward": "2" }
            }
          }

═══════════════════════════════════════════════════════════════
  EXAMPLE 3: Agent Paying a Link
═══════════════════════════════════════════════════════════════

  Agent "ClientBot" received link REQ-x7y8z9 from CodeBot.

  Agent:  "I need to pay REQ-x7y8z9"
  ─────
  PayMe:  {
            "message": "Here are the payment instructions for
              REQ-x7y8z9 (50 USDC). You have enough LCX, so
              the fee will be 4 LCX.",
            "data": {
              "instructions": {
                "transfers": [
                  { "to": "0x742d...", "token": "USDC",
                    "amount": "50", "purpose": "payment" },
                  { "to": "0xTREASURY", "token": "LCX",
                    "amount": "2", "purpose": "platform_fee" },
                  { "to": "0x742d...", "token": "LCX",
                    "amount": "2", "purpose": "creator_reward" }
                ]
              },
              "fee": {
                "token": "LCX", "total": "4",
                "platformShare": "2", "creatorReward": "2"
              }
            }
          }

  [Agent executes the transfers on-chain]

  Agent:  "Done, tx hash is 0xabc123..."
  ─────
  AI detects tx hash → triggers verification

  PayMe:  {
            "message": "Payment verified! REQ-x7y8z9 is now
              marked as PAID. Both parties will be notified.",
            "data": {
              "verified": true,
              "status": "PAID"
            }
          }

═══════════════════════════════════════════════════════════════
  EXAMPLE 4: Ambiguous Request
═══════════════════════════════════════════════════════════════

  Agent:  "I need to send some money"
  ─────
  PayMe:  {
            "action": "clarify",
            "message": "I can help you with that! Could you
              tell me:
              1. How much do you want to send?
              2. Which token? (e.g., USDC, ETH)
              3. Who is it for? (description is optional)

              For example: 'Create a 10 USDC link for API access'"
          }

  Agent:  "10 USDC"
  ─────
  PayMe:  {
            "message": "I've created a 10 USDC payment link.",
            "data": {
              "id": "REQ-m2n3o4",
              "amount": "10",
              "token": "USDC",
              "status": "PENDING"
            }
          }
```

---

## 16. Revenue Model & Unit Economics

```
═══════════════════════════════════════════════════════════════
  PLATFORM REVENUE ANALYSIS
═══════════════════════════════════════════════════════════════

  Revenue comes from fees on every payment.
  The platform keeps 50% of each fee.

  ┌──────────────────────────────────────────────────────────┐
  │  REVENUE PER TRANSACTION                                 │
  │                                                          │
  │  If fee paid in LCX:                                     │
  │    Revenue = 2 LCX per transaction                       │
  │    At $0.15/LCX = $0.30 per transaction                  │
  │    At $0.50/LCX = $1.00 per transaction                  │
  │    At $1.00/LCX = $2.00 per transaction                  │
  │                                                          │
  │  If fee paid in USDC:                                    │
  │    Revenue = 2 LCX equivalent in USDC                    │
  │    At $0.15/LCX = $0.30 per transaction                  │
  │    At $0.50/LCX = $1.00 per transaction                  │
  │    At $1.00/LCX = $2.00 per transaction                  │
  │                                                          │
  │  Note: Revenue per tx is the SAME regardless of whether  │
  │  fee is paid in LCX or USDC. The difference is which     │
  │  token the platform receives.                            │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  PROJECTION SCENARIOS (monthly)                          │
  │                                                          │
  │  LCX Price: $0.15 (conservative)                         │
  │  Revenue per tx: $0.30                                   │
  │                                                          │
  │  100 transactions/month:                                 │
  │    Revenue:  $30/month                                   │
  │    Treasury: 200 LCX (if all paid in LCX)                │
  │                                                          │
  │  1,000 transactions/month:                               │
  │    Revenue:  $300/month                                   │
  │    Treasury: 2,000 LCX                                   │
  │                                                          │
  │  10,000 transactions/month:                              │
  │    Revenue:  $3,000/month                                 │
  │    Treasury: 20,000 LCX                                  │
  │                                                          │
  │  100,000 transactions/month:                             │
  │    Revenue:  $30,000/month                                │
  │    Treasury: 200,000 LCX                                 │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  LCX PRICE APPRECIATION UPSIDE                           │
  │                                                          │
  │  If the platform accumulates LCX as fees and the LCX     │
  │  price increases, the treasury appreciates in value:     │
  │                                                          │
  │  Scenario: 10K tx/mo for 12 months                       │
  │  Treasury: 240,000 LCX accumulated                       │
  │                                                          │
  │  At entry price ($0.15):  $36,000 value                  │
  │  If LCX → $0.50:          $120,000 value (3.3x)          │
  │  If LCX → $1.00:          $240,000 value (6.7x)          │
  │  If LCX → $5.00:          $1,200,000 value (33x)         │
  │                                                          │
  │  This creates a strong incentive to:                     │
  │  1. Prefer LCX fee payments (accumulate the token)       │
  │  2. Hold LCX in treasury rather than sell immediately    │
  │  3. Grow transaction volume to accumulate faster         │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  COST STRUCTURE                                          │
  │                                                          │
  │  Fixed Costs:                                            │
  │  • Supabase:     Free tier → $25/mo (Pro)                │
  │  • Vercel:       Free tier → $20/mo (Pro)                │
  │  • Domain:       ~$12/year                               │
  │                                                          │
  │  Variable Costs:                                         │
  │  • xAI API:      ~$0.001-0.01 per /api/chat call         │
  │  • CoinGecko:    Free tier (50 calls/min)                │
  │  • RPC calls:    Free (Alchemy/Infura free tier)         │
  │  • Gas fees:     Paid by agents (non-custodial)          │
  │                                                          │
  │  Breakeven:                                              │
  │  At $0.30/tx revenue and ~$50/mo fixed cost:             │
  │  Breakeven = ~167 transactions/month                     │
  └──────────────────────────────────────────────────────────┘
```

---

## 17. Backend File Structure

```
═══════════════════════════════════════════════════════════════
  PROJECT DIRECTORY MAP
═══════════════════════════════════════════════════════════════

  payme-your-simple-payment-hub/
  │
  ├── backend/
  │   ├── api/
  │   │   └── index.js              ← Main Express app (serverless entry)
  │   │                                All routes defined here.
  │   │                                Vercel maps /api/* to this file.
  │   │
  │   ├── middleware/
  │   │   └── auth.js               ← authMiddleware + optionalAuthMiddleware
  │   │                                API key extraction, prefix lookup,
  │   │                                bcrypt comparison, req.agent attach.
  │   │
  │   ├── lib/
  │   │   ├── agents.js             ← Agent CRUD operations
  │   │   │                            registerAgent, getAgentById,
  │   │   │                            getAgentByKeyPrefix, updateWallet,
  │   │   │                            touchAgent (update last_active_at)
  │   │   │
  │   │   ├── feeConfig.js          ← Fee configuration management
  │   │   │                            getFeeConfig (1-min cache),
  │   │   │                            updateFeeConfig, DEFAULT_CONFIG
  │   │   │
  │   │   ├── feeCalculator.js      ← Dual-token fee logic
  │   │   │                            calculateFee: check LCX balance,
  │   │   │                            determine LCX vs USDC path,
  │   │   │                            compute platform/creator splits
  │   │   │
  │   │   ├── lcxPrice.js           ← LCX/USD price service
  │   │   │                            getLcxPriceUsd: CoinGecko API,
  │   │   │                            5-min in-memory cache,
  │   │   │                            stale fallback on error
  │   │   │
  │   │   ├── webhooks.js           ← Webhook subscription management
  │   │   │                            registerWebhook, getWebhooks,
  │   │   │                            getWebhooksForEvent, updateWebhook,
  │   │   │                            deleteWebhook, markSuccess/Failure
  │   │   │
  │   │   ├── webhookDispatcher.js  ← Webhook event delivery engine
  │   │   │                            dispatchEvent: find webhooks,
  │   │   │                            build payload, HMAC sign,
  │   │   │                            POST with retry + backoff,
  │   │   │                            deactivate after 5 failures
  │   │   │
  │   │   └── ai/
  │   │       ├── grokClient.js     ← xAI / Grok API wrapper
  │   │       │                        OpenAI SDK configured for x.ai
  │   │       │                        chatWithAgent(messages) → JSON
  │   │       │
  │   │       ├── systemPrompt.js   ← Dynamic system prompt builder
  │   │       │                        Injects agent context (ID, wallet,
  │   │       │                        chain, username) into prompt.
  │   │       │                        Defines supported actions + schemas.
  │   │       │
  │   │       ├── intentRouter.js   ← Action dispatch (switch/case)
  │   │       │                        Routes AI output to handlers:
  │   │       │                        create_link, pay_link, check_status,
  │   │       │                        register_wallet, list_payments
  │   │       │
  │   │       └── conversationMemory.js
  │   │                                ← Chat history storage
  │   │                                   saveMessage, getHistory (last 10),
  │   │                                   clearHistory. Supabase + fallback.
  │   │
  │   ├── server.js                 ← Local dev server entry point
  │   │                                Imports app from api/index.js,
  │   │                                listens on PORT (default 3001)
  │   │
  │   └── schema.sql                ← Complete DB schema for Supabase
  │                                    All CREATE TABLE statements,
  │                                    SQL functions, default inserts
  │
  ├── scripts/
  │   └── register-agent.js         ← CLI registration tool
  │                                    Interactive prompts for username,
  │                                    email, wallet. Calls register API.
  │                                    Prints credentials once.
  │
  ├── src/                          ← React frontend (Vite + Tailwind)
  │   ├── App.tsx                   ← Route definitions
  │   ├── pages/
  │   │   ├── Index.tsx             ← Dashboard with platform stats
  │   │   ├── Login.tsx             ← Login + agent link
  │   │   ├── PayAsAgent.tsx        ← API documentation page
  │   │   ├── PaymentView.tsx       ← Public payment link view
  │   │   ├── AgentsDashboard.tsx   ← Agent metrics + fee model info
  │   │   └── Wallets.tsx           ← Wallet management
  │   ├── components/
  │   │   └── AppSidebar.tsx        ← Navigation with Agents link
  │   └── lib/
  │       └── api.ts                ← Frontend API helpers
  │
  ├── .env.example                  ← Template for environment variables
  ├── BLUEPRINT.md                  ← This document
  ├── BLUEPRINT.html                ← Visual HTML version (for PDF)
  ├── vercel.json                   ← Vercel deployment config
  └── package.json                  ← Dependencies
```

---

## 18. Environment Variables Reference

```
═══════════════════════════════════════════════════════════════
  COMPLETE .env CONFIGURATION
═══════════════════════════════════════════════════════════════

  ┌──────────────────────────────────────────────────────────┐
  │  DATABASE                                                │
  │                                                          │
  │  SUPABASE_URL=https://xxx.supabase.co                    │
  │    The URL of your Supabase project.                     │
  │    Found in: Project Settings → API → URL                │
  │                                                          │
  │  SUPABASE_ANON_KEY=eyJhbGci...                           │
  │    Supabase anonymous/public key.                        │
  │    Found in: Project Settings → API → anon public        │
  │    Used for: Client-side queries (with RLS enabled)      │
  │                                                          │
  │  SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...                   │
  │    Supabase service role key (admin, bypasses RLS).      │
  │    Found in: Project Settings → API → service_role       │
  │    Used for: Server-side operations (agent registration, │
  │              fee transactions, webhook management)        │
  │    ⚠️ NEVER expose this in frontend code                  │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  AI (Grok / xAI)                                         │
  │                                                          │
  │  XAI_API_KEY=xai-...                                     │
  │    API key for xAI's Grok model.                         │
  │    Obtained from: https://console.x.ai/                  │
  │    Used for: POST /api/chat (AI conversation layer)      │
  │    Cost: ~$0.001–0.01 per chat request                   │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  BLOCKCHAIN                                              │
  │                                                          │
  │  SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/..│
  │    Ethereum Sepolia testnet RPC endpoint.                │
  │    Providers: Alchemy (free tier), Infura, QuickNode     │
  │    Used for: On-chain verification, LCX balance checks,  │
  │              ERC-20 contract reads                        │
  │                                                          │
  │  PLATFORM_TREASURY_WALLET=0x...                          │
  │    The wallet address that receives platform fees.       │
  │    This is YOUR revenue wallet.                          │
  │    ⚠️ Use a dedicated wallet, not a personal one          │
  │                                                          │
  │  LCX_CONTRACT_ADDRESS=0x...                              │
  │    The LCX ERC-20 token contract address on the          │
  │    target chain (Sepolia for testing, mainnet for prod). │
  │    Mainnet: 0x037A54AaB062628C9Bbae1FDB1583c195585Fe41   │
  │    Sepolia: Deploy a test ERC-20 for development         │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  APPLICATION                                             │
  │                                                          │
  │  PORT=3001                                               │
  │    Local development server port.                        │
  │    Only used when running `node backend/server.js`       │
  │                                                          │
  │  VITE_API_URL=http://localhost:3001                       │
  │    Frontend's API base URL. In production, set to your   │
  │    deployed backend URL or leave empty for same-origin.  │
  │                                                          │
  │  NODE_ENV=development                                    │
  │    Set to "production" in deployment.                    │
  │    Affects: Error verbosity, logging level               │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  OPTIONAL                                                │
  │                                                          │
  │  COINGECKO_API_KEY=CG-...                                │
  │    CoinGecko Pro API key (optional).                     │
  │    Free tier: 50 calls/min (usually sufficient)          │
  │    Pro tier: Higher limits if you hit rate limits         │
  │                                                          │
  │  WEBHOOK_MAX_RETRIES=5                                   │
  │    Number of retry attempts for failed webhooks.         │
  │    Default: 5 (hardcoded)                                │
  │                                                          │
  │  LOG_LEVEL=info                                          │
  │    Logging verbosity: debug, info, warn, error           │
  └──────────────────────────────────────────────────────────┘
```

---

## 19. Multi-Chain Expansion Roadmap

```
═══════════════════════════════════════════════════════════════
  EXPANDING BEYOND SEPOLIA
═══════════════════════════════════════════════════════════════

  PayMe launches on Sepolia (Ethereum testnet) for development
  and testing. Here's the roadmap for multi-chain support.

  ┌──────────────────────────────────────────────────────────┐
  │  PHASE A: Testnet (Current)                              │
  │                                                          │
  │  Chain: Sepolia (Ethereum testnet)                       │
  │  USDC: Testnet USDC contract                             │
  │  LCX: Deploy test ERC-20 or use testnet mock             │
  │  RPC: Alchemy/Infura free tier                           │
  │  Gas: Free from faucets                                  │
  │                                                          │
  │  Purpose: Development, testing, demo                     │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  PHASE B: First Mainnet                                  │
  │                                                          │
  │  Chain: Base (Coinbase L2)                               │
  │  Why Base?                                               │
  │  • Ultra-low gas fees (~$0.001 per tx)                   │
  │  • Native USDC support (Coinbase)                        │
  │  • Growing agent ecosystem                               │
  │  • EVM compatible (same ethers.js code)                  │
  │                                                          │
  │  Changes Required:                                       │
  │  • Add BASE_RPC_URL to .env                              │
  │  • Update chain detection in fee calculator              │
  │  • Deploy or reference LCX contract on Base              │
  │  • Update USDC contract address for Base                 │
  │  • Add "base" to chain whitelist                         │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  PHASE C: Multi-Chain                                    │
  │                                                          │
  │  Supported Chains:                                       │
  │  ┌──────────────┬───────────┬──────────┬───────────────┐ │
  │  │ Chain        │ Gas Cost  │ USDC     │ Status        │ │
  │  ├──────────────┼───────────┼──────────┼───────────────┤ │
  │  │ Sepolia      │ Free      │ Testnet  │ ✅ Live        │ │
  │  │ Base         │ ~$0.001   │ Native   │ 🔜 Phase B    │ │
  │  │ Arbitrum     │ ~$0.01    │ Bridged  │ 🔜 Phase C    │ │
  │  │ Polygon      │ ~$0.001   │ Native   │ 🔜 Phase C    │ │
  │  │ BNB Chain    │ ~$0.05    │ Bridged  │ 🔜 Phase C    │ │
  │  │ Ethereum     │ ~$2-20    │ Native   │ 🔜 Phase D    │ │
  │  └──────────────┴───────────┴──────────┴───────────────┘ │
  │                                                          │
  │  Architecture for Multi-Chain:                           │
  │                                                          │
  │  1. Chain Registry (new table or config):                │
  │     { chainId, name, rpcUrl, usdcAddress,                │
  │       lcxAddress, explorerUrl, active }                  │
  │                                                          │
  │  2. Agent Registration:                                  │
  │     Agent specifies chain when registering wallet        │
  │     One agent can have wallets on multiple chains        │
  │                                                          │
  │  3. Payment Links:                                       │
  │     Link specifies which chain the payment is on         │
  │     Payee must be on the same chain (no bridging)        │
  │                                                          │
  │  4. Fee Calculation:                                     │
  │     LCX balance check must use correct chain's contract  │
  │     LCX price is chain-agnostic (same USD price)         │
  │                                                          │
  │  5. Verification:                                        │
  │     Use the correct RPC URL for the payment's chain      │
  │     Verify tx on the correct block explorer              │
  └──────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────┐
  │  CROSS-CHAIN (FUTURE — Phase D+)                         │
  │                                                          │
  │  Scenario: Agent on Base wants to pay link on Arbitrum   │
  │                                                          │
  │  Options:                                                │
  │  a) Bridge integration (Across, Stargate, LayerZero)     │
  │  b) Multi-chain escrow contract                          │
  │  c) Reject cross-chain (require same chain) — simplest   │
  │                                                          │
  │  Recommended: Start with option (c), add bridging later. │
  │  Cross-chain adds complexity and risk.                   │
  └──────────────────────────────────────────────────────────┘
```

---

## 20. Glossary

```
═══════════════════════════════════════════════════════════════
  TERMS & DEFINITIONS
═══════════════════════════════════════════════════════════════

  Term                    Definition
  ──────────────────────  ──────────────────────────────────────
  Agent                   An AI bot/service registered on PayMe
                          with an API key and wallet address.

  Agent Developer         A human who builds and operates one or
                          more AI agents on the platform.

  API Key                 A secret string (pk_live_...) used to
                          authenticate API requests. Hashed with
                          bcrypt before storage.

  API Key Prefix          The first 12 characters of the API key
                          (after "pk_live_"), stored in plaintext
                          for fast DB lookups.

  bcrypt                  A password hashing algorithm used to
                          securely store API keys and webhook
                          secrets. Cost factor 12.

  Chain                   A blockchain network (e.g., Sepolia,
                          Base, Arbitrum) where transactions
                          are executed and verified.

  Creator / Link Creator  The agent who creates a payment link
                          and expects to receive payment.

  ERC-20                  The Ethereum token standard used by
                          USDC, LCX, and other tokens. Defines
                          transfer(), balanceOf(), approve().

  Fee Transaction         A record in fee_transactions table
                          capturing all details of a fee payment
                          (token, amounts, tx hashes, price).

  Gate                    A security checkpoint in the /api/chat
                          flow. Three gates: Auth, Wallet, and
                          Action Validation.

  Grok 4 Fast Thinking    The xAI large language model used for
                          the AI conversation layer. Accessed
                          via OpenAI-compatible API.

  HMAC-SHA256             Hash-based Message Authentication Code
                          using SHA-256. Used to sign webhook
                          payloads so agents can verify origin.

  Intent                  The parsed action from a natural
                          language message (e.g., "create_link",
                          "pay_link", "check_status").

  LCX                     Liechtenstein Cryptoassets Exchange
                          token. ERC-20. Used as the preferred
                          fee payment token on PayMe. See:
                          https://www.coingecko.com/en/coins/lcx

  Non-Custodial           Architecture where the platform never
                          holds private keys. Agents sign their
                          own transactions.

  Payee                   The agent who pays a payment link.
                          Pays the link amount + platform fee.

  Payment Instructions    JSON response from /api/pay-link that
                          tells the payee exactly what transfers
                          to execute (addresses, amounts, tokens).

  Payment Link            A request for payment created by an
                          agent. Has an ID (REQ-xxx), amount,
                          token, receiver, and status.

  Payment Request         Synonym for Payment Link. Stored in
                          the payment_requests table.

  Platform Operator       The person/team running the PayMe
                          infrastructure. Collects fees via the
                          treasury wallet.

  Platform Treasury       The wallet address that receives the
                          platform's share of fees (50%).

  RPC Node                Remote Procedure Call node used to
                          interact with the blockchain (read
                          balances, verify transactions).

  Supabase                Hosted PostgreSQL database with REST
                          API and realtime subscriptions. Used
                          as the primary data store.

  USDC                    USD Coin. A stablecoin pegged to $1.
                          The primary payment token on PayMe.

  Webhook                 An HTTP POST callback sent to an
                          agent's server when a payment event
                          occurs (paid, expired, etc.).

  Webhook Secret          A secret string (whsec_...) used to
                          generate HMAC signatures for webhook
                          payloads. Unique per webhook.

  x402 / HTTP 402         "Payment Required" HTTP status code.
                          Returned when accessing an unpaid
                          payment link via GET /api/request/:id.

  xAI                     The company behind Grok. API endpoint:
                          https://api.x.ai/v1
```

---

## 21. Comparison with Alternatives

```
═══════════════════════════════════════════════════════════════
  HOW PAYME COMPARES TO OTHER OPTIONS
═══════════════════════════════════════════════════════════════

  ┌────────────────┬──────────┬──────────┬───────────┬──────────┐
  │  Feature       │  PayMe   │  Stripe  │ MugglePay │  Manual  │
  │                │  (You)   │          │           │  Crypto  │
  ├────────────────┼──────────┼──────────┼───────────┼──────────┤
  │ Agent-native   │   ✅     │   ❌     │    ❌     │   ❌     │
  │ No human KYC   │   ✅     │   ❌     │    ❌     │   ✅     │
  │ Crypto-native  │   ✅     │   ❌     │    ✅     │   ✅     │
  │ Non-custodial  │   ✅     │   ❌     │    ❌     │   ✅     │
  │ AI chat layer  │   ✅     │   ❌     │    ❌     │   ❌     │
  │ Webhooks       │   ✅     │   ✅     │    ✅     │   ❌     │
  │ Fee model      │  LCX/USD │  2.9%+   │   ~1%     │   None   │
  │ Self-hostable  │   ✅     │   ❌     │    ❌     │   N/A    │
  │ Multi-chain    │   🔜     │   N/A    │    ❌     │   ✅     │
  │ Open source    │   ✅     │   ❌     │    ❌     │   N/A    │
  └────────────────┴──────────┴──────────┴───────────┴──────────┘

  Key Differentiators:

  1. AGENT-FIRST DESIGN
     Stripe requires human identity (SSN, bank accounts).
     PayMe requires only a wallet address and email.
     Agents can register and start transacting in seconds.

  2. AI-NATIVE INTERFACE
     No other payment platform has a conversational AI layer.
     Agents can create/pay links using natural language.
     This lowers integration complexity dramatically.

  3. DUAL-TOKEN FEE MODEL
     Unique incentive structure where LCX holders pay lower
     effective fees and link creators earn token rewards.
     Creates a flywheel: more usage → more LCX demand →
     higher LCX price → more revenue for platform.

  4. NON-CUSTODIAL BY DEFAULT
     Unlike Stripe/MugglePay, PayMe never holds funds.
     This reduces regulatory risk and security surface area.

  5. OPEN SOURCE & SELF-HOSTABLE
     Agent developers can audit the code. Platform operators
     can fork and deploy their own instance.
```

---

## 22. Frequently Asked Questions

```
═══════════════════════════════════════════════════════════════
  FAQ
═══════════════════════════════════════════════════════════════

  Q: Do agents need to use the AI chat endpoint?
  A: No. The /api/chat endpoint is optional. Agents can use
     the direct REST endpoints (/api/create-link, /api/pay-link,
     etc.) for all operations. The AI layer is a convenience
     for agents that prefer natural language.

  Q: What happens if an agent's wallet is compromised?
  A: The agent should call POST /api/agents/wallet with a new
     wallet address. Since PayMe is non-custodial, the platform
     doesn't hold any funds. The compromised wallet is only
     used as a receiving address for future payments.

  Q: Can a human use PayMe instead of an agent?
  A: Yes. The API doesn't distinguish between human and AI
     callers. A human can register, get an API key, and use
     cURL or any HTTP client. The frontend also allows human
     users to create and view payment links.

  Q: What if an agent sends the wrong amount?
  A: The /api/verify endpoint checks the exact amount on-chain.
     If the amount doesn't match the payment link, verification
     fails. The agent can submit a new transaction with the
     correct amount.

  Q: Is there a minimum payment amount?
  A: Not enforced by the platform. However, very small amounts
     may not be economical due to gas fees. Recommended minimum:
     $1 USDC on L2 chains, $10 USDC on Ethereum mainnet.

  Q: Can agents pay in tokens other than USDC?
  A: Currently, USDC is the primary payment token. ETH is
     supported for payment links. Token support can be extended
     by adding token contracts to the chain registry.

  Q: How does the platform handle network congestion?
  A: Since PayMe is non-custodial, the agent submits the tx
     and waits for it to confirm. The platform only verifies
     after the tx is included in a block. If the network is
     slow, the agent simply waits longer before calling /verify.

  Q: Can I change the fee amount (4 LCX)?
  A: Yes. The fee_config table has a single row that defines
     the fee parameters. The platform operator can update
     lcx_fee_amount, lcx_platform_share, and lcx_creator_reward
     at any time. Changes apply to future payments.

  Q: What about refunds?
  A: Refunds are not currently supported at the platform level.
     Since payments are on-chain and non-custodial, the creator
     agent would need to send funds back manually. A future
     version could add a refund API that creates a reverse
     payment link.

  Q: How do I monitor platform health?
  A: GET /health returns platform status (DB connectivity,
     RPC availability). GET /api/stats returns aggregate
     metrics (total agents, payments, fees). The frontend
     dashboard visualizes these metrics.

  Q: What happens to accumulated LCX in the treasury?
  A: The platform operator controls the treasury wallet.
     Options: hold LCX (speculate on price appreciation),
     sell for stablecoins (lock in revenue), or use for
     platform operations (liquidity, incentives).
```
