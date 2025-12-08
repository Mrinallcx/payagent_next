import { useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Home, ArrowLeft, Wallet, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.error("404 Error:", location.pathname);
    setMounted(true);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary/90 to-slate-900 flex flex-col relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
      </div>

      {/* Grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* Header */}
      <header className="relative z-10 p-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 group-hover:bg-white/20 transition-colors">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-heading font-bold text-white">
            PayMe
          </span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className={`max-w-lg w-full text-center space-y-8 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {/* 404 Display */}
          <div className="relative">
            <div className="text-[150px] md:text-[200px] font-heading font-bold text-white/5 leading-none select-none">
              404
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shadow-2xl">
                <Search className="w-12 h-12 text-white/70" />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/10">
              <Sparkles className="w-4 h-4 text-white/70" />
              <span className="text-sm font-medium text-white/70">Page Not Found</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-heading font-bold text-white">
              Oops! Lost in the blockchain?
            </h1>
            <p className="text-white/60 max-w-md mx-auto">
              The page you're looking for doesn't exist or has been moved to a different address.
            </p>
            <code className="text-xs text-white/40 bg-white/5 backdrop-blur-sm px-4 py-2 rounded-lg inline-block border border-white/10 font-mono">
              {location.pathname}
            </code>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button asChild size="lg" className="bg-white text-slate-900 hover:bg-white/90 rounded-xl shadow-lg shadow-white/20 gap-2">
              <Link to="/">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => window.history.back()} 
              className="bg-transparent border-white/20 text-white hover:bg-white/10 rounded-xl gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>

          {/* Help links */}
          <div className="flex items-center justify-center gap-6 pt-4 text-sm">
            <Link to="/dashboard" className="text-white/50 hover:text-white transition-colors">
              Dashboard
            </Link>
            <span className="text-white/20">•</span>
            <Link to="/payment-links" className="text-white/50 hover:text-white transition-colors">
              Payment Links
            </Link>
            <span className="text-white/20">•</span>
            <Link to="/transactions" className="text-white/50 hover:text-white transition-colors">
              Transactions
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 p-6 text-center">
        <p className="text-sm text-white/40">
          Built for seamless crypto payments
        </p>
      </footer>
    </div>
  );
};

export default NotFound;
