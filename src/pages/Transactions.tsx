import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { ArrowDownLeft, ArrowUpRight, Calendar } from "lucide-react";
import { format } from "date-fns";

interface TransactionData {
  id: string;
  type: "received" | "sent";
  amount: string;
  currency: string;
  status: "success" | "pending" | "failed";
  address: string;
  date: Date;
  transactionId: string;
}

const mockTransactions: TransactionData[] = [
  {
    id: "1",
    type: "received",
    amount: "500",
    currency: "USDT",
    status: "success",
    address: "0xaBC744CF9a5D42030A85e69fC2816F033a3AFe7E",
    date: new Date(2025, 10, 18, 14, 30),
    transactionId: "0x1a2b3c4d5e6f7g8h9i0j",
  },
  {
    id: "2",
    type: "sent",
    amount: "250",
    currency: "USDT",
    status: "success",
    address: "TH5hnhU4c5cUoiPuEoeEe7oVgfcdv4sgEb",
    date: new Date(2025, 10, 17, 10, 15),
    transactionId: "0x9i8h7g6f5e4d3c2b1a0j",
  },
  {
    id: "3",
    type: "received",
    amount: "1000",
    currency: "ETH",
    status: "pending",
    address: "0x1234567890AbCdEf1234567890AbCdEf123456",
    date: new Date(2025, 10, 16, 16, 45),
    transactionId: "0xabcdef1234567890abcd",
  },
  {
    id: "4",
    type: "received",
    amount: "150",
    currency: "USDT",
    status: "failed",
    address: "0xaBC744CF9a5D42030A85e69fC2816F033a3AFe7E",
    date: new Date(2025, 10, 15, 9, 20),
    transactionId: "0x456789abcdef01234567",
  },
  {
    id: "5",
    type: "sent",
    amount: "300",
    currency: "USDT",
    status: "success",
    address: "TH5hnhU4c5cUoiPuEoeEe7oVgfcdv4sgEb",
    date: new Date(2025, 10, 14, 11, 0),
    transactionId: "0xfedcba9876543210fedc",
  },
];

const Transactions = () => {
  const [transactions] = useState<TransactionData[]>(mockTransactions);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-50 text-green-700 border-green-200";
      case "pending":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "failed":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-6">
            <div className="max-w-5xl mx-auto">
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">Transactions</h1>
                <p className="text-muted-foreground">View all your payment transactions and their details.</p>
              </div>

              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            transaction.type === "received"
                              ? "bg-green-50 text-green-600"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {transaction.type === "received" ? (
                            <ArrowDownLeft className="h-5 w-5" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <h3 className="text-base font-semibold text-foreground">
                              {transaction.type === "received" ? "Received" : "Sent"}
                            </h3>
                            <Badge
                              variant="outline"
                              className={`text-xs ${getStatusColor(transaction.status)}`}
                            >
                              {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            <span>{format(transaction.date, "MMM dd, yyyy 'at' hh:mm a")}</span>
                          </div>

                          <div className="space-y-1">
                            <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded font-mono block overflow-x-auto">
                              {transaction.address}
                            </code>
                            <p className="text-xs text-muted-foreground">
                              TX: {transaction.transactionId}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:flex-shrink-0">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${
                            transaction.type === "received" ? "text-green-600" : "text-blue-600"
                          }`}>
                            {transaction.type === "received" ? "+" : "-"}{transaction.amount}
                          </p>
                          <p className="text-xs text-muted-foreground">{transaction.currency}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {transactions.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No transactions yet.</p>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Transactions;
