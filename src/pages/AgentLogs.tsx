import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppNavbar } from "@/components/AppNavbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  FileText, Globe, ChevronLeft, ChevronRight, Loader2, ArrowLeft, Shield, Wallet
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount, useSignMessage } from "wagmi";
import {
  getAgentLogs, getAgentIpHistory,
  type AgentLogsResponse, type IpHistoryEntry,
  walletLogin, isJwtValid, clearJwt
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const statusColor = (code: number | null) => {
  if (!code) return 'bg-gray-100 text-gray-700';
  if (code < 300) return 'bg-emerald-100 text-emerald-700';
  if (code < 400) return 'bg-yellow-100 text-yellow-700';
  if (code < 500) return 'bg-red-100 text-red-700';
  return 'bg-red-200 text-red-800';
};

export default function AgentLogs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { address: walletAddress } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 25;

  // Check for existing valid JWT session
  useEffect(() => {
    setIsLoggedIn(isJwtValid());
  }, [walletAddress]);

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
        return await signMessageAsync({ message });
      });
      setIsLoggedIn(true);
      toast({ title: 'Signed in', description: 'Authenticated via wallet signature.' });
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoginLoading(false);
    }
  };

  const { data: logsData, isLoading: logsLoading, isError: logsError } = useQuery<AgentLogsResponse>({
    queryKey: ['agentLogs', page],
    queryFn: () => getAgentLogs(page, limit),
    enabled: isLoggedIn,
    staleTime: 5000,
  });

  const { data: ipHistory, isLoading: ipLoading } = useQuery<IpHistoryEntry[]>({
    queryKey: ['agentIpHistory'],
    queryFn: () => getAgentIpHistory(),
    enabled: isLoggedIn,
    staleTime: 10000,
  });

  const totalPages = logsData ? Math.ceil(logsData.total / limit) : 0;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />

        <div className="flex-1 flex flex-col bg-slate-50/50">
          <AppNavbar />

          <main className="flex-1 p-6 lg:p-8">
            <div className="max-w-6xl mx-auto space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" onClick={() => navigate('/agents')} className="gap-1">
                    <ArrowLeft className="h-4 w-4" /> Back
                  </Button>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Security</p>
                    <h1 className="text-2xl font-heading font-bold text-foreground flex items-center gap-2">
                      <FileText className="h-6 w-6" /> Agent Logs
                    </h1>
                  </div>
                </div>
              </div>

              {/* Wallet Login */}
              {!isLoggedIn ? (
                <div className="bg-white rounded-xl border border-border p-6 space-y-4">
                  <h3 className="font-medium text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Sign in with your wallet to view logs</h3>
                  {!walletAddress ? (
                    <p className="text-sm text-muted-foreground">Connect your wallet first using the button in the navbar.</p>
                  ) : (
                    <Button
                      size="sm"
                      disabled={loginLoading}
                      onClick={handleWalletLogin}
                      className="gap-2"
                    >
                      {loginLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wallet className="h-4 w-4" />
                      )}
                      Sign in with Wallet
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  {/* IP History */}
                  <div className="bg-white rounded-xl border border-border p-6 space-y-4">
                    <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" /> IP Address History
                    </h3>

                    {ipLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading IP history...
                      </div>
                    ) : ipHistory && ipHistory.length > 0 ? (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>IP Address</TableHead>
                              <TableHead>First Seen</TableHead>
                              <TableHead>Last Seen</TableHead>
                              <TableHead>Requests</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ipHistory.map((ip) => (
                              <TableRow key={ip.id}>
                                <TableCell className="font-mono text-sm">{ip.ip_address}</TableCell>
                                <TableCell className="text-sm">{formatDate(ip.first_seen_at)}</TableCell>
                                <TableCell className="text-sm">{formatDate(ip.last_seen_at)}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{ip.request_count}</Badge>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No IP history recorded yet.</p>
                    )}
                  </div>

                  {/* Request Logs */}
                  <div className="bg-white rounded-xl border border-border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-heading font-semibold text-sm flex items-center gap-2">
                        <FileText className="h-4 w-4" /> API Request Logs
                      </h3>
                      {logsData && (
                        <span className="text-xs text-muted-foreground">
                          {logsData.total} total entries
                        </span>
                      )}
                    </div>

                    {logsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                        <Loader2 className="h-5 w-5 animate-spin" /> Loading logs...
                      </div>
                    ) : logsError ? (
                      <div className="text-sm text-red-600 py-4 text-center">
                        Failed to load logs. Your session may have expired.
                        <Button variant="ghost" size="sm" className="ml-2" onClick={() => { clearJwt(); setIsLoggedIn(false); }}>
                          Sign in again
                        </Button>
                      </div>
                    ) : logsData && logsData.logs.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Timestamp</TableHead>
                                <TableHead>Method</TableHead>
                                <TableHead>Endpoint</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>IP</TableHead>
                                <TableHead>Time (ms)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {logsData.logs.map((log) => (
                                <TableRow key={log.id}>
                                  <TableCell className="text-xs whitespace-nowrap">{formatDate(log.created_at)}</TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="text-xs">{log.method}</Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs max-w-[200px] truncate">{log.endpoint}</TableCell>
                                  <TableCell>
                                    <Badge className={`${statusColor(log.status_code)} border-0 text-xs`}>
                                      {log.status_code || '-'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-xs">{log.ip_address || '-'}</TableCell>
                                  <TableCell className="text-xs">{log.response_time_ms ?? '-'}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                          <div className="flex items-center justify-between pt-2">
                            <span className="text-xs text-muted-foreground">
                              Page {page} of {totalPages}
                            </span>
                            <div className="flex gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">No API logs recorded yet.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
