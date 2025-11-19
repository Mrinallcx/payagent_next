import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { DashboardCard } from "@/components/DashboardCard";
import { TransactionItem } from "@/components/TransactionItem";
import { PaymentLinkItem } from "@/components/PaymentLinkItem";
import { WalletItem } from "@/components/WalletItem";
import { QuickActions } from "@/components/QuickActions";
import { CreateLinkModal } from "@/components/CreateLinkModal";
import { AddWalletModal } from "@/components/AddWalletModal";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const mockTransactions = [
  { type: "received" as const, status: "success" as const, amount: "1,250.00", description: "Client Payment - Website Design", date: "Today, 2:30 PM" },
  { type: "sent" as const, status: "success" as const, amount: "450.00", description: "Subscription Fee", date: "Yesterday, 9:15 AM" },
  { type: "received" as const, status: "pending" as const, amount: "800.00", description: "Freelance Project", date: "2 days ago" },
  { type: "sent" as const, status: "failed" as const, amount: "125.00", description: "Software License", date: "3 days ago" },
];

const mockPaymentLinks = [
  { title: "Website Package", amount: "2,500.00", clicks: 12, link: "https://payme.app/pay/abc123" },
  { title: "Consulting Session", amount: "250.00", clicks: 5, link: "https://payme.app/pay/def456" },
  { title: "Monthly Retainer", amount: "1,500.00", clicks: 8, link: "https://payme.app/pay/ghi789" },
];

const mockWallets = [
  { name: "Main Wallet", address: "0xAb3...9dE1", balance: "5,420.50", currency: "USD" },
  { name: "Business Account", address: "0x7Fc...3Aa9", balance: "12,350.00", currency: "USD" },
  { name: "Savings Wallet", address: "0x2Bd...7Ff2", balance: "8,750.25", currency: "USD" },
];

const Index = () => {
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);

  const handleAddWallet = (wallet: { token: string; network: string; address: string }) => {
    toast({
      title: "Wallet Added",
      description: `${wallet.token} wallet on ${wallet.network} network added successfully.`,
    });
    setIsAddWalletOpen(false);
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col">
          <AppNavbar />
          
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
                <p className="text-muted-foreground">Welcome back! Here's what's happening with your payments.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <DashboardCard 
                  title="Recent Transactions"
                  action={
                    <Button variant="ghost" size="sm" className="text-xs">
                      View All
                    </Button>
                  }
                >
                  <div className="space-y-1">
                    {mockTransactions.map((transaction, i) => (
                      <TransactionItem key={i} {...transaction} />
                    ))}
                  </div>
                </DashboardCard>

                <DashboardCard 
                  title="Payment Links"
                  action={
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-1"
                      onClick={() => setIsCreateLinkOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                      New
                    </Button>
                  }
                >
                  <div className="space-y-1">
                    {mockPaymentLinks.map((link, i) => (
                      <PaymentLinkItem key={i} {...link} />
                    ))}
                  </div>
                </DashboardCard>

                <DashboardCard 
                  title="Payment Wallets"
                  action={
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs gap-1"
                      onClick={() => setIsAddWalletOpen(true)}
                    >
                      <Plus className="h-3 w-3" />
                      Add
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    {mockWallets.map((wallet, i) => (
                      <WalletItem key={i} {...wallet} />
                    ))}
                  </div>
                </DashboardCard>
              </div>

              <QuickActions onCreateLink={() => setIsCreateLinkOpen(true)} />
            </div>
          </main>
        </div>
      </div>
      
      <CreateLinkModal open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen} />
      <AddWalletModal 
        open={isAddWalletOpen} 
        onOpenChange={setIsAddWalletOpen}
        onAddWallet={handleAddWallet}
      />
    </SidebarProvider>
  );
};

export default Index;
