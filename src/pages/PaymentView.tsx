import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, CheckCircle2, Circle, X } from "lucide-react";

type PaymentStep = "select-network" | "payment" | "success";

// Mock data - in production this would come from an API/database
const MOCK_PAYMENT_LINK = {
  id: "1",
  title: "Website Design Project",
  description: "Final payment for redesign",
  amount: "2.5",
  token: "ETH",
  networks: ["ETH", "BASE"], // Multiple networks from CreateLinkModal
  creatorName: "John Doe",
  creatorWallet: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4",
  wallets: {
    ETH: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb4",
    BASE: "0x8a4C5f3b2D1e9A7F6C8E2B3D4A5F6C7D8E9F0A1B",
  },
  gasFee: "0.002",
};

export default function PaymentView() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState<PaymentStep>("select-network");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(120); // 2 minutes in seconds
  const [transactionHash, setTransactionHash] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);

  const paymentData = MOCK_PAYMENT_LINK;

  // Auto-select if only one network
  useEffect(() => {
    if (paymentData.networks.length === 1) {
      setSelectedNetwork(paymentData.networks[0]);
    }
  }, []);

  // Countdown timer
  useEffect(() => {
    if (step === "payment" && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            toast.error("Transaction timeout. Please try again.");
            setStep("select-network");
            setTimeRemaining(120);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [step, timeRemaining]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleContinueToPayment = () => {
    if (!selectedNetwork) {
      toast.error("Please select a network");
      return;
    }
    setStep("payment");
    setTimeRemaining(120);
  };

  const handlePaymentDone = () => {
    if (!transactionHash) {
      toast.error("Please enter transaction hash");
      return;
    }
    setStep("success");
    toast.success("Payment confirmed!");
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setScreenshot(e.target.files[0]);
      toast.success("Screenshot uploaded!");
    }
  };

  const selectedWalletAddress = selectedNetwork ? paymentData.wallets[selectedNetwork as keyof typeof paymentData.wallets] : "";

  const getNetworkColor = (network: string) => {
    const colors: Record<string, string> = {
      ETH: "#627EEA",
      BASE: "#0052FF",
      SOL: "#14F195",
      BNB: "#F3BA2F",
    };
    return colors[network] || "#0B6FFE";
  };

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      <nav className="bg-white border-b-2 border-[#E8F0FF] px-4 md:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B6FFE] flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-[#0B233F]">Payme</span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/")}
            className="border-[#E8F0FF] hover:bg-[#F8FBFF]"
          >
            Create Your Link
          </Button>
        </div>
      </nav>
      
      <div className="p-4 md:p-8">
        <div className="max-w-md mx-auto">
        {step === "select-network" && (
          <Card className="p-8 border-2 border-[#E8F0FF] shadow-lg bg-white">
            <div className="space-y-6">
              <div className="text-center pb-6">
                <p className="text-[10px] text-[#46658A] font-semibold uppercase tracking-widest mb-4">
                  Payment Terminal
                </p>
                <div className="flex items-center justify-center gap-3 mb-1">
                  <p className="text-5xl font-bold text-[#0B233F] tracking-tight">
                    {paymentData.amount}
                  </p>
                  <Badge className="text-base px-4 py-1.5 bg-[#0B6FFE] hover:bg-[#0547B2]">
                    {paymentData.token}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-[10px] text-[#46658A] font-semibold uppercase tracking-widest mb-4">
                  Available Networks
                </p>
                <div className="space-y-3">
                  {paymentData.networks.map((network) => (
                    <button
                      key={network}
                      onClick={() => setSelectedNetwork(network)}
                      className={`w-full p-5 rounded-xl border-2 transition-all duration-200 ${
                        selectedNetwork === network
                          ? "border-[#0B6FFE] bg-[#F8FBFF] shadow-md"
                          : "border-[#E8F0FF] hover:border-[#80A9FF] hover:bg-[#FAFBFC]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${getNetworkColor(network)}20` }}>
                            <Circle
                              className="h-5 w-5"
                              fill={getNetworkColor(network)}
                              stroke="none"
                            />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-[#0B233F] text-base mb-0.5">
                              {network === "ETH" ? "Ethereum (ERC20)" : network === "BASE" ? "BASE (BASE20)" : `${network} (${network}20)`}
                            </p>
                            <p className="text-xs text-[#46658A] font-mono">
                              {paymentData.wallets[network as keyof typeof paymentData.wallets]?.slice(0, 6)}...
                              {paymentData.wallets[network as keyof typeof paymentData.wallets]?.slice(-6)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs font-semibold px-3 py-1 bg-[#0B6FFE]/10 text-[#0547B2] border-0">
                          ~{paymentData.gasFee}
                        </Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full h-14 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                onClick={handleContinueToPayment}
                disabled={!selectedNetwork}
              >
                Pay - {paymentData.amount} {paymentData.token} ({selectedNetwork || "Select Network"})
              </Button>
            </div>
          </Card>
        )}

        {step === "payment" && (
          <Card className="p-6 border border-[#E8F0FF] shadow-sm">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8F0FF]">
                <div className="text-sm">
                  <p className="text-xs text-muted-foreground mb-1">Paying to</p>
                  <p className="font-bold text-[#0B233F]">@{paymentData.creatorName.replace(/\s+/g, '').toLowerCase()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold tabular-nums ${timeRemaining < 30 ? "text-destructive" : "text-[#0B6FFE]"}`}>
                    {formatTime(timeRemaining)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive h-auto p-0 mt-1"
                    onClick={() => {
                      setStep("select-network");
                      setTimeRemaining(120);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <p className="text-2xl font-bold text-[#0B233F]">{paymentData.amount} {paymentData.token}</p>
                  <Badge variant="secondary" className="text-xs">{selectedNetwork}</Badge>
                </div>
              </div>

              <div className="bg-white p-6 rounded-lg border-2 border-[#E8F0FF]">
                <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-4">
                  Send to this address
                </p>
                <div className="inline-flex items-center justify-center w-full h-48 bg-[#FAFBFC] rounded-lg mb-3">
                  <div className="text-sm text-muted-foreground">Scan QR Code</div>
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Click QR code to copy address
                </p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Payment Instructions
                </p>
                <ol className="space-y-2 text-sm text-[#0B233F]">
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">1.</span>
                    <span>Open your crypto wallet app (Binance, Coinbase, Trust Wallet, etc.)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">2.</span>
                    <span>Scan this QR code with your wallet's scanner</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">3.</span>
                    <span>Confirm sending {paymentData.amount} {paymentData.token} on {selectedNetwork} network</span>
                  </li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Recipient Address
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => handleCopyAddress(selectedWalletAddress)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                <code className="block text-xs bg-[#FAFBFC] px-3 py-2 rounded border border-[#E8F0FF] break-all font-mono text-[#0B233F]">
                  {selectedWalletAddress}
                </code>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                  Transaction Hash (After sending)
                </Label>
                <Input
                  placeholder="Enter transaction hash (0x...)"
                  value={transactionHash}
                  onChange={(e) => setTransactionHash(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <Button
                className="w-full h-12 text-base font-medium"
                onClick={handlePaymentDone}
                disabled={!transactionHash}
              >
                ✓ I've sent payment
              </Button>
            </div>
          </Card>
        )}

        {step === "success" && (
          <Card className="p-6 border border-[#E8F0FF] shadow-sm">
            <div className="space-y-6">
              <div className="text-center pb-6 border-b border-[#E8F0FF]">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#E8F0FF] rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#0B6FFE]" />
                </div>
                <h2 className="text-xl font-bold text-[#0B233F] mb-2">Payment noted!</h2>
                <p className="text-sm text-muted-foreground">
                  We're monitoring the blockchain for your transaction
                </p>
              </div>

              <div className="bg-[#FAFBFC] p-4 rounded-lg border border-[#E8F0FF] space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-[#0B233F]">{paymentData.amount} {paymentData.token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-bold text-[#0B233F]">@{paymentData.creatorName.replace(/\s+/g, '').toLowerCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <Badge variant="secondary" className="text-xs">{selectedNetwork} ({selectedNetwork}20)</Badge>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                  Add your name to let @{paymentData.creatorName.replace(/\s+/g, '').toLowerCase()} know who sent this
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Your name or @username"
                    className="flex-1"
                  />
                  <Button className="px-6">Add</Button>
                </div>
              </div>

              <Button 
                className="w-full h-12 text-base font-medium" 
                onClick={() => navigate("/")}
              >
                Stop copying wallet addresses - Get your link
              </Button>

              <div className="pt-4 border-t border-[#E8F0FF]">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Finding your transaction on blockchain...</span>
                </div>
              </div>
            </div>
          </Card>
        )}
        </div>
      </div>
    </div>
  );
}
