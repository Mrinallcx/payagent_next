import { Wallet, Copy, Trash2, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";

interface WalletCardProps {
  id: string;
  name: string;
  address: string;
  balance: string;
  currency: string;
  onDelete: (id: string) => void;
}

export function WalletCard({ id, name, address, balance, currency, onDelete }: WalletCardProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    toast.success("Wallet address copied to clipboard!");
  };

  const handleDelete = () => {
    onDelete(id);
    setShowDeleteDialog(false);
    toast.success("Wallet deleted successfully");
  };

  return (
    <>
      <Card className="p-6 border-border shadow-sm hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/10">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">{name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground font-mono">{address}</p>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7"
                  onClick={handleCopy}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        <div className="mb-4 p-4 bg-muted rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Balance</p>
          <p className="text-3xl font-bold text-foreground">${balance}</p>
          <p className="text-xs text-muted-foreground mt-1">{currency}</p>
        </div>

        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 gap-2">
            <ArrowUpRight className="h-4 w-4" />
            Send
          </Button>
          <Button size="sm" variant="outline" className="flex-1 gap-2">
            <ArrowDownLeft className="h-4 w-4" />
            Receive
          </Button>
        </div>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Wallet</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{name}"? This action cannot be undone.
              Make sure you have backed up your wallet information before deleting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
