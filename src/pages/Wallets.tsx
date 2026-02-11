import { useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { AddWalletModal } from "@/components/AddWalletModal";
import { Button } from "@/components/ui/button";

interface WalletData {
  id: string;
  address: string;
  tokens: string[];
}

const mockWallets: WalletData[] = [];

const Wallets = () => {
  const [wallets, setWallets] = useState<WalletData[]>(mockWallets);
  const [isAddWalletOpen, setIsAddWalletOpen] = useState(false);
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

  const handleAddWallet = (wallet: { token: string; network: string; address: string }) => {
    const newWallet: WalletData = {
      id: Date.now().toString(),
      address: wallet.address,
      tokens: [wallet.token, wallet.network],
    };
    setWallets([...wallets, newWallet]);
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

              <div className="space-y-3">
                {wallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="bg-card border border-border rounded-lg p-4 hover:border-primary/20 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 overflow-x-auto">
                          <code className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded font-mono">
                            {wallet.address}
                          </code>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {wallet.tokens.map((token) => (
                            <Badge
                              key={token}
                              variant="secondary"
                              className="bg-primary/10 text-primary hover:bg-primary/20 text-xs"
                            >
                              {token}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 sm:flex-shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCopyAddress(wallet.address)}
                          className="gap-1.5 h-8 text-xs"
                        >
                          <Copy className="h-3 w-3" />
                          <span className="hidden sm:inline">Copy</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteWallet(wallet.id)}
                          className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive border-destructive/50"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span className="hidden sm:inline">Remove</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                  <button 
                    onClick={() => setIsAddWalletOpen(true)}
                    className="w-full bg-card border border-border rounded-lg p-4 flex items-center justify-center gap-2 text-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors"
                  >
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

      <AddWalletModal
        open={isAddWalletOpen}
        onOpenChange={setIsAddWalletOpen}
        onAddWallet={handleAddWallet}
      />
    </SidebarProvider>
  );
};

export default Wallets;
