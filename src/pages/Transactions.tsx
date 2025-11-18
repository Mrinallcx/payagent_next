import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";

interface Transaction {
  id: string;
  type: "sent" | "received";
  status: "success" | "pending" | "failed";
  amount: string;
  description: string;
  date: string;
  recipient?: string;
}

const statusConfig = {
  success: {
    icon: CheckCircle2,
    color: "text-success",
    label: "Success",
  },
  pending: {
    icon: Clock,
    color: "text-warning",
    label: "Pending",
  },
  failed: {
    icon: XCircle,
    color: "text-destructive",
    label: "Failed",
  },
};

const mockTransactions: Transaction[] = [
  {
    id: "1",
    type: "received",
    status: "success",
    amount: "1,250.00",
    description: "Payment from Client A",
    date: "2025-01-15 10:30 AM",
    recipient: "0x742d...4e8a",
  },
  {
    id: "2",
    type: "sent",
    status: "success",
    amount: "500.00",
    description: "Transfer to Wallet B",
    date: "2025-01-14 03:45 PM",
    recipient: "0x893f...2b1c",
  },
  {
    id: "3",
    type: "received",
    status: "pending",
    amount: "750.00",
    description: "Payment Link #1234",
    date: "2025-01-13 09:15 AM",
    recipient: "0x456a...7c9d",
  },
  {
    id: "4",
    type: "sent",
    status: "failed",
    amount: "200.00",
    description: "Withdrawal to Bank",
    date: "2025-01-12 02:20 PM",
    recipient: "Bank Account",
  },
  {
    id: "5",
    type: "received",
    status: "success",
    amount: "2,100.00",
    description: "Subscription Payment",
    date: "2025-01-11 11:00 AM",
    recipient: "0x123b...5e6f",
  },
];

const Transactions = () => {
  const [transactions] = useState<Transaction[]>(mockTransactions);

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

              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Type</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="hidden sm:table-cell">Recipient</TableHead>
                        <TableHead className="hidden md:table-cell">Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-center w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => {
                        const StatusIcon = statusConfig[transaction.status].icon;
                        const TypeIcon = transaction.type === "sent" ? ArrowUpRight : ArrowDownLeft;
                        
                        return (
                          <TableRow key={transaction.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`p-1.5 rounded-md ${transaction.type === "sent" ? "bg-muted" : "bg-primary/10"}`}>
                                  <TypeIcon className={`h-3 w-3 ${transaction.type === "sent" ? "text-foreground" : "text-primary"}`} />
                                </div>
                                <span className="text-xs font-medium capitalize hidden sm:inline">
                                  {transaction.type}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium text-foreground">{transaction.description}</p>
                                <p className="text-xs text-muted-foreground md:hidden">{transaction.date}</p>
                              </div>
                            </TableCell>
                            <TableCell className="hidden sm:table-cell">
                              <span className="text-xs text-muted-foreground">{transaction.recipient}</span>
                            </TableCell>
                            <TableCell className="hidden md:table-cell">
                              <span className="text-xs text-muted-foreground">{transaction.date}</span>
                            </TableCell>
                            <TableCell className="text-right">
                              <span className={`text-sm font-semibold ${transaction.type === "sent" ? "text-foreground" : "text-primary"}`}>
                                {transaction.type === "sent" ? "-" : "+"} ${transaction.amount}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center justify-center gap-1">
                                <StatusIcon className={`h-3 w-3 ${statusConfig[transaction.status].color}`} />
                                <span className={`text-xs font-medium capitalize ${statusConfig[transaction.status].color}`}>
                                  {statusConfig[transaction.status].label}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {transactions.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No transactions yet</p>
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
