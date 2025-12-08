import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, Zap, Shield, Globe, ArrowRight, Sparkles, Link2, TrendingUp, Users, ChevronRight } from "lucide-react";

// Cool crypto quotes
const QUOTES = [
  {
    text: "The future of money is digital currency.",
    author: "Bill Gates",
  },
  {
    text: "Bitcoin is a technological tour de force.",
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
  {
    text: "The blockchain does one thing: replaces third-party trust with mathematical proof.",
    author: "Adam Draper",
  },
];

// Floating coin/token data for animation
const FLOATING_TOKENS = [
  { symbol: "ETH", color: "#627EEA", delay: 0 },
  { symbol: "BTC", color: "#F7931A", delay: 1.5 },
  { symbol: "USDC", color: "#2775CA", delay: 0.8 },
  { symbol: "BNB", color: "#F3BA2F", delay: 2.2 },
  { symbol: "USDT", color: "#26A17B", delay: 1.2 },
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

  // Rotate quotes
  useEffect(() => {
    const interval = setInterval(() => {
      setIsQuoteFading(true);
      setTimeout(() => {
        setCurrentQuoteIndex((prev) => (prev + 1) % QUOTES.length);
        setIsQuoteFading(false);
      }, 500);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentQuote = QUOTES[currentQuoteIndex];

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Visual Showcase */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-slate-900 via-primary/90 to-slate-900">
        {/* Animated gradient orbs */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        </div>

        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:60px_60px]" />

        {/* Floating tokens */}
        <div className="absolute inset-0 overflow-hidden">
          {FLOATING_TOKENS.map((token, i) => (
            <div
              key={token.symbol}
              className="absolute w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-sm shadow-2xl backdrop-blur-sm border border-white/10"
              style={{
                backgroundColor: `${token.color}20`,
                left: `${15 + i * 18}%`,
                top: `${20 + (i % 3) * 25}%`,
                animation: `float ${4 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${token.delay}s`,
              }}
            >
              <span style={{ color: token.color }}>{token.symbol}</span>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 xl:p-16 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-heading font-bold text-white">
              PayMe
            </span>
          </div>

          {/* Center content */}
          <div className="space-y-8">
            {/* Main headline */}
            <div className="space-y-4">
              <h1 className="text-5xl xl:text-6xl font-heading font-bold text-white leading-tight">
                The Future of
                <span className="block mt-2 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Crypto Payments
                </span>
              </h1>
              <p className="text-xl text-white/70 max-w-lg">
                Create payment links in seconds. Receive crypto from anyone, anywhere. No hassle.
              </p>
            </div>

            {/* Quote card */}
            <div className={`bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-white/10 max-w-lg transition-opacity duration-500 ${isQuoteFading ? 'opacity-0' : 'opacity-100'}`}>
              <div className="flex gap-4">
                <div className="text-4xl text-white/20">"</div>
                <div>
                  <p className="text-white/90 text-lg italic leading-relaxed">
                    {currentQuote.text}
                  </p>
                  <p className="text-white/50 mt-3 text-sm font-medium">
                    — {currentQuote.author}
                  </p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex gap-8">
              <div>
                <div className="text-3xl font-heading font-bold text-white">$2.4B+</div>
                <div className="text-white/50 text-sm">Crypto Processed</div>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <div className="text-3xl font-heading font-bold text-white">50K+</div>
                <div className="text-white/50 text-sm">Active Users</div>
              </div>
              <div className="w-px bg-white/10" />
              <div>
                <div className="text-3xl font-heading font-bold text-white">5+</div>
                <div className="text-white/50 text-sm">Chains Supported</div>
              </div>
            </div>
          </div>

          {/* Bottom - Trusted by */}
          <div className="space-y-4">
            <p className="text-white/40 text-sm uppercase tracking-wider">Powered by</p>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-white/60">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-sm font-bold">⟠</span>
                </div>
                <span className="text-sm font-medium">Ethereum</span>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-sm font-bold">🔶</span>
                </div>
                <span className="text-sm font-medium">BNB Chain</span>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <span className="text-sm font-bold">💎</span>
                </div>
                <span className="text-sm font-medium">Polygon</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Connect Wallet */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative">
        {/* Mobile header */}
        <header className="lg:hidden p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-bold text-foreground">
              PayMe
            </span>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-6 lg:px-12 xl:px-16 py-12">
          <div className="w-full max-w-md space-y-8">
            {/* Badge */}
            <div className="flex justify-center lg:justify-start">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/20">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Web3 Payments Made Simple</span>
              </div>
            </div>

            {/* Headline */}
            <div className="text-center lg:text-left space-y-3">
              <h2 className="text-3xl sm:text-4xl font-heading font-bold text-foreground">
                Welcome to PayMe
              </h2>
              <p className="text-muted-foreground">
                Connect your wallet to start receiving crypto payments instantly.
              </p>
            </div>

            {/* Connect Card */}
            <div className="bg-white rounded-3xl p-8 shadow-2xl shadow-primary/10 border border-border/50 space-y-6">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center mx-auto mb-4">
                  <Wallet className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-heading font-bold text-foreground">Connect Wallet</h3>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred wallet to get started
                </p>
              </div>
              
              <div className="flex justify-center">
                <ConnectButton.Custom>
                  {({ openConnectModal, mounted }) => {
                    const ready = mounted;
                    
                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
                        })}
                        className="w-full"
                      >
                        <button
                          onClick={openConnectModal}
                          className="w-full inline-flex items-center justify-center gap-3 px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white font-semibold rounded-2xl hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 group"
                        >
                          <Wallet className="w-5 h-5" />
                          <span>Connect Wallet</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    );
                  }}
                </ConnectButton.Custom>
              </div>

              <div className="flex items-center gap-3 justify-center text-xs text-muted-foreground">
                <Shield className="w-4 h-4 text-green-500" />
                <span>Non-custodial & Secure. Your keys, your crypto.</span>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 border border-border/30 hover:bg-white hover:shadow-lg transition-all cursor-default group">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Link2 className="w-6 h-6 text-blue-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">Create Payment Links</h4>
                  <p className="text-sm text-muted-foreground">Generate shareable links in seconds</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 border border-border/30 hover:bg-white hover:shadow-lg transition-all cursor-default group">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">Track Payments</h4>
                  <p className="text-sm text-muted-foreground">Real-time transaction monitoring</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/50 border border-border/30 hover:bg-white hover:shadow-lg transition-all cursor-default group">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                  <Globe className="w-6 h-6 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-foreground">Multi-Chain Support</h4>
                  <p className="text-sm text-muted-foreground">Ethereum, BNB Chain & more</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="p-6 text-center border-t border-border/30">
          <p className="text-sm text-muted-foreground">
            By connecting, you agree to our Terms of Service
          </p>
        </footer>
      </div>

      {/* CSS for floating animation */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0) rotate(0deg);
          }
          25% {
            transform: translateY(-20px) rotate(5deg);
          }
          50% {
            transform: translateY(-10px) rotate(-3deg);
          }
          75% {
            transform: translateY(-25px) rotate(3deg);
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
