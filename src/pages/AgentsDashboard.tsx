import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bot, Users, Loader2, ExternalLink, DollarSign, Coins } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPlatformStats, type PlatformStats } from "@/lib/api";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface Agent {
  id: string;
  username: string;
  email: string;
  wallet_address: string | null;
  chain: string;
  status: string;
  created_at: string;
  total_payments_sent: number;
  total_payments_received: number;
  total_fees_paid: number;
}

interface FeeTransaction {
  id: string;
  payment_request_id: string;
  fee_token: string;
  fee_total: number;
  platform_share: number;
  creator_reward: number;
  lcx_price_usd: number | null;
  status: string;
  created_at: string;
}

const truncateAddress = (addr: string | null) => {
  if (!addr) return 'Not set';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
};

export default function AgentsDashboard() {
  const navigate = useNavigate();

  const { data: platformStats } = useQuery<PlatformStats>({
    queryKey: ['platformStats'],
    queryFn: getPlatformStats,
    staleTime: 30000,
  });

  // Note: These endpoints would need to be added to the backend for full admin view
  // For now, show the platform stats and link to API docs

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col bg-slate-50/50">
          <AppNavbar />

          <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Platform</p>
                  <h1 className="text-2xl font-heading font-bold text-foreground">Agents Dashboard</h1>
                </div>
                <Button
                  onClick={() => navigate('/agent')}
                  variant="outline"
                  className="gap-2 rounded-lg"
                >
                  <ExternalLink className="h-4 w-4" />
                  API Docs
                </Button>
              </div>

              {/* Platform Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl border border-border p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Registered Agents</p>
                      <p className="text-2xl font-heading font-bold">{platformStats?.totalAgents || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Completed Payments</p>
                      <p className="text-2xl font-heading font-bold text-emerald-600">{platformStats?.totalPayments || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-border p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Coins className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Fees Collected</p>
                      <p className="text-2xl font-heading font-bold text-amber-600">
                        {platformStats?.totalFeesCollected ? platformStats.totalFeesCollected.toFixed(2) : '0.00'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fee Model Info */}
              <div className="bg-gradient-to-r from-blue-50 to-blue-50 rounded-xl border border-blue-200 p-6">
                <h3 className="font-heading font-semibold text-lg mb-3 text-blue-800">Fee Model (LCX / USDC)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-blue-100 text-blue-700 border-0">Preferred</Badge>
                      <span className="text-sm font-medium">LCX Token</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If payee holds ≥ 4 LCX, they pay <strong>4 LCX</strong> fee:
                    </p>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      <li>• 2 LCX → Platform Treasury</li>
                      <li>• 2 LCX → Link Creator (reward)</li>
                    </ul>
                  </div>
                  <div className="bg-white rounded-lg p-4 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className="bg-gray-100 text-gray-700 border-0">Fallback</Badge>
                      <span className="text-sm font-medium">USDC</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      If payee holds &lt; 4 LCX, USDC equivalent is used:
                    </p>
                    <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                      <li>• 50% USDC → Platform Treasury</li>
                      <li>• 50% USDC → Link Creator (reward)</li>
                      <li>• Price from CoinGecko (5-min cache)</li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="bg-white rounded-xl border border-border p-6">
                <h3 className="font-heading font-semibold text-lg mb-4">How Agents Use the Platform</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">1</div>
                    <h4 className="font-medium text-sm mb-1">Register</h4>
                    <p className="text-xs text-muted-foreground">Agent calls POST /api/agents/register to get API key</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">2</div>
                    <h4 className="font-medium text-sm mb-1">Create Link</h4>
                    <p className="text-xs text-muted-foreground">Agent creates payment link via API or AI chat</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">3</div>
                    <h4 className="font-medium text-sm mb-1">Pay Link</h4>
                    <p className="text-xs text-muted-foreground">Another agent gets instructions and pays on-chain</p>
                  </div>
                  <div className="text-center p-4">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3 text-sm font-bold text-blue-600">4</div>
                    <h4 className="font-medium text-sm mb-1">Webhooks</h4>
                    <p className="text-xs text-muted-foreground">Both agents get notified via HMAC-signed webhooks</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => navigate('/agent')}
                  className="group bg-blue-600 rounded-xl p-5 text-left text-white hover:bg-blue-700 transition-colors"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <Bot className="h-5 w-5" />
                    <h3 className="font-medium">View API Documentation</h3>
                  </div>
                  <p className="text-sm text-white/70">Registration, endpoints, cURL examples, and more</p>
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
        </div>
      </div>
    </SidebarProvider>
  );
}
