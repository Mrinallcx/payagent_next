import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface WalletData {
  id: string;
  address: string;
  tokens: string[];
}

const mockWallets: WalletData[] = [
  {
    id: "1",
    address: "0xaBC744CF9a5D42030A85e69fC2816F033a3AFe7E",
    tokens: ["USDT", "ERC20"],
  },
  {
    id: "2",
    address: "TH5hnhU4c5cUoiPuEoeEe7oVgfcdv4sgEb",
    tokens: ["USDT", "TRC20"],
  },
  {
    id: "3",
    address: "0x1234567890AbCdEf1234567890AbCdEf123456",
    tokens: ["ETH", "ERC20"],
  },
];

const Wallets = () => {
  const [wallets, setWallets] = useState<WalletData[]>(mockWallets);
  const maxSlots = 10;
  const availableSlots = maxSlots - wallets.length;

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Wallet address copied to clipboard!");
  };

  const handleDeleteWallet = (id: string) => {
    setWallets(wallets.filter((wallet) => wallet.id !== id));
    toast.success("Wallet removed successfully");
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
                <p className="text-sm text-muted-foreground mb-6">
                  Manage your wallet addresses and supported tokens
                </p>

                <div className="bg-card border border-border rounded-lg p-6 mb-6">
                  <h2 className="text-xl font-semibold text-foreground mb-2">Your Wallets</h2>
                  <p className="text-sm text-muted-foreground">
                    Add and manage wallet addresses for receiving payments
                  </p>
                </div>

                <div className="space-y-4">
                  {wallets.map((wallet) => (
                    <div
                      key={wallet.id}
                      className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <div className="w-6 h-6 rounded-full bg-primary/20" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground mb-1 break-all">
                            {wallet.address}
                          </p>
                          <div className="flex gap-2">
                            {wallet.tokens.map((token) => (
                              <Badge
                                key={token}
                                variant="secondary"
                                className="text-xs bg-muted text-foreground hover:bg-muted"
                              >
                                {token}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyAddress(wallet.address)}
                          className="gap-2"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteWallet(wallet.id)}
                          className="gap-2 text-destructive hover:text-destructive border-destructive/50"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  <button className="w-full bg-card border border-border rounded-lg p-4 flex items-center justify-center gap-2 text-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      Add New Wallet ({availableSlots} slots available)
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Wallets;
