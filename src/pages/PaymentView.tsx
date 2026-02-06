import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, CheckCircle2, Circle, Loader2, AlertCircle, Wallet, Clock, ExternalLink, Sparkles, ArrowRight, Shield, Bot } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useSendTransaction } from 'wagmi';
import { parseUnits, parseEther } from 'viem';
import { getPaymentRequest, verifyPayment, type PaymentRequest } from "@/lib/api";
import { getAgents, payLink, isAgentServiceConfigured, type AgentInfo } from "@/lib/agentApi";
import { ERC20_ABI, getTokenAddress, getChainId, getTokenDecimals, isNativeToken as checkIsNativeToken, getExplorerUrl } from "@/lib/contracts";

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
  const [isNativeToken, setIsNativeToken] = useState(false);
  const [expiryTimeRemaining, setExpiryTimeRemaining] = useState<number | null>(null);
  // Pay as human vs Pay as agent
  const [paymentMode, setPaymentMode] = useState<'human' | 'agent'>('human');
  const [agentList, setAgentList] = useState<AgentInfo[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<1 | 2>(1);
  const [agentPayLoading, setAgentPayLoading] = useState(false);
  
  // Wagmi hooks for ERC20 token transfers
  const { data: hash, writeContract, isPending: isWritePending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  // Wagmi hooks for native ETH transfers
  const { data: ethHash, sendTransaction, isPending: isEthPending, error: ethError } = useSendTransaction();
  const { isLoading: isEthConfirming, isSuccess: isEthConfirmed } = useWaitForTransactionReceipt({
    hash: ethHash,
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
          let expiresAtTimestamp: number | null = null;
          if (response.payment.expiresAt) {
            expiresAtTimestamp = typeof response.payment.expiresAt === 'string' 
              ? new Date(response.payment.expiresAt).getTime()
              : response.payment.expiresAt;
          }
          
          const request: PaymentRequest = {
            id: response.payment.id,
            token: response.payment.token,
            amount: response.payment.amount,
            receiver: response.payment.receiver,
            payer: null,
            description: response.payment.description,
            network: response.payment.network,
            status: 'PENDING',
            createdAt: response.payment.createdAt ? new Date(response.payment.createdAt).getTime() : Date.now(),
            expiresAt: expiresAtTimestamp,
            txHash: null,
            paidAt: null,
            creatorWallet: null,
          };
          setPaymentRequest(request);
        } else if (response.request) {
          const req = response.request;
          if (req.expiresAt && typeof req.expiresAt === 'string') {
            req.expiresAt = new Date(req.expiresAt).getTime();
          }
          setPaymentRequest(req);
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

  // Expiry countdown timer
  useEffect(() => {
    if (!paymentRequest?.expiresAt) {
      setExpiryTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const expiresAt = new Date(paymentRequest.expiresAt!).getTime();
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
      return remaining;
    };

    setExpiryTimeRemaining(calculateTimeRemaining());

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setExpiryTimeRemaining(remaining);
      
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentRequest?.expiresAt]);

  // Fetch agents when Pay as agent is available
  useEffect(() => {
    if (!isAgentServiceConfigured() || paymentMode !== 'agent') return;
    getAgents()
      .then((r) => setAgentList(r.agents || []))
      .catch(() => setAgentList([]));
  }, [paymentMode]);

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

  const formatExpiryTime = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (days > 0) {
      return `${days}d ${hours}h ${mins}m`;
    } else if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
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
      
      const result = await verifyPayment({
        requestId: paymentRequest.id,
        txHash: transactionHash,
      });

      if (result.success && result.status === 'PAID') {
        setPaymentRequest(result.request);
    setStep("success");
        toast.success("Payment verified successfully!");
      } else {
        console.log("Payment verification returned non-success status");
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
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

      const network = paymentRequest.network.split(',')[0].trim().toLowerCase();
      const requiredChainId = getChainId(network);
      const tokenUpper = paymentRequest.token.toUpperCase();
      const isNative = checkIsNativeToken(tokenUpper, network);
      setIsNativeToken(isNative);

      const tokenAddress = isNative ? null : getTokenAddress(network, paymentRequest.token);

      if (!isNative && !tokenAddress) {
        toast.error(`${paymentRequest.token} not supported on ${network}`);
        setProcessingPayment(false);
        return;
      }

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

      toast.loading("Please confirm transaction in your wallet...");

      if (isNative) {
        const amountInWei = parseEther(paymentRequest.amount);
        
        sendTransaction({
          to: paymentRequest.receiver as `0x${string}`,
          value: amountInWei,
        });
      } else {
        const decimals = getTokenDecimals(paymentRequest.token);
        const amountInWei = parseUnits(paymentRequest.amount, decimals);

        // @ts-expect-error - wagmi v2 type issue with writeContract
        writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [paymentRequest.receiver as `0x${string}`, amountInWei],
        });
      }

    } catch (err) {
      console.error('Error initiating payment:', err);
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Failed to initiate payment");
      setProcessingPayment(false);
    }
  };

  const handlePayWithAgent = async () => {
    if (!paymentRequest?.id || agentPayLoading) return;
    try {
      setAgentPayLoading(true);
      toast.loading("Agent is paying...");
      const result = await payLink(paymentRequest.id, selectedAgentId);
      toast.dismiss();
      if (result.success && result.request) {
        setPaymentRequest({
          ...paymentRequest,
          ...result.request,
          status: 'PAID',
          txHash: result.txHash || result.request.txHash || null,
          paidAt: result.request.paidAt ?? Date.now()
        });
        setStep("success");
        toast.success(result.alreadyPaid ? "Already paid." : "Payment confirmed!");
        if (result.txHash && result.explorerUrl) {
          toast.success("View on Explorer", { action: { label: "Open", onClick: () => window.open(result.explorerUrl) } });
        }
      }
    } catch (err) {
      toast.dismiss();
      toast.error(err instanceof Error ? err.message : "Agent payment failed");
    } finally {
      setAgentPayLoading(false);
    }
  };

  // Watch for ERC20 transaction confirmation
  useEffect(() => {
    if (isConfirmed && hash && paymentRequest && !isNativeToken) {
      const verifyAndComplete = async () => {
        try {
          toast.dismiss();
          toast.loading("Verifying payment on blockchain...");

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
            console.log("Payment verification returned non-success status");
            setStep("success");
          }
        } catch (err) {
          console.error('Error verifying payment:', err);
          toast.dismiss();
          console.log("Verification error but transaction was successful:", hash);
          setStep("success");
        } finally {
          setProcessingPayment(false);
        }
      };

      verifyAndComplete();
    }
  }, [isConfirmed, hash, paymentRequest, isNativeToken]);

  // Watch for ETH transaction confirmation
  useEffect(() => {
    if (isEthConfirmed && ethHash && paymentRequest && isNativeToken) {
      const verifyAndComplete = async () => {
        try {
          toast.dismiss();
          toast.loading("Verifying ETH payment on blockchain...");

          const result = await verifyPayment({
            requestId: paymentRequest.id,
            txHash: ethHash,
          });

          if (result.success && result.status === 'PAID') {
            setPaymentRequest(result.request);
            setStep("success");
            toast.dismiss();
            toast.success("Payment verified successfully!");
          } else {
            toast.dismiss();
            console.log("Payment verification returned non-success status");
            setStep("success");
          }
        } catch (err) {
          console.error('Error verifying payment:', err);
          toast.dismiss();
          console.log("Verification error but transaction was successful:", ethHash);
          setStep("success");
        } finally {
          setProcessingPayment(false);
        }
      };

      verifyAndComplete();
    }
  }, [isEthConfirmed, ethHash, paymentRequest, isNativeToken]);

  // Handle ERC20 write errors
  useEffect(() => {
    if (writeError) {
      console.error('ERC20 Transaction error:', writeError);
      toast.dismiss();
      console.log("Transaction error:", writeError.message);
      setProcessingPayment(false);
    }
  }, [writeError]);

  // Handle ETH send errors
  useEffect(() => {
    if (ethError) {
      console.error('ETH Transaction error:', ethError);
      toast.dismiss();
      console.log("ETH Transaction error:", ethError.message);
      setProcessingPayment(false);
    }
  }, [ethError]);

  // Update processing state when confirming (ERC20)
  useEffect(() => {
    if (isConfirming) {
      toast.dismiss();
      toast.loading("Waiting for blockchain confirmation...");
    }
  }, [isConfirming]);

  // Update processing state when confirming (ETH)
  useEffect(() => {
    if (isEthConfirming) {
      toast.dismiss();
      toast.loading("Waiting for ETH transaction confirmation...");
    }
  }, [isEthConfirming]);

  const handleCopyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
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
    const networkLower = network.toLowerCase();
    
    if (networkLower.includes('sepolia')) return "Sepolia (Ethereum Testnet)";
    if (networkLower.includes('eth testnet')) return "Sepolia (Ethereum Testnet)";
    
    const names: Record<string, string> = {
      ETH: "Ethereum Mainnet",
      BASE: "BASE Chain",
      SOL: "Solana",
      BNB: "BNB Chain",
      POLYGON: "Polygon",
      ARBITRUM: "Arbitrum",
      SEPOLIA: "Sepolia (Ethereum Testnet)"
    };
    return names[network.toUpperCase()] || network;
  };

  const networks = paymentRequest?.network.split(',').map(n => n.trim()) || [];
  const selectedWalletAddress = paymentRequest?.receiver || "";

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary/5 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/15 to-accent/25 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/40 to-primary/15 rounded-full blur-3xl" />
        </div>
        <Card className="p-8 text-center bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl shadow-primary/10 rounded-3xl relative z-10">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground font-medium">Loading payment request...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !paymentRequest) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary/5 flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-red-500/10 to-orange-500/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/40 to-primary/15 rounded-full blur-3xl" />
        </div>
        <Card className="p-8 text-center max-w-md bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl shadow-red-500/10 rounded-3xl relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500/10 to-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-2xl font-heading font-bold mb-2">Payment Not Found</h2>
          <p className="text-muted-foreground mb-6">
            {error || "This payment link is invalid or has expired."}
          </p>
          <Button 
            onClick={() => navigate("/")} 
            variant="outline"
            className="rounded-xl hover:bg-primary/5 hover:border-primary/30"
          >
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-primary/5 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-primary/15 to-accent/25 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[400px] h-[400px] bg-gradient-to-tr from-blue-200/40 to-primary/15 rounded-full blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0066ff05_1px,transparent_1px),linear-gradient(to_bottom,#0066ff05_1px,transparent_1px)] bg-[size:60px_60px]" />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 bg-white/80 backdrop-blur-xl border-b border-border/50 px-4 md:px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-heading font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              PayMe
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton 
              accountStatus="address"
              chainStatus="icon"
              showBalance={false}
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/")} 
              className="rounded-xl hover:bg-primary/5 hover:border-primary/30 gap-2 hidden sm:flex"
            >
              <Sparkles className="h-3 w-3" />
            Create Your Link
          </Button>
          </div>
        </div>
      </nav>
      
      <div className="p-4 md:p-8 relative z-10">
        <div className="max-w-md mx-auto">
          {step === "select-network" && (
            <Card className="p-8 bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl shadow-primary/10 rounded-3xl">
            <div className="space-y-6">
                {/* Expiry Timer Banner */}
                {expiryTimeRemaining !== null && (
                  <div className={`flex items-center justify-center gap-2 py-3 px-4 rounded-2xl ${
                    expiryTimeRemaining <= 0 
                      ? 'bg-gradient-to-r from-red-500/10 to-rose-500/15 border border-red-500/20' 
                      : expiryTimeRemaining < 3600 
                        ? 'bg-gradient-to-r from-orange-500/10 to-amber-500/15 border border-orange-500/20' 
                        : 'bg-gradient-to-r from-primary/5 to-accent/10 border border-primary/10'
                  }`}>
                    <Clock className={`h-4 w-4 ${
                      expiryTimeRemaining <= 0 
                        ? 'text-red-500' 
                        : expiryTimeRemaining < 3600 
                          ? 'text-orange-500' 
                          : 'text-primary'
                    }`} />
                    <span className={`text-sm font-semibold ${
                      expiryTimeRemaining <= 0 
                        ? 'text-red-700' 
                        : expiryTimeRemaining < 3600 
                          ? 'text-orange-700' 
                          : 'text-primary'
                    }`}>
                      {expiryTimeRemaining <= 0 
                        ? 'This payment link has expired' 
                        : `Expires in ${formatExpiryTime(expiryTimeRemaining)}`}
                    </span>
                  </div>
                )}

                {/* Header */}
              <div className="text-center pb-6">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10 mb-4">
                    <Sparkles className="w-3 h-3 text-primary" />
                    <span className="text-xs font-medium text-primary">Payment Terminal</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <p className="text-5xl font-heading font-bold text-foreground tracking-tight">
                      {paymentRequest.amount}
                    </p>
                    <Badge className="text-base px-4 py-1.5 bg-gradient-to-r from-primary to-secondary border-0 shadow-lg shadow-primary/25">
                      {paymentRequest.token}
                    </Badge>
                  </div>
                  {paymentRequest.description && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {paymentRequest.description}
                    </p>
                  )}
                </div>

                {/* Payment Details */}
                <div className="bg-gradient-to-br from-muted/30 to-primary/5 p-5 rounded-2xl border border-border/50 space-y-4">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-2">
                    <Shield className="h-3 w-3" />
                    Payment Details
                  </p>
                  
                  {/* Receiver Address */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Transfer To</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-semibold text-foreground bg-white px-3 py-2.5 rounded-xl border border-border/50 flex-1 break-all shadow-sm">
                        {selectedWalletAddress}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-xl hover:bg-primary/5 hover:border-primary/30"
                        onClick={() => handleCopyAddress(selectedWalletAddress)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                </div>
              </div>

                  {/* Network */}
              <div>
                    <p className="text-xs text-muted-foreground mb-2">Network / Chain</p>
                    <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-xl border border-border/50 shadow-sm">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                        backgroundColor: `${getNetworkColor(paymentRequest.network.split(',')[0].trim())}15`
                      }}>
                        <Circle className="h-4 w-4" fill={getNetworkColor(paymentRequest.network.split(',')[0].trim())} stroke="none" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">
                        {getNetworkDisplayName(paymentRequest.network.split(',')[0].trim())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment method: Pay as human vs Pay as agent */}
                {(() => {
                  const isUsdcSepolia = paymentRequest.token?.toUpperCase() === 'USDC' &&
                    paymentRequest.network?.toLowerCase().includes('sepolia');
                  const showAgentOption = isUsdcSepolia && isAgentServiceConfigured();
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">
                        How do you want to pay?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={paymentMode === 'human' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 rounded-xl"
                          onClick={() => setPaymentMode('human')}
                        >
                          <Wallet className="h-4 w-4 mr-1.5" />
                          Pay as human
                        </Button>
                        {showAgentOption && (
                          <Button
                            type="button"
                            variant={paymentMode === 'agent' ? 'default' : 'outline'}
                            size="sm"
                            className="flex-1 rounded-xl"
                            onClick={() => setPaymentMode('agent')}
                          >
                            <Bot className="h-4 w-4 mr-1.5" />
                            Pay as agent
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Pay as agent: dropdown + button */}
                {paymentMode === 'agent' && isAgentServiceConfigured() && (
                  <div className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-xs text-muted-foreground font-medium">Select agent wallet (USDC on Sepolia)</p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <select
                        className="flex h-10 rounded-xl border border-border bg-background px-3 text-sm"
                        value={selectedAgentId}
                        onChange={(e) => setSelectedAgentId(Number(e.target.value) as 1 | 2)}
                      >
                        {agentList.map((a) => (
                          <option key={a.id} value={a.id}>Agent {a.id} ({a.address})</option>
                        ))}
                        {agentList.length === 0 && (
                          <>
                            <option value={1}>Agent 1</option>
                            <option value={2}>Agent 2</option>
                          </>
                        )}
                      </select>
                      <Button
                        className="flex-1 rounded-xl bg-primary hover:bg-primary/90 gap-2"
                        onClick={handlePayWithAgent}
                        disabled={agentPayLoading || (expiryTimeRemaining !== null && expiryTimeRemaining <= 0)}
                      >
                        {agentPayLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Paying...
                          </>
                        ) : (
                          <>
                            <Bot className="h-4 w-4" />
                            Pay with agent
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Pay as human: Wallet + Manual (only when paymentMode is human) */}
                {paymentMode === 'human' && (
                  <>
                {/* Network Selection - Only if multiple */}
                {networks.length > 1 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-4">
                      Select Network
                    </p>
                    <div className="space-y-3">
                      {networks.map(network => (
                        <button 
                          key={network} 
                          onClick={() => setSelectedNetwork(network)} 
                          className={`w-full p-4 rounded-2xl border-2 transition-all duration-300 ${
                            selectedNetwork === network 
                              ? "border-primary bg-gradient-to-r from-primary/5 to-accent/10 shadow-lg shadow-primary/10" 
                              : "border-border/50 hover:border-primary/30 hover:bg-primary/5"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                              backgroundColor: `${getNetworkColor(network)}15`
                      }}>
                            <Circle className="h-5 w-5" fill={getNetworkColor(network)} stroke="none" />
                            </div>
                            <span className="font-semibold text-foreground">
                              {getNetworkDisplayName(network)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet Payment */}
                <div className="space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-muted-foreground font-medium">Pay with Wallet</span>
                    </div>
                  </div>

                  {!isConnected ? (
                    <div className="flex flex-col gap-3">
                      <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                          <Button 
                            className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                            onClick={openConnectModal}
                          >
                            <Wallet className="h-5 w-5" />
                            Connect Wallet to Pay
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </ConnectButton.Custom>
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                        <Shield className="h-3 w-3" />
                        Connect your wallet for instant payment
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      <div className="bg-gradient-to-r from-primary/5 to-accent/10 p-4 rounded-2xl border border-primary/10">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-muted-foreground block mb-1">Paying From</span>
                            <code className="text-sm font-mono font-bold text-foreground">
                              {address?.slice(0, 6)}...{address?.slice(-4)}
                            </code>
                          </div>
                          <ConnectButton.Custom>
                            {({ openAccountModal }) => (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={openAccountModal}
                                className="text-xs rounded-xl hover:bg-primary/5"
                              >
                                Switch
                              </Button>
                            )}
                          </ConnectButton.Custom>
                        </div>
                      </div>
                      <Button 
                        className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                        onClick={handlePayWithWallet}
                        disabled={processingPayment || isWritePending || isConfirming || isEthPending || isEthConfirming || (expiryTimeRemaining !== null && expiryTimeRemaining <= 0)}
                      >
                        {(isWritePending || isEthPending) ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Confirm in Wallet...
                          </>
                        ) : (isConfirming || isEthConfirming) ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Confirming Transaction...
                          </>
                        ) : processingPayment ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Verifying Payment...
                          </>
                        ) : (expiryTimeRemaining !== null && expiryTimeRemaining <= 0) ? (
                          <>
                            <AlertCircle className="h-5 w-5" />
                            Link Expired
                          </>
                        ) : (
                          <>
                            <Wallet className="h-5 w-5" />
                            Pay {paymentRequest.amount} {paymentRequest.token}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-3 text-muted-foreground font-medium">Or Pay Manually</span>
                    </div>
                  </div>

                  {/* Manual Payment */}
                  <Button 
                    className="w-full h-12 text-base font-semibold rounded-2xl transition-all" 
                    onClick={handleContinueToPayment} 
                    disabled={!selectedNetwork}
                    variant="outline"
                  >
                    Continue to Manual Payment
                  </Button>
                </div>
                  </>
                )}
              </div>
            </Card>
          )}

          {step === "payment" && (
            <Card className="p-6 bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl shadow-primary/10 rounded-3xl">
            <div className="space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-border/50">
                  <div className="text-sm flex-1 mr-4">
                  <p className="text-xs text-muted-foreground mb-1">Paying to</p>
                    <p className="font-bold text-foreground font-mono text-xs break-all">
                      {selectedWalletAddress}
                    </p>
                </div>
                <div className="text-right">
                    <p className={`text-xl font-heading font-bold tabular-nums ${timeRemaining < 30 ? "text-destructive" : "text-primary"}`}>
                    {formatTime(timeRemaining)}
                  </p>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive h-auto p-0 mt-1 text-xs" 
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
                    <p className="text-2xl font-heading font-bold text-foreground">{paymentRequest.amount} {paymentRequest.token}</p>
                    <Badge variant="secondary" className="text-xs rounded-lg">{selectedNetwork}</Badge>
                  </div>
                  {paymentRequest.description && (
                    <p className="text-sm text-muted-foreground">
                      {paymentRequest.description}
                    </p>
                  )}
              </div>

                <div className="bg-white p-6 rounded-2xl border border-border/50 shadow-sm">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide text-center mb-4 font-medium">
                  Send to this address
                </p>
                  <div 
                    className="inline-flex items-center justify-center w-full h-48 bg-gradient-to-br from-muted/30 to-primary/5 rounded-xl mb-3 cursor-pointer hover:from-muted/50 hover:to-primary/10 transition-colors border border-border/30" 
                    onClick={() => handleCopyAddress(selectedWalletAddress)}
                  >
                    <div className="text-sm text-muted-foreground">QR Code (Click to copy address)</div>
                  </div>
              </div>

              <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-3 font-medium">
                  Payment Instructions
                </p>
                  <ol className="space-y-2 text-sm text-foreground">
                    <li className="flex gap-3">
                      <span className="text-primary font-bold">1.</span>
                      <span>Open your crypto wallet app (MetaMask, Coinbase, Trust Wallet, etc.)</span>
                    </li>
                  <li className="flex gap-3">
                      <span className="text-primary font-bold">2.</span>
                      <span>Copy the recipient address below or scan QR code</span>
                  </li>
                  <li className="flex gap-3">
                      <span className="text-primary font-bold">3.</span>
                      <span>Send exactly {paymentRequest.amount} {paymentRequest.token} on {selectedNetwork} network</span>
                  </li>
                  <li className="flex gap-3">
                      <span className="text-primary font-bold">4.</span>
                      <span>Enter the transaction hash below after sending</span>
                  </li>
                </ol>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
                    Recipient Address
                  </Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-auto p-0 text-xs text-primary hover:text-primary/80" 
                      onClick={() => handleCopyAddress(selectedWalletAddress)}
                    >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </Button>
                </div>
                  <code className="block text-xs bg-muted/50 px-4 py-3 rounded-xl border border-border/50 break-all font-mono text-foreground">
                  {selectedWalletAddress}
                </code>
              </div>

              <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block font-medium">
                  Transaction Hash (After sending)
                </Label>
                  <Input 
                    placeholder="Enter transaction hash (0x...)" 
                    value={transactionHash} 
                    onChange={e => setTransactionHash(e.target.value)} 
                    className="font-mono text-sm rounded-xl" 
                    disabled={verifying}
                  />
              </div>

                <Button 
                  className="w-full h-12 text-base font-semibold rounded-2xl bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg shadow-primary/25" 
                  onClick={handlePaymentDone} 
                  disabled={!transactionHash || verifying}
                >
                  {verifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      I've sent payment
                    </>
                  )}
              </Button>
            </div>
            </Card>
          )}

          {step === "success" && (
            <Card className="p-8 bg-white/90 backdrop-blur-xl border-white/50 shadow-2xl shadow-green-500/10 rounded-3xl">
            <div className="space-y-6">
                <div className="text-center pb-6 border-b border-border/50">
                  <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-500/10 to-emerald-500/20 rounded-2xl mb-4 shadow-lg shadow-green-500/20">
                    <CheckCircle2 className="w-10 h-10 text-green-600" />
                </div>
                  <h2 className="text-2xl font-heading font-bold text-foreground mb-2">
                    {paymentRequest.status === 'PAID' ? 'Payment Verified!' : 'Payment Noted!'}
                  </h2>
                <p className="text-sm text-muted-foreground">
                    {paymentRequest.status === 'PAID' 
                      ? 'Your payment has been confirmed on the blockchain'
                      : "We're monitoring the blockchain for your transaction"}
                </p>
              </div>

                <div className="bg-gradient-to-br from-muted/30 to-green-500/5 p-5 rounded-2xl border border-green-500/10 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-foreground">{paymentRequest.amount} {paymentRequest.token}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To</span>
                    <span className="font-bold text-foreground font-mono text-xs">
                      {selectedWalletAddress.slice(0, 8)}...{selectedWalletAddress.slice(-6)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Network</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs rounded-lg">{selectedNetwork}</Badge>
                      {paymentRequest.txHash && (
                        <a
                          href={`${getExplorerUrl(paymentRequest.network)}/tx/${paymentRequest.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 transition-colors"
                          title="View on Explorer"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                  {paymentRequest.txHash && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Transaction Hash</span>
                      <div className="flex items-center gap-2">
                        <a
                          href={`${getExplorerUrl(paymentRequest.network)}/tx/${paymentRequest.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-primary hover:underline"
                        >
                          {paymentRequest.txHash.slice(0, 8)}...{paymentRequest.txHash.slice(-6)}
                        </a>
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

                <Button 
                  className="w-full h-14 text-base font-semibold rounded-2xl shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 gap-2 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90" 
                  onClick={() => navigate("/")}
                >
                  <Sparkles className="h-5 w-5" />
                  Create Your Payment Link
                  <ArrowRight className="h-4 w-4" />
              </Button>

                {paymentRequest.status !== 'PAID' && (
                  <div className="pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                      <span>Monitoring blockchain for transaction...</span>
                    </div>
                </div>
                )}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
