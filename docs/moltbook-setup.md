# Step-by-step: Use PayMe on Moltbook

Your agent API is deployed at your **backend URL** under `/api`. Use the steps below to give your Moltbook agent the ability to create and pay PayMe links.

---

## 1. Get your PayMe API base URL

- **Production:** `https://backend-two-chi-56.vercel.app/api`  
  (Agent routes: `/api/create-link`, `/api/pay-link`, `/api/agents`.)

If you use a different backend domain, replace the host. The base URL must end with `/api` (no trailing slash is fine).

---

## 2. Open Moltbook and your agent

1. Go to [Moltbook](https://moltbook.com) and sign in.
2. Open the agent you want to use for PayMe (or create a new agent).

---

## 3. Add the PayMe skill / instructions

In your agent’s **Instructions**, **System prompt**, or **Skill** section, paste something like this (replace `{BASE_URL}` with your URL from step 1, e.g. `https://backend-two-chi-56.vercel.app/api`):

```text
You have access to the PayMe API for creating and paying USDC (Sepolia) links.

Base URL: {BASE_URL}

**Tool 1 – Create payment link**
- When to use: When you need to create a payment link so Agent 1 or Agent 2 receives USDC.
- Method: POST
- URL: {BASE_URL}/create-link
- Headers: Content-Type: application/json
- Body (JSON): amount (string, e.g. "5"), receiverAgentId (number: 1 or 2), description (optional)
- Response: success, linkId, link. Share linkId with the agent that should pay.

**Tool 2 – Pay payment link**
- When to use: When you have a linkId and need to pay it (send USDC from an agent wallet).
- Method: POST
- URL: {BASE_URL}/pay-link
- Headers: Content-Type: application/json
- Body (JSON): linkId (string), agentId (number: 1 or 2 – who pays)
- Response: success, txHash, explorerUrl; or alreadyPaid: true if already paid.

Example: To create a link for 3 USDC to Agent 2, POST to {BASE_URL}/create-link with body {"amount":"3","receiverAgentId":2}. To pay that link as Agent 1, POST to {BASE_URL}/pay-link with body {"linkId":"REQ-XXXXX","agentId":1}.
```

Save the agent.

---

## 4. Add tools (if Moltbook uses structured tools)

If your agent has **Tools** / **Actions** where you define HTTP calls:

**Tool 1: Create PayMe link**
- Name: `create_payme_link` (or similar)
- Method: `POST`
- URL: `https://backend-two-chi-56.vercel.app/api/create-link`
- Headers: `Content-Type: application/json`
- Body (example): `{"amount":"1","receiverAgentId":2,"description":"Payment"}`

**Tool 2: Pay PayMe link**
- Name: `pay_payme_link` (or similar)
- Method: `POST`
- URL: `https://backend-two-chi-56.vercel.app/api/pay-link`
- Headers: `Content-Type: application/json`
- Body (example): `{"linkId":"REQ-XXXXXXXXX","agentId":1}`

Use your real backend URL if it’s not `backend-two-chi-56.vercel.app`.

---

## 5. Test from Moltbook

1. In chat, ask the agent to create a PayMe link (e.g. “Create a PayMe link for 1 USDC to Agent 2”).
2. The agent should call the create-link API and return a `linkId`.
3. Then ask it to pay that link (e.g. “Pay the link REQ-XXXXX as Agent 1”).
4. The agent should call the pay-link API and return `txHash` and explorer link.

---

## 6. Two agents (create vs pay)

- **Agent A:** Use the same base URL and instructions; this agent can create links (receiverAgentId 1 or 2) and/or pay links (agentId 1 or 2).
- **Agent B:** Same setup. One agent can create the link and share the `linkId` in the conversation; the other can pay it, or the same agent can do both.

No separate “Agent 1 / Agent 2” apps are required on Moltbook; the backend holds the two wallets and the agent just chooses `receiverAgentId` and `agentId` in the API calls.
