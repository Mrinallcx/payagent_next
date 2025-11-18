import { Wallet, Settings, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
interface WalletItemProps {
  name: string;
  address: string;
  balance: string;
  currency: string;
}
export function WalletItem({
  name,
  address,
  balance,
  currency
}: WalletItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleRemoveWallet = () => {
    // TODO: Add wallet removal logic
    console.log("Removing wallet:", name);
    setShowDeleteDialog(false);
  };

  return <>
    <div className="p-2 bg-muted rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-3 w-3 text-primary" />
          <div>
            <p className="text-xs font-medium text-foreground">{name}</p>
            <p className="text-[10px] text-muted-foreground">{address}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-5 w-5">
              <Settings className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem 
              className="text-destructive focus:text-destructive cursor-pointer text-xs"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3 w-3 mr-2" />
              Remove Wallet
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      <div className="mt-1.5 pl-5">
        <p className="text-base font-bold text-foreground">${balance}</p>
        <p className="text-[10px] text-muted-foreground">{currency}</p>
      </div>
    </div>

    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove Wallet?</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to remove "{name}"? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRemoveWallet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}