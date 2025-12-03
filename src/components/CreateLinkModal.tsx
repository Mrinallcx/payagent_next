import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  Copy, 
  Loader2, 
  Wallet, 
  FileText, 
  Globe, 
  Clock, 
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles
} from "lucide-react";
import { GiPayMoney } from "react-icons/gi";
import { FaGlobe } from "react-icons/fa";
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
  { symbol: "USDC", name: "USD Coin", color: "bg-blue-500" },
  { symbol: "USDT", name: "Tether", color: "bg-green-500" },
  { symbol: "ETH", name: "Ethereum", color: "bg-purple-500" },
  { symbol: "BNB", name: "Wrapped BNB", color: "bg-yellow-500" },
  { symbol: "LCX", name: "LCX Token", color: "bg-orange-500" },
];

const NETWORKS = [
  { name: "Sepolia (ETH Testnet)", short: "Sepolia", color: "bg-purple-500" },
];

// Token to supported networks mapping
const TOKEN_NETWORK_SUPPORT: Record<string, string[]> = {
  "USDC": ["Sepolia (ETH Testnet)"],
  "USDT": ["Sepolia (ETH Testnet)"],
  "ETH": ["Sepolia (ETH Testnet)"],
  "BNB": ["Sepolia (ETH Testnet)"], // WBNB as ERC20 on Sepolia
  "LCX": ["Sepolia (ETH Testnet)"],
};

const STEPS = [
  { key: "amount-token", label: "Amount", icon: GiPayMoney },
  { key: "network", label: "Network", icon: FaGlobe },
  { key: "expiration", label: "Expiry", icon: Clock },
  { key: "details", label: "Details", icon: FileText },
];

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

  const getCurrentStepIndex = () => {
    return STEPS.findIndex(s => s.key === step);
  };

  const handleContinueToNetwork = () => {
    if (!amount || !selectedToken) {
      toast.error("Please enter amount and select a token");
      return;
    }
    // Clear any previously selected networks that aren't supported by the new token
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
      toast.success("Payment link created!");
    } catch (error) {
      console.error("Error creating link:", error);
      toast.error("Failed to create payment link. Please try again.");
    } finally {
      setIsLoading(false);
    }
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
    setAddress("");
    setDescription("");
    setGeneratedLink("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle className="text-xl font-semibold">
            {step === "generated" ? "Link Created!" : "Create Payment Link"}
          </DialogTitle>
        </DialogHeader>

        {/* Step Indicator */}
        {step !== "generated" && (
          <div className="px-6 pb-4">
            <div className="flex items-center justify-between">
              {STEPS.map((s, index) => {
                const Icon = s.icon;
                const currentIndex = getCurrentStepIndex();
                const isActive = index === currentIndex;
                const isCompleted = index < currentIndex;
                
                return (
                  <div key={s.key} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-lg"
                            : isCompleted
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <Icon className="h-5 w-5" />
                        )}
                      </div>
                      <span className={`text-[10px] mt-1.5 font-medium ${
                        isActive ? "text-primary" : "text-muted-foreground"
                      }`}>
                        {s.label}
                      </span>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div className={`w-8 h-0.5 mx-1 mb-5 ${
                        index < currentIndex ? "bg-primary/40" : "bg-muted"
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="px-6 pb-6">
          {/* Step 1: Amount & Token */}
          {step === "amount-token" && (
            <div className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="amount" className="text-sm font-medium">
                  How much do you want to receive?
                </Label>
                <div className="flex items-center gap-2">
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
                    className="h-12 text-xl font-semibold flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  {selectedToken && (
                    <div className="bg-muted px-4 py-2.5 rounded-lg border h-12 flex items-center">
                      <span className="font-semibold text-sm">{selectedToken}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">Select Token</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TOKENS.map((token) => (
                    <button
                      key={token.symbol}
                      type="button"
                      onClick={() => setSelectedToken(token.symbol)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        selectedToken === token.symbol
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full ${token.color} flex items-center justify-center`}>
                        <span className="text-white text-xs font-bold">
                          {token.symbol.charAt(0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-sm">{token.symbol}</p>
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
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Receiving</span>
                <span className="font-semibold">{amount} {selectedToken}</span>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Which networks do you accept?
                </Label>
                <div className="grid grid-cols-1 gap-2">
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
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                          isDisabled
                            ? "border-border bg-muted/50 cursor-not-allowed opacity-50 grayscale"
                            : isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-full ${isDisabled ? "bg-gray-400" : network.color} flex items-center justify-center`}>
                          <Globe className="h-5 w-5 text-white" />
                        </div>
                        <div className="flex-1 text-left">
                          <span className={`font-medium ${isDisabled ? "text-muted-foreground" : ""}`}>{network.name}</span>
                          {isDisabled && (
                            <p className="text-xs text-muted-foreground">Not available for {selectedToken}</p>
                          )}
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isDisabled 
                            ? "border-muted-foreground/50"
                            : isSelected 
                            ? "border-primary bg-primary" 
                            : "border-muted-foreground"
                        }`}>
                          {isSelected && !isDisabled && <CheckCircle2 className="h-4 w-4 text-white" />}
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
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Receiving</span>
                <span className="font-semibold">{amount} {selectedToken}</span>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  When should this link expire?
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { value: "1", label: "24", sublabel: "Hours" },
                    { value: "7", label: "7", sublabel: "Days" },
                    { value: "30", label: "30", sublabel: "Days" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setExpiresInDays(option.value)}
                      className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center ${
                        expiresInDays === option.value
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <Clock className={`h-6 w-6 mb-2 ${
                        expiresInDays === option.value ? "text-primary" : "text-muted-foreground"
                      }`} />
                      <span className="text-2xl font-bold">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Details */}
          {step === "details" && (
            <div className="space-y-4">
              {/* Summary Card */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-primary">Payment Request</span>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {expiresInDays === "1" ? "24 hours" : `${expiresInDays} days`}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{amount}</span>
                  <span className="text-lg font-medium text-muted-foreground">{selectedToken}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {selectedNetworks.join(", ")}
                </div>
              </div>

              {/* Transfer To */}
              <div className="space-y-2">
                <Label htmlFor="address" className="flex items-center gap-2 text-sm font-medium">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Transfer to
                </Label>
                <Input
                  id="address"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="font-mono text-sm h-11"
                />
                <p className="text-[11px] text-muted-foreground">
                  Payments will be sent to this wallet address
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  Description
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="description"
                  placeholder="What is this payment for?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="resize-none text-sm"
                  rows={2}
                />
              </div>
            </div>
          )}

          {/* Step 5: Generated */}
          {step === "generated" && (
            <div className="space-y-5">
              <div className="flex flex-col items-center text-center py-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <Sparkles className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-lg font-semibold mb-1">Your link is ready!</h3>
                <p className="text-sm text-muted-foreground">
                  Share it with anyone to receive {amount} {selectedToken}
                </p>
              </div>

              <div className="bg-muted rounded-xl p-4">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm font-mono break-all bg-background rounded-lg p-3 border">
                    {generatedLink}
                  </code>
                  <Button 
                    size="icon" 
                    variant="outline" 
                    onClick={handleCopy}
                    className="h-11 w-11 shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button onClick={handleCopy} className="w-full h-12 gap-2" size="lg">
                <Copy className="h-4 w-4" />
                Copy Link
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        {step !== "generated" && (
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t">
            <div className="flex w-full gap-3">
              <Button 
                variant="ghost" 
                onClick={handleClose}
                className="gap-1"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
              
              <div className="flex-1" />
              
              {step !== "amount-token" && (
                <Button variant="outline" onClick={handleBack} className="gap-1">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
              )}
              
              {step === "amount-token" && (
                <Button onClick={handleContinueToNetwork} className="gap-1">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "network" && (
                <Button onClick={handleContinueToExpiration} className="gap-1">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "expiration" && (
                <Button onClick={handleContinueToDetails} className="gap-1">
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </Button>
              )}
              {step === "details" && (
                <Button onClick={handleCreate} disabled={isLoading} className="gap-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Create Link
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        )}

        {/* Close button for generated step */}
        {step === "generated" && (
          <DialogFooter className="px-6 py-4 bg-muted/30 border-t">
            <Button variant="outline" onClick={handleClose} className="w-full">
              Done
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
