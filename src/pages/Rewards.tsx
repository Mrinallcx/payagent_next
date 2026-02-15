import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Gift, Loader2, ExternalLink, Wallet, Users, Bot, Coins } from "lucide-react";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { getRewards, getPrices, toUsd, formatUsd, type RewardEntry, type TokenPrices } from "@/lib/api";

type RewardTab = 'human' | 'agent';

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const truncateHash = (hash: string | null) => {
  if (!hash) return '-';
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
};

const Rewards = () => {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const [activeTab, setActiveTab] = useState<RewardTab>('human');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: rewardsData, isLoading } = useQuery({
    queryKey: ['rewards', address],
    queryFn: () => getRewards(address!),
    enabled: isConnected && !!address,
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const { data: prices } = useQuery({
    queryKey: ['prices'],
    queryFn: getPrices,
    staleTime: 60000,
    refetchInterval: 300000,
  });

  const priceData: TokenPrices = prices ?? { LCX: 0, ETH: 0, USDC: 1, USDT: 1 };

  const humanRewards = rewardsData?.rewards?.human ?? [];
  const agentRewards = rewardsData?.rewards?.agent ?? [];
  const totals = rewardsData?.totals ?? { humanRewardsCount: 0, agentRewardsCount: 0, humanRewardsTotal: 0, agentRewardsTotal: 0 };

  const activeRewards = activeTab === 'human' ? humanRewards : agentRewards;
  const activeCount = activeTab === 'human' ? totals.humanRewardsCount : totals.agentRewardsCount;

  // Compute USD totals per tab
  const humanRewardsUsd = useMemo(() =>
    humanRewards.reduce((acc, r) => acc + toUsd(r.creatorReward, r.feeToken, priceData), 0),
    [humanRewards, priceData]
  );
  const agentRewardsUsd = useMemo(() =>
    agentRewards.reduce((acc, r) => acc + toUsd(r.creatorReward, r.feeToken, priceData), 0),
    [agentRewards, priceData]
  );

  // Group rewards by token (with USD)
  const tokenBreakdown = useMemo(() => {
    const breakdown: Record<string, { amount: number; usd: number }> = {};
    activeRewards.forEach(r => {
      const token = r.feeToken;
      if (!breakdown[token]) breakdown[token] = { amount: 0, usd: 0 };
      breakdown[token].amount += r.creatorReward;
      breakdown[token].usd += toUsd(r.creatorReward, r.feeToken, priceData);
    });
    return breakdown;
  }, [activeRewards, priceData]);

  const totalPages = Math.ceil(activeRewards.length / itemsPerPage);
  const paginatedRewards = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return activeRewards.slice(start, start + itemsPerPage);
  }, [activeRewards, currentPage]);

  const tabs: { key: RewardTab; label: string; icon: typeof Users; count: number; totalUsd: number }[] = [
    { key: 'human', label: 'Humans', icon: Users, count: totals.humanRewardsCount, totalUsd: humanRewardsUsd },
    { key: 'agent', label: 'Agents', icon: Bot, count: totals.agentRewardsCount, totalUsd: agentRewardsUsd },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col bg-slate-50/50">
          <AppNavbar />

          <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <p className="text-sm text-muted-foreground mb-1">Earnings</p>
                <h1 className="text-2xl font-heading font-bold text-foreground">Rewards</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Creator rewards earned when others pay your payment links
                </p>
              </div>

              {/* Connect Wallet */}
              {!isConnected ? (
                <div className="bg-white rounded-xl border border-border p-12 text-center">
                  <div className="w-14 h-14 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                    <Wallet className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-heading font-semibold mb-2">Connect Your Wallet</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Connect your wallet to view your earned rewards
                  </p>
                  <Button
                    onClick={() => openConnectModal?.()}
                    className="gap-2 bg-blue-600 hover:bg-blue-700 rounded-lg"
                  >
                    <Wallet className="h-4 w-4" />
                    Connect Wallet
                  </Button>
                </div>
              ) : isLoading ? (
                <div className="flex flex-col items-center justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600 mb-3" />
                  <p className="text-sm text-muted-foreground">Loading rewards...</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {tabs.map(tab => (
                      <div
                        key={tab.key}
                        className={`bg-white rounded-xl border p-5 cursor-pointer transition-colors ${
                          activeTab === tab.key 
                            ? 'border-blue-300 ring-1 ring-blue-100' 
                            : 'border-border hover:border-blue-200'
                        }`}
                        onClick={() => { setActiveTab(tab.key); setCurrentPage(1); }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            tab.key === 'human' ? 'bg-blue-50' : 'bg-purple-50'
                          }`}>
                            <tab.icon className={`h-5 w-5 ${tab.key === 'human' ? 'text-blue-600' : 'text-purple-600'}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{tab.label}</p>
                            <p className="text-xs text-muted-foreground">{tab.count} reward{tab.count !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <p className={`text-2xl font-heading font-bold ${
                          tab.key === 'human' ? 'text-blue-600' : 'text-purple-600'
                        }`}>
                          {tab.totalUsd > 0 ? formatUsd(tab.totalUsd) : '$0.00'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">Total rewards earned (USD)</p>
                      </div>
                    ))}
                  </div>

                  {/* Token Breakdown */}
                  {Object.keys(tokenBreakdown).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                      {Object.entries(tokenBreakdown).map(([token, { amount, usd }]) => (
                        <div key={token} className="bg-white rounded-lg border border-border p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Coins className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">{token}</span>
                          </div>
                          <p className="text-lg font-heading font-bold text-emerald-600">{amount.toFixed(4)}</p>
                          <p className="text-xs text-muted-foreground">{formatUsd(usd)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Rewards Table */}
                  {activeRewards.length > 0 ? (
                    <>
                      <div className="bg-white border border-border rounded-xl overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-[50px]"></TableHead>
                              <TableHead className="text-xs font-semibold">Payment</TableHead>
                              <TableHead className="text-xs font-semibold">Reward</TableHead>
                              <TableHead className="hidden md:table-cell text-xs font-semibold">Fee Token</TableHead>
                              <TableHead className="hidden lg:table-cell text-xs font-semibold">Network</TableHead>
                              <TableHead className="text-xs font-semibold">Date</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {paginatedRewards.map((reward) => (
                              <TableRow key={reward.feeId} className="hover:bg-blue-50/50">
                                <TableCell>
                                  <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                                    <Gift className="h-4 w-4 text-emerald-600" />
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <p className="text-sm font-medium">
                                      {reward.paymentAmount} {reward.paymentToken}
                                    </p>
                                    <p className="text-xs text-muted-foreground font-mono">
                                      {reward.paymentId}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div>
                                    <span className="text-sm font-semibold text-emerald-600">
                                      +{reward.creatorReward.toFixed(4)} {reward.feeToken}
                                    </span>
                                    <p className="text-xs text-muted-foreground">
                                      {formatUsd(toUsd(reward.creatorReward, reward.feeToken, priceData))}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  <Badge variant="secondary" className="bg-gray-50 text-gray-700 border-0 text-xs">
                                    {reward.feeToken}
                                  </Badge>
                                </TableCell>
                                <TableCell className="hidden lg:table-cell">
                                  <span className="text-xs text-muted-foreground">
                                    {reward.network || '-'}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(reward.createdAt)}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {reward.creatorRewardTxHash && (
                                    <a
                                      href={`https://sepolia.etherscan.io/tx/${reward.creatorRewardTxHash}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-2 rounded-md hover:bg-blue-50 inline-flex"
                                      title={reward.creatorRewardTxHash}
                                    >
                                      <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-blue-600" />
                                    </a>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 mt-6">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                            disabled={currentPage === 1}
                            className="h-9 rounded-lg"
                          >
                            Previous
                          </Button>
                          <div className="flex items-center gap-1 px-2">
                            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(page => (
                              <Button
                                key={page}
                                variant={currentPage === page ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className={`h-9 w-9 p-0 rounded-lg ${currentPage === page ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                              >
                                {page}
                              </Button>
                            ))}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="h-9 rounded-lg"
                          >
                            Next
                          </Button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="bg-white rounded-xl border border-border p-12 text-center">
                      <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-4">
                        <Gift className="h-5 w-5 text-blue-400" />
                      </div>
                      <h3 className="font-semibold mb-1">No rewards yet</h3>
                      <p className="text-sm text-muted-foreground">
                        {activeTab === 'human'
                          ? 'You will earn rewards when someone pays your human-created payment links'
                          : 'You will earn rewards when someone pays your agent-created payment links'}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Rewards;
