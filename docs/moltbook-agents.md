# PayMe for Moltbook agents (automated create & pay)

**Agents run on Moltbook.** They do not use the PayMe website. They create and pay links by calling the PayMe **agent payment service** API. The service holds two wallets (Agent 1, Agent 2); when an agent calls the API, the service signs and sends USDC on Sepolia on behalf of that agent.

## Flow (automated)

1. **Agent A (on Moltbook)** calls `POST /create-link` with `receiverAgentId: 2` and `amount: "5"` → gets back a link ID.
2. **Agent B (on Moltbook)** calls `POST /pay-link` with that `linkId` and `agentId: 2` → the service sends USDC from Agent 2’s wallet to the receiver, then verifies and returns `txHash` and confirmation.

So: one agent creates the link, the other agent pays it. Both actions are API calls from the agents on Moltbook.

## Where things run

| What | Where |
|------|--------|
| **Agents** | Moltbook (your agents live there and get tools/skills to call our API). |
| **Agent payment service** | Your server (or deployed URL). Holds Agent 1 & 2 private keys, talks to PayMe API and Sepolia. |
| **PayMe API** | Your backend. Stores payment requests and verifies on-chain. |

Agents never see private keys; they only call the agent payment service over HTTP.

## API (agent payment service)

**Base URL:** your deployed agent service, e.g. `https://your-domain.com` or `http://localhost:3001` for local dev.

### Create link (one agent creates)

```http
POST /create-link
Content-Type: application/json

{
  "amount": "5",
  "receiverAgentId": 1,
  "description": "Optional note"
}
```

- **amount** (required): USDC amount as string, e.g. `"1"`, `"0.5"`.
- **receiverAgentId** (required for this flow): `1` or `2` – which agent’s wallet receives the USDC.
- **description** (optional): Free text.

**Response:** `{ "success": true, "linkId": "REQ-XXXXXXXXX", "link": "/r/REQ-XXXXXXXXX" }`

### Pay link (other agent pays)

```http
POST /pay-link
Content-Type: application/json

{
  "linkId": "REQ-XXXXXXXXX",
  "agentId": 2
}
```

- **linkId** (required): The ID from create-link (e.g. `REQ-XXXXXXXXX`).
- **agentId** (required): `1` or `2` – which agent’s wallet sends the USDC (must have Sepolia ETH + USDC).

**Response:** `{ "success": true, "txHash": "0x...", "explorerUrl": "https://sepolia.etherscan.io/tx/0x...", "request": { ... } }`

If already paid: `{ "success": true, "alreadyPaid": true, "request": { ... } }`

## Giving this to your Moltbook agent

On Moltbook, configure your agent so it can call this API:

1. **Base URL** – Set to your agent payment service URL (e.g. after deploying the `agent-payment-service`).
2. **Tools / skills** – Tell the agent it has two actions:
   - **Create PayMe link** – POST to `{BASE_URL}/create-link` with body `{ amount, receiverAgentId (1 or 2), description? }`. Use the returned `linkId` / `link` to share or pass to the other agent.
   - **Pay PayMe link** – POST to `{BASE_URL}/pay-link` with body `{ linkId, agentId (1 or 2) }`. Returns `txHash` and confirmation.

Then when the agent is live on Moltbook, it can create links and pay links automatically via these API calls; no human needs to use the PayMe web UI for the agent flow.

## Deploying the agent payment service

So that Moltbook agents can reach it:

1. Deploy `agent-payment-service` (Node) to a public URL (e.g. Railway, Render, Fly.io) with env: `PAYME_API_URL`, `SEPOLIA_RPC_URL`, `SEPOLIA_USDC_ADDRESS`, `AGENT_1_PRIVATE_KEY`, `AGENT_2_PRIVATE_KEY`.
2. Use that URL as the base URL in the agent’s tools/skills on Moltbook.

The PayMe **frontend** “Pay as agent” / “For Moltbook agents” page is only for instructions and optional API testing; the real flow is agent → API only.
