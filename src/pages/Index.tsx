import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { DashboardCard } from "@/components/DashboardCard";
import { PaymentLinkItem } from "@/components/PaymentLinkItem";
import { CreateLinkModal } from "@/components/CreateLinkModal";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Link2, 
  Loader2, 
  ArrowDownLeft, 
  CheckCircle2, 
  ExternalLink, 
  Wallet,
  ArrowRight,
  ArrowUpRight
} from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests } from "@/lib/api";
import { getExplorerUrl } from "@/lib/contracts";

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
  if (days < 7) return `${days}d ago`;
  
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
};

const Index = () => {
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const { data, isLoading } = useQuery({
    queryKey: ['paymentRequests', address],
    queryFn: () => getAllPaymentRequests(address!),
    enabled: isConnected && !!address,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const paymentLinks = data?.requests?.slice(0, 5) ?? [];
  const recentTransactions = data?.requests?.filter(r => r.status === 'PAID').slice(0, 5) ?? [];
  const totalReceived = recentTransactions.reduce((acc, t) => acc + parseFloat(t.amount), 0);
  const pendingLinks = paymentLinks.filter(l => l.status === 'PENDING').length;

  const handleCreateLinkClick = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setIsCreateLinkOpen(true);
  };

  const handleLinkCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['paymentRequests', address] });
  };

  const handleDelete = () => {
    queryClient.invalidateQueries({ queryKey: ['paymentRequests', address] });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-slate-50">
          <AppNavbar />
          
          <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Dashboard</p>
                  <h1 className="text-2xl font-heading font-bold text-foreground">
                    {isConnected ? 'Welcome back' : 'Welcome to PayMe'}
                  </h1>
                </div>
                {isConnected && (
                  <Button 
                    onClick={handleCreateLinkClick}
                    className="gap-2 bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    <Plus className="h-4 w-4" />
                    Create Link
                  </Button>
                )}
              </div>

              {/* Connect Prompt */}
              {!isConnected ? (
                <div className="bg-white rounded-2xl border border-border p-12 text-center">
                  <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-5">
                    <Wallet className="h-6 w-6 text-slate-600" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    Connect your wallet to create payment links and view transactions
                  </p>
                  <Button 
                    onClick={() => openConnectModal?.()} 
                    className="gap-2 bg-slate-900 hover:bg-slate-800 rounded-lg"
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                </div>
              ) : (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: "Total Links", value: paymentLinks.length },
                      { label: "Completed", value: recentTransactions.length },
                      { label: "Pending", value: pendingLinks },
                      { label: "Total Received", value: totalReceived > 0 ? totalReceived.toFixed(2) : "0" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white rounded-xl border border-border p-5">
                        <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                        <p className="text-2xl font-heading font-bold text-foreground">{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Transactions */}
                    <DashboardCard 
                      title="Recent Transactions"
                      action={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs text-muted-foreground hover:text-foreground gap-1 h-8"
                          onClick={() => navigate('/transactions')}
                        >
                          View All
                          <ArrowUpRight className="h-3 w-3" />
                        </Button>
                      }
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : recentTransactions.length > 0 ? (
                        <div className="space-y-0">
                          {recentTransactions.map((txn) => (
                            <div 
                              key={txn.id} 
                              className="flex items-center justify-between py-3.5 border-b last:border-0 border-border/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                  <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-foreground">
                                    {txn.description?.trim() || 'Payment received'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatDate(txn.paidAt!)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-emerald-600">
                                    +{txn.amount} {txn.token}
                                  </p>
                                  <div className="flex items-center gap-1 justify-end">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                    <span className="text-[10px] text-emerald-600">Success</span>
                                  </div>
                                </div>
                                {txn.txHash && (
                                  <a
                                    href={`${getExplorerUrl(txn.network)}/tx/${txn.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                            <ArrowDownLeft className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground">No transactions yet</p>
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
                          className="text-xs gap-1 text-muted-foreground hover:text-foreground h-8"
                          onClick={handleCreateLinkClick}
                        >
                          <Plus className="h-3 w-3" />
                          New
                        </Button>
                      }
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : paymentLinks.length > 0 ? (
                        <div className="space-y-0">
                          {paymentLinks.map((link) => (
                            <PaymentLinkItem 
                              key={link.id} 
                              id={link.id}
                              title={`${link.amount} ${link.token}`}
                              amount={link.amount}
                              token={link.token}
                              status={link.status}
                              link={`${window.location.origin}/pay/${link.id}`}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                            <Link2 className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">No payment links yet</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCreateLinkClick}
                            className="gap-1 rounded-lg text-xs"
                          >
                            <Plus className="h-3 w-3" />
                            Create Link
                          </Button>
                        </div>
                      )}
                    </DashboardCard>
                  </div>

                  {/* Quick Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <button 
                      onClick={handleCreateLinkClick}
                      className="group bg-slate-900 rounded-xl p-5 text-left text-white hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                          <Plus className="h-5 w-5" />
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <h3 className="font-medium mb-0.5">Create Payment Link</h3>
                      <p className="text-sm text-white/60">Generate a new link</p>
                    </button>

                    <button 
                      onClick={() => navigate('/payment-links')}
                      className="group bg-white rounded-xl p-5 text-left border border-border hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <Link2 className="h-5 w-5 text-slate-600" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <h3 className="font-medium text-foreground mb-0.5">Manage Links</h3>
                      <p className="text-sm text-muted-foreground">View all payment links</p>
                    </button>

                    <button 
                      onClick={() => navigate('/transactions')}
                      className="group bg-white rounded-xl p-5 text-left border border-border hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                          <ArrowDownLeft className="h-5 w-5 text-slate-600" />
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-40 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <h3 className="font-medium text-foreground mb-0.5">Transactions</h3>
                      <p className="text-sm text-muted-foreground">View payment history</p>
                    </button>
                  </div>
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
