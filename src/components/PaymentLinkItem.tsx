import { Link2, Copy, MoreVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";
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

interface PaymentLinkItemProps {
  title: string;
  amount: string;
  clicks: number;
  link: string;
}

export function PaymentLinkItem({ title, amount, clicks, link }: PaymentLinkItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const handleRemoveLink = () => {
    // TODO: Add link removal logic
    console.log("Removing link:", title);
    setShowDeleteDialog(false);
  };

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b last:border-0 border-border">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-accent/20">
            <Link2 className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground">{clicks} clicks</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-primary">${amount}</p>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
            <Copy className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer text-xs"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Remove Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Payment Link?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveLink} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
