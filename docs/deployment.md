# Deploying PayMe (Vercel)

Frontend and backend are deployed on Vercel. The **agent payment API** (create-link, pay-link, agents) is part of the **backend** deployment, so you only need one backend URL.

## 1. Backend (PayMe API + Agent API)

- Deploy the **backend** folder as a Vercel project (or your existing backend project).
- Root: `backend` (if separate project) or your monorepo with backend as serverless.
- The backend `api/index.js` exposes:
  - PayMe: `/api/create`, `/api/request/:id`, `/api/verify`, etc.
  - Agent: `/api/create-link`, `/api/pay-link`, `/api/agents`, `/api/agent/health`

### Backend env vars (Vercel → Settings → Environment Variables)

Set these for the **backend** project:

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_ETH_RPC_URL` | Yes | Sepolia RPC (e.g. Infura). Used for verify and pay-link. |
| `NEXT_PUBLIC_USDC_ADDRESS` | No | Sepolia USDC (default in code). |
| `SEPOLIA_RPC_URL` | No | Same as above; used by pay-link if set. |
| `SEPOLIA_USDC_ADDRESS` | No | Same as USDC address. |
| `AGENT_1_PRIVATE_KEY` | Yes for agents | Agent 1 wallet (Sepolia). Fund with ETH + USDC. |
| `AGENT_2_PRIVATE_KEY` | Yes for agents | Agent 2 wallet (Sepolia). Fund with ETH + USDC. |
| `SUPABASE_URL` | No | If set, uses Supabase for requests. |
| `SUPABASE_ANON_KEY` | No | With above. |

After deploy, note the backend URL, e.g. `https://your-backend.vercel.app`.

---

## 2. Frontend (Vite)

- Deploy the **repo root** (Vite app) as a Vercel project.
- Build: `npm run build` (or Vite default).

### Frontend env vars (Vercel → Settings → Environment Variables)

Set these for the **frontend** project (prefix `VITE_` so they are exposed to the client):

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_API_URL` | Yes | Backend URL, e.g. `https://your-backend.vercel.app` |
| `VITE_AGENT_PAYMENT_SERVICE_URL` | Yes* | Same as `VITE_API_URL` so the app uses backend’s agent API (`/api/create-link`, etc.). |

\* If you leave `VITE_AGENT_PAYMENT_SERVICE_URL` unset but set `VITE_API_URL`, the “Pay as agent” / Test API will use the backend when both point to the same URL (see `src/lib/agentApi.ts`). For production, set both to the backend URL.

---

## 3. Agent 2 / Agent 1 (optional, for scripts)

If you run **Agent 2** or **Agent 1** scripts against production:

- **Agent 2** `.env`:  
  `AGENT_SERVICE_URL=https://your-backend.vercel.app`  
  (so `POST /request-payment` calls backend’s `/api/create-link`).

- **Agent 1** `.env`:  
  `AGENT_SERVICE_URL=https://your-backend.vercel.app`  
  (so pay-link calls backend’s `/api/pay-link`).  
  If you use Agent 2 in production:  
  `AGENT2_URL=https://your-agent2-url` (only if you deploy Agent 2 separately; otherwise Agent 1 can call the backend’s create-link directly or you run Agent 2 locally pointing at the backend).

---

## 4. No localhost in production

- All service URLs should be **full HTTPS URLs** (e.g. `https://your-backend.vercel.app`).
- Do **not** set `localhost` or `127.0.0.1` for production; those are for local dev only.
- The frontend uses `VITE_API_URL` and `VITE_AGENT_PAYMENT_SERVICE_URL`; when both are the backend URL, it calls `/api/create-link`, `/api/pay-link`, `/api/agents` on that URL.

---

## 5. Quick checklist

1. Backend deployed; env vars set (RPC, USDC, `AGENT_1_PRIVATE_KEY`, `AGENT_2_PRIVATE_KEY`, Supabase if used).
2. Frontend deployed; `VITE_API_URL` and `VITE_AGENT_PAYMENT_SERVICE_URL` set to backend URL.
3. Test: open frontend → “For Moltbook agents” / Test API → Create link (receiver Agent 2) → Pay link (Agent 1).
4. Optional: run Agent 2 / Agent 1 locally with `.env` pointing at the backend URL.
