import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Upload, CheckCircle2 } from "lucide-react";

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
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {step === "select-network" && (
          <Card className="p-6 md:p-8 border-[#E8F0FF] shadow-sm">
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-[#0B233F] mb-2">
                  {paymentData.title}
                </h1>
                <p className="text-[#46658A]">{paymentData.description}</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#E8F0FF]">
                <div>
                  <p className="text-sm text-[#46658A] mb-1">Payment to</p>
                  <p className="font-semibold text-[#0B233F]">{paymentData.creatorName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-[#46658A] bg-[#E8F0FF] px-2 py-1 rounded">
                      {paymentData.creatorWallet.slice(0, 6)}...{paymentData.creatorWallet.slice(-4)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => handleCopyAddress(paymentData.creatorWallet)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-[#46658A] mb-1">Amount</p>
                  <p className="text-3xl font-bold text-[#0B233F]">
                    {paymentData.amount} {paymentData.token}
                  </p>
                  <p className="text-sm text-[#46658A] mt-1">+ {paymentData.gasFee} {paymentData.token} gas fee</p>
                </div>

                <div>
                  <Label className="text-[#0B233F] mb-3 block">Select Network</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {paymentData.networks.map((network) => (
                      <Button
                        key={network}
                        type="button"
                        variant={selectedNetwork === network ? "default" : "outline"}
                        className="w-full"
                        onClick={() => setSelectedNetwork(network)}
                      >
                        {network}
                      </Button>
                    ))}
                  </div>
                  {selectedNetwork && (
                    <div className="mt-4 p-3 bg-[#E8F0FF] rounded-md">
                      <p className="text-xs text-[#46658A] mb-1">Wallet Address</p>
                      <code className="text-xs text-[#0B233F] break-all">
                        {selectedWalletAddress}
                      </code>
                    </div>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handleContinueToPayment}
                disabled={!selectedNetwork}
              >
                Continue to Payment
              </Button>
            </div>
          </Card>
        )}

        {step === "payment" && (
          <Card className="p-6 md:p-8 border-[#E8F0FF] shadow-sm">
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-48 h-48 bg-[#E8F0FF] rounded-lg mb-4">
                  <div className="text-[#46658A] text-sm">QR Code</div>
                </div>
                <p className="text-2xl font-bold text-[#0B233F]">
                  {paymentData.amount} {paymentData.token}
                </p>
                <p className="text-sm text-[#46658A] mt-1">+ {paymentData.gasFee} gas fee</p>
              </div>

              <div className="space-y-4 pt-4 border-t border-[#E8F0FF]">
                <div>
                  <p className="font-semibold text-[#0B233F] mb-2">How to Pay</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-[#46658A]">
                    <li>Open your {paymentData.token} wallet</li>
                    <li>Scan the QR code or copy the address below</li>
                    <li>Send exactly {paymentData.amount} {paymentData.token} on {selectedNetwork} network</li>
                    <li>Click "Payment Done" after sending</li>
                  </ol>
                </div>

                <div>
                  <Label className="text-[#0B233F] mb-2 block">Wallet Address</Label>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs text-[#0B233F] bg-[#E8F0FF] px-3 py-2 rounded break-all">
                      {selectedWalletAddress}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyAddress(selectedWalletAddress)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-center py-4">
                  <p className="text-sm text-[#46658A] mb-1">Time Remaining</p>
                  <p className={`text-3xl font-bold ${timeRemaining < 30 ? "text-destructive" : "text-[#0B233F]"}`}>
                    {formatTime(timeRemaining)}
                  </p>
                </div>

                <div>
                  <Label className="text-[#0B233F] mb-2 block">Transaction Hash</Label>
                  <Input
                    placeholder="Enter transaction hash"
                    value={transactionHash}
                    onChange={(e) => setTransactionHash(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePaymentDone}
                disabled={!transactionHash}
              >
                Payment Done
              </Button>
            </div>
          </Card>
        )}

        {step === "success" && (
          <Card className="p-6 md:p-8 border-[#E8F0FF] shadow-sm">
            <div className="space-y-6 text-center">
              <div className="flex justify-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-bold text-[#0B233F] mb-2">Payment Submitted!</h2>
                <p className="text-[#46658A]">Your payment has been submitted for verification</p>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#E8F0FF] text-left">
                <div className="flex justify-between">
                  <span className="text-[#46658A]">Amount</span>
                  <span className="font-semibold text-[#0B233F]">{paymentData.amount} {paymentData.token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#46658A]">To</span>
                  <span className="font-semibold text-[#0B233F]">{paymentData.creatorName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#46658A]">Network</span>
                  <Badge variant="outline">{selectedNetwork}</Badge>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-[#46658A]">Transaction Hash</span>
                  <code className="text-xs text-[#0B233F] break-all max-w-[200px] text-right">
                    {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                  </code>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E8F0FF]">
                <Label className="text-[#0B233F] mb-3 block text-left">Upload Payment Screenshot (Optional)</Label>
                <div className="relative">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  {screenshot && (
                    <p className="text-sm text-green-600 mt-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {screenshot.name}
                    </p>
                  )}
                </div>
              </div>

              <Button
                className="w-full"
                size="lg"
                variant="outline"
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
