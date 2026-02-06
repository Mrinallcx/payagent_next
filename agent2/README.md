# Agent 2 (Payee)

Agent 2 receives payment requests and returns PayMe links. It calls the PayMe **agent payment service** to create links (receiver = Agent 2).

## Run

**Leave this running in its own terminal** (do not close it before running Agent 1):

```bash
cd agent2
cp .env.example .env
# Edit .env if needed (AGENT_SERVICE_URL must point to agent-payment-service, e.g. http://localhost:3001)
npm install
npm start
```

Use a separate terminal for the backend, agent-payment-service, and Agent 1.

## API

- **POST /request-payment**  
  Body: `{ "amount": "10", "description": "Optional", "requester": "Agent1" }`  
  Returns: `{ "success": true, "payment_link": "...", "link_id": "REQ-XXX", "link": "/r/REQ-XXX", "amount": "10", "receiver": "Agent 2" }`

- **GET /health**  
  Returns: `{ "status": "ok", "agent": "Agent 2 (Payee)", "service_url": "..." }`

Agent 1 (or any payer) calls this to get a `link_id`, then pays via the agent payment service `POST /pay-link` with that `link_id` and `agentId: 1`.
