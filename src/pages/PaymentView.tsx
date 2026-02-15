import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, CheckCircle2, Circle, Loader2, AlertCircle, Wallet, Clock, ExternalLink, ArrowRight, Shield, Info } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useSwitchChain, useSendTransaction } from 'wagmi';
import { parseUnits, parseEther } from 'viem';
import { getPaymentRequest, verifyPayment, getFeeInfo, type PaymentRequest, type FeeInfoResponse, type FeeTransfer } from "@/lib/api";
import { ERC20_ABI, getTokenAddress, getChainId, getTokenDecimals, isNativeToken as checkIsNativeToken, getExplorerUrl } from "@/lib/contracts";

type PaymentStep = "select-network" | "success";

// Parse raw wallet/viem errors into user-friendly messages
function formatTransferError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('User rejected') || msg.includes('denied transaction') || msg.includes('ACTION_REJECTED'))
    return 'You declined the transaction in your wallet.';
  if (msg.includes('insufficient funds') || msg.includes('exceeds balance') || msg.includes('INSUFFICIENT_FUNDS'))
    return 'Insufficient balance to complete this payment.';
  if (msg.includes('nonce'))
    return 'Transaction conflict. Please try again.';
  if (msg.includes('network') || msg.includes('chain'))
    return 'Network error. Please check your wallet is on the correct chain.';
  return 'Transaction failed. Please try again.';
}

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
  const [processingPayment, setProcessingPayment] = useState(false);
  const [isNativeToken, setIsNativeToken] = useState(false);
  const [expiryTimeRemaining, setExpiryTimeRemaining] = useState<number | null>(null);

  // Fee state
  const [feeInfo, setFeeInfo] = useState<FeeInfoResponse | null>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [transferProgress, setTransferProgress] = useState<{ current: number; total: number; hashes: string[] }>({ current: 0, total: 0, hashes: [] });
  const [transferError, setTransferError] = useState<string | null>(null);
  
  // Wagmi hooks
  const { writeContract } = useWriteContract();
  const { sendTransaction } = useSendTransaction();

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
        
        if (response.status === 'PAID' && response.request) {
          setPaymentRequest(response.request);
          setStep('success');
          setLoading(false);
          return;
        }

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

  // Fetch fee info when wallet connects
  useEffect(() => {
    if (!isConnected || !address || !paymentRequest || paymentRequest.status === 'PAID') return;

    const fetchFee = async () => {
      try {
        setFeeLoading(true);
        setFeeError(null);
        const info = await getFeeInfo(paymentRequest.id, address);
        setFeeInfo(info);
      } catch (err) {
        console.error('Error fetching fee info:', err);
        setFeeError(err instanceof Error ? err.message : 'Failed to load fee info');
      } finally {
        setFeeLoading(false);
      }
    };

    fetchFee();
  }, [isConnected, address, paymentRequest?.id]);

  // Expiry countdown timer
  useEffect(() => {
    if (!paymentRequest?.expiresAt) {
      setExpiryTimeRemaining(null);
      return;
    }

    const calculateTimeRemaining = () => {
      const expiresAt = new Date(paymentRequest.expiresAt!).getTime();
      const now = Date.now();
      return Math.max(0, Math.floor((expiresAt - now) / 1000));
    };

    setExpiryTimeRemaining(calculateTimeRemaining());

    const timer = setInterval(() => {
      const remaining = calculateTimeRemaining();
      setExpiryTimeRemaining(remaining);
      if (remaining <= 0) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentRequest?.expiresAt]);

  const formatExpiryTime = (seconds: number) => {
    if (seconds <= 0) return "Expired";
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}d ${hours}h ${mins}m`;
    if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
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

    if (!feeInfo || !feeInfo.transfers || feeInfo.transfers.length === 0) {
      toast.error("Fee info not loaded. Please wait or refresh.");
      return;
    }

    try {
      setProcessingPayment(true);
      setTransferError(null);

      const network = paymentRequest.network.split(',')[0].trim().toLowerCase();
      const requiredChainId = getChainId(network);

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

      const transfers = feeInfo.transfers;
      const totalTransfers = transfers.length;
      const txHashes: string[] = [];
      setTransferProgress({ current: 0, total: totalTransfers, hashes: [] });

      for (let i = 0; i < totalTransfers; i++) {
        const transfer = transfers[i];
        const transferNum = i + 1;
        setTransferProgress({ current: transferNum, total: totalTransfers, hashes: txHashes });

        toast.dismiss();
        toast.loading(`Transaction ${transferNum}/${totalTransfers}: ${transfer.description}. Please confirm in wallet...`);

        const isNative = checkIsNativeToken(transfer.token.toUpperCase(), network);
        setIsNativeToken(isNative);

        try {
          let txHash: string;

          if (isNative) {
            txHash = await new Promise<string>((resolve, reject) => {
              sendTransaction(
                {
                  to: transfer.to as `0x${string}`,
                  value: parseEther(transfer.amount),
                },
                {
                  onSuccess: (hash) => resolve(hash),
                  onError: (error) => reject(error),
                }
              );
            });
          } else {
            const tokenAddr = transfer.tokenAddress || getTokenAddress(network, transfer.token);
            if (!tokenAddr) {
              throw new Error(`${transfer.token} not supported on ${network}`);
            }

            const decimals = getTokenDecimals(transfer.token);
            const amountInWei = parseUnits(transfer.amount, decimals);

            txHash = await new Promise<string>((resolve, reject) => {
              // @ts-expect-error - wagmi v2 type issue with writeContract
              writeContract(
                {
                  address: tokenAddr as `0x${string}`,
                  abi: ERC20_ABI,
                  functionName: 'transfer',
                  args: [transfer.to as `0x${string}`, amountInWei],
                },
                {
                  onSuccess: (hash: string) => resolve(hash),
                  onError: (error: Error) => reject(error),
                }
              );
            });
          }

          txHashes.push(txHash);
          setTransferProgress({ current: transferNum, total: totalTransfers, hashes: [...txHashes] });

          toast.dismiss();
          toast.success(`Transaction ${transferNum}/${totalTransfers} submitted!`);

          if (i < totalTransfers - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (txErr) {
          console.error(`Transfer ${transferNum} error:`, txErr);
          toast.dismiss();

          const friendlyMsg = formatTransferError(txErr);
          const completedNote = txHashes.length > 0
            ? ` (${txHashes.length} of ${totalTransfers} completed)`
            : '';
          setTransferError(`${friendlyMsg}${completedNote}`);

          toast.error(friendlyMsg);
          setProcessingPayment(false);
          return;
        }
      }

      toast.dismiss();
      toast.loading("All transfers complete. Verifying payment...");

      try {
        const result = await verifyPayment({
          requestId: paymentRequest.id,
          txHash: txHashes[0],
        });

        if (result.success && result.status === 'PAID') {
          setPaymentRequest(result.request);
          setStep("success");
          toast.dismiss();
          toast.success("Payment verified successfully!");
        } else {
          setStep("success");
          toast.dismiss();
          toast.success("Payment submitted! Verification in progress.");
        }
      } catch (verifyErr) {
        console.error('Verification error:', verifyErr);
        toast.dismiss();
        toast.success("Payment submitted! Blockchain verification may take a moment.");
        setStep("success");
      }
    } catch (err) {
      console.error('Error initiating payment:', err);
      toast.dismiss();
      toast.error(formatTransferError(err));
    } finally {
      setProcessingPayment(false);
    }
  };

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
    return colors[network.toUpperCase()] || "#2563EB";
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="p-6 text-center bg-white border border-border shadow-lg rounded-2xl">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
          <p className="text-muted-foreground text-sm">Loading payment request...</p>
        </Card>
      </div>
    );
  }

  // Error state
  if (error || !paymentRequest) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-md bg-white border border-border shadow-lg rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
          </div>
          <h2 className="text-xl font-heading font-bold mb-2">Payment Not Found</h2>
          <p className="text-muted-foreground text-sm mb-4">
            {error || "This payment link is invalid or has expired."}
          </p>
          <Button 
            onClick={() => navigate("/")} 
            variant="outline"
            className="rounded-lg"
          >
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-border px-4 md:px-8 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
              <Wallet className="w-4.5 h-4.5 text-white" />
            </div>
            <span className="text-xl font-heading font-bold text-blue-600">
              PayAgent
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-blue-100 text-blue-700 rounded-md">
              Beta
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton 
              accountStatus="address"
              chainStatus="none"
              showBalance={false}
            />
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/")} 
              className="rounded-lg gap-1.5 hidden sm:flex text-sm"
            >
              Create Your Link
            </Button>
          </div>
        </div>
      </nav>
      
      <div className="p-4 md:p-6">
        <div className="max-w-md mx-auto">
          {step === "select-network" && (
            <Card className="p-5 bg-white border border-border shadow-lg rounded-2xl">
              <div className="space-y-4">
                {/* Expiry Timer Banner */}
                {expiryTimeRemaining !== null && (
                  <div className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium ${
                    expiryTimeRemaining <= 0 
                      ? 'bg-red-50 text-red-700 border border-red-200' 
                      : expiryTimeRemaining < 3600 
                        ? 'bg-orange-50 text-orange-700 border border-orange-200' 
                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    <Clock className="h-4 w-4" />
                    <span>
                      {expiryTimeRemaining <= 0 
                        ? 'This payment link has expired' 
                        : `Expires in ${formatExpiryTime(expiryTimeRemaining)}`}
                    </span>
                  </div>
                )}

                {/* Header */}
                <div className="text-center pb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Payment Request</p>
                  <div className="flex items-center justify-center gap-2.5 mb-1.5">
                    <p className="text-3xl font-heading font-bold text-foreground tabular-nums">
                      {paymentRequest.amount}
                    </p>
                    <Badge className="text-sm px-3 py-1 bg-blue-600 hover:bg-blue-600 border-0">
                      {paymentRequest.token}
                    </Badge>
                  </div>
                  {paymentRequest.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {paymentRequest.description}
                    </p>
                  )}
                </div>

                {/* Payment Details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-border space-y-3">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="h-3 w-3" />
                    Payment Details
                  </p>
                  
                  {/* Receiver Address */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Transfer To</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono font-medium text-foreground bg-white px-2.5 py-2 rounded-lg border border-border flex-1 break-all">
                        {selectedWalletAddress}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-9 w-9 shrink-0 rounded-lg"
                        onClick={() => handleCopyAddress(selectedWalletAddress)}
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Network */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Network</p>
                    <div className="flex items-center gap-2 bg-white px-3 py-2.5 rounded-lg border border-border">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
                        backgroundColor: `${getNetworkColor(paymentRequest.network.split(',')[0].trim())}15`
                      }}>
                        <Circle className="h-3 w-3" fill={getNetworkColor(paymentRequest.network.split(',')[0].trim())} stroke="none" />
                      </div>
                      <span className="font-medium text-sm text-foreground">
                        {getNetworkDisplayName(paymentRequest.network.split(',')[0].trim())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Network Selection - Only if multiple */}
                {networks.length > 1 && (
                  <div>
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider mb-3">
                      Select Network
                    </p>
                    <div className="space-y-2">
                      {networks.map(network => (
                        <button 
                          key={network} 
                          onClick={() => setSelectedNetwork(network)} 
                          className={`w-full p-3 rounded-xl border-2 transition-all ${
                            selectedNetwork === network 
                              ? "border-blue-500 bg-blue-50" 
                              : "border-border hover:border-blue-300 hover:bg-blue-50/50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{
                              backgroundColor: `${getNetworkColor(network)}15`
                            }}>
                              <Circle className="h-4 w-4" fill={getNetworkColor(network)} stroke="none" />
                            </div>
                            <span className="font-medium text-sm text-foreground">
                              {getNetworkDisplayName(network)}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Wallet Payment */}
                <div className="space-y-3">
                  {!isConnected ? (
                    <div className="flex flex-col gap-2.5">
                      <ConnectButton.Custom>
                        {({ openConnectModal }) => (
                          <Button 
                            className="w-full h-12 text-sm font-semibold rounded-xl gap-2 bg-blue-600 hover:bg-blue-700"
                            onClick={openConnectModal}
                          >
                            <Wallet className="h-4 w-4" />
                            Connect Wallet to Pay
                            <ArrowRight className="h-4 w-4" />
                          </Button>
                        )}
                      </ConnectButton.Custom>
                      <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                        <Shield className="h-3 w-3" />
                        Non-custodial. Your keys, your wallet.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {/* Connected wallet info */}
                      <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs text-muted-foreground block mb-0.5">Paying From</span>
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
                                className="text-xs rounded-lg h-8"
                              >
                                Switch
                              </Button>
                            )}
                          </ConnectButton.Custom>
                        </div>
                      </div>

                      {/* Fee Loading */}
                      {feeLoading && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-border text-center">
                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1.5 text-blue-600" />
                          <p className="text-xs text-muted-foreground">Calculating fees...</p>
                        </div>
                      )}

                      {/* Fee Error */}
                      {feeError && (
                        <div className="bg-red-50 p-3 rounded-xl border border-red-200">
                          <p className="text-xs text-red-600">{feeError}</p>
                        </div>
                      )}

                      {/* Fee Breakdown */}
                      {feeInfo && feeInfo.fee && !feeLoading && (
                        <div className="bg-slate-50 p-4 rounded-xl border border-border">
                          <div className="space-y-2.5 text-sm tabular-nums">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Payment</span>
                              <span className="font-semibold">{paymentRequest.amount} {paymentRequest.token}</span>
                            </div>
                            
                            <div className="border-t border-border" />
                            
                            {feeInfo.fee.feeDeductedFromPayment ? (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Fee</span>
                                  <span className="font-medium text-orange-600">-{feeInfo.fee.feeTotal} {feeInfo.fee.feeToken}</span>
                                </div>
                                <div className="border-t border-border" />
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-foreground">Creator Receives</span>
                                  <span className="font-bold text-blue-600 text-base">{feeInfo.creatorReceives} {paymentRequest.token}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex justify-between items-center">
                                  <span className="text-muted-foreground">Fee (LCX)</span>
                                  <span className="font-medium text-emerald-600">{feeInfo.fee.feeTotal} LCX</span>
                                </div>
                                <div className="border-t border-border" />
                                <div className="flex justify-between items-center">
                                  <span className="font-semibold text-foreground">Creator Receives</span>
                                  <span className="font-bold text-blue-600 text-base">{paymentRequest.amount} {paymentRequest.token}</span>
                                </div>
                              </>
                            )}
                          </div>
                          
                          {feeInfo.transfers && feeInfo.transfers.length > 1 && (
                            <div className="flex items-start gap-1.5 mt-3 pt-3 border-t border-border">
                              <Info className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                              <p className="text-xs text-muted-foreground">
                                You will approve <span className="font-semibold text-foreground">{feeInfo.transfers.length} transactions</span> in your wallet.
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Transfer Progress */}
                      {processingPayment && transferProgress.total > 0 && (
                        <div className="bg-blue-50 p-3 rounded-xl border border-blue-200 space-y-2">
                          <div className="flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                            <span className="text-sm font-semibold text-blue-700">
                              Transaction {transferProgress.current}/{transferProgress.total}
                            </span>
                          </div>
                          <div className="w-full bg-blue-100 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${(transferProgress.current / transferProgress.total) * 100}%` }}
                            />
                          </div>
                          {transferProgress.hashes.length > 0 && (
                            <div className="text-xs text-muted-foreground space-y-0.5">
                              {transferProgress.hashes.map((h, i) => (
                                <div key={i} className="flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                  <span>Tx {i + 1}: {h.slice(0, 10)}...{h.slice(-6)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Transfer Error */}
                      {transferError && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                          <div className="flex items-start gap-2.5">
                            <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-700">{transferError}</p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="mt-2.5 text-xs rounded-lg h-8 border-red-200 text-red-600 hover:bg-red-50"
                                onClick={() => { setTransferError(null); setTransferProgress({ current: 0, total: 0, hashes: [] }); }}
                              >
                                Retry Payment
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Pay Button */}
                      <Button 
                        className="w-full h-12 text-sm font-semibold rounded-xl gap-2 bg-blue-600 hover:bg-blue-700"
                        onClick={handlePayWithWallet}
                        disabled={processingPayment || feeLoading || !feeInfo || (expiryTimeRemaining !== null && expiryTimeRemaining <= 0)}
                      >
                        {processingPayment && transferProgress.total > 0 ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing {transferProgress.current}/{transferProgress.total}...
                          </>
                        ) : processingPayment ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Processing Payment...
                          </>
                        ) : feeLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading Fees...
                          </>
                        ) : (expiryTimeRemaining !== null && expiryTimeRemaining <= 0) ? (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            Link Expired
                          </>
                        ) : (
                          <>
                            <Wallet className="h-4 w-4" />
                            Pay {paymentRequest.amount} {paymentRequest.token}
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {step === "success" && (
            <Card className="p-5 bg-white border border-border shadow-lg rounded-2xl">
              <div className="space-y-4">
                <div className="text-center pb-3 border-b border-border">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-green-50 rounded-xl mb-3">
                    <CheckCircle2 className="w-7 h-7 text-green-600" />
                  </div>
                  <h2 className="text-xl font-heading font-bold text-foreground mb-1">
                    {paymentRequest.status === 'PAID' ? 'Payment Verified!' : 'Payment Noted!'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {paymentRequest.status === 'PAID' 
                      ? 'Your payment has been confirmed on the blockchain'
                      : "We're monitoring the blockchain for your transaction"}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-border space-y-2.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-bold text-foreground tabular-nums">{paymentRequest.amount} {paymentRequest.token}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium text-foreground font-mono text-xs">
                      {selectedWalletAddress.slice(0, 8)}...{selectedWalletAddress.slice(-6)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Network</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs rounded-md">{selectedNetwork || paymentRequest.network}</Badge>
                      {paymentRequest.txHash && (
                        <a
                          href={`${getExplorerUrl(paymentRequest.network)}/tx/${paymentRequest.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                          title="View on Explorer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </div>
                  {paymentRequest.txHash && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tx Hash</span>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`${getExplorerUrl(paymentRequest.network)}/tx/${paymentRequest.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-mono text-blue-600 hover:underline"
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
                      <span className="text-xs tabular-nums">
                        {new Date(paymentRequest.paidAt).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>

                <Button 
                  className="w-full h-11 text-sm font-semibold rounded-xl gap-2 bg-blue-600 hover:bg-blue-700" 
                  onClick={() => navigate("/")}
                >
                  Create Your Payment Link
                  <ArrowRight className="h-4 w-4" />
                </Button>

                {paymentRequest.status !== 'PAID' && (
                  <div className="pt-3 border-t border-border">
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
