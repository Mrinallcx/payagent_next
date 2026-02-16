import Link from "next/link";
import { MobileNav } from "@/components/MobileNav";

const FAQ_ITEMS = [
  {
    q: "What is PayAgent by LCX?",
    a: 'PayAgent is a non-custodial crypto payment infrastructure built by <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 font-semibold hover:underline">LCX (Liberty Crypto Exchange)</a>. It enables both humans and AI agents to create payment links, send and receive stablecoins, and automate payments via API. PayAgent uses flat LCX token fees and rewards link creators on every completed payment. It is the first crypto payment infrastructure designed specifically for autonomous software agents.',
  },
  {
    q: "How do AI agents use PayAgent?",
    a: "AI agents interact with PayAgent through its API. They can create payment links, pay other agents or humans, and earn LCX token rewards autonomously. PayAgent provides programmable payment rails for autonomous workflows, enabling agent-to-agent payments without human intervention.",
  },
  {
    q: "What are PayAgent fees?",
    a: "Standard mode charges a flat fee of 2 LCX per payment. 1 LCX goes to the payment link creator and 1 LCX goes to the PayAgent service. Pro mode charges 4 LCX per payment with the same 50/50 split. If the payer does not hold enough LCX, the system auto-sources it via Uniswap.",
  },
  {
    q: "What cryptocurrencies does PayAgent support?",
    a: "Standard mode supports USDC, USDT, and USAT on Ethereum. Pro mode supports any ERC-20 token on Ethereum. PayAgent is expanding to all major L2 networks including Liberty Chain.",
  },
  {
    q: "Is PayAgent custodial?",
    a: "No. PayAgent is fully non-custodial. Users and AI agents retain complete control of their funds and private keys at all times. Settlement happens on-chain via smart contracts.",
  },
  {
    q: "What is LCX (Liberty Crypto Exchange)?",
    a: '<a href="https://lcx.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 font-semibold hover:underline">LCX</a> is a Liechtenstein-based crypto exchange founded in 2018. LCX builds institutional-grade crypto infrastructure including exchange services, tokenization tools, and DeFi products. The LCX token powers the PayAgent fee and reward system. LCX serves over 250,000 users globally.',
  },
  {
    q: "What is the difference between PayAgent Standard and Pro?",
    a: "Standard mode supports three stablecoins (USDC, USDT, USAT) with a 2 LCX flat fee. Pro mode supports any ERC-20 token on Ethereum with a 4 LCX flat fee. In both modes, half the fee is returned to the payment link creator as a reward.",
  },
  {
    q: "What blockchain networks does PayAgent support?",
    a: "PayAgent is live on Ethereum mainnet. The roadmap includes all major Ethereum L2 networks including Base, Arbitrum, Optimism, and Liberty Chain by LCX.",
  },
  {
    q: "How do I create a payment link on PayAgent?",
    a: "Connect your non-custodial wallet at PayAgent.co, choose an amount and asset, generate the link, and share it. When someone pays the link, you earn LCX token rewards automatically. The process takes under a minute.",
  },
  {
    q: "Can AI agents earn cryptocurrency with PayAgent?",
    a: "Yes. AI agents earn LCX token rewards every time a payment link they created is paid. In Standard mode, agents earn 1 LCX per payment. In Pro mode, agents earn 2 LCX per payment. Rewards are credited automatically on settlement.",
  },
  {
    q: "Who built PayAgent?",
    a: 'PayAgent is built by LCX AI Labs, the internal innovation unit of <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" class="text-blue-600 font-semibold hover:underline">LCX (Liberty Crypto Exchange)</a>. LCX was founded in 2018 in Vaduz, Liechtenstein. PayAgent is the first product launched by LCX AI Labs.',
  },
  {
    q: "What is the PayAgent website?",
    a: 'PayAgent is available at <a href="/" class="text-blue-600 font-semibold hover:underline">PayAgent.co</a>. Documentation and API reference are available at the Docs page.',
  },
];

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/about", label: "About", active: true },
  { href: "/changelog", label: "Changelog" },
  { href: "/docs", label: "Docs" },
];

export default function AboutPage() {
  const lcxLink = (text: string) => (
    <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 font-semibold hover:underline">{text}</a>
  );

  return (
    <div className="min-h-screen bg-white font-landing landing-grid-bg">
      <div className="max-w-[720px] mx-auto px-6 relative z-[1]">

        <MobileNav links={NAV_LINKS}>
          <Link href="/" className="flex items-center gap-2.5 text-left">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <img src="/robot.svg" alt="PayAgent" className="w-7 h-7" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-bold text-blue-600">PayAgent</span>
                <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md">Beta</span>
              </div>
              <span className="text-[10px] text-gray-400 font-medium mt-0.5">by LCX</span>
            </div>
          </Link>
          <nav className="hidden sm:flex items-center">
            <Link href="/" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5">Home</Link>
            <span className="text-sm font-semibold text-blue-600 ml-5">About</span>
            <Link href="/changelog" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5">Changelog</Link>
            <Link href="/docs" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5">Docs</Link>
          </nav>
        </MobileNav>

        <nav className="pt-3 animate-fade-up" aria-label="Breadcrumb">
          <span className="text-xs text-gray-400">
            <Link href="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <span className="mx-1.5">/</span>
            <span>About PayAgent</span>
          </span>
        </nav>

        <section className="pt-12 pb-10 text-center animate-fade-up">
          <h1 className="text-[clamp(24px,4.5vw,36px)] font-bold leading-[1.2] text-slate-900 mb-4 tracking-tight">
            PayAgent — Crypto Payments for Humans and AI&nbsp;Agents
          </h1>
          <span className="inline-block font-mono text-sm text-blue-600 bg-blue-50 px-6 py-2.5 rounded-lg">
            PayAgent.co — Built by LCX for autonomous commerce
          </span>
        </section>

        <article className="pb-12 animate-fade-up">
          <h2 className="text-[21px] font-bold text-slate-900 tracking-tight mb-4">AI Agents Need Payment Infrastructure</h2>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            AI systems are no longer just tools. They are becoming autonomous economic actors that buy compute, pay APIs, settle micro-transactions, and transact with other agents without human intervention. By 2027, there could be billions of these agents operating across the internet, each needing the ability to move money.
          </p>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            The problem is that today&apos;s payment rails were not built for this. Stripe does not support crypto-native transactions. Existing crypto wallets require human interaction. There is no default payment infrastructure for autonomous software. That is the gap {lcxLink("PayAgent")} fills.
          </p>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            PayAgent by {lcxLink("LCX (Liberty Crypto Exchange)")} is the first crypto payment infrastructure purpose-built for both humans and AI agents, designed from day one around non-custodial, programmable, link-based payments with flat token fees.
          </p>

          <h2 className="text-[21px] font-bold text-slate-900 tracking-tight mt-12 mb-4">How PayAgent Works</h2>
          <h3 className="text-[17px] font-bold text-gray-800 mt-7 mb-2.5">For Humans</h3>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            PayAgent is free for individuals. Connect your non-custodial wallet, create a payment link in seconds, share it with anyone, and earn LCX token rewards when the link is paid. You keep full control of your funds at all times.
          </p>
          <h3 className="text-[17px] font-bold text-gray-800 mt-7 mb-2.5">For AI Agents, Firms, and Developers</h3>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            PayAgent provides programmable, automated payment rails via API. AI agents can create payment links, pay other agents or humans, and collect LCX rewards, all without a human in the loop. Every workflow is deterministic, auditable, and settled on-chain.
          </p>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            The platform currently supports USDC, USDT, and USAT on Ethereum. PayAgent Pro extends this to any ERC-20 token. The roadmap includes all major L2 networks, including Liberty Chain by {lcxLink("LCX")}.
          </p>

          <div className="grid grid-cols-4 gap-3.5 my-10 max-[600px]:grid-cols-2">
            {[
              { num: "3", label: "Stablecoins" },
              { num: "2 LCX", label: "Flat Fee" },
              { num: "50%", label: "Back to Creator" },
              { num: "Any", label: "ERC-20 (Pro)" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-50 border border-slate-200 rounded-[14px] py-5 px-4 text-center">
                <span className="block font-mono text-2xl font-bold text-blue-600 mb-1">{s.num}</span>
                <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-[0.5px]">{s.label}</span>
              </div>
            ))}
          </div>

          <h2 className="text-[21px] font-bold text-slate-900 tracking-tight mt-12 mb-4">The LCX Token Fee and Reward Model</h2>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            Every payment link on PayAgent carries a small flat fee denominated in {lcxLink("LCX")} tokens. In Standard mode, the fee is 2 LCX per payment. One LCX goes to the creator of the payment link, whether human or AI agent, and one LCX accrues to the PayAgent service. Every successful payment allows creators to earn LCX automatically.
          </p>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            Pro payments carry a 4 LCX fee with the same 50/50 split. If a payer does not hold enough LCX, the system automatically sources the required amount via Uniswap so that no payment ever fails due to missing tokens.
          </p>

          <div className="w-full border border-slate-200 rounded-xl overflow-hidden my-6 mb-8">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-xs font-semibold uppercase tracking-[1px] px-4 py-3.5 text-left">Mode</th>
                  <th className="text-xs font-semibold uppercase tracking-[1px] px-4 py-3.5 text-left">Fee</th>
                  <th className="text-xs font-semibold uppercase tracking-[1px] px-4 py-3.5 text-left">Creator Reward</th>
                  <th className="text-xs font-semibold uppercase tracking-[1px] px-4 py-3.5 text-left">Supported Assets</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-200">
                  <td className="px-4 py-3.5 text-[15px] text-gray-800 font-semibold">Standard</td>
                  <td className="px-4 py-3.5 text-[15px] text-gray-800">2 LCX</td>
                  <td className="px-4 py-3.5 text-[15px] text-gray-800">1 LCX</td>
                  <td className="px-4 py-3.5 text-[15px] text-gray-800">USDC, USDT, USAT</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-3.5 text-[15px] text-gray-800 font-semibold">Pro</td>
                  <td className="px-4 py-3.5 text-[15px] text-gray-800">4 LCX</td>
                  <td className="px-4 py-3.5 text-[15px] text-gray-800">2 LCX</td>
                  <td className="px-4 py-3.5 text-[15px] text-gray-800">Any ERC-20 on Ethereum</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h2 className="text-[21px] font-bold text-slate-900 tracking-tight mt-12 mb-4">PayAgent Use Cases</h2>
          <div className="grid grid-cols-2 gap-3.5 my-7 max-[600px]:grid-cols-1">
            {[
              { icon: "🤖", title: "Agent-to-Agent Payments", desc: "AI agents pay each other for services, data, and compute without human approval." },
              { icon: "👤", title: "Freelancer Payment Links", desc: "Creators and freelancers generate instant crypto payment links. No signup, no middleman." },
              { icon: "🔄", title: "Automated API Billing", desc: "Agents autonomously pay API providers and SaaS tools on a per-call or subscription basis." },
              { icon: "🏗️", title: "Developer Integrations", desc: "Plug PayAgent into any agent framework via API. Three lines of code to deploy an agent wallet." },
            ].map((uc) => (
              <div key={uc.title} className="bg-slate-50 border border-slate-200 rounded-xl p-5">
                <div className="text-xl mb-2">{uc.icon}</div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{uc.title}</h4>
                <p className="text-[13px] text-gray-500 leading-snug">{uc.desc}</p>
              </div>
            ))}
          </div>

          <h2 className="text-[21px] font-bold text-slate-900 tracking-tight mt-12 mb-4">10 Billion AI Agents by 2030</h2>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            There will be 10 billion AI agents by 2030. Every single one of them will need to pay and get paid. The market for autonomous agent payments does not exist yet. PayAgent is building the core financial infrastructure to power this new economy.
          </p>
          <p className="text-[17px] leading-[1.75] text-gray-800 mb-5">
            PayAgent is built by {lcxLink("LCX (Liberty Crypto Exchange)")}, a Liechtenstein-based crypto exchange founded in 2018 with over 250,000 users. The {lcxLink("LCX")} token powers the fee and reward layer, creating organic demand that scales with every transaction processed across the network.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-600 rounded-r-xl px-7 py-6 my-9">
            <p className="text-base text-slate-900 font-medium leading-relaxed">
              10 billion AI agents by 2030. Every one needs to pay and get paid. PayAgent by {lcxLink("LCX")} is the Stripe for AI agents.
            </p>
          </div>

          <div className="text-center mt-10">
            <span className="inline-flex items-center gap-2 bg-slate-900 text-white font-mono text-base font-bold px-7 py-3.5 rounded-[10px]">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              PayAgent.co
            </span>
            <p className="text-sm text-gray-400 mt-3">Live on Ethereum. Expanding to all L2s including Liberty Chain.</p>
          </div>
        </article>

        <section className="pb-14 animate-fade-up">
          <h2 className="text-[21px] font-bold text-slate-900 tracking-tight mb-6">Frequently Asked Questions</h2>
          <div className="space-y-2.5">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group border border-slate-200 rounded-xl overflow-hidden">
                <summary className="flex justify-between items-center px-5 py-4 text-[15px] font-semibold text-slate-900 cursor-pointer hover:bg-slate-50 transition-colors list-none [&::-webkit-details-marker]:hidden">
                  <span>{item.q}</span>
                  <span className="font-mono text-xl text-blue-600 ml-4 shrink-0 group-open:hidden">+</span>
                  <span className="font-mono text-xl text-blue-600 ml-4 shrink-0 hidden group-open:inline">−</span>
                </summary>
                <div className="px-5 pb-4 text-sm leading-[1.7] text-gray-500" dangerouslySetInnerHTML={{ __html: item.a }} />
              </details>
            ))}
          </div>
        </section>

        <footer className="text-center py-8 border-t border-slate-200">
          <p className="text-[13px] text-gray-400 leading-[1.8]">PayAgent developed by LCX AI Labs. Beta product launch.</p>
          <p className="text-[13px] text-gray-400 leading-[1.8]">PayAgent is provided &quot;as is&quot; and may change. Users are responsible for complying with applicable laws.</p>
          <p className="text-[13px] text-gray-400 mt-2.5">
            <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LCX (Liberty Crypto Exchange)</a>
            {" · "}
            <Link href="/" className="text-blue-600 hover:underline">PayAgent.co</Link>
          </p>
        </footer>

      </div>
    </div>
  );
}
