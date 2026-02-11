import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownLeft, Download, Loader2, ExternalLink, CheckCircle2, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests } from "@/lib/api";
import { getExplorerUrl } from "@/lib/contracts";

const truncateAddress = (addr: string) => {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
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

  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transactions.slice(startIndex, endIndex);
  }, [transactions, currentPage]);

  const tokenTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    transactions.forEach(t => {
      const token = t.token;
      totals[token] = (totals[token] || 0) + parseFloat(t.amount || '0');
    });
    return totals;
  }, [transactions]);

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
      title: "Exported",
      description: "Transactions exported to CSV",
    });
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col bg-slate-50/50">
          <AppNavbar />
          
          <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">History</p>
                <h1 className="text-2xl font-heading font-bold text-foreground">Transactions</h1>
              </div>

              {/* Connect Wallet */}
              {!isConnected ? (
                <div className="bg-white rounded-xl border border-border p-12 text-center">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Connect your wallet to view transaction history
                  </p>
                  <Button 
                    onClick={() => openConnectModal?.()} 
                    className="gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-3" />
                  <p className="text-sm text-muted-foreground">Loading...</p>
                </div>
              ) : transactions.length > 0 ? (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-border p-4">
                      <p className="text-xs text-muted-foreground mb-1">Total</p>
                      <p className="text-2xl font-heading font-bold">{transactions.length}</p>
                    </div>
                    {Object.entries(tokenTotals).slice(0, 3).map(([token, total]) => (
                      <div key={token} className="bg-white rounded-xl border border-border p-4">
                        <p className="text-xs text-muted-foreground mb-1">{token}</p>
                        <p className="text-2xl font-heading font-bold text-emerald-600">
                          {total.toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Export */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={handleExport}
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-lg h-9"
                    >
                      <Download className="h-4 w-4" />
                      Export CSV
                    </Button>
                  </div>

                  {/* Table */}
                  <div className="bg-white border border-border rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-[50px]"></TableHead>
                          <TableHead className="text-xs font-semibold">Details</TableHead>
                          <TableHead className="hidden md:table-cell text-xs font-semibold">Receiver</TableHead>
                          <TableHead className="hidden lg:table-cell text-xs font-semibold">Network</TableHead>
                          <TableHead className="text-right text-xs font-semibold">Amount</TableHead>
                          <TableHead className="text-center w-[80px] text-xs font-semibold">Status</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedTransactions.map((transaction) => (
                          <TableRow key={transaction.id} className="hover:bg-blue-50/50">
                            <TableCell>
                              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">
                                  {transaction.description?.trim() ? transaction.description : 'Payment received'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatDate(transaction.paidAt!)}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <code className="text-xs font-mono text-muted-foreground">
                                {truncateAddress(transaction.receiver)}
                              </code>
                            </TableCell>
                            <TableCell className="hidden lg:table-cell">
                              <span className="text-xs text-muted-foreground">
                                {transaction.network.split('(')[0].trim()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-emerald-600">
                                +{transaction.amount} {transaction.token}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center">
                                <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 text-[10px]">
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
                                  className="p-2 rounded-md hover:bg-blue-50 inline-flex"
                                >
                                  <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                                </a>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-6">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-9 rounded-lg"
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
                            className={`h-9 w-9 p-0 rounded-lg ${currentPage === page ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
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
                        className="h-9 rounded-lg"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-white rounded-xl border border-border p-12 text-center">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <ArrowDownLeft className="h-5 w-5 text-blue-400" />
                  </div>
                  <h3 className="font-semibold mb-1">No transactions</h3>
                  <p className="text-sm text-muted-foreground">
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
