import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Trash2, Plus, Clock, CheckCircle2, XCircle, Copy, ExternalLink, Loader2, RefreshCw, AlertCircle, Wallet, Sparkles, ArrowRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { CreateLinkModal } from "@/components/CreateLinkModal";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests, deletePaymentRequest, PaymentRequest } from "@/lib/api";
import { getExplorerUrl } from "@/lib/contracts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const PaymentLinks = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [, setCurrentTime] = useState(new Date());
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  // React Query for fetching payment links
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['paymentLinks', address],
    queryFn: () => getAllPaymentRequests(address!),
    enabled: isConnected && !!address,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const paymentLinks = data?.requests ?? [];

  // Update time display every second (for expiry countdown)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCreateLinkClick = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setIsCreateLinkOpen(true);
  };

  const calculateTimeRemaining = (expiresAt: number | null) => {
    if (!expiresAt) return "No expiry";
    const now = Date.now();
    const diff = expiresAt - now;
    if (diff <= 0) return "Expired";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor(diff % (1000 * 60 * 60 * 24) / (1000 * 60 * 60));
    const minutes = Math.floor(diff % (1000 * 60 * 60) / (1000 * 60));
    if (days > 0) return `${days}d ${hours}h remaining`;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  };

  const getStatusBadge = (link: PaymentRequest) => {
    if (link.status === 'PAID') {
      return (
        <Badge className="bg-green-500 text-white border-0 shadow-md shadow-green-500/30 font-semibold">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    }
    if (link.expiresAt && Date.now() > link.expiresAt) {
      return (
        <Badge className="bg-red-500 text-white border-0 shadow-md shadow-red-500/30 font-semibold">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge className="bg-amber-500 text-white border-0 shadow-md shadow-amber-500/30 font-semibold">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const handleViewLink = (id: string) => {
    navigate(`/pay/${id}`);
  };

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await deletePaymentRequest(deleteId);
      queryClient.invalidateQueries({ queryKey: ['paymentLinks', address] });
      queryClient.invalidateQueries({ queryKey: ['paymentRequests', address] });
      toast.success("Payment link deleted successfully");
    } catch (error) {
      console.error("Error deleting payment link:", error);
      toast.error("Failed to delete payment link");
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const handleCreateLink = () => {
    queryClient.invalidateQueries({ queryKey: ['paymentLinks', address] });
    queryClient.invalidateQueries({ queryKey: ['paymentRequests', address] });
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col bg-gradient-to-br from-blue-50/50 via-white to-primary/5 relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 to-accent/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/30 to-primary/10 rounded-full blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#0066ff05_1px,transparent_1px),linear-gradient(to_bottom,#0066ff05_1px,transparent_1px)] bg-[size:60px_60px]" />
          </div>

          <AppNavbar />

          <main className="flex-1 p-6 relative z-10">
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full border border-primary/10 shadow-sm mb-4">
                    <Link2 className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-foreground/70">Manage Links</span>
                  </div>
                  <h1 className="text-4xl font-heading font-bold text-foreground mb-2">Payment Links</h1>
                  <p className="text-muted-foreground">
                    {!isConnected 
                      ? 'Connect your wallet to view your payment links'
                      : paymentLinks.length > 0 
                        ? `${paymentLinks.length} payment link${paymentLinks.length > 1 ? 's' : ''}` 
                        : 'Create and manage your payment links'}
                  </p>
                </div>
                {isConnected && (
                  <Button 
                    variant="outline" 
                    size="icon" 
                    onClick={() => refetch()} 
                    disabled={isFetching}
                    className="rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all"
                  >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                </Button>
                )}
              </div>

              {/* Connect Wallet Prompt */}
              {!isConnected && (
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-12 text-center shadow-xl shadow-primary/5 border border-white/50">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
                    <Wallet className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-3">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Connect your wallet to create and manage your payment links
                  </p>
                  <Button 
                    onClick={() => openConnectModal?.()} 
                    className="gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300 rounded-xl px-8 py-6 text-base"
                  >
                    <Wallet className="h-5 w-5" />
                    Connect Wallet
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* Stats Cards */}
              {isConnected && paymentLinks.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-lg">
                    <p className="text-sm text-gray-500 mb-1 font-medium">Total Links</p>
                    <p className="text-3xl font-heading font-bold text-gray-900">{paymentLinks.length}</p>
                  </div>
                  <div className="bg-green-50 rounded-2xl p-5 border border-green-200 shadow-lg">
                    <p className="text-sm text-green-700 mb-1 font-medium">Paid</p>
                    <p className="text-3xl font-heading font-bold text-green-600">
                      {paymentLinks.filter(l => l.status === 'PAID').length}
                    </p>
                  </div>
                  <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-lg">
                    <p className="text-sm text-amber-700 mb-1 font-medium">Pending</p>
                    <p className="text-3xl font-heading font-bold text-amber-600">
                      {paymentLinks.filter(l => l.status === 'PENDING' && (!l.expiresAt || Date.now() < l.expiresAt)).length}
                    </p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {isConnected && isLoading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading payment links...</p>
                </div>
              )}

              {/* Payment Links List */}
              {isConnected && !isLoading && (
                <div className="space-y-4">
                  {paymentLinks.map(link => (
                    <div 
                      key={link.id} 
                      className={`bg-white/80 backdrop-blur-sm rounded-2xl p-6 transition-all duration-300 hover:shadow-xl border ${
                        link.status === 'PAID' 
                          ? 'border-green-500/20 hover:shadow-green-500/10' 
                          : link.expiresAt && Date.now() > link.expiresAt 
                            ? 'border-red-500/20 opacity-75 hover:shadow-red-500/5' 
                            : 'border-border/50 hover:border-primary/30 hover:shadow-primary/10'
                      }`}
                    >
                      <div className="flex flex-col gap-4">
                        {/* Top Row */}
                        <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2.5 rounded-xl shadow-sm ${
                                link.status === 'PAID' 
                                  ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/20' 
                                  : link.expiresAt && Date.now() > link.expiresAt
                                    ? 'bg-gradient-to-br from-red-500/10 to-rose-500/20'
                                    : 'bg-gradient-to-br from-primary/10 to-accent/20'
                              }`}>
                                <LinkIcon className={`h-5 w-5 ${
                                  link.status === 'PAID' 
                                    ? 'text-green-600' 
                                    : link.expiresAt && Date.now() > link.expiresAt
                                      ? 'text-red-500'
                                      : 'text-primary'
                                }`} />
                              </div>
                              <h3 className="text-xl font-heading font-bold text-foreground">
                                {link.amount} {link.token}
                          </h3>
                              {getStatusBadge(link)}
                        </div>
                            
                            {link.description && (
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                          {link.description}
                        </p>
                            )}

                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
                                <span className="font-medium">To:</span>
                                <code className="font-mono">{truncateAddress(link.receiver)}</code>
                              </span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg">
                                <span className="font-medium">Network:</span>
                                {link.network.split('(')[0].trim()}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="font-medium">Created:</span>
                                {formatDate(link.createdAt)}
                              </span>
                        </div>
                      </div>

                          {/* Actions */}
                          <div className="flex gap-2 ml-4">
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => handleCopyLink(link.id)} 
                              className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" 
                              title="Copy link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                        <Button
                          size="sm"
                              variant="ghost" 
                          onClick={() => handleViewLink(link.id)}
                              className="h-9 w-9 p-0 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors" 
                              title="Open link"
                        >
                              <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                              variant="ghost" 
                              onClick={() => handleDeleteClick(link.id)} 
                              className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" 
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                        </Button>
                          </div>
                        </div>

                        {/* Bottom Row - Expiry & Payment Info */}
                        <div className="flex items-center justify-between pt-4 border-t border-border/30">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className={`h-4 w-4 ${link.expiresAt && Date.now() > link.expiresAt ? 'text-red-500' : 'text-muted-foreground'}`} />
                            <span className={link.expiresAt && Date.now() > link.expiresAt ? 'text-red-500 font-medium' : 'text-muted-foreground'}>
                              {calculateTimeRemaining(link.expiresAt)}
                            </span>
                          </div>

                          {link.status === 'PAID' && link.txHash && (
                            <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-muted-foreground">Paid on {formatDate(link.paidAt!)}</span>
                              <a 
                                href={`${getExplorerUrl(link.network)}/tx/${link.txHash}`} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-primary hover:underline flex items-center gap-1 font-medium"
                              >
                                <code className="text-xs">{truncateAddress(link.txHash)}</code>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                ))}

                {paymentLinks.length === 0 && (
                    <div className="text-center py-20 bg-white/80 backdrop-blur-sm border border-border/50 rounded-3xl shadow-lg shadow-primary/5">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <LinkIcon className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <h3 className="text-xl font-heading font-bold mb-2">No payment links yet</h3>
                      <p className="text-muted-foreground mb-8 max-w-sm mx-auto">
                        Create your first payment link to start receiving crypto payments
                      </p>
                      <Button 
                        onClick={handleCreateLinkClick} 
                        className="gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25 transition-all duration-300 rounded-xl px-6"
                      >
                        <Plus className="h-4 w-4" />
                        Create Your First Link
                      </Button>
                  </div>
                )}
              </div>
              )}
            </div>
          </main>
        </div>
      </div>

      <CreateLinkModal open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen} onCreateLink={handleCreateLink} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-heading">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Payment Link
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment link? This action cannot be undone.
              Anyone with this link will no longer be able to make a payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </>
              ) : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default PaymentLinks;
