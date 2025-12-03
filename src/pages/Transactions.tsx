import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowDownLeft, Download, Loader2, ExternalLink, Receipt, CheckCircle2, Wallet } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getAllPaymentRequests, PaymentRequest } from "@/lib/api";

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
  const [transactions, setTransactions] = useState<PaymentRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const fetchTransactions = useCallback(async () => {
    // Only fetch if wallet is connected
    if (!isConnected || !address) {
      setTransactions([]);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch payment requests for this wallet and filter for PAID ones
      const response = await getAllPaymentRequests(address);
      const paidTransactions = response.requests.filter(r => r.status === 'PAID');
      setTransactions(paidTransactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [address, isConnected]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Clear data when wallet disconnects
  useEffect(() => {
    if (!isConnected) {
      setTransactions([]);
    }
  }, [isConnected]);

  // Paginate transactions
  const totalPages = Math.ceil(transactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transactions.slice(startIndex, endIndex);
  }, [transactions, currentPage]);

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
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-3 sm:p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-4 sm:mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">Transactions</h1>
                <p className="text-sm text-muted-foreground">
                  {isConnected 
                    ? 'Completed payments made through PayMe'
                    : 'Connect your wallet to view your transactions'}
                </p>
              </div>

              {/* Connect Wallet Prompt */}
              {!isConnected ? (
                <div className="bg-card border rounded-xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Wallet className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
                    Connect your wallet to view your transaction history
                  </p>
                  <Button onClick={() => openConnectModal?.()} className="gap-2">
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : transactions.length > 0 ? (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">Total Transactions</p>
                      <p className="text-2xl font-bold">{transactions.length}</p>
                    </div>
                    <div className="bg-card border rounded-xl p-4">
                      <p className="text-sm text-muted-foreground mb-1">Total Received</p>
                      <p className="text-2xl font-bold text-green-600">
                        {transactions.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0).toFixed(2)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">USDC</span>
                      </p>
                    </div>
                  </div>

                  {/* Export Button */}
                  <div className="flex justify-end mb-4">
                    <Button
                      onClick={handleExport}
                      variant="outline"
                      size="sm"
                      className="h-8"
                    >
                      <Download className="h-3 w-3 mr-2" />
                      Export CSV
                    </Button>
                  </div>

                  <div className="bg-card border border-border rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]"></TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead className="hidden md:table-cell">Receiver</TableHead>
                            <TableHead className="hidden lg:table-cell">Network</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead className="text-center w-[100px]">Status</TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {paginatedTransactions.map((transaction) => (
                            <TableRow key={transaction.id}>
                              <TableCell>
                                <div className="p-1.5 rounded-md bg-green-500/10">
                                  <ArrowDownLeft className="h-3 w-3 text-green-600" />
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="text-sm font-medium">
                                    {transaction.description || `Payment ${transaction.id}`}
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
                                <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                                  {truncateAddress(transaction.receiver)}
                                </code>
                              </TableCell>
                              <TableCell className="hidden lg:table-cell">
                                <span className="text-xs text-muted-foreground">
                                  {transaction.network.split('(')[0].trim()}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-sm font-semibold text-green-600">
                                  +{transaction.amount} {transaction.token}
                                </span>
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center">
                                  <Badge className="bg-green-500/10 text-green-600 border-0 text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell>
                                {transaction.txHash && (
                                  <a
                                    href={`https://sepolia.etherscan.io/tx/${transaction.txHash}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 rounded-md hover:bg-muted inline-flex"
                                    title="View on Etherscan"
                                  >
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
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
                    <div className="flex items-center justify-center gap-1 mt-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="h-8 text-xs"
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
                            className="h-8 w-8 p-0 text-xs"
                          >
                            {page}
                          </Button>
                        ))}
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="h-8 text-xs"
                      >
                        Next
                      </Button>
                    </div>
                  )}
                </>
              ) : (
                <div className="bg-card border rounded-xl p-12 text-center">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                    <Receipt className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No transactions yet</h3>
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
