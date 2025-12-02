import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Eye, Trash2, Plus, Clock, CheckCircle2, XCircle, Copy, ExternalLink, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { CreateLinkModal } from "@/components/CreateLinkModal";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests, deletePaymentRequest, PaymentRequest } from "@/lib/api";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
const PaymentLinks = () => {
  const navigate = useNavigate();
  const [paymentLinks, setPaymentLinks] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [, setCurrentTime] = useState(new Date());
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const {
    address,
    isConnected
  } = useAccount();
  const {
    openConnectModal
  } = useConnectModal();
  const fetchPaymentLinks = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);else setIsLoading(true);
      const response = await getAllPaymentRequests(address);
      setPaymentLinks(response.requests);
    } catch (error) {
      console.error("Error fetching payment links:", error);
      toast.error("Failed to load payment links");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [address]);
  useEffect(() => {
    fetchPaymentLinks();
  }, [fetchPaymentLinks]);
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
      return <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/20">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>;
    }
    if (link.expiresAt && Date.now() > link.expiresAt) {
      return <Badge variant="destructive" className="bg-red-500/10 text-red-600 hover:bg-red-500/20 border-red-500/20">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 border-yellow-500/20">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>;
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
      setPaymentLinks(links => links.filter(l => l.id !== deleteId));
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
    // Refresh the list after creating a new link
    fetchPaymentLinks(true);
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
  return <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col">
          <AppNavbar />

          <main className="flex-1 p-6">
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground mb-2">Payment Links</h1>
                  <p className="text-muted-foreground">
                    {paymentLinks.length > 0 ? `${paymentLinks.length} payment link${paymentLinks.length > 1 ? 's' : ''}` : 'Create and manage your payment links'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => fetchPaymentLinks(true)} disabled={isRefreshing}>
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  </Button>
                  
                </div>
              </div>

              {/* Stats Cards */}
              {paymentLinks.length > 0 && <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">Total Links</p>
                    <p className="text-2xl font-bold">{paymentLinks.length}</p>
                  </div>
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">Paid</p>
                    <p className="text-2xl font-bold text-green-600">
                      {paymentLinks.filter(l => l.status === 'PAID').length}
                    </p>
                  </div>
                  <div className="bg-card border rounded-xl p-4">
                    <p className="text-sm text-muted-foreground mb-1">Pending</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {paymentLinks.filter(l => l.status === 'PENDING' && (!l.expiresAt || Date.now() < l.expiresAt)).length}
                    </p>
                  </div>
                </div>}

              {/* Loading State */}
              {isLoading && <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Loading payment links...</p>
                </div>}

              {/* Payment Links List */}
              {!isLoading && <div className="space-y-3">
                  {paymentLinks.map(link => <div key={link.id} className={`bg-card border rounded-xl p-5 transition-all hover:shadow-md ${link.status === 'PAID' ? 'border-green-500/20' : link.expiresAt && Date.now() > link.expiresAt ? 'border-red-500/20 opacity-75' : 'border-border hover:border-primary/30'}`}>
                      <div className="flex flex-col gap-4">
                        {/* Top Row */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold text-foreground">
                                {link.amount} {link.token}
                              </h3>
                              {getStatusBadge(link)}
                            </div>
                            
                            {link.description && <p className="text-sm text-muted-foreground mb-2 line-clamp-1">
                                {link.description}
                              </p>}

                            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <span className="font-medium">To:</span>
                                <code className="bg-muted px-1.5 py-0.5 rounded">
                                  {truncateAddress(link.receiver)}
                                </code>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Network:</span>
                                {link.network}
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="font-medium">Created:</span>
                                {formatDate(link.createdAt)}
                              </span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 ml-4">
                            <Button size="sm" variant="ghost" onClick={() => handleCopyLink(link.id)} className="h-8 w-8 p-0" title="Copy link">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleViewLink(link.id)} className="h-8 w-8 p-0" title="Open link">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteClick(link.id)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Bottom Row - Expiry & Payment Info */}
                        <div className="flex items-center justify-between pt-3 border-t border-border/50">
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className={`${link.expiresAt && Date.now() > link.expiresAt ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {calculateTimeRemaining(link.expiresAt)}
                            </span>
                          </div>

                          {link.status === 'PAID' && link.txHash && <div className="flex items-center gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-muted-foreground">Paid on {formatDate(link.paidAt!)}</span>
                              <a href={`https://sepolia.etherscan.io/tx/${link.txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                <code className="text-xs">{truncateAddress(link.txHash)}</code>
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>}
                        </div>
                      </div>
                    </div>)}

                  {paymentLinks.length === 0 && <div className="text-center py-16 bg-card border rounded-xl">
                      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                        <LinkIcon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">No payment links yet</h3>
                      <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                        Create your first payment link to start receiving crypto payments
                      </p>
                      <Button onClick={handleCreateLinkClick} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Your First Link
                      </Button>
                    </div>}
                </div>}
            </div>
          </main>
        </div>
      </div>

      <CreateLinkModal open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen} onCreateLink={handleCreateLink} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Delete Payment Link
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment link? This action cannot be undone.
              Anyone with this link will no longer be able to make a payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Deleting...
                </> : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>;
};
export default PaymentLinks;