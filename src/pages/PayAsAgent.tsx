import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Bot, Link2, Copy, ExternalLink, Loader2, ArrowLeft, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { createLink, payLink, getAgents, isAgentServiceConfigured } from "@/lib/agentApi";

// Same as agentApi: backend URL when set, else standalone agent service (local)
const AGENT_SERVICE_BASE = import.meta.env.VITE_API_URL
  ? `${(import.meta.env.VITE_API_URL as string).replace(/\/$/, '')}/api`
  : (import.meta.env.VITE_AGENT_PAYMENT_SERVICE_URL || "http://localhost:3001");

export default function PayAsAgent() {
  const navigate = useNavigate();
  const [showTestSection, setShowTestSection] = useState(false);
  const [agents, setAgents] = useState<{ id: number; address: string }[]>([]);

  const [receiverAgentId, setReceiverAgentId] = useState<1 | 2>(1);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [createLoading, setCreateLoading] = useState(false);
  const [createdLinkId, setCreatedLinkId] = useState<string | null>(null);
  const [createdLinkPath, setCreatedLinkPath] = useState<string | null>(null);

  const [linkIdInput, setLinkIdInput] = useState("");
  const [payerAgentId, setPayerAgentId] = useState<1 | 2>(2);
  const [payLoading, setPayLoading] = useState(false);
  const [payResult, setPayResult] = useState<{ txHash?: string; explorerUrl?: string; alreadyPaid?: boolean } | null>(null);

  useEffect(() => {
    if (!isAgentServiceConfigured()) return;
    getAgents()
      .then((r) => setAgents(r.agents || []))
      .catch(() => setAgents([]));
  }, []);

  const handleCreateLink = async () => {
    const amt = amount.trim();
    if (!amt || isNaN(Number(amt)) || Number(amt) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    try {
      setCreateLoading(true);
      setPayResult(null);
      const result = await createLink({
        amount: amt,
        receiverAgentId,
        description: description.trim() || undefined,
        expiresInDays: 7
      });
      if (result.success && result.linkId && result.link) {
        setCreatedLinkId(result.linkId);
        setCreatedLinkPath(result.link);
        setLinkIdInput(result.linkId);
        toast.success("Link created.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePayLink = async () => {
    let id = linkIdInput.trim();
    const match = id.match(/REQ-[A-Z0-9]+/i);
    if (match) id = match[0];
    if (!id) {
      toast.error("Enter a link ID or paste the full link");
      return;
    }
    try {
      setPayLoading(true);
      setPayResult(null);
      const result = await payLink(id, payerAgentId);
      if (result.success) {
        setPayResult({
          txHash: result.txHash,
          explorerUrl: result.explorerUrl,
          alreadyPaid: result.alreadyPaid
        });
        toast.success(result.alreadyPaid ? "Already paid." : "Payment confirmed!");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pay failed");
    } finally {
      setPayLoading(false);
    }
  };

  const copyLink = () => {
    if (!createdLinkPath) return;
    const url = `${window.location.origin}${createdLinkPath}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied!");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/50 via-white to-slate-50">
      <nav className="border-b border-border bg-white/80 backdrop-blur px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-heading font-semibold text-foreground">Pay as agent (Moltbook)</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Home
          </Button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
        {/* Main message: agents run on Moltbook, use API only */}
        <Card className="p-6 bg-violet-50/50 border-violet-200">
          <h2 className="font-heading font-semibold text-lg mb-2">Links are created and paid by agents on Moltbook</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Agents run on Moltbook only. They do not use this website. One agent creates a payment link by calling our API; the other agent pays it by calling our API. The flow is fully automated on Moltbook.
          </p>
          <p className="text-sm text-muted-foreground">
            Use the API reference below to configure your agent on Moltbook so it can create and pay PayMe links. The agent payment service holds two wallets (Agent 1, Agent 2); your Moltbook agents trigger create/pay by HTTP.
          </p>
        </Card>

        {/* Moltbook skill – copy-paste ready for agent Instructions */}
        <Card className="p-6 bg-amber-50/50 border-amber-200">
          <h3 className="font-heading font-semibold text-lg mb-2">Moltbook skill (copy for your agent)</h3>
          <p className="text-sm text-muted-foreground mb-3">
            Paste this into your Moltbook agent&apos;s <strong>Instructions</strong> or <strong>Skill</strong>. The same skill is also at <code className="text-xs bg-muted px-1 rounded">/payme-moltbook-skill.md</code> on this site—use your deployed app URL + that path if your agent can load from a URL.
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs whitespace-pre-wrap font-sans border border-amber-200/50">
{`You have access to the PayMe API for creating and paying USDC (Sepolia) links.

Base URL: ${AGENT_SERVICE_BASE}

**Create payment link**
- When: You need to create a payment link so Agent 1 or Agent 2 receives USDC.
- POST ${AGENT_SERVICE_BASE}/create-link
- Headers: Content-Type: application/json
- Body (JSON): amount (string, e.g. "5"), receiverAgentId (number: 1 or 2), description (optional)
- Response: success, linkId, link. Share linkId with whoever should pay it.

**Pay payment link**
- When: You have a linkId and need to pay it (send USDC from an agent wallet).
- POST ${AGENT_SERVICE_BASE}/pay-link
- Headers: Content-Type: application/json
- Body (JSON): linkId (string), agentId (number: 1 or 2 – who pays)
- Response: success, txHash, explorerUrl; or alreadyPaid: true if already paid.

Example: Create link for 3 USDC to Agent 2 → POST ${AGENT_SERVICE_BASE}/create-link with {"amount":"3","receiverAgentId":2}. Pay that link as Agent 1 → POST ${AGENT_SERVICE_BASE}/pay-link with {"linkId":"REQ-XXXXX","agentId":1}.`}
          </pre>
          <Button
            variant="outline"
            size="sm"
            className="mt-3 border-amber-300 bg-amber-50 hover:bg-amber-100"
            onClick={() => {
              const skillText = `You have access to the PayMe API for creating and paying USDC (Sepolia) links.

Base URL: ${AGENT_SERVICE_BASE}

**Create payment link**
- When: You need to create a payment link so Agent 1 or Agent 2 receives USDC.
- POST ${AGENT_SERVICE_BASE}/create-link
- Headers: Content-Type: application/json
- Body (JSON): amount (string, e.g. "5"), receiverAgentId (number: 1 or 2), description (optional)
- Response: success, linkId, link. Share linkId with whoever should pay it.

**Pay payment link**
- When: You have a linkId and need to pay it (send USDC from an agent wallet).
- POST ${AGENT_SERVICE_BASE}/pay-link
- Headers: Content-Type: application/json
- Body (JSON): linkId (string), agentId (number: 1 or 2 – who pays)
- Response: success, txHash, explorerUrl; or alreadyPaid: true if already paid.

Example: Create link for 3 USDC to Agent 2 → POST ${AGENT_SERVICE_BASE}/create-link with {"amount":"3","receiverAgentId":2}. Pay that link as Agent 1 → POST ${AGENT_SERVICE_BASE}/pay-link with {"linkId":"REQ-XXXXX","agentId":1}.`;
              navigator.clipboard.writeText(skillText);
              toast.success("Moltbook skill copied! Paste it into your agent's Instructions on Moltbook.");
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy Moltbook skill
          </Button>
        </Card>

        {/* API reference */}
        <Card className="p-6">
          <h3 className="font-heading font-semibold text-lg mb-2">API reference (for Moltbook agent setup)</h3>
          <p className="text-sm text-muted-foreground mb-4">Base URL: <code className="bg-muted px-1.5 py-0.5 rounded text-xs break-all">{AGENT_SERVICE_BASE}</code></p>

          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium text-foreground mb-1">Create link (one agent creates)</p>
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
{`POST ${AGENT_SERVICE_BASE}/create-link
Content-Type: application/json

{
  "amount": "5",
  "receiverAgentId": 1,
  "description": "Optional"
}

→ { "success": true, "linkId": "REQ-...", "link": "/r/REQ-..." }`}
              </pre>
              <p className="text-muted-foreground mt-1">receiverAgentId: 1 or 2 (who receives USDC).</p>
            </div>

            <div>
              <p className="font-medium text-foreground mb-1">Pay link (other agent pays)</p>
              <pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs">
{`POST ${AGENT_SERVICE_BASE}/pay-link
Content-Type: application/json

{
  "linkId": "REQ-XXXXXXXXX",
  "agentId": 2
}

→ { "success": true, "txHash": "0x...", "explorerUrl": "..." }`}
              </pre>
              <p className="text-muted-foreground mt-1">agentId: 1 or 2 (who sends USDC from their wallet).</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={() => {
              navigator.clipboard.writeText(`${AGENT_SERVICE_BASE}`);
              toast.success("Base URL copied");
            }}
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy base URL
          </Button>
        </Card>

        {/* Test API – verify agent is ready before adding to Moltbook */}
        <Card className="p-4">
          <button
            type="button"
            className="w-full flex items-center justify-between font-medium text-foreground"
            onClick={() => setShowTestSection(!showTestSection)}
          >
            Test API (create link + pay link – confirm ready for Moltbook)
            {showTestSection ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showTestSection && (
            <div className="mt-4 pt-4 border-t border-border space-y-6">
              {!isAgentServiceConfigured() ? (
                <p className="text-sm text-muted-foreground">Set VITE_API_URL (or VITE_AGENT_PAYMENT_SERVICE_URL for local) so the Test API can run.</p>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Create link</h4>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <Label className="text-xs">Receiver</Label>
                        <select
                          className="mt-1 h-9 rounded border px-2 text-sm"
                          value={receiverAgentId}
                          onChange={(e) => setReceiverAgentId(Number(e.target.value) as 1 | 2)}
                        >
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>Agent {a.id}</option>
                          ))}
                          {agents.length === 0 && (
                            <>
                              <option value={1}>Agent 1</option>
                              <option value={2}>Agent 2</option>
                            </>
                          )}
                        </select>
                      </div>
                      <div>
                        <Label className="text-xs">Amount</Label>
                        <Input type="text" placeholder="1" value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1 h-9 w-24" />
                      </div>
                      <Button size="sm" onClick={handleCreateLink} disabled={createLoading}>
                        {createLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                      </Button>
                    </div>
                    {createdLinkId && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <code className="bg-muted px-2 py-1 rounded">{createdLinkId}</code>
                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyLink}><Copy className="h-3 w-3" /></Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium mb-2">Pay link</h4>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <Label className="text-xs">Link ID</Label>
                        <Input type="text" placeholder="REQ-..." value={linkIdInput} onChange={(e) => setLinkIdInput(e.target.value)} className="mt-1 h-9 w-40 font-mono text-xs" />
                      </div>
                      <div>
                        <Label className="text-xs">Pay with</Label>
                        <select
                          className="mt-1 h-9 rounded border px-2 text-sm"
                          value={payerAgentId}
                          onChange={(e) => setPayerAgentId(Number(e.target.value) as 1 | 2)}
                        >
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>Agent {a.id}</option>
                          ))}
                          {agents.length === 0 && (
                            <>
                              <option value={1}>Agent 1</option>
                              <option value={2}>Agent 2</option>
                            </>
                          )}
                        </select>
                      </div>
                      <Button size="sm" onClick={handlePayLink} disabled={payLoading}>
                        {payLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pay"}
                      </Button>
                    </div>
                    {payResult && (
                      <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
                        {payResult.alreadyPaid ? "Already paid" : payResult.txHash && (
                          <>
                            <span>{payResult.txHash.slice(0, 10)}...</span>
                            {payResult.explorerUrl && (
                              <a href={payResult.explorerUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                                Explorer <ExternalLink className="h-3 w-3" />
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Full doc: <code className="bg-muted px-1 rounded">docs/moltbook-agents.md</code>
        </p>
      </main>
    </div>
  );
}
