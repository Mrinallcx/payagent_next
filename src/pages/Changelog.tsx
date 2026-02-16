import { useNavigate } from "react-router-dom";
import { Wallet } from "lucide-react";

const LIVE_ITEMS = [
  {
    title: "Payment Links for Humans",
    desc: "Create shareable crypto payment links instantly. Get paid in USDC, USDT, or USAT. Connect any non-custodial wallet.",
  },
  {
    title: "Track Payments",
    desc: "Real-time transaction monitoring. See every payment settle as it happens.",
  },
  {
    title: "LCX Token Rewards",
    desc: "Earn 1 LCX (Standard) or 2 LCX (Pro) on every paid link you create. Rewards are automatic, no staking or claims.",
    tag: "New",
  },
  {
    title: "Flat Fee Model",
    desc: "2 LCX per Standard payment, 4 LCX per Pro payment. Half goes back to the link creator. No percentages.",
  },
  {
    title: "Auto-Swap via Uniswap",
    desc: "If the payer does not hold LCX, the required amount is sourced automatically. Payments never fail due to missing tokens.",
  },
  {
    title: "Pro Mode: Any ERC-20",
    desc: "Request payments in any ERC-20 token on Ethereum. 4 LCX fee, 2 LCX back to creator.",
    tag: "New",
  },
  {
    title: "Ethereum Mainnet",
    desc: "All payments settle on Ethereum. Fully on-chain, publicly verifiable.",
  },
  {
    title: "AI Agent Functionality",
    desc: "Preview of how AI agents interact with PayAgent. Learn how autonomous software will create links, pay, and earn rewards via API. Full agent functionality coming soon.",
    tag: "Preview",
  },
];

const PLANNED_ITEMS = [
  {
    title: "Full AI Agent API",
    desc: (
      <>
        REST API and npm package (
        <code className="font-mono text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">
          @payagent
        </code>
        ) for autonomous agent integrations. Create links, pay, and earn rewards
        programmatically.
      </>
    ),
  },
  {
    title: "Full Payment History",
    desc: "Filtering, export, and detailed analytics for all transactions and rewards.",
  },
  {
    title: "L2 Network Support",
    desc: "Expanding to all major Ethereum L2s including Base, Arbitrum, Optimism, and Liberty Chain.",
  },
  {
    title: "Agent Framework Integrations",
    desc: "Plugins for LangChain, AutoGPT, CrewAI, Claude tool use, and OpenAI function calling.",
  },
  {
    title: "Volume-Based Fee Tiers",
    desc: "Reduced fees for high-volume agents and enterprise integrations.",
  },
  {
    title: "Advanced Agent Permissions",
    desc: "Spending limits, approval workflows, and multi-agent coordination for enterprise deployments.",
  },
];

const SHARE_LINKS = [
  {
    label: "𝕏 Post",
    href: "https://twitter.com/intent/tweet?text=PayAgent%20by%20LCX%20is%20live.%20Crypto%20payments%20for%20humans%20and%20AI%20agents.%20Create%20links%2C%20earn%20LCX%2C%20automate%20agent%20payments.&url=https%3A%2F%2Fpayagent.co",
  },
  {
    label: "Telegram",
    href: "https://t.me/share/url?url=https%3A%2F%2Fpayagent.co&text=PayAgent%20by%20LCX%20is%20live.%20Crypto%20payments%20for%20humans%20and%20AI%20agents.",
  },
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/shareArticle?mini=true&url=https%3A%2F%2Fpayagent.co&title=PayAgent%20by%20LCX%20is%20Live&summary=Crypto%20payments%20for%20humans%20and%20AI%20agents",
  },
];

export default function Changelog() {
  const navigate = useNavigate();

  const lcxLink = (text: string) => (
    <a
      href="https://lcx.com"
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-600 font-semibold hover:underline"
    >
      {text}
    </a>
  );

  return (
    <div className="min-h-screen bg-white font-landing landing-grid-bg">
      <div className="max-w-[720px] mx-auto px-6 relative z-[1]">
        {/* ── HEADER ── */}
        <header className="pt-8 flex justify-between items-center animate-fade-up">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2.5"
          >
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-xl font-bold text-blue-600">PayAgent</span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md">
              Beta
            </span>
          </button>
          <nav className="flex items-center">
            <a
              href="/"
              className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5"
            >
              Home
            </a>
            <a
              href="/about"
              className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5"
            >
              About
            </a>
            <span className="text-sm font-semibold text-blue-600 ml-5">
              Changelog
            </span>
            <a
              href="/docs"
              className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5"
            >
              Docs
            </a>
          </nav>
        </header>

        {/* ── BREADCRUMB ── */}
        <nav className="pt-3 animate-fade-up" aria-label="Breadcrumb">
          <span className="text-xs text-gray-400">
            <a href="/" className="hover:text-blue-600 transition-colors">
              Home
            </a>
            <span className="mx-1.5">/</span>
            <span>Changelog</span>
          </span>
        </nav>

        {/* ── ARTICLE ── */}
        <article className="pt-12 pb-14 animate-fade-up">
          {/* Meta badges */}
          <div className="flex items-center gap-3 mb-6">
            <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-600 tracking-wide">
              Beta Launch
            </span>
            <span className="font-mono text-xs font-bold px-3 py-1.5 rounded-md bg-slate-100 text-gray-500 tracking-wide">
              February 16, 2026 · 1:00 PM CET
            </span>
          </div>

          {/* Title */}
          <h1 className="text-[clamp(26px,5vw,36px)] font-bold leading-[1.2] tracking-tight text-slate-900 mb-4">
            PayAgent is Live
          </h1>

          {/* Lead */}
          <p className="text-lg text-gray-500 leading-[1.65] mb-9">
            Crypto payments for humans and AI agents. Create payment links, earn
            LCX token rewards, track payments in real time, and preview AI agent
            payment functionality. Built by {lcxLink("LCX")} AI Labs.
          </p>

          {/* Highlight box 1 */}
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-xl px-7 py-6 mb-10">
            <p className="text-base text-slate-900 font-medium leading-relaxed">
              Every AI agent will need a wallet, payment rails, and financial
              autonomy. PayAgent is how they pay.
            </p>
          </div>

          {/* ── What is PayAgent ── */}
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-10 mb-3">
            What is PayAgent
          </h2>
          <p className="text-base leading-[1.7] text-gray-800 mb-4">
            PayAgent by {lcxLink("LCX (Liberty Crypto Exchange)")} is the first
            crypto payment infrastructure built for both humans and AI agents. As
            AI systems evolve from tools into economic actors, they need the
            ability to pay APIs, buy compute, settle micro-transactions, and
            transact with other agents without human intervention.
          </p>
          <p className="text-base leading-[1.7] text-gray-800 mb-4">
            PayAgent fills this gap. Free for humans to create payment links.
            Programmable payment rails for AI agents, firms, and developers via
            API. Flat LCX token fees. Non-custodial. On-chain settlement.
          </p>

          {/* ── What is Live ── */}
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-10 mb-3">
            What is Live{" "}
            <span className="text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 ml-2 align-middle">
              Live
            </span>
          </h2>

          <div className="mt-7 mb-7">
            {LIVE_ITEMS.map((item, i) => (
              <div
                key={item.title}
                className={`flex items-start gap-3.5 py-3.5 ${
                  i < LIVE_ITEMS.length - 1
                    ? "border-b border-slate-100"
                    : ""
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900 mb-0.5">
                    {item.title}
                    {item.tag && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-0.5 rounded bg-blue-50 text-blue-600 ml-2 align-middle">
                        {item.tag}
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-gray-500 leading-snug">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── What is Coming ── */}
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-10 mb-3">
            What is Coming{" "}
            <span className="text-[10px] font-bold uppercase tracking-[0.8px] px-2 py-0.5 rounded bg-amber-50 text-amber-600 ml-2 align-middle">
              Planned
            </span>
          </h2>

          <div className="mt-7 mb-7">
            {PLANNED_ITEMS.map((item, i) => (
              <div
                key={item.title}
                className={`flex items-start gap-3.5 py-3.5 ${
                  i < PLANNED_ITEMS.length - 1
                    ? "border-b border-slate-100"
                    : ""
                }`}
              >
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900 mb-0.5">
                    {item.title}
                  </h4>
                  <p className="text-sm text-gray-500 leading-snug">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* ── The Opportunity ── */}
          <h2 className="text-xl font-bold text-slate-900 tracking-tight mt-10 mb-3">
            The Opportunity
          </h2>
          <p className="text-base leading-[1.7] text-gray-800 mb-4">
            There will be 10 billion AI agents by 2030. Every one of them needs
            to pay and get paid. PayAgent is building the financial
            infrastructure for autonomous commerce.
          </p>
          <p className="text-base leading-[1.7] text-gray-800 mb-4">
            Today, no one owns this space. Stripe is not crypto-native. Existing
            crypto wallets are not built for agents. PayAgent is purpose-built
            for a world where both humans and autonomous software transact value
            on the same rails.
          </p>

          {/* Highlight box 2 */}
          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-xl px-7 py-6 my-9">
            <p className="text-base text-slate-900 font-medium leading-relaxed">
              PayAgent is live at{" "}
              <a href="/" className="text-blue-600 font-semibold hover:underline">
                PayAgent.co
              </a>
              . Read the{" "}
              <a
                href="/docs"
                className="text-blue-600 font-semibold hover:underline"
              >
                documentation
              </a>{" "}
              or{" "}
              <a href="/" className="text-blue-600 font-semibold hover:underline">
                create your first payment link
              </a>
              .
            </p>
          </div>

          {/* ── Share Bar ── */}
          <div className="flex items-center gap-3 mt-10 pt-7 border-t border-slate-200">
            <span className="text-[13px] font-semibold text-gray-400">
              Share:
            </span>
            {SHARE_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold border border-slate-200 text-gray-500 bg-white hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 transition-all"
              >
                {link.label}
              </a>
            ))}
          </div>
        </article>

        {/* ── FOOTER ── */}
        <footer className="text-center py-8 border-t border-slate-200">
          <p className="text-[13px] text-gray-400 leading-[1.8]">
            PayAgent developed by LCX AI Labs. Beta product launch.
          </p>
          <p className="text-[13px] text-gray-400 mt-2.5">
            <a
              href="https://lcx.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              LCX (Liberty Crypto Exchange)
            </a>
            {" · "}
            <a href="/" className="text-blue-600 hover:underline">
              PayAgent.co
            </a>
            {" · "}
            <a href="/docs" className="text-blue-600 hover:underline">
              Docs
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}
