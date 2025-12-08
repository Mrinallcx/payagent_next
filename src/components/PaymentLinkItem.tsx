import { Link2, Copy, MoreVertical, Trash2, CheckCircle2, Clock, XCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    toast.success("Link copied to clipboard!");
  };

  const handleOpenLink = () => {
    navigate(`/pay/${id}`);
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
          <Badge className="bg-green-500 text-white border-0 text-[10px] shadow-sm shadow-green-500/30">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case 'EXPIRED':
        return (
          <Badge className="bg-red-500 text-white border-0 text-[10px] shadow-sm shadow-red-500/30">
            <XCircle className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge className="bg-amber-500 text-white border-0 text-[10px] shadow-sm shadow-amber-500/30">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <>
      <div className="flex items-center justify-between py-3 px-3 -mx-3 rounded-xl hover:bg-primary/5 transition-all group border-b last:border-0 border-border/50">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl transition-transform group-hover:scale-110 ${
            status === 'PAID' 
              ? 'bg-gradient-to-br from-green-500/10 to-emerald-500/20' 
              : status === 'EXPIRED' 
              ? 'bg-gradient-to-br from-red-500/10 to-rose-500/20' 
              : 'bg-gradient-to-br from-primary/10 to-blue-500/20'
          }`}>
            <Link2 className={`h-4 w-4 ${
              status === 'PAID' ? 'text-green-600' : status === 'EXPIRED' ? 'text-red-500' : 'text-primary'
            }`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-bold text-foreground">{amount} {token}</p>
              {getStatusBadge()}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" 
            onClick={handleCopy}
          >
            <Copy className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" 
            onClick={handleOpenLink}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 rounded-xl">
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive cursor-pointer text-xs rounded-lg"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Remove Link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading">Remove Payment Link?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this {amount} {token} payment link? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleRemoveLink} 
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
            >
              {isDeleting ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
