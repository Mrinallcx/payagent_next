# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/169febe3-0f6c-4a55-bb52-02e93acd16d0

## How can I edit this code??

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/169febe3-0f6c-4a55-bb52-02e93acd16d0) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Agent integration (Pay as agent)

PayMe supports **Pay as agent**: AI agents (e.g. on Moltbook) or automated services can create payment links and pay them with USDC on Sepolia using configured agent wallets.

- **Frontend**: On a payment page, if the link is USDC on Sepolia and the agent service is configured, you can choose **Pay as human** (wallet or manual) or **Pay as agent** (select Agent 1 or 2 and click "Pay with agent").
- **Agent payment service**: A small Node service in `agent-payment-service/` holds two agent wallets (private keys in env), calls the PayMe API to get payment details, sends USDC on Sepolia, then verifies the payment and returns `txHash` and confirmation.
- **Where the agent runs**: The same service can be called by the frontend (for testing), by a Moltbook/OpenClaw agent via HTTP, or by any script. See [docs/agents.md](docs/agents.md) for API and env setup.

**Quick start (local)**

1. Copy [.env.example](.env.example) to `.env` and fill in `AGENT_1_PRIVATE_KEY`, `AGENT_2_PRIVATE_KEY`, and RPC/USDC if needed.
2. Start the PayMe backend: `cd backend && npm run dev` (port 3000).
3. Start the agent service: `cd agent-payment-service && npm i && npm run dev` (port 3001).
4. In `.env` set `VITE_AGENT_PAYMENT_SERVICE_URL=http://localhost:3001` and start the frontend: `npm run dev`.
5. Create a payment link (USDC, Sepolia), open the link, choose **Pay as agent**, select an agent, and click **Pay with agent**. Each agent wallet needs Sepolia ETH (gas) and USDC.

**Agent 1 (Payer) and Agent 2 (Payee) – separate apps**

Two small apps implement the “Agent 2 provides link, Agent 1 pays” flow:

- **agent2/** (Payee): Express server with `POST /request-payment`. When called with `{ amount }`, it creates a PayMe link (receiver = Agent 2) via the agent payment service and returns `link_id` and `payment_link`. Run: `cd agent2 && npm i && cp .env.example .env && npm run dev` (port 3002).
- **agent1/** (Payer): Scripts that call Agent 2 to get a link, then call the agent payment service to pay it (Agent 1’s wallet). Run: `cd agent1 && npm i && cp .env.example .env && npm run pay [amount]` (e.g. `npm run pay 1` for 1 USDC). Requires Agent 2 and agent-payment-service to be running.

Full stack order: (1) Backend (3000), (2) agent-payment-service (3001), (3) Agent 2 (3002), then from agent1 run `npm run pay 1`.

## Deploying (Vercel)

Frontend and backend deploy on Vercel. The **agent payment API** (create-link, pay-link) is part of the **backend** (same deployment). Set env vars so production uses your backend URL only (no localhost). See **[docs/deployment.md](docs/deployment.md)** for step-by-step backend + frontend env vars and optional Agent 2/Agent 1 production URLs.

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/169febe3-0f6c-4a55-bb52-02e93acd16d0) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
