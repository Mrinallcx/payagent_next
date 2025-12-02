import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, CheckCircle2, Circle, Loader2, AlertCircle, Wallet } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi';
import { parseUnits } from 'viem';
import { getPaymentRequest, verifyPayment, type PaymentRequest } from "@/lib/api";
import { ERC20_ABI, getTokenAddress, getChainId, getTokenDecimals } from "@/lib/contracts";

type PaymentStep = "select-network" | "payment" | "success";

export default function PaymentView() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const { address, isConnected, chain } = useAccount();
  const { switchChain } = useSwitchChain();
  
  // Payment request data
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // UI state
  const [step, setStep] = useState<PaymentStep>("select-network");
  const [selectedNetwork, setSelectedNetwork] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(120);
  const [transactionHash, setTransactionHash] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  
  // Wagmi hooks for contract interaction
  const { data: hash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Fetch payment request data
  useEffect(() => {
    if (!linkId) {
      setError('Invalid payment link');
      setLoading(false);
      return;
    }

    const fetchPaymentRequest = async () => {
      try {
        setLoading(true);
        const response = await getPaymentRequest(linkId);
        
        // Check if already paid
        if (response.status === 'PAID' && response.request) {
          setPaymentRequest(response.request);
          setStep('success');
          setLoading(false);
          return;
        }

        // Handle 402 Payment Required response
        if (response.payment) {
          // Convert backend format to frontend format
          const request: PaymentRequest = {
            id: response.payment.id,
            token: response.payment.token,
            amount: response.payment.amount,
            receiver: response.payment.receiver,
            payer: null,
            description: response.payment.description,
            network: response.payment.network,
            status: 'PENDING',
            createdAt: Date.now(),
            expiresAt: null,
            txHash: null,
            paidAt: null,
          };
          setPaymentRequest(request);
        } else if (response.request) {
          setPaymentRequest(response.request);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching payment request:', err);
        setError(err instanceof Error ? err.message : 'Failed to load payment request');
        setLoading(false);
      }
    };

    fetchPaymentRequest();
  }, [linkId]);

  // Auto-select if only one network
  useEffect(() => {
    if (paymentRequest && paymentRequest.network) {
      const networks = paymentRequest.network.split(',').map(n => n.trim());
      if (networks.length === 1) {
        setSelectedNetwork(networks[0]);
      }
    }
  }, [paymentRequest]);

  // Countdown timer
  useEffect(() => {
    if (step === "payment" && timeRemaining > 0) {
      const timer = setInterval(() => {
        setTimeRemaining(prev => {
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
  const handlePaymentDone = async () => {
    if (!transactionHash) {
      toast.error("Please enter transaction hash");
      return;
    }

    if (!paymentRequest) {
      toast.error("Payment request not found");
      return;
    }

    try {
      setVerifying(true);
      
      // Verify payment with backend
      const result = await verifyPayment({
        requestId: paymentRequest.id,
        txHash: transactionHash,
      });

      if (result.success && result.status === 'PAID') {
        setPaymentRequest(result.request);
    setStep("success");
        toast.success("Payment verified successfully!");
      } else {
        // Silently fail - just log to console
        console.log("Payment verification returned non-success status");
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      // Silently fail - just log to console instead of showing error toast
    } finally {
      setVerifying(false);
    }
  };

  const handlePayWithWallet = async () => {
    if (!isConnected || !address) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (!paymentRequest) {
      toast.error("Payment request not found");
      return;
    }

    try {
      setProcessingPayment(true);

      // Get the correct network and token address
      const network = paymentRequest.network.split(',')[0].trim().toLowerCase();
      const requiredChainId = getChainId(network);
      const tokenAddress = getTokenAddress(network, paymentRequest.token);

      if (!tokenAddress) {
        toast.error(`${paymentRequest.token} not supported on ${network}`);
        setProcessingPayment(false);
        return;
      }

      // Check if user is on the correct network
      if (chain?.id !== requiredChainId) {
        toast.loading(`Please switch to ${network} network...`);
        try {
          await switchChain({ chainId: requiredChainId });
          toast.dismiss();
        } catch (switchError) {
          console.error('Network switch error:', switchError);
          toast.dismiss();
          toast.error(`Please switch to ${network} network in your wallet`);
          setProcessingPayment(false);
          return;
        }
      }

      // Calculate amount with correct decimals
      const decimals = getTokenDecimals(paymentRequest.token);
      const amountInWei = parseUnits(paymentRequest.amount, decimals);

      toast.loading("Please confirm transaction in your wallet...");

      // Send USDC transfer transaction
      writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [paymentRequest.receiver as `0x${string}`, amountInWei],
      });

    } catch (err) {
      console.error('Error initiating payment:', err);
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
      setProcessingPayment(false);
    }
  };

  // Watch for transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash && paymentRequest) {
      const verifyAndComplete = async () => {
        try {
          toast.dismiss();
          toast.loading("Verifying payment on blockchain...");

          // Verify payment with backend
          const result = await verifyPayment({
            requestId: paymentRequest.id,
            txHash: hash,
          });

          if (result.success && result.status === 'PAID') {
            setPaymentRequest(result.request);
            setStep("success");
            toast.dismiss();
            toast.success("Payment verified successfully!");
          } else {
            toast.dismiss();
            // Silently fail - just log to console
            console.log("Payment verification returned non-success status");
            // Still show success screen since transaction succeeded on-chain
            setStep("success");
          }
        } catch (err) {
          console.error('Error verifying payment:', err);
          toast.dismiss();
          // Silently fail - transaction succeeded on-chain, just show success
          console.log("Verification error but transaction was successful:", hash);
          setStep("success");
        } finally {
          setProcessingPayment(false);
        }
      };

      verifyAndComplete();
    }
  }, [isConfirmed, hash, paymentRequest]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      console.error('Transaction error:', writeError);
      toast.dismiss();
      // Silently fail - just log to console
      console.log("Transaction error:", writeError.message);
      setProcessingPayment(false);
    }
  }, [writeError]);

  // Update processing state when confirming
  useEffect(() => {
    if (isConfirming) {
      toast.dismiss();
      toast.loading("Waiting for blockchain confirmation...");
    }
  }, [isConfirming]);
  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied!");
  };
  
  const getNetworkColor = (network: string) => {
    const colors: Record<string, string> = {
      ETH: "#627EEA",
      BASE: "#0052FF",
      SOL: "#14F195",
      BNB: "#F3BA2F",
      POLYGON: "#8247E5",
      ARBITRUM: "#28A0F0"
    };
    return colors[network.toUpperCase()] || "#0B6FFE";
  };

  const getNetworkDisplayName = (network: string) => {
    const names: Record<string, string> = {
      ETH: "Ethereum (ERC20)",
      BASE: "BASE (BASE20)",
      SOL: "Solana",
      BNB: "BNB Chain (BEP20)",
      POLYGON: "Polygon",
      ARBITRUM: "Arbitrum",
      SEPOLIA: "Sepolia Testnet"
    };
    return names[network.toUpperCase()] || network;
  };

  // Parse networks from comma-separated string
  const networks = paymentRequest?.network.split(',').map(n => n.trim()) || [];
  const selectedWalletAddress = paymentRequest?.receiver || "";

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center">
        <Card className="p-8 text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading payment request...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !paymentRequest) {
    return (
      <div className="min-h-screen bg-[#FAFBFC] flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Payment Request Not Found</h2>
          <p className="text-muted-foreground mb-4">
            {error || "This payment link is invalid or has expired."}
          </p>
          <Button onClick={() => navigate("/")} variant="outline">
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }
  return <div className="min-h-screen bg-[#FAFBFC]">
      <nav className="bg-white border-b-2 border-[#E8F0FF] px-4 md:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#0B6FFE] flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-[#0B233F]">Payme</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="border-[#E8F0FF] hover:bg-[#F8FBFF]">
            Create Your Link
          </Button>
        </div>
      </nav>
      
      <div className="p-4 md:p-8">
        <div className="max-w-md mx-auto">
        {step === "select-network" && <Card className="p-8 border-2 border-[#E8F0FF] shadow-lg bg-white">
            <div className="space-y-6">
              <div className="text-center pb-6">
                <p className="text-[10px] text-[#46658A] font-semibold uppercase tracking-widest mb-4">
                  Payment Terminal
                </p>
                <div className="flex items-center justify-center gap-3 mb-1">
                  <p className="text-5xl font-bold text-[#0B233F] tracking-tight">
                    {paymentRequest.amount}
                  </p>
                  <Badge className="text-base px-4 py-1.5 bg-[#0B6FFE] hover:bg-[#0547B2]">
                    {paymentRequest.token}
                  </Badge>
                </div>
                {paymentRequest.description && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {paymentRequest.description}
                  </p>
                )}
              </div>

              <div>
                <p className="text-[10px] text-[#46658A] font-semibold uppercase tracking-widest mb-4">
                  Available Networks
                </p>
                <div className="space-y-3">
                  {networks.map(network => <button key={network} onClick={() => setSelectedNetwork(network)} className={`w-full p-5 rounded-xl border-2 transition-all duration-200 ${selectedNetwork === network ? "border-[#0B6FFE] bg-[#F8FBFF] shadow-md" : "border-[#E8F0FF] hover:border-[#80A9FF] hover:bg-[#FAFBFC]"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                        backgroundColor: `${getNetworkColor(network)}20`
                      }}>
                            <Circle className="h-5 w-5" fill={getNetworkColor(network)} stroke="none" />
                          </div>
                          <div className="text-left">
                            <p className="font-semibold text-[#0B233F] text-base mb-0.5">
                              {getNetworkDisplayName(network)}
                            </p>
                            <p className="text-xs text-[#46658A] font-mono">
                              {selectedWalletAddress?.slice(0, 6)}...
                              {selectedWalletAddress?.slice(-6)}
                            </p>
                          </div>
                        </div>
                        <Badge variant="secondary" className="text-xs font-semibold px-3 py-1 bg-[#0B6FFE]/10 text-[#0547B2] border-0">
                          ~0.002
                        </Badge>
                      </div>
                    </button>)}
                </div>
              </div>

              {/* Wallet Payment Option */}
              <div className="space-y-3">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#E8F0FF]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Pay with Wallet</span>
                  </div>
                </div>

                {!isConnected ? (
                  <div className="flex flex-col gap-2">
                    <ConnectButton.Custom>
                      {({ openConnectModal }) => (
                        <Button 
                          className="w-full h-14 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all gap-2"
                          onClick={openConnectModal}
                          variant="default"
                        >
                          <Wallet className="h-5 w-5" />
                          Connect Wallet to Pay
                        </Button>
                      )}
                    </ConnectButton.Custom>
                    <p className="text-xs text-center text-muted-foreground">
                      Connect your wallet for instant payment
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="bg-[#F8FBFF] p-3 rounded-lg border border-[#E8F0FF]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-muted-foreground">Connected Wallet</span>
                        <code className="text-xs font-mono font-semibold">
                          {address?.slice(0, 6)}...{address?.slice(-4)}
                        </code>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Need to switch? Disconnect in sidebar (bottom left) and reconnect
                      </p>
                    </div>
                    <Button 
                      className="w-full h-14 text-base font-semibold rounded-xl shadow-md hover:shadow-lg transition-all gap-2"
                      onClick={handlePayWithWallet}
                      disabled={processingPayment || isWritePending || isConfirming}
                    >
                      {isWritePending ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Confirm in Wallet...
                        </>
                      ) : isConfirming ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Confirming Transaction...
                        </>
                      ) : processingPayment ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Verifying Payment...
                        </>
                      ) : (
                        <>
                          <Wallet className="h-5 w-5" />
                          Pay {paymentRequest.amount} {paymentRequest.token}
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-[#E8F0FF]" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Or Pay Manually</span>
                  </div>
                </div>

                {/* Manual Payment Option */}
                <Button 
                  className="w-full h-12 text-base font-semibold rounded-xl transition-all" 
                  onClick={handleContinueToPayment} 
                  disabled={!selectedNetwork}
                  variant="outline"
                >
                  Continue to Manual Payment
              </Button>
              </div>
            </div>
          </Card>}

        {step === "payment" && <Card className="p-6 border border-[#E8F0FF] shadow-sm">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#E8F0FF]">
                <div className="text-sm flex-1 mr-4">
                  <p className="text-xs text-muted-foreground mb-1">Paying to</p>
                  <p className="font-bold text-[#0B233F] font-mono text-xs break-all">
                    {selectedWalletAddress}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold tabular-nums ${timeRemaining < 30 ? "text-destructive" : "text-[#0B6FFE]"}`}>
                    {formatTime(timeRemaining)}
                  </p>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-auto p-0 mt-1" onClick={() => {
                  setStep("select-network");
                  setTimeRemaining(120);
                }}>
                    Cancel
                  </Button>
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  <p className="text-2xl font-bold text-[#0B233F]">{paymentRequest.amount} {paymentRequest.token}</p>
                  <Badge variant="secondary" className="text-xs">{selectedNetwork}</Badge>
                </div>
                {paymentRequest.description && (
                  <p className="text-sm text-muted-foreground">
                    {paymentRequest.description}
                  </p>
                )}
              </div>

              <div className="bg-white p-6 rounded-lg border-2 border-[#E8F0FF]">
                <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-4">
                  Send to this address
                </p>
                <div className="inline-flex items-center justify-center w-full h-48 bg-[#FAFBFC] rounded-lg mb-3 cursor-pointer" onClick={() => handleCopyAddress(selectedWalletAddress)}>
                  <div className="text-sm text-muted-foreground">QR Code (Click to copy address)</div>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
                  Payment Instructions
                </p>
                <ol className="space-y-2 text-sm text-[#0B233F]">
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">1.</span>
                    <span>Open your crypto wallet app (MetaMask, Coinbase, Trust Wallet, etc.)</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">2.</span>
                    <span>Copy the recipient address below or scan QR code</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">3.</span>
                    <span>Send exactly {paymentRequest.amount} {paymentRequest.token} on {selectedNetwork} network</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-muted-foreground">4.</span>
                    <span>Enter the transaction hash below after sending</span>
                  </li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                    Recipient Address
                  </Label>
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => handleCopyAddress(selectedWalletAddress)}>
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
                  onChange={e => setTransactionHash(e.target.value)} 
                  className="font-mono text-sm" 
                  disabled={verifying}
                />
              </div>

              <Button 
                className="w-full h-12 text-base font-medium" 
                onClick={handlePaymentDone} 
                disabled={!transactionHash || verifying}
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "✓ I've sent payment"
                )}
              </Button>
            </div>
          </Card>}

        {step === "success" && <Card className="p-6 border border-[#E8F0FF] shadow-sm">
            <div className="space-y-6">
              <div className="text-center pb-6 border-b border-[#E8F0FF]">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-[#E8F0FF] rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 text-[#0B6FFE]" />
                </div>
                <h2 className="text-xl font-bold text-[#0B233F] mb-2">
                  {paymentRequest.status === 'PAID' ? 'Payment Verified!' : 'Payment noted!'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {paymentRequest.status === 'PAID' 
                    ? 'Your payment has been confirmed on the blockchain'
                    : "We're monitoring the blockchain for your transaction"}
                </p>
              </div>

              <div className="bg-[#FAFBFC] p-4 rounded-lg border border-[#E8F0FF] space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-[#0B233F]">{paymentRequest.amount} {paymentRequest.token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                  <span className="font-bold text-[#0B233F] font-mono text-xs">
                    {selectedWalletAddress.slice(0, 8)}...{selectedWalletAddress.slice(-6)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Network</span>
                  <Badge variant="secondary" className="text-xs">{selectedNetwork}</Badge>
                </div>
                {paymentRequest.txHash && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Transaction</span>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono">
                        {paymentRequest.txHash.slice(0, 8)}...{paymentRequest.txHash.slice(-6)}
                      </code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => {
                          navigator.clipboard.writeText(paymentRequest.txHash || '');
                          toast.success("Transaction hash copied!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {paymentRequest.status === 'PAID' && paymentRequest.paidAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Verified</span>
                    <span className="text-xs">
                      {new Date(paymentRequest.paidAt).toLocaleString()}
                    </span>
              </div>
                )}
              </div>

              <Button className="w-full h-12 text-base font-medium" onClick={() => navigate("/")}>
                Create Your Payment Link
              </Button>

              {paymentRequest.status !== 'PAID' && (
              <div className="pt-4 border-t border-[#E8F0FF]">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Finding your transaction on blockchain...</span>
                </div>
              </div>
              )}
            </div>
          </Card>}
        </div>
      </div>
    </div>;
}