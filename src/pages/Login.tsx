import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet, Zap, Shield, Globe, ArrowRight } from "lucide-react";

const Login = () => {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (isConnected) {
      navigate("/dashboard");
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="text-2xl font-heading font-bold text-foreground">
            PayMe
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-md w-full text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
            <span className="text-sm font-medium text-primary">Simple & Secure Payments</span>
          </div>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl font-heading font-bold text-foreground leading-tight">
              Your Simple
              <span className="block text-primary">Payment Hub</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-sm mx-auto">
              Create payment links, receive crypto, and manage transactions across multiple chains.
            </p>
          </div>

          {/* Connect Card */}
          <div className="bg-white rounded-2xl p-8 shadow-xl shadow-primary/5 border border-border space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-heading font-semibold text-foreground">Get Started</h2>
              <p className="text-sm text-muted-foreground">Connect your wallet to continue</p>
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
                    >
                      <button
                        onClick={openConnectModal}
                        className="inline-flex items-center gap-3 px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
                      >
                        <Wallet className="w-5 h-5" />
                        <span>Connect Wallet</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }}
              </ConnectButton.Custom>
            </div>

            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5" />
              Non-custodial. Your keys, your crypto.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Instant</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Secure</span>
            </div>
            <div className="flex flex-col items-center gap-2 p-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <span className="text-sm font-medium text-foreground">Multi-Chain</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Built for seamless crypto payments
        </p>
      </footer>
    </div>
  );
};

export default Login;
