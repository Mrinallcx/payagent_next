import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Copy, ArrowLeft, Code2, Key, Webhook, MessageSquare, ExternalLink } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/$/, '')}/api`
  : "http://localhost:3000/api";

export default function PayAsAgent() {
  const navigate = useNavigate();

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/50 via-white to-slate-50">
      <nav className="border-b border-border bg-white/80 backdrop-blur px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-semibold text-foreground">PayAgent API</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {/* Overview */}
        <Card className="p-6 bg-blue-50/50 border-blue-200">
          <h2 className="font-heading font-semibold text-lg mb-2">Stripe for AI Agents</h2>
          <p className="text-sm text-muted-foreground mb-3">
            PayAgent is a crypto payment infrastructure platform for AI agents. Register your agent, get an API key, and let your agents create and pay payment links programmatically.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Key className="h-4 w-4 text-blue-500" />
              <span>API Key Auth</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              <span>AI Chat</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Webhook className="h-4 w-4 text-blue-500" />
              <span>Webhooks</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Code2 className="h-4 w-4 text-blue-500" />
              <span>REST API</span>
            </div>
          </div>
        </Card>

        {/* Step 1: Register */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">1</span>
            Register Your Agent
          </h3>
          <p className="text-sm text-muted-foreground mb-4">No UI needed. Register via cURL and get your credentials.</p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`curl -X POST ${API_BASE}/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "my-agent",
    "email": "dev@example.com",
    "wallet_address": "0xYourWalletAddress"
  }'

# Response (save these — shown ONCE):
# {
#   "agent_id": "agent_my-agent_a1b2c3",
#   "api_key": "pk_live_abc123...",
#   "webhook_secret": "whsec_xyz789..."
# }`}
          </pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => copyText(
            `curl -X POST ${API_BASE}/agents/register -H "Content-Type: application/json" -d '{"username": "my-agent", "email": "dev@example.com", "wallet_address": "0xYourWalletAddress"}'`,
            "Register command"
          )}>
            <Copy className="h-4 w-4 mr-2" />
            Copy cURL
          </Button>
        </Card>

        {/* Step 2: Create Link */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">2</span>
            Create a Payment Link
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            <strong>network</strong> is required. Supported: <code>sepolia</code>, <code>ethereum</code>, <code>base</code>. Token defaults to USDC.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`curl -X POST ${API_BASE}/create-link \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{
    "amount": "10",
    "network": "ethereum",
    "token": "USDC",
    "description": "Service fee"
  }'

# Response:
# {
#   "success": true,
#   "linkId": "REQ-ABC123",
#   "link": "/r/REQ-ABC123",
#   "network": "ethereum",
#   "token": "USDC",
#   "amount": "10"
# }

# Without network → 400 error:
# { "error": "Missing required field: network. Supported: sepolia, ethereum, base" }`}
          </pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => copyText(
            `curl -X POST ${API_BASE}/create-link -H "Content-Type: application/json" -H "x-api-key: pk_live_YOUR_API_KEY" -d '{"amount": "10", "network": "ethereum", "token": "USDC", "description": "Service fee"}'`,
            "Create link command"
          )}>
            <Copy className="h-4 w-4 mr-2" />
            Copy cURL
          </Button>
        </Card>

        {/* Supported Chains */}
        <Card className="p-6 bg-slate-50/50 border-slate-200">
          <h3 className="font-heading font-semibold text-lg mb-3">Supported Chains &amp; Tokens</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-200/50">
              <span className="font-medium">Ethereum Mainnet</span>
              <span className="text-muted-foreground font-mono text-xs">ethereum</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-200/50">
              <span className="font-medium">Base Mainnet</span>
              <span className="text-muted-foreground font-mono text-xs">base</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-200/50">
              <span className="font-medium">Sepolia Testnet</span>
              <span className="text-muted-foreground font-mono text-xs">sepolia</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Tokens per chain: USDC, USDT, ETH (native), LCX. Query <code>GET /api/chains</code> for full details.
          </p>
        </Card>

        {/* Step 3: Pay via SDK (Recommended) */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">3</span>
            Pay a Link — SDK (Recommended)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Install <code>@payagent/sdk</code> to integrate PayAgent payments into your agent or application. The SDK handles fetching instructions, signing, broadcasting, and verification.
          </p>

          {/* npm badge */}
          <a
            href="https://www.npmjs.com/package/@payagent/sdk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full bg-red-50 border border-red-200 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
          >
            <img src="https://img.shields.io/npm/v/@payagent/sdk?color=red&label=npm" alt="npm version" className="h-4" />
            <span>@payagent/sdk</span>
            <ExternalLink className="h-3 w-3" />
          </a>

          {/* Install */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Install</div>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`npm install @payagent/sdk ethers`}
            </pre>
          </div>

          {/* Full Example Template */}
          <div className="mb-4">
            <div className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">Full Implementation Example</div>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`const { PayAgentClient } = require('@payagent/sdk');

// ── Initialize the client ───────────────────────────────
const client = new PayAgentClient({
  apiKey: 'pk_live_YOUR_API_KEY',
  privateKey: process.env.WALLET_PRIVATE_KEY,
  baseUrl: '${API_BASE.replace('/api', '')}',
  // Optional: provide your own RPC URLs for better reliability
  // rpcUrl: {
  //   sepolia: 'https://sepolia.infura.io/v3/YOUR_KEY',
  //   ethereum: 'https://mainnet.infura.io/v3/YOUR_KEY',
  //   base: 'https://base-mainnet.infura.io/v3/YOUR_KEY',
  // },
});

console.log('Wallet address:', client.address);

// ── Create a payment link ───────────────────────────────
const link = await client.createLink({
  amount: '10',
  network: 'sepolia',      // 'sepolia' | 'ethereum' | 'base'
  token: 'USDC',           // 'USDC' | 'USDT' | 'ETH' | 'LCX'
  description: 'Service fee',
});
console.log('Link created:', link.linkId);

// ── Pay a link (one call) ───────────────────────────────
const result = await client.payLink(link.linkId);
console.log('Status:', result.status);        // 'PAID'
console.log('Payer:', result.payer);           // '0x...'
console.log('Network:', result.network);       // 'sepolia'
console.log('Transactions:');
for (const tx of result.transactions) {
  console.log(\`  \${tx.description}: \${tx.txHash} (\${tx.status})\`);
}

// ── Or step-by-step for more control ────────────────────
// 1. Get payment instructions
const instructions = await client.getInstructions('REQ-ABC123');
console.log(instructions.instructions.transfers);

// 2. (SDK signs & broadcasts automatically in payLink)

// 3. Verify a payment manually
const verification = await client.verifyPayment(
  'REQ-ABC123',        // requestId
  '0xPaymentTxHash',   // main payment tx
  '0xFeeTxHash',       // platform fee tx (optional)
  '0xRewardTxHash'     // creator reward tx (optional)
);

// ── List supported chains ───────────────────────────────
const chains = await client.getChains();
console.log(chains);`}
            </pre>
          </div>

          {/* SDK Methods Reference */}
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 text-xs font-semibold text-muted-foreground border-b">SDK Methods</div>
            <div className="divide-y text-xs font-mono">
              <div className="flex gap-3 px-4 py-2"><span className="text-blue-600 font-semibold min-w-[200px]">client.payLink(linkId)</span><span className="text-muted-foreground">Fetch instructions, sign, broadcast, and verify in one call</span></div>
              <div className="flex gap-3 px-4 py-2"><span className="text-blue-600 font-semibold min-w-[200px]">client.createLink({"{ ... }"})</span><span className="text-muted-foreground">Create a payment link (amount, network, token, description)</span></div>
              <div className="flex gap-3 px-4 py-2"><span className="text-blue-600 font-semibold min-w-[200px]">client.getInstructions(linkId)</span><span className="text-muted-foreground">Fetch transfer instructions only (for manual control)</span></div>
              <div className="flex gap-3 px-4 py-2"><span className="text-blue-600 font-semibold min-w-[200px]">client.verifyPayment(id, txHash)</span><span className="text-muted-foreground">Verify a payment by transaction hash</span></div>
              <div className="flex gap-3 px-4 py-2"><span className="text-blue-600 font-semibold min-w-[200px]">client.getChains()</span><span className="text-muted-foreground">List supported chains and tokens</span></div>
              <div className="flex gap-3 px-4 py-2"><span className="text-blue-600 font-semibold min-w-[200px]">client.address</span><span className="text-muted-foreground">Your wallet address (read-only property)</span></div>
            </div>
          </div>

          <Button variant="outline" size="sm" className="mt-4" onClick={() => copyText(
            `npm install @payagent/sdk ethers`,
            "SDK install command"
          )}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Install Command
          </Button>
        </Card>

        {/* Step 3b: Manual Flow */}
        <Card className="p-6 bg-slate-50/50 border-slate-200">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-slate-200 flex items-center justify-center text-sm font-bold text-slate-600">3b</span>
            Manual Flow (Advanced)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Alternatively, get payment instructions via <code>POST /api/pay-link</code>, sign and broadcast yourself, then verify via <code>POST /api/verify</code>.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# Step A: Get payment instructions + fee breakdown
curl -X POST ${API_BASE}/pay-link \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{ "linkId": "REQ-ABC123" }'

# Response:
# {
#   "success": true,
#   "linkId": "REQ-ABC123",
#   "instructions": {
#     "payment": {
#       "token": "USDC",
#       "tokenAddress": "0xA0b8...",
#       "amount": "10",
#       "to": "0xCreatorWallet",
#       "network": "ethereum"
#     },
#     "fee": {
#       "feeToken": "LCX",
#       "feeTotal": 4,
#       "platformShare": 2,
#       "creatorReward": 2
#     },
#     "transfers": [
#       { "description": "Payment to creator", "token": "USDC", "amount": "10", "to": "0xCreator" },
#       { "description": "Platform fee", "token": "LCX", "amount": "2", "to": "0xTreasury" },
#       { "description": "Creator reward", "token": "LCX", "amount": "2", "to": "0xCreator" }
#     ]
#   }
# }`}
          </pre>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border mt-3">
{`# Step B: Sign & broadcast transfers on-chain yourself (ethers.js, etc.)
# Then verify with the transaction hash:

curl -X POST ${API_BASE}/verify \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{
    "requestId": "REQ-ABC123",
    "txHash": "0xPaymentTxHash...",
    "feeTxHash": "0xFeeTxHash...",
    "creatorRewardTxHash": "0xRewardTxHash..."
  }'

# Response:
# {
#   "success": true,
#   "status": "PAID",
#   "verification": {
#     "valid": true,
#     "txHash": "0x...",
#     "amount": "10",
#     "blockNumber": 12345678
#   }
# }`}
          </pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => copyText(
            `curl -X POST ${API_BASE}/pay-link -H "Content-Type: application/json" -H "x-api-key: pk_live_YOUR_API_KEY" -d '{"linkId": "REQ-ABC123"}'`,
            "Pay-link command"
          )}>
            <Copy className="h-4 w-4 mr-2" />
            Copy pay-link cURL
          </Button>
        </Card>

        {/* Step 4: AI Chat */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">4</span>
            AI Chat (Natural Language)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Talk to PayAgent AI (powered by Grok). It can create links, check status, and more. When creating a link, the AI will ask which chain to use.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# Step 1: Ask to create a link (no chain specified)
curl -X POST ${API_BASE}/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{ "message": "Create a 5 USDC payment link" }'

# AI responds → asks which chain:
# { "action": "select_chain",
#   "result": {
#     "action_required": "select_chain",
#     "chains": [
#       { "name": "sepolia", "displayName": "Sepolia (ETH Testnet)" },
#       { "name": "ethereum", "displayName": "Ethereum Mainnet" },
#       { "name": "base", "displayName": "Base Mainnet" }
#     ],
#     "pending": { "amount": "5", "token": "USDC" },
#     "message": "Which chain would you like to use?"
#   }
# }

# Step 2: Reply with the chain
curl -X POST ${API_BASE}/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{ "message": "base" }'

# AI creates the link on Base:
# { "action": "create_link",
#   "result": { "linkId": "REQ-XYZ", "link": "/r/REQ-XYZ",
#     "network": "base", "token": "USDC" } }

# Or specify chain upfront to skip the prompt:
curl -X POST ${API_BASE}/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{ "message": "Create a 10 USDT link on ethereum" }'`}
          </pre>
        </Card>

        {/* Step 5: Webhooks */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">5</span>
            Register Webhooks
          </h3>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`curl -X POST ${API_BASE}/webhooks \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: pk_live_YOUR_API_KEY" \\
  -d '{
    "url": "https://your-agent.com/webhook",
    "events": ["payment.paid", "payment.created"]
  }'

# Events: payment.created, payment.paid, payment.expired
# Payloads include HMAC-SHA256 signature in X-PayAgent-Signature header`}
          </pre>
        </Card>

        {/* Fee Model */}
        <Card className="p-6 bg-amber-50/50 border-amber-200">
          <h3 className="font-heading font-semibold text-lg mb-3">Fee Model (LCX / USDC)</h3>
          <p className="text-sm text-muted-foreground mb-3">
            The payee covers the fee. Fee can be paid in LCX token (preferred) or USDC (fallback).
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-amber-200/50">
              <span className="text-muted-foreground">If payee has ≥ 4 LCX</span>
              <span className="font-medium">4 LCX fee (2 platform + 2 creator reward)</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">If payee has &lt; 4 LCX</span>
              <span className="font-medium">USDC equiv of 4 LCX (50/50 split)</span>
            </div>
          </div>
        </Card>

        {/* All Endpoints */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3">All Endpoints</h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex gap-3 py-1.5"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/register</span><span className="text-foreground ml-auto">Register (no auth)</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/agents/me</span><span className="text-foreground ml-auto">My profile</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/wallet</span><span className="text-foreground ml-auto">Update wallet</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/create-link</span><span className="text-foreground ml-auto">Create link (network required)</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/pay-link</span><span className="text-foreground ml-auto">Get pay instructions</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/verify</span><span className="text-foreground ml-auto">Verify payment</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/chat</span><span className="text-foreground ml-auto">AI chat (chain-aware)</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/chains</span><span className="text-foreground ml-auto">List supported chains</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/requests</span><span className="text-foreground ml-auto">My payment links</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/request/:id</span><span className="text-foreground ml-auto">Get link (public)</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/webhooks</span><span className="text-foreground ml-auto">Register webhook</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/webhooks</span><span className="text-foreground ml-auto">List webhooks</span></div>
          </div>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => copyText(API_BASE, "Base URL")}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Base URL ({API_BASE})
          </Button>
        </Card>
      </main>
    </div>
  );
}
