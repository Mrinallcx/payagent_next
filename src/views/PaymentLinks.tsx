import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link as LinkIcon, Trash2, Plus, Clock, CheckCircle2, XCircle, Copy, ExternalLink, Loader2, RefreshCw, Wallet } from "lucide-react";
import { toast } from "sonner";
import { CreateLinkModal } from "@/components/CreateLinkModal";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests, deletePaymentRequest, PaymentRequest } from "@/lib/api";
import { getExplorerUrl } from "@/lib/contracts";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type FilterTab = 'all' | 'human' | 'agent';

const PaymentLinks = () => {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [, setCurrentTime] = useState(new Date());
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['paymentLinks', address],
    queryFn: () => getAllPaymentRequests(address!),
    enabled: isConnected && !!address,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  });

  const allLinks = data?.requests ?? [];

  const filteredLinks = useMemo(() => {
    switch (activeTab) {
      case 'human': return allLinks.filter(l => !l.creatorAgentId);
      case 'agent': return allLinks.filter(l => !!l.creatorAgentId);
      default: return allLinks;
    }
  }, [allLinks, activeTab]);

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
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const getStatusBadge = (link: PaymentRequest) => {
    if (link.status === 'PAID') {
      return (
        <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 text-xs">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Paid
        </Badge>
      );
    }
    if (link.expiresAt && Date.now() > link.expiresAt) {
      return (
        <Badge variant="secondary" className="bg-red-50 text-red-700 border-0 text-xs">
          <XCircle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-0 text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  const getOriginBadge = (link: PaymentRequest) => {
    if (link.creatorAgentId) {
      return (
        <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-0 text-xs">
          Agent
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-0 text-xs">
        Human
      </Badge>
    );
  };

  const handleViewLink = (id: string) => {
    router.push(`/pay/${id}`);
  };

  const handleCopyLink = (id: string) => {
    const link = `${window.location.origin}/pay/${id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    if (!address) {
      toast.error("Please connect your wallet first");
      return;
    }
    setIsDeleting(true);
    try {
      await deletePaymentRequest(deleteId, address);
      queryClient.invalidateQueries({ queryKey: ['paymentLinks', address] });
      queryClient.invalidateQueries({ queryKey: ['paymentRequests', address] });
      toast.success("Payment link deleted");
    } catch (error: any) {
      console.error("Error deleting payment link:", error);
      toast.error(error?.message || "Failed to delete");
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
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const paidCount = filteredLinks.filter(l => l.status === 'PAID').length;
  const pendingCount = filteredLinks.filter(l => l.status === 'PENDING' && (!l.expiresAt || Date.now() < l.expiresAt)).length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: allLinks.length },
    { key: 'human', label: 'Human', count: allLinks.filter(l => !l.creatorAgentId).length },
    { key: 'agent', label: 'Agent', count: allLinks.filter(l => !!l.creatorAgentId).length },
  ];

  return (
    <>
      <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-5xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Manage</p>
                  <h1 className="text-2xl font-heading font-bold text-foreground">Payment Links</h1>
                </div>
                {isConnected && (
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => refetch()} 
                      disabled={isFetching}
                      className="rounded-lg h-9 w-9"
                    >
                      <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button 
                      onClick={handleCreateLinkClick}
                      className="gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg h-9"
                    >
                      <Plus className="h-4 w-4" />
                      Create Link
                    </Button>
                  </div>
                )}
              </div>

              {/* Connect Wallet */}
              {!isConnected && (
                <div className="bg-white rounded-xl border border-border p-12 text-center">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Connect your wallet to view and manage payment links
                  </p>
                  <Button 
                    onClick={() => openConnectModal?.()} 
                    className="gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                </div>
              )}

              {/* Filter Tabs */}
              {isConnected && (
                <div className="flex items-center gap-1 mb-4 bg-white rounded-lg border border-border p-1 w-fit">
                  {tabs.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === tab.key
                          ? 'bg-blue-600 text-white'
                          : 'text-muted-foreground hover:text-foreground hover:bg-gray-50'
                      }`}
                    >
                      {tab.label}
                      <span className={`ml-1.5 text-xs ${activeTab === tab.key ? 'text-white/70' : 'text-muted-foreground'}`}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Stats */}
              {isConnected && filteredLinks.length > 0 && (
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white rounded-xl border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Total</p>
                    <p className="text-2xl font-heading font-bold">{filteredLinks.length}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Paid</p>
                    <p className="text-2xl font-heading font-bold text-emerald-600">{paidCount}</p>
                  </div>
                  <div className="bg-white rounded-xl border border-border p-4">
                    <p className="text-xs text-muted-foreground mb-1">Pending</p>
                    <p className="text-2xl font-heading font-bold text-amber-600">{pendingCount}</p>
                  </div>
                </div>
              )}

              {/* Loading */}
              {isConnected && isLoading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-3" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              )}

              {/* Links List */}
              {isConnected && !isLoading && (
                <div className="space-y-3">
                  {filteredLinks.map(link => (
                    <div 
                      key={link.id} 
                      className="bg-white rounded-xl border border-border p-5 hover:border-blue-200 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                            link.status === 'PAID' 
                              ? 'bg-emerald-50' 
                              : link.expiresAt && Date.now() > link.expiresAt
                                ? 'bg-red-50'
                                : 'bg-blue-50'
                          }`}>
                            <LinkIcon className={`h-5 w-5 ${
                              link.status === 'PAID' 
                                ? 'text-emerald-600' 
                                : link.expiresAt && Date.now() > link.expiresAt
                                  ? 'text-red-500'
                                  : 'text-blue-600'
                            }`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-foreground">
                                {link.amount} {link.token}
                              </h3>
                              {getStatusBadge(link)}
                              {getOriginBadge(link)}
                            </div>
                            {link.description && (
                              <p className="text-sm text-muted-foreground mb-2 truncate">
                                {link.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span>To: <code className="font-mono">{truncateAddress(link.receiver)}</code></span>
                              <span>{link.network.split('(')[0].trim()}</span>
                              <span>{formatDate(link.createdAt)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleCopyLink(link.id)} 
                            className="h-8 w-8 rounded-md hover:bg-blue-50 hover:text-blue-600"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost" 
                            onClick={() => handleViewLink(link.id)}
                            className="h-8 w-8 rounded-md hover:bg-blue-50 hover:text-blue-600"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost" 
                            onClick={() => handleDeleteClick(link.id)} 
                            className="h-8 w-8 rounded-md text-muted-foreground hover:text-destructive hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-border text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{calculateTimeRemaining(link.expiresAt)}</span>
                        </div>
                        {link.status === 'PAID' && link.txHash && (
                          <a 
                            href={`${getExplorerUrl(link.network)}/tx/${link.txHash}`} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <code className="font-mono">{truncateAddress(link.txHash)}</code>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredLinks.length === 0 && (
                    <div className="text-center py-16 bg-white rounded-xl border border-border">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <LinkIcon className="h-5 w-5 text-blue-400" />
                      </div>
                      <h3 className="font-semibold mb-1">No payment links</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {activeTab === 'human' ? 'No human-created links found' : 
                         activeTab === 'agent' ? 'No agent-created links found' :
                         'Create your first link to start receiving payments'}
                      </p>
                      {activeTab !== 'agent' && (
                        <Button 
                          onClick={handleCreateLinkClick} 
                          className="gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                        >
                          <Plus className="h-4 w-4" />
                          Create Link
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>

      <CreateLinkModal open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen} onCreateLink={handleCreateLink} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Delete Payment Link?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The link will no longer accept payments.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete} 
              disabled={isDeleting} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default PaymentLinks;
