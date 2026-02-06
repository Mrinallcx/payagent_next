# PayMe agent integration

This doc describes how AI agents (e.g. Moltbook) or automated services can create payment links and pay them with USDC on Sepolia.

## Overview

- **PayMe API** (backend): Creates links, returns payment details (402 when pending), verifies on-chain and marks PAID.
- **Agent payment service** (`agent-payment-service/`): Holds two agent wallets (env: `AGENT_1_PRIVATE_KEY`, `AGENT_2_PRIVATE_KEY`). Exposes:
  - `POST /create-link` – create a PayMe link (USDC, Sepolia).
  - `POST /pay-link` – get payment details, send USDC from the chosen agent wallet, verify with PayMe, return `txHash` and confirmation.
  - `GET /agents` – list configured agents (masked addresses).

Agents (or the frontend) call the agent payment service; the service talks to the PayMe API and to Sepolia.

## Environment variables

See [.env.example](../.env.example) at the repo root. Summary:

**Backend (PayMe API)**

- `NEXT_PUBLIC_ETH_RPC_URL` – Sepolia RPC.
- `NEXT_PUBLIC_USDC_ADDRESS` – USDC on Sepolia (optional; default in code).
- Optional: `MOLTBOOK_APP_KEY`, `MOLTBOOK_VERIFY_AUDIENCE` for Moltbook identity verification.

**Agent payment service**

- `PAYME_API_URL` – PayMe API base URL (e.g. `http://localhost:3000`).
- `SEPOLIA_RPC_URL` – Sepolia RPC.
- `SEPOLIA_USDC_ADDRESS` – USDC contract on Sepolia.
- `AGENT_1_PRIVATE_KEY`, `AGENT_2_PRIVATE_KEY` – Agent wallets (fund with Sepolia ETH + USDC).

**Frontend**

- `VITE_AGENT_PAYMENT_SERVICE_URL` – Agent service URL (e.g. `http://localhost:3001`). If set and the link is USDC on Sepolia, the payment page shows “Pay as agent”.

## API (agent payment service)

Base URL: `http://localhost:3001` (or your deployment).

- **GET /health** – `{ status: "ok", agents: number }`.
- **GET /agents** – `{ success: true, agents: [ { id: 1, address: "0x1234...5678" }, ... ] }`.
- **POST /create-link** – Body: `{ amount, receiver, description?, expiresInDays?, creatorWallet? }`. Returns `{ success, linkId, link }`.
- **POST /pay-link** – Body: `{ linkId, agentId: 1 | 2 }`. Returns `{ success, txHash?, request?, verification?, explorerUrl?, alreadyPaid?, error? }`.

Only USDC on Sepolia is supported for `/pay-link`.

## Where the agent runs

- **Frontend (testing)**: Set `VITE_AGENT_PAYMENT_SERVICE_URL` and use “Pay as agent” on the payment page.
- **Moltbook / OpenClaw**: Have the agent call the agent payment service HTTP API (e.g. `POST /pay-link` with `linkId` and `agentId`). Optionally use Moltbook identity and verify it in your backend (see plan).
- **Scripts / cron**: Same HTTP API; no browser.

## Moltbook identity (optional)

To verify that the caller is a Moltbook agent:

1. Set `MOLTBOOK_APP_KEY` in the PayMe backend.
2. Agent gets a token from Moltbook and sends it in `X-Moltbook-Identity`.
3. Backend middleware (see `backend/server.js`) can verify the token and attach `req.moltbookAgent`. You can then protect selected routes with this middleware.

Auth instructions for bots: `https://moltbook.com/auth.md?app=PayMe&endpoint=https://your-payme-api.com/api/create`
