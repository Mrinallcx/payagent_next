import { Plus } from "lucide-react";
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
      <header className="sticky top-0 z-50 h-14 border-b border-border bg-white">
        <div className="flex h-full items-center justify-between px-4 md:px-6">
          <SidebarTrigger />
          
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
              className="gap-2 bg-violet-600 hover:bg-violet-700 rounded-lg h-9"
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
