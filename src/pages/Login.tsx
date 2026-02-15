import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, ArrowRight, Lock, Bot } from "lucide-react";

const QUOTES = [
  {
    text: "The future of money is digital currency.",
    author: "Bill Gates",
  },
  {
    text: "Cryptocurrency is such a powerful concept.",
    author: "Vitalik Buterin",
  },
  {
    text: "Web3 is the internet owned by the builders and users.",
    author: "Chris Dixon",
  },
];

const Login = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isQuoteFading, setIsQuoteFading] = useState(false);

  useEffect(() => {
    if (isConnected) {
      navigate("/dashboard");
    }
  }, [isConnected, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsQuoteFading(true);
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length);
        setIsQuoteFading(false);
      }, 400);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const currentQuote = QUOTES[currentQuoteIndex];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Brand blue gradient */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800">
        {/* Subtle pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:80px_80px]" />
        
        {/* Decorative circles */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-48 h-48 bg-blue-400/10 rounded-full blur-2xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-16 xl:p-20 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-semibold text-white">
              PayAgent
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-white/20 text-white rounded-md">
              Beta
            </span>
          </div>

          {/* Center content */}
          <div className="space-y-12 max-w-xl">
            <div className="space-y-6">
              <h1 className="text-5xl xl:text-6xl font-heading font-bold text-white leading-[1.1] tracking-tight">
                Simple crypto
                <br />
                payments for
                <br />
                <span className="text-white/60">everyone.</span>
              </h1>
              <p className="text-lg text-white/70 leading-relaxed max-w-md">
                Create payment links in seconds. Accept crypto from anyone, anywhere.
              </p>
            </div>

            {/* Quote */}
            <div className={`transition-opacity duration-400 ${isQuoteFading ? 'opacity-0' : 'opacity-100'}`}>
              <p className="text-white/80 text-lg italic">
                "{currentQuote.text}"
              </p>
              <p className="text-white/50 mt-3 text-sm">
                — {currentQuote.author}
              </p>
            </div>
          </div>

          {/* Bottom */}
          <div className="flex items-center gap-8 text-sm text-white/50">
            <span>Ethereum</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>BNB Chain</span>
            <span className="w-1 h-1 rounded-full bg-white/30" />
            <span>Polygon</span>
          </div>
        </div>
      </div>

      {/* Right Side - Clean White */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col bg-white">
        {/* Mobile header */}
        <header className="lg:hidden p-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-heading font-semibold text-foreground">
              PayAgent
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md">
              Beta
            </span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-8 lg:px-16 py-12">
          <div className="w-full max-w-sm space-y-10">
            {/* Headline */}
            <div className="space-y-3">
              <h2 className="text-3xl font-heading font-bold text-foreground tracking-tight">
                Get started
              </h2>
              <p className="text-muted-foreground">
                Pay as human with your wallet, or as agent (create link → other agent pays).
              </p>
            </div>

            {/* Pay as human */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pay as human</p>
              <ConnectButton.Custom>
                {({ openConnectModal, mounted }) => {
                  const ready = mounted;
                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                      })}
                    >
                      <button
                        onClick={openConnectModal}
                        className="w-full flex items-center justify-between px-5 py-4 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5" />
                          <span>Connect Wallet</span>
                        </div>
                        <ArrowRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </button>
                    </div>
                  );
                }}
              </ConnectButton.Custom>
              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                <Lock className="w-3.5 h-3.5" />
                <span>Non-custodial. Your keys, your crypto.</span>
              </div>
            </div>

            {/* For AI Agents */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">For AI agents</p>
              <button
                type="button"
                onClick={() => navigate("/agent")}
                className="w-full flex items-center justify-between px-5 py-4 bg-white border-2 border-blue-200 text-blue-700 font-medium rounded-xl hover:bg-blue-50 hover:border-blue-300 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <Bot className="w-5 h-5 shrink-0" />
                  <span className="text-left">AI agents create and pay links via API. View docs & register →</span>
                </div>
                <ArrowRight className="w-4 h-4 opacity-70 shrink-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-3 text-muted-foreground">Features</span>
              </div>
            </div>

            {/* Features - Minimal */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-600">01</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground text-sm">Payment Links</h4>
                  <p className="text-xs text-muted-foreground">Create shareable links instantly</p>
                </div>
              </div>

              <div className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-600">02</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground text-sm">Track Payments</h4>
                  <p className="text-xs text-muted-foreground">Real-time transaction monitoring</p>
                </div>
              </div>

              <div className="flex items-center gap-4 py-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-blue-600">03</span>
                </div>
                <div>
                  <h4 className="font-medium text-foreground text-sm">Multi-Chain</h4>
                  <p className="text-xs text-muted-foreground">Ethereum, BNB Chain & more</p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center border-t border-border">
          <p className="text-xs text-muted-foreground">
            By connecting, you agree to our Terms of Service
          </p>
        </footer>
      </div>
    </div>
  );
};

export default Login;
