import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { ArrowUpRight, ArrowDownLeft, Download } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";

interface Transaction {
  id: string;
  type: "sent" | "received";
  status: "success" | "pending" | "failed";
  amount: string;
  date: string;
  from: string;
  recipient: string;
}

const statusConfig = {
  success: {
    color: "bg-success/10 text-success border-success/20",
    label: "Success",
  },
  pending: {
    color: "bg-warning/10 text-warning border-warning/20",
    label: "Pending",
  },
  failed: {
    color: "bg-destructive/10 text-destructive border-destructive/20",
    label: "Failed",
  },
};

const mockTransactions: Transaction[] = [
  {
    id: "1",
    type: "received",
    status: "success",
    amount: "1,250.00",
    date: "2025-01-15 10:30 AM",
    from: "0x456a...7c9d",
    recipient: "0x742d...4e8a",
  },
  {
    id: "2",
    type: "sent",
    status: "success",
    amount: "500.00",
    date: "2025-01-14 03:45 PM",
    from: "0x742d...4e8a",
    recipient: "0x893f...2b1c",
  },
  {
    id: "3",
    type: "received",
    status: "pending",
    amount: "750.00",
    date: "2025-01-13 09:15 AM",
    from: "0x123b...5e6f",
    recipient: "0x456a...7c9d",
  },
  {
    id: "4",
    type: "sent",
    status: "failed",
    amount: "200.00",
    date: "2025-01-12 02:20 PM",
    from: "0x742d...4e8a",
    recipient: "0x893f...2b1c",
  },
  {
    id: "5",
    type: "received",
    status: "success",
    amount: "2,100.00",
    date: "2025-01-11 11:00 AM",
    from: "0x789c...1a2b",
    recipient: "0x123b...5e6f",
  },
];

const Transactions = () => {
  const { toast } = useToast();
  const [transactions] = useState<Transaction[]>(mockTransactions);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      const matchesType = typeFilter === "all" || transaction.type === typeFilter;
      const matchesStatus = statusFilter === "all" || transaction.status === statusFilter;
      return matchesType && matchesStatus;
    });
  }, [transactions, typeFilter, statusFilter]);

  // Paginate transactions
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredTransactions.slice(startIndex, endIndex);
  }, [filteredTransactions, currentPage]);

  // Export to CSV
  const handleExport = () => {
    const headers = ["Type", "From", "Recipient", "Date", "Amount", "Status"];
    const csvData = filteredTransactions.map((t) => [
      t.type,
      t.from,
      t.recipient,
      t.date,
      `${t.type === "sent" ? "-" : "+"}$${t.amount}`,
      statusConfig[t.status].label,
    ]);

    const csvContent = [
      headers.join(","),
      ...csvData.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
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
                <p className="text-sm text-muted-foreground">View all your payment transactions</p>
              </div>

              {/* Filters and Export */}
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="sent">Sent</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  onClick={handleExport}
                  variant="outline"
                  className="ml-auto"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead className="hidden sm:table-cell">From</TableHead>
                        <TableHead>Recipient</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((transaction) => {
                        const TypeIcon = transaction.type === "sent" ? ArrowUpRight : ArrowDownLeft;
                        
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <div className={`p-1.5 rounded-md ${transaction.type === "sent" ? "bg-muted" : "bg-primary/10"}`}>
                                <TypeIcon className={`h-3 w-3 ${transaction.type === "sent" ? "text-foreground" : "text-primary"}`} />
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground">{transaction.from}</span>
                            </TableCell>
                            <TableCell>
                              <div>
                                <span className="text-xs text-muted-foreground">{transaction.recipient}</span>
                                <p className="text-xs text-muted-foreground md:hidden mt-1">{transaction.date}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">{transaction.date}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className="text-sm font-semibold text-foreground">
                                {transaction.type === "sent" ? "-" : "+"} ${transaction.amount}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center">
                                <Badge variant="outline" className={`text-xs ${statusConfig[transaction.status].color}`}>
                                  {statusConfig[transaction.status].label}
                                </Badge>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Pagination */}
              {filteredTransactions.length > itemsPerPage && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            onClick={() => setCurrentPage(page)}
                            isActive={currentPage === page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}

                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}

              {filteredTransactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No transactions found</p>
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
