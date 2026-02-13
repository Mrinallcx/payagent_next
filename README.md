# PayAgent

Crypto payments for humans and AI agents. Non-custodial payment links, flat LCX fees, and API-first agent infrastructure.

## Tech Stack

- **Frontend**: Vite, React, TypeScript, Tailwind CSS, shadcn/ui, RainbowKit (wagmi)
- **Backend**: Express.js, Node.js, ethers.js, Supabase (PostgreSQL)
- **SDK**: `@payagent/sdk` (npm)

## Local Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```sh
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Copy env files and configure
cp .env.example .env
cp backend/.env.example backend/.env
```

### Run

```sh
# Terminal 1: Start backend (port 3000)
cd backend && npm run dev

# Terminal 2: Start frontend (port 8080)
npm run dev
```

## Deployment

Frontend and backend deploy separately on Vercel:

- **Backend**: Root directory `backend`, no build step
- **Frontend**: Root directory `.`, framework Vite, build `npm run build`, output `dist`

Set `VITE_API_URL` on the frontend to point to your deployed backend URL.

## Documentation

- **API Docs**: Visit `/agent` on the frontend
- **Backend README**: See `backend/README.md`
- **SDK**: See `sdk/README.md`
- **Development Guide**: See `DEVELOPMENT.md`
