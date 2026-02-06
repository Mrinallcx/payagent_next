# Agent 1 (Payer)

Agent 1 requests payment links from Agent 2 and pays them via the PayMe **agent payment service** (Agent 1’s wallet sends USDC).

## Prerequisites

Start these **before** running Agent 1 scripts:

1. **Agent 2** must be running: `cd agent2 && npm run dev` (default port 3002). If it’s not running, `npm run pay` will fail with “Agent 2 returned non-JSON” or connection errors.
2. **Agent payment service** running: `cd agent-payment-service && npm run dev` (port 3001) with Agent 1 and Agent 2 keys in `.env`.
3. **PayMe backend** running: `cd backend && npm run dev` (port 3000).

## Setup

```bash
cd agent1
cp .env.example .env
# Edit .env: AGENT2_URL=http://localhost:3002, AGENT_SERVICE_URL=http://localhost:3001
npm install
```

## Commands

- **Request link and pay (full flow)**  
  `npm run pay [amount]`  
  Example: `npm run pay 2` requests a 2 USDC link from Agent 2, then pays it with Agent 1’s wallet.

- **Request link only (no pay)**  
  `npm run request [amount]`  
  Returns `link_id`; you can pay later with `npm run pay-link -- <link_id>`.

- **Pay an existing link by linkId**  
  `npm run pay-link -- <linkId> [agentId]`  
  Example: `npm run pay-link -- REQ-CP9DWMBGV` (Agent 1 pays). Use `2` as second arg to pay with Agent 2’s wallet.

## Flow

1. Agent 1 calls Agent 2’s `POST /request-payment` with `{ amount }` → gets `link_id`.
2. Agent 1 calls agent payment service `POST /pay-link` with `{ linkId: link_id, agentId: 1 }` → USDC is sent from Agent 1 to Agent 2; returns `txHash` and confirmation.
