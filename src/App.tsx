import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { WalletProvider } from "@/components/WalletProvider";
import { useAccount } from "wagmi";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Wallets from "./pages/Wallets";
import PaymentLinks from "./pages/PaymentLinks";
import Transactions from "./pages/Transactions";
import PaymentView from "./pages/PaymentView";
import PayAsAgent from "./pages/PayAsAgent";
import NotFound from "./pages/NotFound";

// Protected route wrapper - redirects to login if not connected
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isConnected } = useAccount();
  
  if (!isConnected) {
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
};

// Auth route wrapper - redirects to dashboard if already connected
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  const { isConnected } = useAccount();
  
  if (isConnected) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes = () => {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/pay/:linkId" element={<PaymentView />} />
      <Route path="/r/:linkId" element={<PaymentView />} />
      <Route path="/agent" element={<PayAsAgent />} />
      
      {/* Protected routes */}
      <Route path="/dashboard" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="/wallets" element={<ProtectedRoute><Wallets /></ProtectedRoute>} />
      <Route path="/payment-links" element={<ProtectedRoute><PaymentLinks /></ProtectedRoute>} />
      <Route path="/transactions" element={<ProtectedRoute><Transactions /></ProtectedRoute>} />
      
      {/* Catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <WalletProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </WalletProvider>
);

export default App;
