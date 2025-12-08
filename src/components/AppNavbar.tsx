import { Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";
import { CreateLinkModal } from "./CreateLinkModal";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function AppNavbar() {
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  const handleCreateLinkClick = () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setIsCreateLinkOpen(true);
  };

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-border/50 bg-white/80 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="hover:bg-primary/5 rounded-lg" />
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary/5 to-transparent rounded-full">
              <Sparkles className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">Web3 Payment Hub</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ConnectButton 
                accountStatus="address"
                chainStatus="icon"
                showBalance={false}
              />
            </div>
            <Button 
              size="sm" 
              className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/20 rounded-xl"
              onClick={handleCreateLinkClick}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create Link</span>
            </Button>
          </div>
        </div>
      </header>
      
      <CreateLinkModal open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen} />
    </>
  );
}
