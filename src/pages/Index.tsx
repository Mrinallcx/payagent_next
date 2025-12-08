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
  Receipt, 
  ArrowDownLeft, 
  CheckCircle2, 
  ExternalLink, 
  Wallet,
  TrendingUp,
  Sparkles,
  ArrowRight,
  Zap,
  BarChart3
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
  if (days < 7) return `${days} days ago`;
  
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

  const paymentLinks = data?.requests?.slice(0, 4) ?? [];
  const recentTransactions = data?.requests?.filter(r => r.status === 'PAID').slice(0, 4) ?? [];
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
        
        <div className="flex-1 flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50/30 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-blue-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-purple-500/10 to-primary/10 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0066ff05_1px,transparent_1px),linear-gradient(to_bottom,#0066ff05_1px,transparent_1px)] bg-[size:60px_60px]" />
          </div>

          <AppNavbar />
          
          <main className="flex-1 p-6 relative z-10">
            <div className="max-w-7xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full border border-primary/10 shadow-sm mb-3">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-foreground/70">Dashboard</span>
                  </div>
                  <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground mb-2">
                    {isConnected ? 'Welcome back!' : 'Welcome to PayMe'}
                  </h1>
                  <p className="text-muted-foreground">
                    {isConnected 
                      ? "Here's what's happening with your payments today."
                      : "Connect your wallet to start receiving crypto payments."}
                  </p>
                </div>
                {isConnected && (
                  <Button 
                    onClick={handleCreateLinkClick}
                    className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 rounded-xl"
                  >
                    <Plus className="h-4 w-4" />
                    Create Payment Link
                  </Button>
                )}
              </div>

              {/* Connect Prompt */}
              {!isConnected ? (
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-12 text-center shadow-xl shadow-primary/5">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
                    <Wallet className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-3">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Connect your wallet to create payment links and view your transaction history
                  </p>
                  <Button 
                    onClick={() => openConnectModal?.()} 
                    className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25 rounded-xl px-8 py-6 text-base"
                  >
                    <Wallet className="h-5 w-5" />
                    Connect Wallet
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              ) : (
                <>
                  {/* Stats Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-primary/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-blue-500/10">
                          <Link2 className="h-5 w-5 text-blue-500" />
                        </div>
                      </div>
                      <p className="text-2xl font-heading font-bold text-foreground">{paymentLinks.length}</p>
                      <p className="text-xs text-muted-foreground">Total Links</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-green-500/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-green-500/10">
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>
                      </div>
                      <p className="text-2xl font-heading font-bold text-foreground">{recentTransactions.length}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-amber-500/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-amber-500/10">
                          <Zap className="h-5 w-5 text-amber-500" />
                        </div>
                      </div>
                      <p className="text-2xl font-heading font-bold text-foreground">{pendingLinks}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-white/50 shadow-lg shadow-purple-500/5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 rounded-xl bg-purple-500/10">
                          <BarChart3 className="h-5 w-5 text-purple-500" />
                        </div>
                      </div>
                      <p className="text-2xl font-heading font-bold text-foreground">
                        {totalReceived > 0 ? totalReceived.toFixed(2) : '0'}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Received</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Transactions */}
                    <DashboardCard 
                      title="Recent Transactions"
                      icon={<Receipt className="h-5 w-5 text-green-500" />}
                      action={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs hover:bg-primary/5 hover:text-primary gap-1"
                          onClick={() => navigate('/transactions')}
                        >
                          View All
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      }
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : recentTransactions.length > 0 ? (
                        <div className="space-y-1">
                          {recentTransactions.map((txn) => (
                            <div 
                              key={txn.id} 
                              className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-green-500/5 transition-colors border-b last:border-0 border-border/50"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/20">
                                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-foreground">
                                    {txn.description?.trim() || 'Payment received'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">{formatDate(txn.paidAt!)}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-right">
                                  <p className="text-sm font-bold text-green-600">
                                    +{txn.amount} {txn.token}
                                  </p>
                                  <div className="flex items-center gap-1 justify-end">
                                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                                    <span className="text-[10px] text-green-600 font-medium">Success</span>
                                  </div>
                                </div>
                                {txn.txHash && (
                                  <a
                                    href={`${getExplorerUrl(txn.network)}/tx/${txn.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                            <Receipt className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground mb-1">No transactions yet</p>
                          <p className="text-xs text-muted-foreground">Completed payments will appear here</p>
                        </div>
                      )}
                    </DashboardCard>

                    {/* Payment Links */}
                    <DashboardCard 
                      title="Payment Links"
                      icon={<Link2 className="h-5 w-5 text-primary" />}
                      action={
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-xs gap-1 hover:bg-primary/5 hover:text-primary"
                          onClick={handleCreateLinkClick}
                        >
                          <Plus className="h-3 w-3" />
                          New Link
                        </Button>
                      }
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
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
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mb-4">
                            <Link2 className="h-7 w-7 text-muted-foreground" />
                          </div>
                          <p className="text-sm font-medium text-foreground mb-1">No payment links</p>
                          <p className="text-xs text-muted-foreground mb-4">Create your first link to start receiving payments</p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={handleCreateLinkClick}
                            className="gap-1 rounded-lg"
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
                      className="group bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-6 text-left text-white shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-1"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-white/20">
                          <Plus className="h-6 w-6" />
                        </div>
                        <ArrowRight className="h-5 w-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="font-heading font-bold text-lg mb-1">Create Payment Link</h3>
                      <p className="text-sm text-white/80">Generate a new link instantly</p>
                    </button>

                    <button 
                      onClick={() => navigate('/payment-links')}
                      className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-left border border-border/50 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-blue-500/10">
                          <Link2 className="h-6 w-6 text-blue-500" />
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="font-heading font-bold text-lg text-foreground mb-1">Manage Links</h3>
                      <p className="text-sm text-muted-foreground">View and manage all your links</p>
                    </button>

                    <button 
                      onClick={() => navigate('/transactions')}
                      className="group bg-white/80 backdrop-blur-sm rounded-2xl p-6 text-left border border-border/50 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="p-3 rounded-xl bg-green-500/10">
                          <TrendingUp className="h-6 w-6 text-green-500" />
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                      </div>
                      <h3 className="font-heading font-bold text-lg text-foreground mb-1">View Transactions</h3>
                      <p className="text-sm text-muted-foreground">Check your payment history</p>
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
