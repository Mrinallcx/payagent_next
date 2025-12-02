import { Link2, Copy, MoreVertical, Trash2, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { deletePaymentRequest } from "@/lib/api";

interface PaymentLinkItemProps {
  id: string;
  title: string;
  amount: string;
  token: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  link: string;
  onDelete?: () => void;
}

export function PaymentLinkItem({ id, title, amount, token, status, link, onDelete }: PaymentLinkItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const handleRemoveLink = async () => {
    setIsDeleting(true);
    try {
      await deletePaymentRequest(id);
      toast.success("Payment link deleted");
      onDelete?.();
    } catch (error) {
      console.error("Error deleting link:", error);
      toast.error("Failed to delete link");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'PAID':
        return (
          <Badge className="bg-green-500/10 text-green-600 border-0 text-[10px] h-5">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge className="bg-red-500/10 text-red-500 border-0 text-[10px] h-5">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-0 text-[10px] h-5">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-3 border-b last:border-0 border-border">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            status === 'PAID' 
              ? 'bg-green-500/10' 
              : status === 'EXPIRED'
              ? 'bg-red-500/10'
              : 'bg-accent/20'
          }`}>
            <Link2 className={`h-4 w-4 ${
              status === 'PAID'
                ? 'text-green-600'
                : status === 'EXPIRED'
                ? 'text-red-500'
                : 'text-accent-foreground'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-foreground">{amount} {token}</p>
              {getStatusBadge()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
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
              Are you sure you want to remove this {amount} {token} payment link? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveLink} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
