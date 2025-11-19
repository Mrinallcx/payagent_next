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
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";
import { toast } from "sonner";

interface CreateLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLink?: (linkData: {
    title: string;
    description: string;
    amount: string;
    token: string;
    network: string;
    expiresInDays: number;
    link: string;
  }) => void;
}

type Step = "amount-token" | "network" | "expiration" | "details" | "generated";

const TOKENS = ["ETH", "LCX", "USDT", "BASE", "SOL", "BTC"];
const NETWORKS = ["ETH", "BASE", "SOL", "BNB (BEP20)"];

export function CreateLinkModal({ open, onOpenChange, onCreateLink }: CreateLinkModalProps) {
  const [step, setStep] = useState<Step>("amount-token");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");

  const handleContinueToNetwork = () => {
    if (!amount || !selectedToken) {
      toast.error("Please enter amount and select a token");
      return;
    }
    setStep("network");
  };

  const handleContinueToExpiration = () => {
    if (!selectedNetworks.length) {
      toast.error("Please select at least one network");
      return;
    }
    setStep("expiration");
  };

  const handleContinueToDetails = () => {
    if (!expiresInDays) {
      toast.error("Please enter expiration days");
      return;
    }
    setStep("details");
  };

  const handleCreate = () => {
    if (!title || !description) {
      toast.error("Please fill in title and description");
      return;
    }
    
    const link = `https://payme.app/pay/${Math.random().toString(36).substring(7)}`;
    setGeneratedLink(link);
    
    if (onCreateLink) {
      onCreateLink({
        title,
        description,
        amount,
        token: selectedToken,
        network: selectedNetworks.join(", "),
        expiresInDays: parseInt(expiresInDays),
        link,
      });
    }

    setStep("generated");
    toast.success("Payment link created!");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Link copied to clipboard!");
  };

  const handleBack = () => {
    if (step === "network") setStep("amount-token");
    else if (step === "expiration") setStep("network");
    else if (step === "details") setStep("expiration");
  };

  const handleClose = () => {
    setStep("amount-token");
    setAmount("");
    setSelectedToken("");
    setSelectedNetworks([]);
    setExpiresInDays("");
    setTitle("");
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
            {step === "amount-token" && "Enter amount and select token"}
            {step === "network" && "Select networks for payment"}
            {step === "expiration" && "Set link expiration"}
            {step === "details" && "Add title and description"}
            {step === "generated" && "Your payment link is ready"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {step === "amount-token" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Select Token</Label>
                <div className="grid grid-cols-3 gap-2">
                  {TOKENS.map((token) => (
                    <Button
                      key={token}
                      type="button"
                      variant={selectedToken === token ? "default" : "outline"}
                      className="w-full"
                      onClick={() => setSelectedToken(token)}
                    >
                      {token}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}

          {step === "network" && (
            <div className="space-y-2">
              <Label>Select Networks</Label>
              <div className="grid grid-cols-2 gap-2">
                {NETWORKS.map((network) => {
                  const isSelected = selectedNetworks.includes(network);
                  return (
                    <Button
                      key={network}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      className="w-full"
                      onClick={() => {
                        setSelectedNetworks((prev) =>
                          prev.includes(network)
                            ? prev.filter((n) => n !== network)
                            : [...prev, network]
                        );
                      }}
                    >
                      {network}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "expiration" && (
            <div className="space-y-2">
              <Label htmlFor="expires">Expires in (days)</Label>
              <Input
                id="expires"
                type="number"
                placeholder="7"
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>
          )}

          {step === "details" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Payment for..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Additional details about this payment"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </>
          )}

          {step === "generated" && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">Your payment link:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm text-foreground break-all">{generatedLink}</code>
                <Button size="icon" variant="ghost" onClick={handleCopy}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <DialogFooter>
          {step === "generated" ? (
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          ) : (
            <>
              {step !== "amount-token" && (
                <Button variant="outline" onClick={handleBack}>
                  Back
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {step === "amount-token" && (
                <Button onClick={handleContinueToNetwork}>Continue</Button>
              )}
              {step === "network" && (
                <Button onClick={handleContinueToExpiration}>Continue</Button>
              )}
              {step === "expiration" && (
                <Button onClick={handleContinueToDetails}>Continue</Button>
              )}
              {step === "details" && (
                <Button onClick={handleCreate}>Create Link</Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
