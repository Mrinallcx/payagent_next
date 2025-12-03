import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { DashboardCard } from "@/components/DashboardCard";
import { PaymentLinkItem } from "@/components/PaymentLinkItem";
import { QuickActions } from "@/components/QuickActions";
import { CreateLinkModal } from "@/components/CreateLinkModal";
import { Button } from "@/components/ui/button";
import { Plus, Link2, Loader2, Receipt, ArrowDownLeft, CheckCircle2, ExternalLink, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests, PaymentRequest } from "@/lib/api";

const formatDate = (timestamp: number) => {
  const now = Date.now();
  const diff = now - timestamp;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

const Index = () => {
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [paymentLinks, setPaymentLinks] = useState<PaymentRequest[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<PaymentRequest[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(false);
  const [isLoadingTxns, setIsLoadingTxns] = useState(false);
  const navigate = useNavigate();
  
  // Wallet connection
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const fetchData = useCallback(async () => {
    // Only fetch if wallet is connected
    if (!isConnected || !address) {
      setPaymentLinks([]);
      setRecentTransactions([]);
      return;
    }

    try {
      setIsLoadingLinks(true);
      setIsLoadingTxns(true);
      
      // Pass wallet address to filter by creator
      const response = await getAllPaymentRequests(address);
      
      // Payment links (all for this wallet)
      setPaymentLinks(response.requests.slice(0, 4));
      
      // Recent transactions (only PAID ones for this wallet)
      const paidTxns = response.requests.filter(r => r.status === 'PAID').slice(0, 4);
      setRecentTransactions(paidTxns);
    } catch (error) {
      console.error("Error fetching data:", error);
      setPaymentLinks([]);
      setRecentTransactions([]);
    } finally {
      setIsLoadingLinks(false);
      setIsLoadingTxns(false);
    }
  }, [address, isConnected]);

  // Fetch data when wallet connects or address changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Clear data when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setPaymentLinks([]);
      setRecentTransactions([]);
    }
  }, [isConnected]);

  const handleCreateLinkClick = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setIsCreateLinkOpen(true);
  };

  const handleLinkCreated = () => {
    fetchData();
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
                <p className="text-muted-foreground">
                  {isConnected 
                    ? "Welcome back! Here's what's happening with your payments."
                    : "Connect your wallet to view your payments."}
                </p>
              </div>

              {/* Show connect wallet prompt if not connected */}
              {!isConnected ? (
                <div className="bg-card border rounded-xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Wallet className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    Connect your wallet to create payment links and view your transaction history
                  </p>
                  <Button onClick={() => openConnectModal?.()} className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Transactions */}
                    <DashboardCard 
                      title="Recent Transactions"
                      action={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs"
                          onClick={() => navigate('/transactions')}
                        >
                          View All
                        </Button>
                      }
                    >
                      {isLoadingTxns ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : recentTransactions.length > 0 ? (
                        <div className="space-y-1">
                          {recentTransactions.map((txn) => (
                            <div 
                              key={txn.id} 
                              className="flex items-center justify-between py-3 border-b last:border-0 border-border"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-green-500/10">
                                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {txn.description || `Payment received`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatDate(txn.paidAt!)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-green-600">
                                    +{txn.amount} {txn.token}
                                  </p>
                                  <div className="flex items-center gap-1 justify-end">
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    <span className="text-xs text-green-600">Success</span>
                                  </div>
                                </div>
                                {txn.txHash && (
                                  <a
                                    href={`https://sepolia.etherscan.io/tx/${txn.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md hover:bg-muted"
                                    title="View on Etherscan"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                            <Receipt className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">No transactions yet</p>
                          <p className="text-xs text-muted-foreground">Completed payments will appear here</p>
                        </div>
                      )}
                    </DashboardCard>

                    {/* Payment Links */}
                    <DashboardCard 
                      title="Payment Links"
                      action={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs gap-1"
                          onClick={handleCreateLinkClick}
                        >
                          <Plus className="h-3 w-3" />
                          New
                        </Button>
                      }
                    >
                      {isLoadingLinks ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : paymentLinks.length > 0 ? (
                        <div className="space-y-1">
                          {paymentLinks.map((link) => (
                            <PaymentLinkItem 
                              key={link.id} 
                              id={link.id}
                              title={`${link.amount} ${link.token}`}
                              amount={link.amount}
                              token={link.token}
                              status={link.status}
                              link={`${window.location.origin}/pay/${link.id}`}
                              onDelete={fetchData}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                            <Link2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">No payment links</p>
                          <p className="text-xs text-muted-foreground">Create one to get started</p>
                        </div>
                      )}
                    </DashboardCard>
                  </div>

                  <QuickActions 
                    onCreateLink={handleCreateLinkClick} 
                    onAddWallet={() => {}}
                    onSettings={() => navigate("/settings")}
                  />
                </>
              )}
            </div>
          </main>
        </div>
      </div>
      
      <CreateLinkModal 
        open={isCreateLinkOpen} 
        onOpenChange={setIsCreateLinkOpen}
        onCreateLink={handleLinkCreated}
      />
    </SidebarProvider>
  );
};

export default Index;
