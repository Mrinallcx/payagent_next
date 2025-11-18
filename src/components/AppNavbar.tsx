import { Bell, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useState } from "react";
import { CreateLinkModal } from "./CreateLinkModal";

export function AppNavbar() {
  const [isCreateLinkOpen, setIsCreateLinkOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-50 h-16 border-b border-border bg-background">
        <div className="flex h-full items-center justify-between px-6">
          <SidebarTrigger />
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Wallet</span>
            </Button>
            
            <Button
              size="sm"
              className="gap-2"
              onClick={() => setIsCreateLinkOpen(true)}
            >
              <Plus className="h-4 w-4" />
              <span>Create Link</span>
            </Button>
            
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            </Button>
          </div>
        </div>
      </header>
      
      <CreateLinkModal open={isCreateLinkOpen} onOpenChange={setIsCreateLinkOpen} />
    </>
  );
}
