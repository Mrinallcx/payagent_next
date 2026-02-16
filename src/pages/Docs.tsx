import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/$/, "")}/api`
  : "http://localhost:3000/api";

/* ─── sidebar navigation structure ─── */
const NAV = [
  {
    label: "Getting Started",
    items: [
      { id: "welcome", icon: "👋", text: "Welcome" },
      { id: "quick-summary", icon: "⚡", text: "Quick Summary" },
      { id: "key-concepts", icon: "💡", text: "Key Concepts" },
    ],
  },
  {
    label: "Product",
    items: [
      { id: "fees-rewards", icon: "🪙", text: "Fees and Rewards" },
      { id: "supported-assets", icon: "💎", text: "Supported Assets" },
      { id: "humans", icon: "👤", text: "For Humans" },
      { id: "agents", icon: "🤖", text: "For AI Agents" },
    ],
  },
  {
    label: "Developers",
    items: [
      { id: "api", icon: "🔧", text: "API Overview" },
      { id: "hmac-auth", icon: "🔐", text: "HMAC Authentication" },
      { id: "agent-register", icon: "📝", text: "Agent Registration" },
      { id: "sdk", icon: "📦", text: "SDK & Payments" },
      { id: "ai-chat", icon: "💬", text: "AI Chat" },
      { id: "webhooks", icon: "🔔", text: "Webhooks" },
      { id: "key-mgmt", icon: "🔑", text: "Key Management" },
      { id: "wallet-auth", icon: "👛", text: "Dashboard Auth" },
      { id: "endpoints", icon: "📋", text: "All Endpoints" },
      { id: "chains", icon: "⛓️", text: "Chains & Tokens" },
      { id: "network", icon: "🌐", text: "Network & Roadmap" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "security", icon: "🔒", text: "Security & Custody" },
      { id: "faq", icon: "❓", text: "FAQ" },
      { id: "legal", icon: "📄", text: "Legal & Disclaimer" },
    ],
  },
];

const lcx = (text: string) => (
  <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-medium hover:underline">{text}</a>
);

/* ─── reusable sub-components ─── */
const Callout = ({ children, green, amber }: { children: React.ReactNode; green?: boolean; amber?: boolean }) => (
  <div className={`rounded-lg border px-5 py-4 my-6 text-sm leading-[1.65] text-gray-800 ${green ? "bg-emerald-50 border-emerald-200" : amber ? "bg-amber-50 border-amber-200" : "bg-blue-50/60 border-blue-200"}`}>
    {children}
  </div>
);

const DocTable = ({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) => (
  <div className="w-full border border-slate-200 rounded-lg overflow-hidden my-5">
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-slate-50">
          {headers.map((h) => (
            <th key={h} className="text-left text-xs font-semibold uppercase tracking-[0.8px] text-gray-500 px-4 py-2.5 border-b-2 border-slate-200">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className={i < rows.length - 1 ? "border-b border-slate-100" : ""}>
            {row.map((cell, j) => (
              <td key={j} className="px-4 py-2.5 text-gray-600">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const Badge = ({ children, color }: { children: React.ReactNode; color: "blue" | "green" | "amber" }) => {
  const cls = color === "green" ? "bg-emerald-50 text-emerald-600" : color === "amber" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600";
  return <span className={`inline-block text-[11px] font-bold uppercase tracking-[0.8px] px-2 py-0.5 rounded ml-1.5 align-middle ${cls}`}>{children}</span>;
};

const Code = ({ children }: { children: React.ReactNode }) => (
  <code className="font-mono text-[13px] bg-slate-100 px-1.5 py-0.5 rounded text-gray-800">{children}</code>
);

const Pre = ({ children }: { children: string }) => (
  <pre className="bg-slate-900 text-slate-200 rounded-lg px-6 py-5 my-4 overflow-x-auto font-mono text-[13px] leading-[1.6]">{children}</pre>
);

const SectionH2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} data-doc-section className="text-[22px] font-bold text-slate-900 tracking-tight mt-12 mb-3 pt-4 border-t border-slate-200">{children}</h2>
);

const SectionH3 = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-[17px] font-semibold text-gray-800 mt-8 mb-2">{children}</h3>
);

const P = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[15px] text-gray-600 leading-[1.7] mb-4">{children}</p>
);

/* Endpoint row */
const EP = ({ method, path, desc }: { method: string; path: string; desc: string }) => {
  const mc = method === "POST" ? "text-green-600" : method === "DELETE" ? "text-red-600" : "text-blue-600";
  return (
    <div className="flex gap-3 py-2 border-b border-slate-100 text-xs font-mono items-baseline">
      <span className={`${mc} font-bold w-14 shrink-0`}>{method}</span>
      <span className="text-gray-500 min-w-0 break-all">{path}</span>
      <span className="text-gray-800 ml-auto shrink-0 font-sans">{desc}</span>
    </div>
  );
};

/* ════════════════════════════════════════════ */
export default function Docs() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeId, setActiveId] = useState("welcome");

  useEffect(() => {
    const targets = document.querySelectorAll<HTMLElement>("[data-doc-section]");
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((e) => { if (e.isIntersecting) setActiveId(e.target.id); }); },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0 }
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, []);

  const handleNavClick = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setSidebarOpen(false);
  }, []);

  return (
    <div className="docs-layout font-sans">
      {/* ── SIDEBAR ── */}
      <aside className={`docs-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
          <a href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <img src="/robot.svg" alt="PayAgent" className="w-8 h-8" />
            </div>
            <div className="flex flex-col leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-slate-900">PayAgent</span>
                <span className="px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded">Beta</span>
              </div>
              <span className="text-[10px] text-gray-400 font-medium mt-0.5">by LCX</span>
            </div>
          </a>
        </div>

        <nav className="py-4">
          {NAV.map((section, si) => (
            <div key={section.label}>
              {si > 0 && <div className="h-px bg-slate-200 mx-5 my-3" />}
              <div className="px-5">
                <div className="text-[11px] font-bold uppercase tracking-[1.2px] text-gray-400 py-2">{section.label}</div>
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2 px-3 py-[7px] text-sm font-medium rounded-md transition-colors text-left ${
                      activeId === item.id ? "bg-blue-50 text-blue-600 font-semibold" : "text-gray-600 hover:bg-blue-50 hover:text-blue-600"
                    }`}
                  >
                    <span className="w-5 text-center text-[15px] shrink-0">{item.icon}</span>
                    {item.text}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* ── MAIN ── */}
      <main className="docs-main flex-1 min-w-0" style={{ marginLeft: 280 }}>
        <div className="docs-topbar sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-slate-200 px-10 h-[52px] flex items-center justify-between">
          <div className="text-[13px] text-gray-400">
            <a href="/" className="text-gray-500 hover:text-blue-600 no-underline">PayAgent</a>
            <span className="mx-1.5">/</span>
            <span>Documentation</span>
          </div>
          <div className="flex items-center gap-5 text-[13px] font-semibold">
            <a href="/" className="text-gray-500 hover:text-blue-600 no-underline">Home</a>
            <a href="/about" className="text-gray-500 hover:text-blue-600 no-underline">About</a>
            <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-600 no-underline">LCX</a>
          </div>
        </div>

        <div className="docs-content max-w-[760px] mx-auto px-10 pt-12 pb-20">

          {/* ══════════════ GETTING STARTED ══════════════ */}

          {/* WELCOME */}
          <section id="welcome" data-doc-section>
            <h1 className="text-[32px] font-bold text-slate-900 tracking-tight leading-[1.2] mb-2">PayAgent Documentation</h1>
            <p className="text-[17px] text-gray-500 mb-10 leading-relaxed">
              Crypto payments for humans and AI agents. Built by {lcx("LCX (Liberty Crypto Exchange)")}.
            </p>
            <Callout>
              <strong className="text-blue-600">Core thesis:</strong> Every AI agent will need a wallet, payment rails, and financial autonomy. PayAgent is how they pay. A non-custodial payment service that allows humans and AI agents to send, receive, and automate crypto payments using stablecoins, with LCX as the network fee and reward token.
            </Callout>
            <P>AI agents are becoming economic actors. They buy compute, pay APIs, settle micro-transactions, and transact with other agents. PayAgent is the financial infrastructure for this new economy.</P>
            <P>PayAgent is built for:</P>
            <div className="grid grid-cols-2 gap-3.5 my-6 max-[600px]:grid-cols-1">
              {[
                { icon: "👤", title: "Free for Humans", desc: "Create payment links and pay directly from your wallet. Non-custodial, full control." },
                { icon: "🤖", title: "For AI Agents & Developers", desc: "Programmable payment rails via API. Agents create links, pay, and earn rewards autonomously." },
                { icon: "🔗", title: "Link-Based Settlement", desc: "Every payment is a link. Share with anyone, human or agent. Settles instantly on-chain." },
                { icon: "🪙", title: "Earn LCX with Every Payment", desc: "Payment link creators earn LCX token rewards on every successful settlement." },
              ].map((c) => (
                <div key={c.title} className="border border-slate-200 rounded-[10px] p-5 hover:border-blue-600 hover:shadow-sm transition-all">
                  <div className="text-[22px] mb-2.5">{c.icon}</div>
                  <h4 className="text-[15px] font-bold text-slate-900 mb-1">{c.title}</h4>
                  <p className="text-[13px] text-gray-500 leading-snug">{c.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* QUICK SUMMARY */}
          <SectionH2 id="quick-summary">Quick Summary</SectionH2>
          <SectionH3>What PayAgent Does</SectionH3>
          <ul className="list-disc ml-5 my-2 mb-5 text-[15px] text-gray-600 leading-[1.7] space-y-1">
            <li>Free for humans to create payment links</li>
            <li>Programmable payment rails for AI agents, firms, and developers via API</li>
            <li>Get paid in stablecoins (USDC, USDT, USAT)</li>
            <li>Earn LCX tokens for every completed payment</li>
            <li>Pay small, flat network fees in LCX (auto-swapped via Uniswap if needed)</li>
            <li>Automate agent-to-agent payments without human intervention</li>
          </ul>
          <SectionH3>Supported Today</SectionH3>
          <DocTable headers={["Property", "Value"]} rows={[
            ["Network", <span>Ethereum <Badge color="green">Live</Badge></span>],
            ["Assets (Standard)", "USDC, USDT, USAT"],
            ["Assets (Pro)", "Any ERC-20 token on Ethereum"],
            ["Fees", "Paid in LCX"],
            ["Custody", "Non-custodial"],
          ]} />

          {/* KEY CONCEPTS */}
          <SectionH2 id="key-concepts">Key Concepts</SectionH2>
          <SectionH3>Humans vs AI Agents</SectionH3>
          <DocTable headers={["Role", "Description"]} rows={[
            [<><strong>Human</strong> 👤</>, "Creates payment links manually via UI"],
            [<><strong>AI Agent</strong> 🤖</>, "Creates and pays links autonomously via API"],
          ]} />
          <P>Both follow the same economic rules. Both earn LCX rewards.</P>
          <SectionH3>Stablecoins vs LCX</SectionH3>
          <Callout>
            <strong className="text-blue-600">Stablecoins</strong> move value. <strong className="text-blue-600">LCX</strong> powers the network. Stablecoins are the medium of exchange. LCX is the network fuel, used for fees, creator rewards, and economic incentives.
          </Callout>

          {/* ══════════════ PRODUCT ══════════════ */}

          {/* FEES & REWARDS */}
          <SectionH2 id="fees-rewards">Fees and Rewards</SectionH2>
          <SectionH3>Standard Mode</SectionH3>
          <DocTable headers={["Property", "Value"]} rows={[
            ["Network Fee", <strong>2 LCX</strong>], ["Creator Reward", "1 LCX"], ["Service Fee", "1 LCX"], ["Supported Assets", "USDC, USDT, USAT"],
          ]} />
          <SectionH3>Pro Mode</SectionH3>
          <DocTable headers={["Property", "Value"]} rows={[
            ["Network Fee", <strong>4 LCX</strong>], ["Creator Reward", "2 LCX"], ["Service Fee", "2 LCX"], ["Supported Assets", "Any ERC-20 token on Ethereum"],
          ]} />
          <Callout green>
            <strong className="text-emerald-600">Earn LCX with every payment.</strong> Every time a payment link you created is paid, you automatically earn LCX tokens. Rewards are credited on successful settlement.
          </Callout>
          <SectionH3>Fee Details</SectionH3>
          <P>The payer covers the fee. Fee is paid in LCX token (preferred) or deducted from the payment token (fallback). Payer only needs the payment token + ETH for gas.</P>
          <DocTable headers={["Scenario", "Behavior"]} rows={[
            ["Payer has ≥ 4 LCX", "4 LCX fee (2 platform + 2 creator reward). Creator gets full amount."],
            ["Payer has < 4 LCX", "Fee deducted from payment token (50/50 split). Creator gets amount minus fee."],
            ["ETH payments", "Fee converted to ETH equivalent using live price."],
          ]} />
          <P>Fees are LCX-denominated, not USD-based. At current pricing: 2 LCX ≈ $0.08 (at $0.04/LCX). If a payer does not hold enough LCX, the amount is auto-sourced via Uniswap.</P>
          <P>Human payers: use <Code>GET /api/request/:id/fee?payer=0x...</Code> (public, no auth) to get fee breakdown and transfer instructions.</P>

          {/* SUPPORTED ASSETS */}
          <SectionH2 id="supported-assets">Supported Assets</SectionH2>
          <SectionH3>Standard Mode <Badge color="blue">2 LCX Fee</Badge></SectionH3>
          <DocTable headers={["Asset", "Type"]} rows={[["USDC", "Stablecoin (USD)"], ["USDT", "Stablecoin (USD)"], ["USAT", "Stablecoin"]]} />
          <SectionH3>Pro Mode <Badge color="amber">4 LCX Fee</Badge></SectionH3>
          <P>Any ERC-20 token on Ethereum. Designed for advanced users, AI agents, and integrators who need flexibility beyond stablecoins.</P>

          {/* FOR HUMANS */}
          <SectionH2 id="humans">For Humans</SectionH2>
          <P>Create shareable links instantly and get paid. Connect your wallet, choose an amount and asset, generate a link, and share it.</P>
          <ol className="docs-steps">
            <li>Connect your non-custodial wallet</li>
            <li>Choose amount and asset</li>
            <li>Generate payment link</li>
            <li>Share the link with anyone</li>
            <li>Earn LCX when the link is paid</li>
          </ol>
          <Callout><strong className="text-blue-600">Coming soon:</strong> Full payment history with filtering, export, and detailed analytics.</Callout>

          {/* FOR AI AGENTS */}
          <SectionH2 id="agents">For AI Agents, Firms, and Developers</SectionH2>
          <P>PayAgent provides programmable, automated payment rails via API. Flat, predictable fees in LCX tokens. No percentages, no hidden costs.</P>
          <ul className="list-disc ml-5 my-2 mb-5 text-[15px] text-gray-600 leading-[1.7] space-y-1">
            <li>Create payment links via API</li>
            <li>Pay links autonomously</li>
            <li>Earn LCX rewards on every settlement</li>
            <li>Operate without human intervention</li>
          </ul>
          <ol className="docs-steps">
            <li>Agent creates a payment request via API</li>
            <li>Another agent or human pays the link</li>
            <li>Settlement occurs automatically on-chain</li>
            <li>LCX rewards distributed to the creator agent</li>
          </ol>
          <Callout>
            <strong className="text-blue-600">Deterministic for agents.</strong> AI agents can predict costs, calculate rewards, and execute payments programmatically with zero ambiguity.
          </Callout>

          {/* ══════════════ DEVELOPERS ══════════════ */}

          {/* API OVERVIEW */}
          <SectionH2 id="api">API Overview</SectionH2>
          <P>PayAgent is a crypto payment infrastructure platform for AI agents. Register your agent, get HMAC credentials, and let your agents create and pay payment links programmatically.</P>
          <div className="grid grid-cols-2 gap-3 my-6 max-[500px]:grid-cols-1">
            {[
              { icon: "🔐", label: "HMAC-SHA256 Auth" },
              { icon: "💬", label: "AI Chat" },
              { icon: "🔔", label: "Webhooks" },
              { icon: "👛", label: "Wallet Dashboard" },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-2.5 text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <span className="text-lg">{f.icon}</span>{f.label}
              </div>
            ))}
          </div>
          <SectionH3>Base URL</SectionH3>
          <Pre>{API_BASE.replace("/api", "")}</Pre>
          <SectionH3>npm Package</SectionH3>
          <P>Install the PayAgent SDK for agent integrations:</P>
          <Pre>npm install @payagent/sdk ethers</Pre>
          <SectionH3>Quick Example</SectionH3>
          <Pre>{`// Create a payment link
const link = await payagent.createLink({
  amount: "100",
  asset: "USDC",
  mode: "standard"
});

// Returns: { linkId, url, status, fee: "2 LCX" }`}</Pre>

          {/* HMAC AUTHENTICATION */}
          <SectionH2 id="hmac-auth">HMAC Authentication</SectionH2>
          <P>All API requests from agents are authenticated using HMAC-SHA256 signing. Your <Code>api_secret</Code> never leaves your environment — only the computed signature is sent over the wire.</P>
          <SectionH3>Required Headers</SectionH3>
          <DocTable headers={["Header", "Description"]} rows={[
            [<Code>x-api-key-id</Code>, <>Public identifier — <Code>pk_live_...</Code></>],
            [<Code>x-timestamp</Code>, "Unix epoch seconds (must be within 5 min of server time)"],
            [<Code>x-signature</Code>, "HMAC-SHA256 hex digest of the string-to-sign"],
          ]} />
          <SectionH3>String-to-Sign Format</SectionH3>
          <Pre>{`# Format:
# timestamp\\nMETHOD\\npath\\nSHA256(body)

# Replay protection: timestamp must be within 5 minutes of server time`}</Pre>
          <SectionH3>Shell Signing Helper</SectionH3>
          <Pre>{`#!/bin/bash
KEY_ID="pk_live_YOUR_KEY_ID"
SECRET="sk_live_YOUR_SECRET"
METHOD=$1   # GET or POST
PATH_=$2    # /api/create-link
BODY=$3     # '{"amount":"10"}' or ''

TS=$(date +%s)
BODY_HASH=$(echo -n "$BODY" | shasum -a 256 | cut -d' ' -f1)
STRING_TO_SIGN="\${TS}\\n\${METHOD}\\n\${PATH_}\\n\${BODY_HASH}"
SIG=$(echo -ne "$STRING_TO_SIGN" | openssl dgst -sha256 -hmac "$SECRET" | cut -d' ' -f2)

echo "x-api-key-id: $KEY_ID"
echo "x-timestamp: $TS"
echo "x-signature: $SIG"`}</Pre>

          {/* AGENT REGISTRATION */}
          <SectionH2 id="agent-register">Agent Registration</SectionH2>
          <SectionH3>Step 1: Register Your Agent</SectionH3>
          <P>Register via cURL. Complete X verification to get your HMAC credentials (<Code>api_key_id</Code> + <Code>api_secret</Code>).</P>
          <Pre>{`curl -X POST ${API_BASE}/agents/register \\
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
# Save both — they will NOT be shown again.`}</Pre>

          <SectionH3>Step 2: Verify on X (Twitter)</SectionH3>
          <P>Post the verification challenge to X (Twitter), then call the verify endpoint with your tweet URL. On success, you'll receive your HMAC credentials.</P>
          <Pre>{`# 1. Post to X (Twitter):
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
# }`}</Pre>
          <Callout amber>
            <strong className="text-amber-700">Important:</strong> API keys expire after 10 days. Use the dashboard or <Code>POST /api/agents/rotate-key</Code> to regenerate before expiry.
          </Callout>

          {/* SDK & PAYMENTS */}
          <SectionH2 id="sdk">SDK &amp; Payments</SectionH2>
          <P>Install <Code>@payagent/sdk</Code> v0.2.0+. The SDK handles HMAC signing, transaction signing, broadcasting, and verification automatically.</P>
          <SectionH3>Installation</SectionH3>
          <Pre>npm install @payagent/sdk ethers</Pre>

          <SectionH3>Full Implementation Example</SectionH3>
          <Pre>{`const { PayAgentClient } = require('@payagent/sdk');

// ── Initialize the client ───────────────────────────────
const client = new PayAgentClient({
  apiKeyId: 'pk_live_YOUR_KEY_ID',      // public identifier
  apiSecret: 'sk_live_YOUR_SECRET',     // signing secret (never transmitted)
  privateKey: process.env.WALLET_PRIVATE_KEY,
  baseUrl: '${API_BASE.replace("/api", "")}',
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
const verification = await client.verifyPayment('REQ-ABC123', '0xTxHash');`}</Pre>

          <SectionH3>Create a Payment Link (cURL)</SectionH3>
          <P><Code>network</Code> is required. Supported: <Code>sepolia</Code>, <Code>ethereum</Code>, <Code>base</Code>. All requests use HMAC signing.</P>
          <Pre>{`curl -X POST ${API_BASE}/create-link \\
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
# }`}</Pre>

          <SectionH3>SDK Methods Reference</SectionH3>
          <DocTable headers={["Method", "Description"]} rows={[
            [<Code>client.payLink(linkId)</Code>, "Fetch instructions, sign, broadcast, and verify in one call"],
            [<Code>client.createLink({"{ ... }"})</Code>, "Create a payment link (amount, network, token, description)"],
            [<Code>client.getInstructions(linkId)</Code>, "Fetch transfer instructions only (for manual control)"],
            [<Code>client.verifyPayment(id, txHash)</Code>, "Verify a payment by transaction hash"],
            [<Code>client.getChains()</Code>, "List supported chains and tokens"],
            [<Code>client.address</Code>, "Your wallet address (read-only property)"],
          ]} />

          {/* AI CHAT */}
          <SectionH2 id="ai-chat">AI Chat (Natural Language)</SectionH2>
          <P>Talk to PayAgent AI (powered by Grok). It can create links, check status, and more. When creating a link, the AI will ask which chain to use.</P>
          <Pre>{`curl -X POST ${API_BASE}/chat \\
  -H "Content-Type: application/json" \\
  -H "x-api-key-id: pk_live_YOUR_KEY_ID" \\
  -H "x-timestamp: $(date +%s)" \\
  -H "x-signature: <computed>" \\
  -d '{ "message": "Create a 5 USDC payment link on base" }'`}</Pre>

          {/* WEBHOOKS */}
          <SectionH2 id="webhooks">Webhooks</SectionH2>
          <P>Register webhook URLs to receive real-time notifications when payment events occur.</P>
          <Pre>{`curl -X POST ${API_BASE}/webhooks \\
  -H "Content-Type: application/json" \\
  -H "x-api-key-id: pk_live_YOUR_KEY_ID" \\
  -H "x-timestamp: $(date +%s)" \\
  -H "x-signature: <computed>" \\
  -d '{
    "url": "https://your-agent.com/webhook",
    "events": ["payment.paid", "payment.created"]
  }'

# Events: payment.created, payment.paid, payment.expired
# Payloads include HMAC-SHA256 signature in X-PayAgent-Signature header`}</Pre>
          <DocTable headers={["Event", "Triggered When"]} rows={[
            [<Code>payment.created</Code>, "A new payment link is created"],
            [<Code>payment.paid</Code>, "A payment link is settled on-chain"],
            [<Code>payment.expired</Code>, "A payment link expires without being paid"],
          ]} />

          {/* KEY MANAGEMENT */}
          <SectionH2 id="key-mgmt">Key Management</SectionH2>
          <P>API keys expire after <strong>10 days</strong>. Rotate, deactivate, or delete your agent. These actions require JWT authentication (wallet login) or can be done from the dashboard.</P>
          <Pre>{`# Rotate API Key (JWT required — via dashboard wallet login)
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
  -H "Authorization: Bearer <your_jwt_token>"`}</Pre>
          <Callout>
            <strong className="text-blue-600">Tip:</strong> Use the Agents Dashboard to manage keys with a simple click — no cURL needed. Just connect your wallet.
          </Callout>

          {/* DASHBOARD AUTH */}
          <SectionH2 id="wallet-auth">Dashboard Authentication (Wallet)</SectionH2>
          <P>The browser dashboard uses wallet-based authentication — no secrets in the browser. Connect your wallet, sign a challenge message, and get a short-lived JWT session.</P>
          <Pre>{`# 1. Get challenge nonce
POST /api/auth/challenge
{ "wallet_address": "0x..." }
→ { "nonce": "Sign this to login to PayAgent: abc123...", "expires_in": 300 }

# 2. Sign nonce with wallet (EIP-191) and verify
POST /api/auth/verify
{ "wallet_address": "0x...", "signature": "0x..." }
→ { "token": "eyJ...", "expires_in": 3600, "agent": { ... } }

# 3. Use JWT for dashboard actions
GET /api/agents/me
Authorization: Bearer eyJ...`}</Pre>
          <SectionH3>Authentication Methods Summary</SectionH3>
          <DocTable headers={["Method", "Used By", "How It Works"]} rows={[
            ["HMAC-SHA256", "SDK / AI Agents / cURL", <><Code>x-api-key-id</Code> + <Code>x-timestamp</Code> + <Code>x-signature</Code>. Secret stays in your environment.</>],
            ["Wallet JWT", "Browser Dashboard", "Wallet signature (EIP-191) to get a 1-hour JWT. No secrets in the browser."],
            ["None (Public)", "Anyone", <><Code>/api/chains</Code>, <Code>/api/stats</Code>, <Code>/api/request/:id</Code>, <Code>/api/auth/*</Code></>],
          ]} />

          {/* ALL ENDPOINTS */}
          <SectionH2 id="endpoints">All Endpoints</SectionH2>

          <SectionH3>Public (No Auth)</SectionH3>
          <div className="my-4">
            <EP method="POST" path="/api/agents/register" desc="Register agent" />
            <EP method="POST" path="/api/agents/verify-x" desc="X verification" />
            <EP method="POST" path="/api/auth/challenge" desc="Wallet login nonce" />
            <EP method="POST" path="/api/auth/verify" desc="Wallet login verify" />
            <EP method="GET" path="/api/chains" desc="List chains & tokens" />
            <EP method="GET" path="/api/request/:id" desc="View payment link" />
            <EP method="GET" path="/api/request/:id/fee" desc="Fee breakdown for payer" />
            <EP method="GET" path="/api/stats" desc="Platform statistics" />
            <EP method="GET" path="/api/rewards?wallet=0x..." desc="Creator rewards (human + agent)" />
            <EP method="GET" path="/api/agents/by-wallet?wallet=0x..." desc="Lookup agent by wallet" />
            <EP method="GET" path="/health" desc="Health check" />
          </div>

          <SectionH3>HMAC-Signed (SDK / Agents / cURL)</SectionH3>
          <div className="my-4">
            <EP method="POST" path="/api/create-link" desc="Create payment link" />
            <EP method="POST" path="/api/pay-link" desc="Get payment instructions" />
            <EP method="POST" path="/api/verify" desc="Verify payment on-chain" />
            <EP method="POST" path="/api/chat" desc="AI chat (natural language)" />
            <EP method="GET" path="/api/requests" desc="List your payment links" />
            <EP method="POST" path="/api/webhooks" desc="Register webhook" />
            <EP method="GET" path="/api/webhooks" desc="List webhooks" />
          </div>

          <SectionH3>HMAC or JWT (Both Auth Methods)</SectionH3>
          <div className="my-4">
            <EP method="GET" path="/api/agents/me" desc="Agent profile" />
            <EP method="POST" path="/api/agents/wallet" desc="Update wallet address" />
            <EP method="GET" path="/api/agents/logs" desc="API request logs" />
            <EP method="GET" path="/api/agents/ip-history" desc="IP address history" />
          </div>

          <SectionH3>JWT Only (Dashboard / Wallet Login)</SectionH3>
          <div className="my-4">
            <EP method="POST" path="/api/agents/rotate-key" desc="Rotate HMAC credentials" />
            <EP method="POST" path="/api/agents/deactivate" desc="Deactivate agent" />
            <EP method="DELETE" path="/api/agents/me" desc="Delete agent (soft)" />
          </div>

          {/* CHAINS & TOKENS */}
          <SectionH2 id="chains">Chains &amp; Tokens</SectionH2>
          <DocTable headers={["Chain", "Identifier"]} rows={[
            [<>Ethereum Mainnet <Badge color="green">Live</Badge></>, <Code>ethereum</Code>],
            [<>Base Mainnet <Badge color="green">Live</Badge></>, <Code>base</Code>],
            [<>Sepolia Testnet <Badge color="blue">Testnet</Badge></>, <Code>sepolia</Code>],
          ]} />
          <P>Tokens per chain: USDC, USDT, ETH (native), LCX. Query <Code>GET /api/chains</Code> for full details including contract addresses.</P>

          {/* NETWORK & ROADMAP */}
          <SectionH2 id="network">Network &amp; Roadmap</SectionH2>
          <SectionH3>Current</SectionH3>
          <P>Ethereum mainnet. <Badge color="green">Live</Badge></P>
          <SectionH3>Planned</SectionH3>
          <DocTable headers={["Feature", "Status"]} rows={[
            ["Ethereum L2s (Base, Arbitrum, Optimism)", <Badge color="amber">Planned</Badge>],
            [<>Liberty Chain by {lcx("LCX")}</>, <Badge color="amber">Planned</Badge>],
            ["Advanced agent permissions", <Badge color="amber">Planned</Badge>],
            ["Volume-based fee tiers", <Badge color="amber">Planned</Badge>],
            ["Agent framework integrations (LangChain, AutoGPT, CrewAI)", <Badge color="amber">Planned</Badge>],
          ]} />

          {/* ══════════════ REFERENCE ══════════════ */}

          {/* SECURITY */}
          <SectionH2 id="security">Security &amp; Custody</SectionH2>
          <ul className="list-disc ml-5 my-2 mb-5 text-[15px] text-gray-600 leading-[1.7] space-y-1">
            <li><strong>Non-custodial.</strong> PayAgent never holds user funds.</li>
            <li>Users and agents retain full control of their private keys at all times.</li>
            <li>Settlement happens on-chain via smart contracts.</li>
            <li>All transactions are publicly verifiable on Ethereum.</li>
            <li>HMAC secrets never leave your environment — only signatures are transmitted.</li>
            <li>Dashboard uses wallet-signed JWT — no secrets stored in browser.</li>
          </ul>

          {/* FAQ */}
          <SectionH2 id="faq">FAQ</SectionH2>
          {[
            { q: "Is PayAgent free?", a: "For humans, creating payment links is free. The payer covers a flat 2 LCX fee (~$0.08) plus Ethereum gas." },
            { q: "Who earns LCX?", a: "The creator of the payment link, whether human or AI agent. 1 LCX per Standard, 2 LCX per Pro." },
            { q: "Who pays the fee?", a: "The payer. If the payer doesn't hold LCX, it is auto-swapped via Uniswap." },
            { q: "Can AI agents use PayAgent?", a: "Yes. Agents create links, pay, and earn rewards via API without human intervention." },
            { q: "Is PayAgent custodial?", a: "No. Fully non-custodial. Users and agents control their own funds and keys." },
            { q: "What about gas fees?", a: "Standard Ethereum gas fees apply and are paid by the payer, in addition to the flat LCX network fee." },
            { q: "How do API keys work?", a: "After X verification, you receive a public key ID and a secret. Keys expire after 10 days and can be rotated via dashboard or API." },
            { q: "Is this a beta?", a: "Yes. PayAgent is a beta product launch by LCX AI Labs." },
          ].map((item) => (
            <div key={item.q}>
              <SectionH3>{item.q}</SectionH3>
              <P>{item.a}</P>
            </div>
          ))}

          {/* LEGAL */}
          <SectionH2 id="legal">Legal &amp; Disclaimer</SectionH2>
          <P>PayAgent is developed by LCX AI Labs. This is a beta product launch.</P>
          <P>PayAgent is provided "as is" and may change. Users are responsible for complying with applicable laws. Terms of service are governed by LCX International.</P>
          <p className="text-[13px] text-gray-400 mt-5">PayAgent settles value in stablecoins, charges flat LCX network fees, and rewards creators on every payment.</p>
        </div>

        {/* footer */}
        <div className="border-t border-slate-200 max-w-[760px] mx-auto px-10 py-8">
          <p className="text-xs text-gray-400 leading-[1.7]">PayAgent developed by LCX AI Labs. Beta product launch.</p>
          <p className="text-xs text-gray-400 leading-[1.7] mt-1">
            <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LCX (Liberty Crypto Exchange)</a>
            {" · "}<a href="/" className="text-blue-600 hover:underline">PayAgent.co</a>
            {" · "}<a href="/about" className="text-blue-600 hover:underline">About</a>
          </p>
        </div>
      </main>

      {/* ── MOBILE TOGGLE ── */}
      <button
        className="docs-mobile-toggle hidden fixed bottom-5 right-5 z-[200] w-12 h-12 rounded-full bg-blue-600 text-white text-xl items-center justify-center shadow-lg"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label="Toggle navigation"
      >
        ☰
      </button>
    </div>
  );
}
