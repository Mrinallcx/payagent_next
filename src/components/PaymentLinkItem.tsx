import { Link2, Copy, MoreVertical, Trash2, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
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
import { deletePaymentRequest, walletLogin, isJwtValid } from "@/lib/api";

interface PaymentLinkItemProps {
  id: string;
  title: string;
  amount: string;
  token: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  link: string;
  onDelete?: () => void;
}

export function PaymentLinkItem({ id, amount, token, status, link, onDelete }: PaymentLinkItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied");
  };

  const handleOpenLink = () => {
    navigate(`/pay/${id}`);
  };

  const handleRemoveLink = async () => {
    setIsDeleting(true);
    try {
      // Auto-login with wallet if no JWT session
      if (!isJwtValid() && address) {
        toast.info("Please sign the message to verify your wallet");
        await walletLogin(address, async (msg: string) => signMessageAsync({ message: msg }));
      }

      await deletePaymentRequest(id);
      toast.success("Payment link deleted");
      onDelete?.();
    } catch (error: any) {
      console.error("Error deleting link:", error);
      if (error?.message === 'WALLET_LOGIN_REQUIRED') {
        toast.error("Wallet verification required. Please try again.");
      } else {
        toast.error(error?.message || "Failed to delete link");
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'PAID':
        return (
          <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-0 text-[10px] font-medium">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge variant="secondary" className="bg-red-50 text-red-700 border-0 text-[10px] font-medium">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-0 text-[10px] font-medium">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-3.5 border-b last:border-0 border-border/50 group">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
            status === 'PAID' 
              ? 'bg-emerald-50' 
              : status === 'EXPIRED' 
              ? 'bg-red-50' 
              : 'bg-blue-50'
          }`}>
            <Link2 className={`h-4 w-4 ${
              status === 'PAID' ? 'text-emerald-600' : status === 'EXPIRED' ? 'text-red-500' : 'text-blue-600'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{amount} {token}</p>
              {getStatusBadge()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-md hover:bg-blue-50 hover:text-blue-600" 
            onClick={handleCopy}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-md hover:bg-blue-50 hover:text-blue-600" 
            onClick={handleOpenLink}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-slate-100">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 rounded-lg">
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer text-xs rounded-md"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Remove Payment Link?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the {amount} {token} payment link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveLink} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
