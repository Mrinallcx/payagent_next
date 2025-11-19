import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, CheckCircle2, Timer, Wallet, Network, ArrowRight, Upload } from "lucide-react";

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-[#F8FBFF] to-[#E8F0FF] p-4 md:p-8">
      <div className="max-w-2xl mx-auto animate-fade-in">
        {step === "select-network" && (
          <Card className="overflow-hidden border-2 border-[#E8F0FF] shadow-xl bg-white animate-scale-in">
            {/* Header Section */}
            <div className="bg-gradient-to-r from-[#0B6FFE] to-[#0547B2] p-6 md:p-8 text-white">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">
                {paymentData.title}
              </h1>
              <p className="text-white/90 text-sm md:text-base">{paymentData.description}</p>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Amount Display */}
              <div className="text-center py-6 bg-gradient-to-br from-[#E8F0FF] to-white rounded-2xl border border-[#E8F0FF]">
                <p className="text-sm text-[#46658A] mb-2 uppercase tracking-wide">Total Amount</p>
                <p className="text-4xl md:text-5xl font-bold text-[#0B233F] mb-2">
                  {paymentData.amount} <span className="text-[#0B6FFE]">{paymentData.token}</span>
                </p>
                <p className="text-sm text-[#46658A] flex items-center justify-center gap-1">
                  <span>+ {paymentData.gasFee} {paymentData.token}</span>
                  <span className="text-xs">(gas fee)</span>
                </p>
              </div>

              {/* Recipient Info */}
              <div className="flex items-start gap-4 p-4 bg-[#E8F0FF]/30 rounded-xl border border-[#E8F0FF]">
                <div className="p-2 bg-[#0B6FFE] rounded-lg">
                  <Wallet className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-[#46658A] mb-1 uppercase tracking-wide">Payment to</p>
                  <p className="font-semibold text-[#0B233F] mb-2">{paymentData.creatorName}</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-[#46658A] bg-white px-3 py-1.5 rounded-lg border border-[#E8F0FF] font-mono">
                      {paymentData.creatorWallet.slice(0, 10)}...{paymentData.creatorWallet.slice(-8)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-white hover:border-[#E8F0FF]"
                      onClick={() => handleCopyAddress(paymentData.creatorWallet)}
                    >
                      <Copy className="h-4 w-4 text-[#0B6FFE]" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Network Selection */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Network className="h-5 w-5 text-[#0B6FFE]" />
                  <Label className="text-[#0B233F] text-base font-semibold">Select Payment Network</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {paymentData.networks.map((network) => (
                    <Button
                      key={network}
                      type="button"
                      variant={selectedNetwork === network ? "default" : "outline"}
                      className={`w-full h-14 text-base font-semibold transition-all hover-scale ${
                        selectedNetwork === network 
                          ? "bg-[#0B6FFE] hover:bg-[#0547B2] shadow-lg" 
                          : "border-2 border-[#E8F0FF] hover:border-[#0B6FFE]"
                      }`}
                      onClick={() => setSelectedNetwork(network)}
                    >
                      {network}
                    </Button>
                  ))}
                </div>
                
                {selectedNetwork && (
                  <div className="mt-4 p-4 bg-gradient-to-br from-[#E8F0FF] to-white rounded-xl border-2 border-[#0B6FFE]/20 animate-fade-in">
                    <p className="text-xs text-[#46658A] mb-2 uppercase tracking-wide font-semibold">Wallet Address</p>
                    <code className="text-xs md:text-sm text-[#0B233F] break-all font-mono block bg-white p-3 rounded-lg border border-[#E8F0FF]">
                      {selectedWalletAddress}
                    </code>
                  </div>
                )}
              </div>

              <Button
                className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover-scale"
                size="lg"
                onClick={handleContinueToPayment}
                disabled={!selectedNetwork}
              >
                Continue to Payment
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>
        )}

        {step === "payment" && (
          <Card className="overflow-hidden border-2 border-[#E8F0FF] shadow-xl bg-white animate-scale-in">
            {/* Header with Timer */}
            <div className="bg-gradient-to-r from-[#0B6FFE] to-[#0547B2] p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Complete Payment</h2>
                  <p className="text-white/80 text-sm mt-1">Scan QR or copy address</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl">
                    <Timer className="h-5 w-5" />
                    <span className={`text-2xl font-bold tabular-nums ${timeRemaining < 30 ? "animate-pulse" : ""}`}>
                      {formatTime(timeRemaining)}
                    </span>
                  </div>
                  <p className="text-xs mt-1 text-white/70">Time remaining</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* QR Code Section */}
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-56 h-56 bg-gradient-to-br from-white to-[#E8F0FF] rounded-2xl border-4 border-[#0B6FFE]/20 shadow-2xl mb-4">
                  <div className="text-[#46658A] text-sm font-medium">QR Code Placeholder</div>
                </div>
                <div className="inline-block p-4 bg-[#E8F0FF]/50 rounded-xl">
                  <p className="text-3xl font-bold text-[#0B233F]">
                    {paymentData.amount} <span className="text-[#0B6FFE]">{paymentData.token}</span>
                  </p>
                  <p className="text-sm text-[#46658A] mt-1">+ {paymentData.gasFee} gas fee</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-5 bg-gradient-to-br from-[#E8F0FF] to-white rounded-xl border border-[#E8F0FF]">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 bg-[#0B6FFE] rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                  <p className="font-semibold text-[#0B233F]">How to Pay</p>
                </div>
                <ol className="space-y-2.5 ml-8">
                  <li className="text-sm text-[#46658A] flex items-start gap-2">
                    <span className="text-[#0B6FFE] font-bold">1.</span>
                    <span>Open your {paymentData.token} wallet app</span>
                  </li>
                  <li className="text-sm text-[#46658A] flex items-start gap-2">
                    <span className="text-[#0B6FFE] font-bold">2.</span>
                    <span>Scan the QR code or copy the address below</span>
                  </li>
                  <li className="text-sm text-[#46658A] flex items-start gap-2">
                    <span className="text-[#0B6FFE] font-bold">3.</span>
                    <span>Send exactly <strong>{paymentData.amount} {paymentData.token}</strong> on <Badge variant="secondary" className="inline-flex">{selectedNetwork}</Badge> network</span>
                  </li>
                  <li className="text-sm text-[#46658A] flex items-start gap-2">
                    <span className="text-[#0B6FFE] font-bold">4.</span>
                    <span>Enter transaction hash and click "Payment Done"</span>
                  </li>
                </ol>
              </div>

              {/* Wallet Address */}
              <div>
                <Label className="text-[#0B233F] mb-3 flex items-center gap-2 font-semibold">
                  <Wallet className="h-4 w-4 text-[#0B6FFE]" />
                  Wallet Address
                </Label>
                <div className="flex gap-2">
                  <code className="flex-1 text-xs md:text-sm text-[#0B233F] bg-gradient-to-br from-[#E8F0FF] to-white px-4 py-3 rounded-xl border-2 border-[#E8F0FF] break-all font-mono">
                    {selectedWalletAddress}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 border-2 border-[#E8F0FF] hover:bg-[#0B6FFE] hover:text-white hover:border-[#0B6FFE] transition-all hover-scale"
                    onClick={() => handleCopyAddress(selectedWalletAddress)}
                  >
                    <Copy className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Transaction Hash Input */}
              <div>
                <Label className="text-[#0B233F] mb-3 block font-semibold">Transaction Hash</Label>
                <Input
                  placeholder="0x..."
                  value={transactionHash}
                  onChange={(e) => setTransactionHash(e.target.value)}
                  className="font-mono text-sm h-12 border-2 border-[#E8F0FF] focus:border-[#0B6FFE] bg-white"
                />
              </div>

              <Button
                className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover-scale"
                size="lg"
                onClick={handlePaymentDone}
                disabled={!transactionHash}
              >
                Payment Done
                <CheckCircle2 className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </Card>
        )}

        {step === "success" && (
          <Card className="overflow-hidden border-2 border-[#E8F0FF] shadow-xl bg-white animate-scale-in">
            {/* Success Header */}
            <div className="bg-gradient-to-r from-green-500 to-green-600 p-8 text-white text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4 animate-scale-in">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-2">Payment Submitted!</h2>
              <p className="text-white/90">Your payment has been submitted for verification</p>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Payment Details */}
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 bg-[#E8F0FF]/30 rounded-xl">
                  <span className="text-[#46658A] font-medium">Amount</span>
                  <span className="font-bold text-[#0B233F] text-lg">{paymentData.amount} {paymentData.token}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-[#E8F0FF]/30 rounded-xl">
                  <span className="text-[#46658A] font-medium">To</span>
                  <span className="font-semibold text-[#0B233F]">{paymentData.creatorName}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-[#E8F0FF]/30 rounded-xl">
                  <span className="text-[#46658A] font-medium">Network</span>
                  <Badge variant="default" className="bg-[#0B6FFE] hover:bg-[#0547B2] font-semibold">{selectedNetwork}</Badge>
                </div>
                <div className="p-4 bg-gradient-to-br from-[#E8F0FF] to-white rounded-xl border border-[#E8F0FF]">
                  <p className="text-[#46658A] font-medium mb-2">Transaction Hash</p>
                  <code className="text-xs md:text-sm text-[#0B233F] break-all font-mono block bg-white p-3 rounded-lg">
                    {transactionHash}
                  </code>
                </div>
              </div>

              {/* Screenshot Upload */}
              <div className="p-5 bg-gradient-to-br from-[#E8F0FF] to-white rounded-xl border-2 border-dashed border-[#0B6FFE]/30">
                <Label className="text-[#0B233F] mb-3 flex items-center gap-2 font-semibold">
                  <Upload className="h-4 w-4 text-[#0B6FFE]" />
                  Upload Payment Screenshot (Optional)
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="cursor-pointer border-2 border-[#E8F0FF] hover:border-[#0B6FFE] transition-colors"
                />
                {screenshot && (
                  <div className="mt-3 p-3 bg-green-50 border-2 border-green-200 rounded-lg animate-fade-in">
                    <p className="text-sm text-green-700 flex items-center gap-2 font-medium">
                      <CheckCircle2 className="h-4 w-4" />
                      {screenshot.name}
                    </p>
                  </div>
                )}
              </div>

              <Button
                className="w-full h-14 text-base font-semibold shadow-lg hover:shadow-xl transition-all hover-scale"
                size="lg"
                variant="default"
                onClick={() => navigate("/")}
              >
                Done
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
