import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Bot, Users, Loader2, ExternalLink, DollarSign, Coins,
  RotateCcw, Power, Trash2, ShieldCheck, Clock, FileText, Copy, Check, AlertTriangle, Wallet
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAccount, useSignMessage } from "wagmi";
import {
  getAgentByWallet, type AgentProfile,
  getAgentsList, type AgentSummary,
  getAllPaymentRequests, getRewards,
  getPrices, toUsd, formatUsd, type TokenPrices,
  rotateApiKey, deactivateAgent, deleteAgent,
  walletLogin, isJwtValid, clearJwt
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const truncateAddress = (addr: string | null) => {
  if (!addr) return 'Not set';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function AgentsDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ api_key_id: string; api_secret: string } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-login when wallet is connected and JWT is still valid
  useEffect(() => {
    if (isJwtValid()) {
      setIsLoggedIn(true);
    } else {
      setIsLoggedIn(false);
    }
  }, [walletAddress]);

  // Clear session on wallet disconnect
  useEffect(() => {
    if (!walletAddress) {
      clearJwt();
      setIsLoggedIn(false);
    }
  }, [walletAddress]);

  const handleWalletLogin = async () => {
    if (!walletAddress) return;

    setLoginLoading(true);
    try {
      await walletLogin(walletAddress, async (message: string) => {
        return await signMessageAsync({ account: walletAddress as `0x${string}`, message });
      });
      setIsLoggedIn(true);
      queryClient.invalidateQueries({ queryKey: ['agentByWallet'] });
      toast({ title: 'Signed in', description: 'Dashboard authenticated via wallet signature.' });
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSessionExpired = () => {
    clearJwt();
    setIsLoggedIn(false);
    toast({ title: 'Session expired', description: 'Please sign in again with your wallet.', variant: 'destructive' });
  };

  // Wallet-scoped data
  const { data: allAgents } = useQuery<AgentSummary[]>({
    queryKey: ['agentsList'],
    queryFn: getAgentsList,
    staleTime: 30000,
  });

  const { data: paymentData } = useQuery({
    queryKey: ['paymentRequests', walletAddress],
    queryFn: () => getAllPaymentRequests(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 10000,
  });

  const { data: rewardsData } = useQuery({
    queryKey: ['rewards', walletAddress],
    queryFn: () => getRewards(walletAddress!),
    enabled: !!walletAddress,
    staleTime: 30000,
  });

  const { data: prices } = useQuery({
    queryKey: ['prices'],
    queryFn: getPrices,
    staleTime: 60000,
    refetchInterval: 300000,
  });

  const priceData: TokenPrices = prices ?? { LCX: 0, ETH: 0, USDC: 1, USDT: 1 };

  // Filter agents to this wallet only
  const myAgents = useMemo(() =>
    (allAgents || []).filter(a => a.wallet_address?.toLowerCase() === walletAddress?.toLowerCase()),
    [allAgents, walletAddress]
  );

  // Agent-created payments received by this wallet (PAID only)
  const agentPayments = useMemo(() =>
    (paymentData?.requests || []).filter(r => r.status === 'PAID' && r.creatorAgentId),
    [paymentData]
  );

  // Compute agent payment value in USD (wallet-scoped)
  const agentPaymentValueUsd = useMemo(() =>
    agentPayments.reduce((sum, p) => sum + toUsd(parseFloat(p.amount), p.token, priceData), 0),
    [agentPayments, priceData]
  );

  // Compute total rewards in USD (wallet-scoped, agent tab only)
  const agentRewards = rewardsData?.rewards?.agent ?? [];
  const totalRewardsUsd = useMemo(() =>
    agentRewards.reduce((sum, r) => sum + toUsd(r.creatorReward, r.feeToken, priceData), 0),
    [agentRewards, priceData]
  );

  // Fee breakdown by token (wallet-scoped)
  const feeBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {};
    agentRewards.forEach(r => {
      breakdown[r.feeToken] = (breakdown[r.feeToken] || 0) + r.feeTotal;
    });
    return breakdown;
  }, [agentRewards]);

  // Try to look up agent by connected wallet (public endpoint, no auth needed)
  const { data: agentProfile, isLoading: profileLoading } = useQuery<AgentProfile | null>({
    queryKey: ['agentByWallet', walletAddress],
    queryFn: () => walletAddress ? getAgentByWallet(walletAddress) : Promise.resolve(null),
    enabled: !!walletAddress,
    staleTime: 10000,
  });

  const rotateMutation = useMutation({
    mutationFn: () => rotateApiKey(),
    onSuccess: (data) => {
      setNewCredentials({ api_key_id: data.api_key_id, api_secret: data.api_secret });
      toast({ title: 'API Key Rotated', description: `New credentials generated. Expires: ${formatDate(data.expires_at)}` });
      queryClient.invalidateQueries({ queryKey: ['agentByWallet'] });
    },
    onError: (err: Error) => {
      if (err.message === 'SESSION_EXPIRED') return handleSessionExpired();
      toast({ title: 'Failed to rotate key', description: err.message, variant: 'destructive' });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateAgent(),
    onSuccess: () => {
      toast({ title: 'Agent Deactivated', description: 'Your agent has been deactivated.' });
      queryClient.invalidateQueries({ queryKey: ['agentByWallet'] });
    },
    onError: (err: Error) => {
      if (err.message === 'SESSION_EXPIRED') return handleSessionExpired();
      toast({ title: 'Failed to deactivate', description: err.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAgent(),
    onSuccess: () => {
      toast({ title: 'Agent Deleted', description: 'Agent deleted. Payment history is preserved.' });
      queryClient.invalidateQueries({ queryKey: ['agentByWallet'] });
      setConfirmDelete(false);
      clearJwt();
      setIsLoggedIn(false);
    },
    onError: (err: Error) => {
      if (err.message === 'SESSION_EXPIRED') return handleSessionExpired();
      toast({ title: 'Failed to delete', description: err.message, variant: 'destructive' });
    }
  });

  const copyToClipboard = useCallback((text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700';
      case 'pending_verification': return 'bg-yellow-100 text-yellow-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'suspended': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <>
      <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Platform</p>
                  <h1 className="text-2xl font-heading font-bold text-foreground">Agents Dashboard</h1>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => router.push('/logs')}
                    variant="outline"
                    className="gap-2 rounded-lg"
                  >
                    <FileText className="h-4 w-4" />
                    View Logs
                  </Button>
                  <Button
                    onClick={() => router.push('/agent')}
                    variant="outline"
                    className="gap-2 rounded-lg"
                  >
                    <ExternalLink className="h-4 w-4" />
                    API Docs
                  </Button>
                </div>
              </div>

              {/* Linked Agent Profile */}
              {profileLoading ? (
                <div className="bg-white rounded-xl border border-border p-6 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                  <span className="text-sm text-muted-foreground">Looking up agent linked to your wallet...</span>
                </div>
              ) : agentProfile ? (
                <div className="bg-white rounded-xl border border-border p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bot className="h-6 w-6 text-blue-600" />
                      <div>
                        <h3 className="font-heading font-semibold text-lg">{agentProfile.username}</h3>
                        <p className="text-sm text-muted-foreground">{agentProfile.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`${statusColor(agentProfile.status)} border-0`}>
                        {agentProfile.status}
                      </Badge>
                      {agentProfile.verification_status === 'verified' && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 gap-1">
                          <ShieldCheck className="h-3 w-3" /> X Verified
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Wallet</p>
                      <p className="font-mono">{truncateAddress(agentProfile.wallet_address)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Payments Sent</p>
                      <p className="font-semibold">{agentProfile.total_payments_sent}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Payments Received</p>
                      <p className="font-semibold">{agentProfile.total_payments_received}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">API Key Expires</p>
                      <p className="font-mono text-xs">
                        {agentProfile.api_key_expires_at ? (
                          <span className={new Date(agentProfile.api_key_expires_at) < new Date() ? 'text-red-600 font-bold' : ''}>
                            {formatDate(agentProfile.api_key_expires_at)}
                            {new Date(agentProfile.api_key_expires_at) < new Date() && ' (EXPIRED)'}
                          </span>
                        ) : 'N/A'}
                      </p>
                    </div>
                    {agentProfile.x_username && (
                      <div>
                        <p className="text-muted-foreground text-xs">X (Twitter)</p>
                        <a href={`https://x.com/${agentProfile.x_username}`} target="_blank" rel="noopener" className="text-blue-600 hover:underline">
                          @{agentProfile.x_username}
                        </a>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground text-xs">Created</p>
                      <p>{formatDate(agentProfile.created_at)}</p>
                    </div>
                  </div>

                  {/* Key Expiry Warning */}
                  {agentProfile.api_key_expires_at && (() => {
                    const expiresAt = new Date(agentProfile.api_key_expires_at);
                    const now = new Date();
                    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isExpired = daysLeft <= 0;
                    const isExpiringSoon = daysLeft > 0 && daysLeft <= 3;

                    if (!isExpired && !isExpiringSoon) return null;

                    return (
                      <div className={`rounded-lg p-3 flex items-center justify-between ${
                        isExpired
                          ? 'bg-red-50 border border-red-200'
                          : 'bg-amber-50 border border-amber-200'
                      }`}>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-amber-600'}`} />
                          <span className={`text-sm font-medium ${isExpired ? 'text-red-700' : 'text-amber-700'}`}>
                            {isExpired
                              ? 'API key has expired! Rotate now to restore API access.'
                              : `API key expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}. Rotate soon to avoid disruption.`
                            }
                          </span>
                        </div>
                        {isLoggedIn && (
                          <Button
                            variant="outline"
                            size="sm"
                            className={`gap-1 ${isExpired ? 'border-red-300 text-red-700 hover:bg-red-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100'}`}
                            disabled={rotateMutation.isPending}
                            onClick={() => rotateMutation.mutate()}
                          >
                            {rotateMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                            Rotate Now
                          </Button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Management Actions */}
                  <div className="border-t pt-4 space-y-3">
                    <h4 className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Agent Management</h4>

                    {!isLoggedIn ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleWalletLogin}
                        disabled={loginLoading}
                        className="gap-2"
                      >
                        {loginLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wallet className="h-4 w-4" />
                        )}
                        Sign in with Wallet to Manage Agent
                      </Button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3" /> Authenticated via wallet signature
                        </p>

                        {newCredentials && (
                          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs text-emerald-700 font-medium">New HMAC credentials (save now — shown once):</p>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16">Key ID:</span>
                                <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">{newCredentials.api_key_id}</code>
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newCredentials.api_key_id, 'keyId')}>
                                  {copiedField === 'keyId' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-16">Secret:</span>
                                <code className="text-xs bg-white px-2 py-1 rounded border flex-1 break-all">{newCredentials.api_secret}</code>
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(newCredentials.api_secret, 'secret')}>
                                  {copiedField === 'secret' ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            disabled={rotateMutation.isPending}
                            onClick={() => rotateMutation.mutate()}
                          >
                            {rotateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            Regenerate API Key
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2 text-amber-600 hover:text-amber-700"
                            disabled={deactivateMutation.isPending}
                            onClick={() => deactivateMutation.mutate()}
                          >
                            {deactivateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                            Deactivate Agent
                          </Button>

                          {!confirmDelete ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2 text-red-600 hover:text-red-700"
                              onClick={() => setConfirmDelete(true)}
                            >
                              <Trash2 className="h-4 w-4" /> Delete Agent
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-red-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Are you sure?</span>
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={deleteMutation.isPending}
                                onClick={() => deleteMutation.mutate()}
                              >
                                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, Delete'}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : walletAddress ? (
                <div className="bg-white rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                  <Bot className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                  <p>No agent linked to wallet <span className="font-mono">{truncateAddress(walletAddress)}</span></p>
                  <p className="mt-1">Register an agent via the <button onClick={() => router.push('/agent')} className="text-blue-600 underline">API</button> using this wallet.</p>
                </div>
              ) : null}

              {/* Your Agent Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-border p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Your Agents</p>
                      <p className="text-2xl font-heading font-bold">{myAgents.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Agent Payment Value</p>
                      <p className="text-2xl font-heading font-bold text-emerald-600">
                        {agentPaymentValueUsd > 0 ? formatUsd(agentPaymentValueUsd) : '$0.00'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{agentPayments.length} agent payments</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Agent Rewards Earned</p>
                      <p className="text-2xl font-heading font-bold text-amber-600">
                        {totalRewardsUsd > 0 ? formatUsd(totalRewardsUsd) : '$0.00'}
                      </p>
                      {Object.keys(feeBreakdown).length > 0 && (
                        <p className="text-[10px] text-muted-foreground">
                          {Object.entries(feeBreakdown).map(([token, amt]) => `${Number(amt).toFixed(2)} ${token}`).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Your Agents List */}
              {myAgents.length > 0 && (
                <div className="bg-white rounded-xl border border-border overflow-hidden">
                  <div className="px-6 py-4 border-b border-border">
                    <h3 className="font-heading font-semibold">Your Agents ({myAgents.length})</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs font-semibold">Agent</TableHead>
                        <TableHead className="hidden md:table-cell text-xs font-semibold">Wallet</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="hidden lg:table-cell text-xs font-semibold">Payments</TableHead>
                        <TableHead className="hidden lg:table-cell text-xs font-semibold">Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {myAgents.map((agent) => (
                        <TableRow key={agent.id} className="hover:bg-blue-50/50">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                                <Bot className="h-4 w-4 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{agent.username}</p>
                                <p className="text-xs text-muted-foreground">{agent.email}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <code className="text-xs font-mono text-muted-foreground">
                              {truncateAddress(agent.wallet_address)}
                            </code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Badge className={`${statusColor(agent.status)} border-0 text-[10px]`}>
                                {agent.status}
                              </Badge>
                              {agent.verification_status === 'verified' && (
                                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {agent.total_payments_sent} sent / {agent.total_payments_received} received
                            </span>
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(agent.created_at)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* How it works */}
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="font-heading font-semibold text-lg mb-4">How Agents Use the Platform</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">1</div>
                    <h4 className="font-medium text-sm mb-1">Register</h4>
                    <p className="text-xs text-muted-foreground">Call POST /api/agents/register with username &amp; email</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-yellow-600">2</div>
                    <h4 className="font-medium text-sm mb-1">Verify on X</h4>
                    <p className="text-xs text-muted-foreground">Post challenge to X, then call /api/agents/verify-x</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">3</div>
                    <h4 className="font-medium text-sm mb-1">Create Link</h4>
                    <p className="text-xs text-muted-foreground">Create payment links via HMAC-signed API or AI chat</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">4</div>
                    <h4 className="font-medium text-sm mb-1">Pay Link</h4>
                    <p className="text-xs text-muted-foreground">Another agent gets instructions and pays on-chain via SDK</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">5</div>
                    <h4 className="font-medium text-sm mb-1">Webhooks</h4>
                    <p className="text-xs text-muted-foreground">Both agents get notified via HMAC-signed webhooks</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/agent')}
                  className="group bg-blue-600 rounded-xl p-5 text-left text-white hover:bg-blue-700 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Bot className="h-5 w-5" />
                    <h3 className="font-medium">View API Documentation</h3>
                  </div>
                  <p className="text-sm text-white/70">Registration, HMAC signing, cURL examples, and more</p>
                </button>
                <a
                  href={`${API_BASE_URL}/api/stats`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-white rounded-xl p-5 text-left border border-border hover:border-blue-200 transition-colors block"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <ExternalLink className="h-5 w-5 text-blue-600" />
                    <h3 className="font-medium text-foreground">View Raw Stats</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">Open platform stats JSON endpoint</p>
                </a>
              </div>
            </div>
          </main>
    </>
  );
}
