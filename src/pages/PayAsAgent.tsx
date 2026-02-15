import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Bot, Copy, ArrowLeft, Code2, Key, Webhook, MessageSquare, ExternalLink, Shield, Wallet } from "lucide-react";

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
    <div className="min-h-screen bg-slate-50">
      <nav className="border-b border-border bg-white px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-semibold text-foreground">PayAgent API</span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md">
              Beta
            </span>
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
            PayAgent is a crypto payment infrastructure platform for AI agents. Register your agent, get HMAC credentials, and let your agents create and pay payment links programmatically.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4 text-blue-500" />
              <span>HMAC-SHA256 Auth</span>
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
              <Wallet className="h-4 w-4 text-blue-500" />
              <span>Wallet Dashboard</span>
            </div>
          </div>
        </Card>

        {/* How HMAC Works */}
        <Card className="p-6 bg-emerald-50/50 border-emerald-200">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            How HMAC Request Signing Works
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            All API requests from agents are authenticated using HMAC-SHA256 signing. Your <code>api_secret</code> never leaves your environment — only the computed signature is sent over the wire.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# String-to-sign format:
# timestamp\\nMETHOD\\npath\\nSHA256(body)

# Required headers on every request:
#   x-api-key-id:  pk_live_...   (public identifier)
#   x-timestamp:   1707000000    (unix epoch seconds)
#   x-signature:   <HMAC-SHA256 hex>

# Replay protection: timestamp must be within 5 minutes of server time

# ── Shell helper for signing ─────────────────────────────
# Save this as payagent-sign.sh:

#!/bin/bash
KEY_ID="pk_live_YOUR_KEY_ID"
SECRET="sk_live_YOUR_SECRET"
METHOD=\$1   # GET or POST
PATH_=\$2    # /api/create-link
BODY=\$3     # '{"amount":"10"}' or ''

TS=$(date +%s)
BODY_HASH=$(echo -n "\$BODY" | shasum -a 256 | cut -d' ' -f1)
STRING_TO_SIGN="\${TS}\\n\${METHOD}\\n\${PATH_}\\n\${BODY_HASH}"
SIG=$(echo -ne "\$STRING_TO_SIGN" | openssl dgst -sha256 -hmac "\$SECRET" | cut -d' ' -f2)

echo "x-api-key-id: \$KEY_ID"
echo "x-timestamp: \$TS"
echo "x-signature: \$SIG"`}
          </pre>
        </Card>

        {/* Step 1: Register */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">1</span>
            Register Your Agent
          </h3>
          <p className="text-sm text-muted-foreground mb-4">Register via cURL. Complete X verification to get your HMAC credentials (<code>api_key_id</code> + <code>api_secret</code>).</p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`curl -X POST ${API_BASE}/agents/register \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "my-agent",
    "email": "dev@example.com",
    "wallet_address": "0xYourWalletAddress"
  }'

# Response:
# {
#   "success": true,
#   "agent_id": "agent_my-agent_a1b2c3",
#   "verification_challenge": "payagent-verify-my-agent-abc123",
#   "instructions": "Post the challenge to X, then call /api/agents/verify-x"
# }

# After X verification → you receive HMAC credentials:
# {
#   "api_key_id": "pk_live_abc123...",
#   "api_secret": "sk_live_xyz789...",
#   "api_key_expires_at": "2026-02-21T..."
# }
# Save both — they will NOT be shown again.`}
          </pre>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => copyText(
            `curl -X POST ${API_BASE}/agents/register -H "Content-Type: application/json" -d '{"username": "my-agent", "email": "dev@example.com", "wallet_address": "0xYourWalletAddress"}'`,
            "Register command"
          )}>
            <Copy className="h-4 w-4 mr-2" />
            Copy cURL
          </Button>
        </Card>

        {/* Step 1b: X Verification */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-yellow-100 flex items-center justify-center text-sm font-bold text-yellow-600">1b</span>
            Verify on X (Twitter)
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            Post the verification challenge to X (Twitter), then call the verify endpoint with your tweet URL. On success, you'll receive your HMAC credentials.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# 1. Post to X (Twitter):
#    "payagent-verify-my-agent-abc123"

# 2. Call verify endpoint with your tweet URL:
curl -X POST ${API_BASE}/agents/verify-x \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "my-agent",
    "tweet_url": "https://x.com/yourhandle/status/1234567890"
  }'

# Response (save both credentials — shown ONCE):
# {
#   "success": true,
#   "api_key_id": "pk_live_abc123...",
#   "api_secret": "sk_live_xyz789...",
#   "api_key_expires_at": "2026-02-21T...",
#   "x_username": "yourhandle"
# }`}
          </pre>
          <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs text-amber-700">
              <strong>Important:</strong> API keys expire after 10 days. Use the dashboard or <code>POST /api/agents/rotate-key</code> to regenerate before expiry.
            </p>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => copyText(
            `curl -X POST ${API_BASE}/agents/verify-x -H "Content-Type: application/json" -d '{"username": "my-agent", "tweet_url": "https://x.com/yourhandle/status/1234567890"}'`,
            "Verify-X command"
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
            <strong>network</strong> is required. Supported: <code>sepolia</code>, <code>ethereum</code>, <code>base</code>. All requests use HMAC signing.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# Using the @payagent/sdk (recommended):
const link = await client.createLink({
  amount: '10',
  network: 'ethereum',
  token: 'USDC',
  description: 'Service fee',
});

# Using cURL with HMAC headers:
curl -X POST ${API_BASE}/create-link \\
  -H "Content-Type: application/json" \\
  -H "x-api-key-id: pk_live_YOUR_KEY_ID" \\
  -H "x-timestamp: $(date +%s)" \\
  -H "x-signature: <computed HMAC signature>" \\
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
# }`}
          </pre>
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
            Install <code>@payagent/sdk</code> v0.2.0+. The SDK handles HMAC signing, transaction signing, broadcasting, and verification automatically.
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
  apiKeyId: 'pk_live_YOUR_KEY_ID',      // public identifier
  apiSecret: 'sk_live_YOUR_SECRET',     // signing secret (never transmitted)
  privateKey: process.env.WALLET_PRIVATE_KEY,
  baseUrl: '${API_BASE.replace('/api', '')}',
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
for (const tx of result.transactions) {
  console.log(\`  \${tx.description}: \${tx.txHash} (\${tx.status})\`);
}

// ── Or step-by-step for more control ────────────────────
const instructions = await client.getInstructions('REQ-ABC123');
// ... sign & broadcast yourself ...
const verification = await client.verifyPayment('REQ-ABC123', '0xTxHash');`}
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
{`# Using SDK or HMAC-signed requests:
curl -X POST ${API_BASE}/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key-id: pk_live_YOUR_KEY_ID" \\
  -H "x-timestamp: $(date +%s)" \\
  -H "x-signature: <computed>" \\
  -d '{ "message": "Create a 5 USDC payment link on base" }'`}
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
  -H "x-api-key-id: pk_live_YOUR_KEY_ID" \\
  -H "x-timestamp: $(date +%s)" \\
  -H "x-signature: <computed>" \\
  -d '{
    "url": "https://your-agent.com/webhook",
    "events": ["payment.paid", "payment.created"]
  }'

# Events: payment.created, payment.paid, payment.expired
# Payloads include HMAC-SHA256 signature in X-PayAgent-Signature header`}
          </pre>
        </Card>

        {/* Step 6: Key Management */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600">6</span>
            Key Management
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            API keys expire after <strong>10 days</strong>. Rotate keys, deactivate, or delete your agent. These actions require JWT authentication (wallet login) or can be done from the <button onClick={() => navigate('/agents')} className="text-blue-600 underline">Dashboard</button>.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# Rotate API Key (JWT required — via dashboard wallet login)
curl -X POST ${API_BASE}/agents/rotate-key \\
  -H "Authorization: Bearer <your_jwt_token>"

# Response (save both — shown ONCE):
# {
#   "api_key_id": "pk_live_new_id...",
#   "api_secret": "sk_live_new_secret...",
#   "expires_at": "2026-02-23T..."
# }

# Deactivate Agent (soft — can be reactivated)
curl -X POST ${API_BASE}/agents/deactivate \\
  -H "Authorization: Bearer <your_jwt_token>"

# Delete Agent (soft — payment history preserved)
curl -X DELETE ${API_BASE}/agents/me \\
  -H "Authorization: Bearer <your_jwt_token>"`}
          </pre>
          <div className="mt-3 p-3 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> Use the <button onClick={() => navigate('/agents')} className="text-blue-600 underline font-medium">Agents Dashboard</button> to manage keys with a simple click — no cURL needed. Just connect your wallet.
            </p>
          </div>
        </Card>

        {/* Dashboard Auth */}
        <Card className="p-6 bg-purple-50/50 border-purple-200">
          <h3 className="font-heading font-semibold text-lg mb-3 flex items-center gap-2">
            <Wallet className="h-5 w-5 text-purple-600" />
            Dashboard Authentication (Wallet)
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            The browser dashboard uses wallet-based authentication — no secrets in the browser. Connect your wallet, sign a challenge message, and get a short-lived JWT session.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-mono border">
{`# 1. Get challenge nonce
POST /api/auth/challenge
{ "wallet_address": "0x..." }
→ { "nonce": "Sign this to login to PayAgent: abc123...", "expires_in": 300 }

# 2. Sign nonce with wallet (EIP-191) and verify
POST /api/auth/verify
{ "wallet_address": "0x...", "signature": "0x..." }
→ { "token": "eyJ...", "expires_in": 3600, "agent": { ... } }

# 3. Use JWT for dashboard actions
GET /api/agents/me
Authorization: Bearer eyJ...`}
          </pre>
        </Card>

        {/* Auth Method Summary */}
        <Card className="p-6 bg-slate-50/50 border-slate-200">
          <h3 className="font-heading font-semibold text-lg mb-3">Authentication Methods</h3>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg border bg-white">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Key className="h-4 w-4 text-blue-500" />
                SDK / AI Agents / curl
              </div>
              <p className="text-xs text-muted-foreground">
                HMAC-SHA256 request signing via <code>x-api-key-id</code> + <code>x-timestamp</code> + <code>x-signature</code> headers. The <code>api_secret</code> stays in your environment.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-white">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Wallet className="h-4 w-4 text-purple-500" />
                Browser Dashboard
              </div>
              <p className="text-xs text-muted-foreground">
                Wallet signature (EIP-191) to get a 1-hour JWT. No secrets in the browser — just connect your wallet.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-white">
              <div className="flex items-center gap-2 font-medium mb-1">
                <Code2 className="h-4 w-4 text-gray-500" />
                Public Endpoints
              </div>
              <p className="text-xs text-muted-foreground">
                No auth needed: <code>/api/chains</code>, <code>/api/stats</code>, <code>/api/request/:id</code>, <code>/api/auth/*</code>
              </p>
            </div>
          </div>
        </Card>

        {/* Fee Model */}
        <Card className="p-6 bg-amber-50/50 border-amber-200">
          <h3 className="font-heading font-semibold text-lg mb-3">Fee Model</h3>
          <p className="text-sm text-muted-foreground mb-3">
            The payer covers the fee. Fee is paid in LCX token (preferred) or deducted from the payment token (fallback). Payer only needs the payment token + ETH for gas.
          </p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-amber-200/50">
              <span className="text-muted-foreground">If payer has ≥ 4 LCX</span>
              <span className="font-medium">4 LCX fee (2 platform + 2 creator reward). Creator gets full amount.</span>
            </div>
            <div className="flex justify-between py-2 border-b border-amber-200/50">
              <span className="text-muted-foreground">If payer has &lt; 4 LCX</span>
              <span className="font-medium">Fee deducted from payment token (50/50 split). Creator gets amount minus fee.</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">ETH payments</span>
              <span className="font-medium">Fee converted to ETH equivalent using live price.</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Human payers: use <code>GET /api/request/:id/fee?payer=0x...</code> (public, no auth) to get fee breakdown and transfer instructions.
          </p>
        </Card>

        {/* All Endpoints */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-3">All Endpoints</h3>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex gap-3 py-1.5 text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wide">Public (No Auth)</div>
            <div className="flex gap-3 py-1.5"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/register</span><span className="text-foreground ml-auto">Register agent</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/verify-x</span><span className="text-foreground ml-auto">X verification</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/auth/challenge</span><span className="text-foreground ml-auto">Wallet login nonce</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/auth/verify</span><span className="text-foreground ml-auto">Wallet login verify</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/chains</span><span className="text-foreground ml-auto">List chains &amp; tokens</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/request/:id</span><span className="text-foreground ml-auto">View payment link</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/request/:id/fee</span><span className="text-foreground ml-auto">Fee breakdown for payer</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/stats</span><span className="text-foreground ml-auto">Platform statistics</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/rewards?wallet=0x...</span><span className="text-foreground ml-auto">Creator rewards (human + agent)</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/agents/by-wallet?wallet=0x...</span><span className="text-foreground ml-auto">Lookup agent by wallet</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/health</span><span className="text-foreground ml-auto">Health check</span></div>

            <div className="flex gap-3 py-1.5 mt-3 text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wide">HMAC-Signed (SDK / Agents / cURL)</div>
            <div className="flex gap-3 py-1.5"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/create-link</span><span className="text-foreground ml-auto">Create payment link</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/pay-link</span><span className="text-foreground ml-auto">Get payment instructions</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/verify</span><span className="text-foreground ml-auto">Verify payment on-chain</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/chat</span><span className="text-foreground ml-auto">AI chat (natural language)</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/requests</span><span className="text-foreground ml-auto">List your payment links</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/webhooks</span><span className="text-foreground ml-auto">Register webhook</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/webhooks</span><span className="text-foreground ml-auto">List webhooks</span></div>

            <div className="flex gap-3 py-1.5 mt-3 text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wide">HMAC or JWT (Both Auth Methods)</div>
            <div className="flex gap-3 py-1.5"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/agents/me</span><span className="text-foreground ml-auto">Agent profile</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/wallet</span><span className="text-foreground ml-auto">Update wallet address</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/agents/logs</span><span className="text-foreground ml-auto">API request logs</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-blue-600 font-bold w-14">GET</span><span className="text-muted-foreground">/api/agents/ip-history</span><span className="text-foreground ml-auto">IP address history</span></div>

            <div className="flex gap-3 py-1.5 mt-3 text-muted-foreground font-sans text-xs font-semibold uppercase tracking-wide">JWT Only (Dashboard / Wallet Login)</div>
            <div className="flex gap-3 py-1.5"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/rotate-key</span><span className="text-foreground ml-auto">Rotate HMAC credentials</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-green-600 font-bold w-14">POST</span><span className="text-muted-foreground">/api/agents/deactivate</span><span className="text-foreground ml-auto">Deactivate agent</span></div>
            <div className="flex gap-3 py-1.5 border-t"><span className="text-red-600 font-bold w-14">DELETE</span><span className="text-muted-foreground">/api/agents/me</span><span className="text-foreground ml-auto">Delete agent (soft)</span></div>
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
