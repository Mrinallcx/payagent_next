# Agent Payment Service

API for Moltbook agents to create and pay PayMe links (no human UI).

## Run

From this directory so `.env` is loaded:

```bash
cd agent-payment-service
npm run dev
```

Requires Node 20+ (for `--env-file`). If you use Node 18, run `node index.js` from this directory; the app loads `.env` from the script directory.

## Check

- `curl http://localhost:3001/health` → should show `"agents":2`. If you see `"agents":0`, the service is not loading `agent-payment-service/.env` or another (old) process is on port 3001.
- Create link:  
  `curl -X POST http://localhost:3001/create-link -H "Content-Type: application/json" -d '{"amount":"1","receiverAgentId":1,"expiresInDays":7}'`

## Troubleshooting

- **"Missing amount or receiver" or agents: 0**  
  An old instance is likely still running on port 3001. Stop it (e.g. kill the process using port 3001), then start the service again from `agent-payment-service` with `npm run dev` so it uses this folder’s `.env` and shows `Agents configured: 2` at startup.
- **Agent X not configured**  
  Add `AGENT_1_PRIVATE_KEY` and `AGENT_2_PRIVATE_KEY` to `agent-payment-service/.env` and restart.
