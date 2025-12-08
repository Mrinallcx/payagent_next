import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Copy, 
  Loader2, 
  Wallet, 
  Clock, 
  Check,
  ArrowRight,
  ArrowLeft,
  X
} from "lucide-react";
import { toast } from "sonner";
import { createPaymentLink } from "@/lib/api";
import { useAccount } from "wagmi";

interface CreateLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLink?: (linkData: {
    address: string;
    description: string;
    amount: string;
    token: string;
    network: string;
    expiresInDays: number;
    link: string;
  }) => void;
}

type Step = "amount-token" | "network" | "expiration" | "details" | "generated";

const TOKENS = [
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "BNB", name: "BNB" },
  { symbol: "LCX", name: "LCX Token" },
];

const NETWORKS = [
  { name: "Sepolia (ETH Testnet)", short: "Sepolia" },
  { name: "BNB Testnet", short: "BNB Test" },
];

const TOKEN_NETWORK_SUPPORT: Record<string, string[]> = {
  "USDC": ["Sepolia (ETH Testnet)", "BNB Testnet"],
  "USDT": ["Sepolia (ETH Testnet)", "BNB Testnet"],
  "ETH": ["Sepolia (ETH Testnet)"],
  "BNB": ["Sepolia (ETH Testnet)", "BNB Testnet"],
  "LCX": ["Sepolia (ETH Testnet)"],
};

export function CreateLinkModal({ open, onOpenChange, onCreateLink }: CreateLinkModalProps) {
  const [step, setStep] = useState<Step>("amount-token");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState("");
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState("");
  const [address, setAddress] = useState("");
  const [description, setDescription] = useState("");
  const [generatedLink, setGeneratedLink] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const { address: walletAddress } = useAccount();

  useEffect(() => {
    if (step === "details" && walletAddress && !address) {
      setAddress(walletAddress);
    }
  }, [step, walletAddress, address]);

  const handleContinueToNetwork = () => {
    if (!amount || !selectedToken) {
      toast.error("Please enter amount and select a token");
      return;
    }
    const supportedNetworks = TOKEN_NETWORK_SUPPORT[selectedToken] || [];
    setSelectedNetworks((prev) => prev.filter((n) => supportedNetworks.includes(n)));
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
      toast.error("Please select an expiration period");
      return;
    }
    setStep("details");
  };

  const handleCreate = async () => {
    if (!address) {
      toast.error("Please fill in address");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createPaymentLink({
        token: selectedToken,
        amount,
        receiver: address,
        network: selectedNetworks.join(", "),
        expiresInDays: parseInt(expiresInDays),
        description,
        creatorWallet: walletAddress,
      });

      const frontendUrl = `${window.location.origin}/pay/${result.request.id}`;
      setGeneratedLink(frontendUrl);

      if (onCreateLink) {
        onCreateLink({
          address,
          description,
          amount,
          token: selectedToken,
          network: selectedNetworks.join(", "),
          expiresInDays: parseInt(expiresInDays),
          link: frontendUrl,
        });
      }

      setStep("generated");
      toast.success("Payment link created");
    } catch (error) {
      console.error("Error creating link:", error);
      toast.error("Failed to create payment link");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLink);
    toast.success("Copied to clipboard");
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
    setAddress("");
    setDescription("");
    setGeneratedLink("");
    onOpenChange(false);
  };

  const stepNumber = step === "amount-token" ? 1 : step === "network" ? 2 : step === "expiration" ? 3 : step === "details" ? 4 : 5;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 rounded-xl">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-lg font-heading font-semibold">
            {step === "generated" ? "Link Created" : "Create Payment Link"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === "generated" 
              ? "Share this link to receive payment" 
              : `Step ${stepNumber} of 4`}
          </DialogDescription>
        </DialogHeader>

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Step 1: Amount & Token */}
          {step === "amount-token" && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="amount" className="text-sm">Amount</Label>
                <div className="flex gap-2">
                  <Input
                    id="amount"
                    type="number"
                    placeholder="0.00"
                    value={amount}
                    min="0"
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) >= 0) {
                        setAmount(value);
                      }
                    }}
                    className="h-11 text-lg font-semibold flex-1 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {selectedToken && (
                    <div className="h-11 px-4 bg-violet-50 text-violet-700 rounded-lg flex items-center">
                      <span className="font-medium text-sm">{selectedToken}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Token</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        selectedToken === token.symbol
                          ? "border-violet-600 bg-violet-50"
                          : "border-border hover:border-violet-300"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center overflow-hidden">
                        <img 
                          src={`/tokenicon/${token.symbol.toLowerCase()}.svg`}
                          alt={token.symbol}
                          className="w-5 h-5 object-contain"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-sm">{token.symbol}</p>
                        <p className="text-[10px] text-muted-foreground">{token.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Network */}
          {step === "network" && (
            <div className="space-y-5">
              <div className="bg-violet-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-semibold text-violet-700">{amount} {selectedToken}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Network</Label>
                <div className="space-y-2">
                  {NETWORKS.map((network) => {
                    const isSelected = selectedNetworks.includes(network.name);
                    const supportedNetworks = TOKEN_NETWORK_SUPPORT[selectedToken] || [];
                    const isDisabled = !supportedNetworks.includes(network.name);
                    
                    return (
                      <button
                        key={network.name}
                        type="button"
                        disabled={isDisabled}
                        onClick={() => {
                          if (isDisabled) return;
                          setSelectedNetworks((prev) =>
                            prev.includes(network.name)
                              ? prev.filter((n) => n !== network.name)
                              : [...prev, network.name]
                          );
                        }}
                        className={`w-full flex items-center justify-between p-4 rounded-lg border transition-colors ${
                          isDisabled
                            ? "border-border bg-slate-50 cursor-not-allowed opacity-50"
                            : isSelected
                            ? "border-violet-600 bg-violet-50"
                            : "border-border hover:border-violet-300"
                        }`}
                      >
                        <span className={`font-medium text-sm ${isDisabled ? "text-muted-foreground" : ""}`}>
                          {network.name}
                        </span>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? "border-violet-600 bg-violet-600" : "border-slate-300"
                        }`}>
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Expiration */}
          {step === "expiration" && (
            <div className="space-y-5">
              <div className="bg-violet-50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Amount</span>
                <span className="font-semibold text-violet-700">{amount} {selectedToken}</span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Expiration</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "1", label: "24h" },
                    { value: "7", label: "7 days" },
                    { value: "30", label: "30 days" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setExpiresInDays(option.value)}
                      className={`p-4 rounded-lg border transition-colors ${
                        expiresInDays === option.value
                          ? "border-violet-600 bg-violet-50"
                          : "border-border hover:border-violet-300"
                      }`}
                    >
                      <Clock className={`h-5 w-5 mx-auto mb-2 ${
                        expiresInDays === option.value ? "text-violet-600" : "text-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Details */}
          {step === "details" && (
            <div className="space-y-5">
              <div className="bg-violet-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Amount</span>
                  <span className="text-xs text-muted-foreground">{expiresInDays === "1" ? "24h" : `${expiresInDays} days`}</span>
                </div>
                <p className="text-2xl font-heading font-bold text-violet-700">{amount} {selectedToken}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedNetworks.join(", ")}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Receive to
                </Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="font-mono text-sm h-11 rounded-lg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">
                  Description <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="What is this payment for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none text-sm rounded-lg"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 5: Generated */}
          {step === "generated" && (
            <div className="space-y-5">
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <Check className="h-7 w-7 text-emerald-600" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Share this link to receive {amount} {selectedToken}
                </p>
              </div>

              <div className="bg-violet-50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all bg-white rounded-md p-3 border border-violet-100">
                    {generatedLink}
                  </code>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    onClick={handleCopy}
                    className="h-10 w-10 shrink-0 rounded-lg border-violet-200 hover:bg-violet-100"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button onClick={handleCopy} className="w-full h-11 gap-2 rounded-lg bg-violet-600 hover:bg-violet-700">
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "generated" && (
          <DialogFooter className="px-6 py-4 border-t border-border bg-slate-50/50">
            <div className="flex w-full gap-2">
              <Button 
                variant="ghost" 
                onClick={handleClose}
                className="gap-1 text-muted-foreground"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              
              <div className="flex-1" />
              
              {step !== "amount-token" && (
                <Button variant="outline" onClick={handleBack} className="gap-1 rounded-lg">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              
              {step === "amount-token" && (
                <Button onClick={handleContinueToNetwork} className="gap-1 rounded-lg bg-violet-600 hover:bg-violet-700">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "network" && (
                <Button onClick={handleContinueToExpiration} className="gap-1 rounded-lg bg-violet-600 hover:bg-violet-700">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "expiration" && (
                <Button onClick={handleContinueToDetails} className="gap-1 rounded-lg bg-violet-600 hover:bg-violet-700">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "details" && (
                <Button onClick={handleCreate} disabled={isLoading} className="gap-1 rounded-lg bg-violet-600 hover:bg-violet-700">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Link"
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}

        {step === "generated" && (
          <DialogFooter className="px-6 py-4 border-t border-border bg-slate-50/50">
            <Button variant="outline" onClick={handleClose} className="w-full rounded-lg">
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
