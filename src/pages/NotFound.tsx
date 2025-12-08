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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-heading font-bold text-foreground">
            PayMe
          </span>
        </Link>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-8xl font-heading font-bold text-primary/20">
            404
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-heading font-bold text-foreground">
              Page Not Found
            </h1>
            <p className="text-muted-foreground">
              The page you're looking for doesn't exist or has been moved.
            </p>
            <code className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded inline-block">
              {location.pathname}
            </code>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <Button asChild>
              <Link to="/" className="gap-2">
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </Button>
            <Button variant="outline" onClick={() => window.history.back()} className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Go Back
            </Button>
          </div>
        </div>
      </main>

      <footer className="p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Built for seamless crypto payments
        </p>
      </footer>
    </div>
  );
};

export default NotFound;
