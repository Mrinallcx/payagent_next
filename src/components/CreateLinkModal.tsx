import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface CreateLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateLinkModal({ open, onOpenChange }: CreateLinkModalProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const handleCreate = () => {
    if (!amount || !description) {
      toast.error("Please fill in all fields");
      return;
    }
    
    const link = `https://payme.app/pay/${Math.random().toString(36).substring(7)}`;
    setGeneratedLink(link);
    toast.success("Payment link created!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard!");
  };

  const handleClose = () => {
    setAmount("");
    setDescription("");
    setGeneratedLink("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Payment Link</DialogTitle>
          <DialogDescription>
            Generate a payment link to share with your customers
          </DialogDescription>
        </DialogHeader>
        
        {!generatedLink ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="What is this payment for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your payment link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-foreground break-all">{generatedLink}</code>
                <Button size="icon" variant="ghost" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
        
        <DialogFooter>
          {!generatedLink ? (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleCreate}>Create Link</Button>
            </>
          ) : (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
