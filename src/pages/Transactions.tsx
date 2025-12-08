import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownLeft, Download, Loader2, ExternalLink, Receipt, CheckCircle2, Wallet, ArrowRight, TrendingUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests } from "@/lib/api";
import { getExplorerUrl } from "@/lib/contracts";

const truncateAddress = (addr: string) => {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const truncateHash = (hash: string) => {
  if (!hash) return '';
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Transactions = () => {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // React Query for fetching transactions
  const { data, isLoading } = useQuery({
    queryKey: ['transactions', address],
    queryFn: () => getAllPaymentRequests(address!),
    enabled: isConnected && !!address,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
    select: (data) => data.requests.filter(r => r.status === 'PAID'),
  });

  const transactions = data ?? [];

  // Paginate transactions
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transactions.slice(startIndex, endIndex);
  }, [transactions, currentPage]);

  // Calculate totals by token
  const tokenTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions.forEach(t => {
      const token = t.token;
      totals[token] = (totals[token] || 0) + parseFloat(t.amount || '0');
    });
    return totals;
  }, [transactions]);

  // Export to CSV
  const handleExport = () => {
    const headers = ["Date", "Amount", "Token", "Network", "Receiver", "TxHash"];
    const csvData = transactions.map((t) => [
      formatDate(t.paidAt!),
      t.amount,
      t.token,
      t.network,
      t.receiver,
      t.txHash || ''
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payme-transactions-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "Your transactions have been exported to CSV.",
    });
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
          
          <main className="flex-1 p-3 sm:p-6 relative z-10">
            <div className="max-w-7xl mx-auto">
              <div className="mb-6 sm:mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/80 backdrop-blur-sm rounded-full border border-primary/10 shadow-sm mb-4">
                  <TrendingUp className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium text-foreground/70">Transaction History</span>
                </div>
                <h1 className="text-3xl sm:text-4xl font-heading font-bold text-foreground mb-2">Transactions</h1>
                <p className="text-muted-foreground">
                  {isConnected 
                    ? 'Completed payments made through PayMe'
                    : 'Connect your wallet to view your transactions'}
                </p>
              </div>

              {/* Connect Wallet Prompt */}
              {!isConnected ? (
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-12 text-center shadow-xl shadow-primary/5 border border-white/50">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/20 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-primary/10">
                    <Wallet className="h-10 w-10 text-primary" />
                  </div>
                  <h3 className="text-2xl font-heading font-bold mb-3">Connect Your Wallet</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    Connect your wallet to view your transaction history
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
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                  <p className="text-muted-foreground">Loading transactions...</p>
                </div>
              ) : transactions.length > 0 ? (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-lg">
                      <p className="text-sm text-gray-500 mb-1 font-medium">Total Transactions</p>
                      <p className="text-3xl font-heading font-bold text-gray-900">{transactions.length}</p>
                    </div>
                    {Object.entries(tokenTotals).slice(0, 3).map(([token, total]) => (
                      <div key={token} className="bg-green-50 rounded-2xl p-5 border border-green-200 shadow-lg">
                        <p className="text-sm text-green-700 mb-1 font-medium">Total {token}</p>
                        <p className="text-3xl font-heading font-bold text-green-600">
                          {total.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Export Button */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={handleExport}
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl hover:bg-primary/5 hover:border-primary/30 gap-2 transition-all"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>

                  <div className="bg-white/80 backdrop-blur-sm border border-border/50 rounded-2xl overflow-hidden shadow-lg shadow-primary/5">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border/50 hover:bg-transparent">
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead className="font-heading font-bold">Details</TableHead>
                            <TableHead className="hidden md:table-cell font-heading font-bold">Receiver</TableHead>
                            <TableHead className="hidden lg:table-cell font-heading font-bold">Network</TableHead>
                            <TableHead className="text-right font-heading font-bold">Amount</TableHead>
                            <TableHead className="text-center w-[100px] font-heading font-bold">Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTransactions.map((transaction) => (
                            <TableRow key={transaction.id} className="border-border/30 hover:bg-gradient-to-r hover:from-transparent hover:to-green-500/5 transition-colors">
                              <TableCell>
                                <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-500/20 shadow-sm">
                                  <ArrowDownLeft className="h-4 w-4 text-green-600" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-semibold">
                                    {transaction.description?.trim() ? transaction.description : 'Payment received'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatDate(transaction.paidAt!)}
                                  </p>
                                  {transaction.txHash && (
                                    <code className="text-[10px] text-muted-foreground font-mono md:hidden">
                                      {truncateHash(transaction.txHash)}
                                    </code>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                <code className="text-xs font-mono bg-muted/50 px-2.5 py-1 rounded-lg">
                                  {truncateAddress(transaction.receiver)}
                                </code>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg inline-block">
                                  {transaction.network.split('(')[0].trim()}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-bold text-green-600">
                                  +{transaction.amount} {transaction.token}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Badge className="bg-green-500 text-white border-0 shadow-md shadow-green-500/30 text-xs font-semibold">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                {transaction.txHash && (
                                  <a
                                    href={`${getExplorerUrl(transaction.network)}/tx/${transaction.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-lg hover:bg-muted transition-colors inline-flex"
                                    title="View on Explorer"
                                  >
                                    <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
                                  </a>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-9 text-xs rounded-xl hover:bg-primary/5"
                      >
                        Previous
                      </Button>
                      
                      <div className="flex items-center gap-1 px-2">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((page) => (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className={`h-9 w-9 p-0 text-xs rounded-xl ${currentPage === page ? 'bg-gradient-to-r from-primary to-secondary shadow-md' : 'hover:bg-primary/5'}`}
                          >
                            {page}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-9 text-xs rounded-xl hover:bg-primary/5"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white/90 backdrop-blur-xl rounded-3xl p-12 text-center shadow-xl shadow-primary/5 border border-white/50">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <Receipt className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <h3 className="text-xl font-heading font-bold mb-2">No transactions yet</h3>
                  <p className="text-muted-foreground">
                    Completed payments will appear here
                  </p>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Transactions;
