import { Plus, Wallet, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface QuickActionsProps {
  onCreateLink: () => void;
  onAddWallet: () => void;
}

export function QuickActions({ onCreateLink, onAddWallet }: QuickActionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card 
        className="p-6 border-border hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
        onClick={onCreateLink}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Plus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Create Payment Link</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Generate a new payment link instantly
            </p>
          </div>
        </div>
      </Card>

      <Card 
        className="p-6 border-border hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5"
        onClick={onAddWallet}
      >
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-full bg-accent/20">
            <Wallet className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Add Wallet</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Connect a new wallet to your account
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border-border hover:shadow-lg transition-all cursor-pointer hover:-translate-y-0.5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-3 rounded-full bg-muted">
            <Settings className="h-6 w-6 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Settings</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Manage your account preferences
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
