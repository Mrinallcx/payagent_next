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
import { toast } from "sonner";

interface AddWalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (wallet: { name: string; address: string }) => void;
}

export function AddWalletModal({ open, onOpenChange, onAdd }: AddWalletModalProps) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");

  const handleAdd = () => {
    if (!name || !address) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!address.startsWith("0x") || address.length < 10) {
      toast.error("Please enter a valid wallet address");
      return;
    }

    onAdd({ name, address });
    setName("");
    setAddress("");
    onOpenChange(false);
    toast.success("Wallet added successfully!");
  };

  const handleClose = () => {
    setName("");
    setAddress("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add New Wallet</DialogTitle>
          <DialogDescription>
            Connect a new wallet to your Payme account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="wallet-name">Wallet Name</Label>
            <Input
              id="wallet-name"
              placeholder="e.g., Main Wallet, Business Account"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wallet-address">Wallet Address</Label>
            <Input
              id="wallet-address"
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter your wallet address (must start with 0x)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add Wallet</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
