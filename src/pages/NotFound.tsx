import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <header className="p-6">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-heading font-semibold text-foreground">
            PayMe
          </span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-[120px] font-heading font-bold text-violet-100 leading-none">
            404
          </div>
          
          <div className="space-y-2">
            <h1 className="text-xl font-heading font-bold text-foreground">
              Page not found
            </h1>
            <p className="text-muted-foreground text-sm">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <code className="text-xs text-muted-foreground bg-violet-50 border border-violet-100 px-3 py-1.5 rounded-md inline-block font-mono mt-2">
              {location.pathname}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild className="bg-violet-600 hover:bg-violet-700 rounded-lg">
              <Link to="/" className="gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()} className="gap-2 rounded-lg">
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center">
        <p className="text-xs text-muted-foreground">
          PayMe — Simple crypto payments
        </p>
      </footer>
    </div>
  );
};

export default NotFound;
