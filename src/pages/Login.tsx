import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";


const Login = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const sectionsRef = useRef<HTMLDivElement[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (isConnected) {
      navigate("/dashboard");
    }
  }, [isConnected, navigate]);

  // Scroll-reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    sectionsRef.current.forEach((el) => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const addSectionRef = (el: HTMLDivElement | null) => {
    if (el && !sectionsRef.current.includes(el)) {
      sectionsRef.current.push(el);
    }
  };

  return (
    <div className="min-h-screen bg-white font-landing landing-grid-bg">
      <div className="max-w-[680px] mx-auto px-6 relative z-[1]">

        {/* ── HEADER ── */}
        <header className="pt-6 animate-fade-up">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
                <img src="/robot.svg" alt="PayAgent" className="w-8 h-8" />
              </div>
              <div className="flex flex-col leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-bold text-blue-600">PayAgent</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md">
                    Beta
                  </span>
                </div>
                <span className="text-[10px] text-gray-400 font-medium mt-0.5">by LCX</span>
              </div>
            </div>
            <nav className="hidden sm:flex items-center">
              <a href="/about" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5">About</a>
              <a href="/changelog" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5">Changelog</a>
              <a href="/docs" className="text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors ml-5">Docs</a>
            </nav>
            <button className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg text-gray-500 hover:bg-slate-100 transition-colors" onClick={() => setMobileMenuOpen(!mobileMenuOpen)} aria-label="Toggle menu">
              {mobileMenuOpen ? <span className="text-lg leading-none">✕</span> : <span className="text-xl leading-none">☰</span>}
            </button>
          </div>
          {mobileMenuOpen && (
            <nav className="sm:hidden mt-3 pb-3 border-b border-slate-200 flex flex-col gap-1">
              <a href="/about" className="text-sm font-semibold text-gray-600 hover:text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors">About</a>
              <a href="/changelog" className="text-sm font-semibold text-gray-600 hover:text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors">Changelog</a>
              <a href="/docs" className="text-sm font-semibold text-gray-600 hover:text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-50 transition-colors">Docs</a>
            </nav>
          )}
        </header>

        {/* ── HERO ── */}
        <section className="pt-11 animate-fade-up">
          <h1 className="text-[clamp(28px,5.5vw,40px)] font-bold leading-[1.15] tracking-tight text-slate-900 mb-4">
            Payments for Humans<br />and AI&nbsp;Agents
          </h1>
          <p className="text-[17px] leading-relaxed text-gray-500 mb-6">
            Send, receive, and automate crypto payments, manually or fully autonomous.
          </p>

          {/* World model tagline */}
          <div className="bg-slate-50 border border-slate-200 rounded-[10px] px-5 py-4 text-base font-medium text-gray-700 mb-6 leading-relaxed">
            AI agents are becoming economic actors. PayAgent is how they pay.
          </div>

          {/* ── WOW CARD ── */}
          <div className="bg-blue-50 border border-blue-200 rounded-[14px] px-6 py-7 max-sm:px-4 max-sm:py-5 mb-7 text-center">
            <div className="text-xs font-bold text-blue-600 uppercase tracking-[1px] mb-5 max-sm:mb-3">
              Live autonomous payment flow
            </div>
            <div className="flex items-center justify-center gap-4 max-sm:gap-2 mb-3.5 max-sm:mb-2">
              <div className="flex items-center gap-2 max-sm:gap-1 text-base max-sm:text-sm font-bold text-slate-900">
                <span className="text-2xl max-sm:text-lg">🤖</span> Agent&nbsp;A
              </div>
              <div className="flex items-center gap-0.5 text-blue-600">
                <span className="tracking-[3px] max-sm:tracking-[1px] font-mono text-sm max-sm:text-xs">......</span>
                <span className="text-lg max-sm:text-base font-bold">→</span>
              </div>
              <div className="flex items-center gap-2 max-sm:gap-1 text-base max-sm:text-sm font-bold text-slate-900">
                Agent&nbsp;B <span className="text-2xl max-sm:text-lg">🤖</span>
              </div>
            </div>
            <div className="flex justify-center gap-12 max-sm:gap-6 text-[13px] max-sm:text-[12px] text-gray-500 mb-4 max-sm:mb-2.5">
              <span>request payment</span>
              <span>settled automatically</span>
            </div>
            <div className="text-sm font-semibold text-slate-900">
              No humans. No custody. No manual steps.
            </div>
          </div>

          {/* ── CTA ROW ── */}
          <div className="grid grid-cols-2 gap-3.5 mb-12 max-[520px]:grid-cols-1">
            {/* For Humans */}
            <div className="rounded-[14px] p-5 bg-blue-50 border border-blue-200">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xl">💼</span>
                <h3 className="text-[17px] font-bold text-slate-900">For Humans</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 mb-4">
                Pay directly from your wallet. Non-custodial. Full control.
              </p>
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => (
                  <div {...(!mounted && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none" as const } })}>
                    <button
                      onClick={openConnectModal}
                      className="inline-block px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all hover:-translate-y-px"
                    >
                      Create Payment Link →
                    </button>
                  </div>
                )}
              </ConnectButton.Custom>
            </div>
            {/* For AI Agents */}
            <div className="rounded-[14px] p-5 bg-blue-50/60 border border-blue-200">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-xl">🤖</span>
                <h3 className="text-[17px] font-bold text-slate-900">For AI Agents</h3>
              </div>
              <p className="text-sm leading-relaxed text-gray-700 mb-4">
                Autonomous software that earns, spends, and settles value via API.
              </p>
              <button
                onClick={() => navigate("/agent")}
                className="inline-block px-5 py-2.5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all hover:-translate-y-px"
              >
                Explore AI Payments →
              </button>
            </div>
          </div>
        </section>

        {/* ── EARN WITH EVERY PAYMENT ── */}
        <section ref={addSectionRef} className="py-12 border-t border-slate-200 fade-in-section">
          <div className="text-xs font-bold uppercase tracking-[1.2px] text-blue-600 mb-2">Rewards</div>
          <h2 className="text-[26px] font-bold tracking-tight mb-2">Earn with every payment</h2>
          <p className="text-base text-gray-500 mb-8 leading-relaxed">
            Every paid link rewards the creator with LCX tokens. Humans and AI agents earn the same way.
          </p>

          <div className="grid grid-cols-2 gap-3.5 mb-6 max-[480px]:grid-cols-1">
            <div className="bg-slate-50 border border-slate-200 rounded-[14px] py-7 px-5 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400 mb-2">Standard</div>
              <div className="font-mono text-[32px] font-bold text-blue-600 mb-1">1 LCX</div>
              <div className="text-[13px] text-gray-500">Per paid link (USDC, USDT, USAT)</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-[14px] py-7 px-5 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[1px] text-gray-400 mb-2">Pro</div>
              <div className="font-mono text-[32px] font-bold text-blue-600 mb-1">2 LCX</div>
              <div className="text-[13px] text-gray-500">Per paid link (any ERC-20)</div>
            </div>
          </div>

          <div className="bg-blue-50 rounded-[10px] px-5 py-4 text-sm text-slate-900 font-medium leading-relaxed">
            <strong className="text-blue-600">No staking. No lockups. No claims.</strong> Create a link, get it paid, earn LCX. Rewards are credited automatically on settlement.
          </div>
        </section>

        {/* ── FEE MODEL ── */}
        <section ref={addSectionRef} className="py-12 border-t border-slate-200 fade-in-section">
          <div className="text-xs font-bold uppercase tracking-[1.2px] text-blue-600 mb-2">Fees</div>
          <h2 className="text-[26px] font-bold tracking-tight mb-2">Simple, flat fees</h2>
          <p className="text-base text-gray-500 mb-8 leading-relaxed">
            No percentages. No hidden costs. Flat LCX token fees paid by the payer.
          </p>

          <div className="w-full border border-slate-200 rounded-xl overflow-hidden mb-3">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="text-[11px] font-bold uppercase tracking-[1px] px-4 py-3 text-left">Mode</th>
                  <th className="text-[11px] font-bold uppercase tracking-[1px] px-4 py-3 text-left">Fee</th>
                  <th className="text-[11px] font-bold uppercase tracking-[1px] px-4 py-3 text-left">Creator Reward</th>
                  <th className="text-[11px] font-bold uppercase tracking-[1px] px-4 py-3 text-left">Assets</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="px-4 py-3 text-sm text-gray-700 font-semibold">Standard</td>
                  <td className="px-4 py-3 text-sm text-gray-700">2 LCX</td>
                  <td className="px-4 py-3 text-sm text-gray-700">1 LCX</td>
                  <td className="px-4 py-3 text-sm text-gray-700">USDC, USDT, USAT</td>
                </tr>
                <tr className="bg-slate-50">
                  <td className="px-4 py-3 text-sm text-gray-700 font-semibold">Pro</td>
                  <td className="px-4 py-3 text-sm text-gray-700">4 LCX</td>
                  <td className="px-4 py-3 text-sm text-gray-700">2 LCX</td>
                  <td className="px-4 py-3 text-sm text-gray-700">Any ERC-20</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[13px] text-gray-400 leading-relaxed">
            If the payer does not hold LCX, the required amount is auto-sourced via Uniswap. Payments never fail due to missing tokens. Standard Ethereum gas fees also apply.
          </p>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section ref={addSectionRef} className="py-12 border-t border-slate-200 fade-in-section">
          <div className="text-xs font-bold uppercase tracking-[1.2px] text-blue-600 mb-2">For Humans</div>
          <h2 className="text-[26px] font-bold tracking-tight mb-2">Create a payment link in seconds</h2>
          <p className="text-base text-gray-500 mb-8 leading-relaxed">
            Free to create. No signup required. Connect your wallet and go.
          </p>

          <div className="max-w-[540px]">
            {[
              { num: "1", title: "Connect your wallet", desc: "Any non-custodial wallet. You keep full control of your funds." },
              { num: "2", title: "Choose amount and asset", desc: "USDC, USDT, or USAT in Standard. Any ERC-20 in Pro mode." },
              { num: "3", title: "Generate and share your link", desc: "Instant link. Share with anyone, human or AI agent." },
              { num: "4", title: "Get paid, earn LCX", desc: "Funds settle to your wallet. You earn 1 LCX (or 2 LCX in Pro)." },
            ].map((step, i, arr) => (
              <div key={step.num} className={`flex gap-4 mb-6 relative ${i < arr.length - 1 ? "step-connector" : ""}`}>
                <div className="w-[34px] h-[34px] rounded-full bg-blue-600 text-white font-mono text-sm font-bold flex items-center justify-center shrink-0">
                  {step.num}
                </div>
                <div>
                  <h4 className="text-[15px] font-bold text-slate-900 mb-0.5">{step.title}</h4>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── TRACK PAYMENTS ── */}
        <section ref={addSectionRef} className="py-12 border-t border-slate-200 fade-in-section">
          <div className="text-xs font-bold uppercase tracking-[1.2px] text-blue-600 mb-2">Monitoring</div>
          <h2 className="text-[26px] font-bold tracking-tight mb-2">Track payments</h2>
          <p className="text-base text-gray-500 mb-8 leading-relaxed">
            Real-time transaction monitoring for every link you create.
          </p>

          <div className="grid grid-cols-3 gap-3.5 max-[500px]:grid-cols-1">
            {[
              { icon: "⚡", title: "Live Status", desc: "See payments settle in real time" },
              { icon: "🪙", title: "Reward Tracking", desc: "View earned LCX across all links" },
              { icon: "📋", title: "Link Overview", desc: "All your payment links in one place" },
            ].map((card) => (
              <div key={card.title} className="text-center py-5 px-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="text-[22px] mb-2">{card.icon}</div>
                <h4 className="text-sm font-bold text-slate-900 mb-0.5">{card.title}</h4>
                <p className="text-xs text-gray-500">{card.desc}</p>
              </div>
            ))}
          </div>

          <p className="text-center text-[13px] text-gray-400 mt-5 italic">
            Full payment history with filtering, export, and analytics coming soon.
          </p>
        </section>

        {/* ── CORE FEATURES ── */}
        <section ref={addSectionRef} className="py-12 border-t border-slate-200 fade-in-section">
          <div className="text-xs font-bold uppercase tracking-[1.2px] text-blue-600 mb-2">Infrastructure</div>
          <h2 className="text-[26px] font-bold tracking-tight mb-2">Built for scale</h2>
          <p className="text-base text-gray-500 mb-8 leading-relaxed">
            Non-custodial payment infrastructure for humans and autonomous software.
          </p>

          <div className="grid grid-cols-3 gap-3.5 max-[580px]:grid-cols-1">
            {[
              { icon: "🔒", title: "Non-Custodial", desc: "You control your keys and funds. Always." },
              { icon: "🤖", title: "Agent-to-Agent", desc: "AI agents pay each other autonomously via API." },
              { icon: "🔗", title: "Payment Links", desc: "Create, share, and settle in seconds. On-chain." },
              { icon: "💱", title: "Auto-Swap", desc: "LCX sourced via Uniswap if needed. Never fails." },
              { icon: "⛓️", title: "On-Chain", desc: "Every payment settled and verifiable on Ethereum." },
              { icon: "🌐", title: "Multi-Chain Soon", desc: "Expanding to all L2s including Liberty Chain." },
            ].map((f) => (
              <div key={f.title} className="bg-slate-50 border border-slate-200 rounded-xl py-6 px-4 text-center">
                <div className="w-11 h-11 rounded-[10px] bg-blue-50 inline-flex items-center justify-center text-xl mb-3">
                  {f.icon}
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-1">{f.title}</h4>
                <p className="text-[13px] text-gray-500 leading-snug">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SUPPORTED NETWORKS ── */}
        <section ref={addSectionRef} className="py-12 border-t border-slate-200 fade-in-section">
          <div className="text-xs font-bold uppercase tracking-[1.2px] text-blue-600 mb-2">Network</div>
          <h2 className="text-[26px] font-bold tracking-tight mb-2">Supported networks</h2>
          <p className="text-base text-gray-500 mb-8 leading-relaxed">
            Live on Ethereum. Expanding to all major L2s.
          </p>

          <div className="flex items-center justify-center gap-5 flex-wrap">
            {[
              { name: "Ethereum Mainnet", live: true },
              { name: "Base", live: false },
              { name: "Arbitrum", live: false },
              { name: "Optimism", live: false },
              { name: "Liberty Chain", live: false },
            ].map((n) => (
              <div key={n.name} className="flex items-center gap-2 text-sm font-semibold text-gray-700 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                <span className={`w-2 h-2 rounded-full ${n.live ? "bg-emerald-600" : "bg-gray-300"}`} />
                {n.name}
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section ref={addSectionRef} className="py-14 border-t border-slate-200 text-center fade-in-section">
          <h2 className="text-[28px] font-bold tracking-tight mb-2">Start earning LCX today</h2>
          <p className="text-base text-gray-500 mb-6">
            Create your first payment link in under a minute. Free, non-custodial, instant.
          </p>
          <ConnectButton.Custom>
            {({ openConnectModal, mounted }) => (
              <div {...(!mounted && { "aria-hidden": true, style: { opacity: 0, pointerEvents: "none" as const } })}>
                <button
                  onClick={openConnectModal}
                  className="inline-flex items-center gap-2 bg-blue-600 text-white text-base font-bold px-8 py-3.5 rounded-[10px] hover:bg-blue-700 transition-all hover:-translate-y-px"
                >
                  Create Payment Link →
                </button>
              </div>
            )}
          </ConnectButton.Custom>
          <div className="mt-4 text-sm">
            <a href="/about" className="text-blue-600 font-semibold hover:underline mx-2.5">About</a>
            <a href="/changelog" className="text-blue-600 font-semibold hover:underline mx-2.5">Changelog</a>
            <a href="/docs" className="text-blue-600 font-semibold hover:underline mx-2.5">Documentation</a>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="text-center py-8 border-t border-slate-200">
          <p className="text-[13px] text-gray-400 leading-[1.8]">PayAgent developed by LCX AI Labs. Beta product launch.</p>
          <p className="text-[13px] text-gray-400 leading-[1.8]">PayAgent is provided "as is" and may change. Users are responsible for complying with applicable laws.</p>
          <p className="text-[13px] text-gray-400 mt-2.5">
            <a href="https://lcx.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">LCX (Liberty Crypto Exchange)</a>
            {" · "}
            <a href="/" className="text-blue-600 hover:underline">PayAgent</a>
          </p>
        </footer>

      </div>
    </div>
  );
};

export default Login;
