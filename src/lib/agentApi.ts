// Backend URL (PayMe API). In production set VITE_API_URL in Vercel env.
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
// Agent API: use backend URL + /api when backend is set (prod); else standalone agent service or localhost
const AGENT_SERVICE_URL = API_BASE
  ? `${API_BASE}/api`
  : (import.meta.env.VITE_AGENT_PAYMENT_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '');

export interface AgentInfo {
  id: number;
  address: string;
}

export interface AgentsResponse {
  success: boolean;
  agents: AgentInfo[];
}

export interface PayLinkResponse {
  success: boolean;
  alreadyPaid?: boolean;
  txHash?: string;
  request?: {
    id: string;
    status: string;
    amount: string;
    token: string;
    receiver: string;
    txHash?: string | null;
    paidAt?: number | null;
  };
  verification?: { valid: boolean; txHash: string; blockNumber?: number };
  explorerUrl?: string;
  message?: string;
  error?: string;
}

export async function getAgents(): Promise<AgentsResponse> {
  const res = await fetch(`${AGENT_SERVICE_URL}/agents`);
  if (!res.ok) throw new Error('Failed to fetch agents');
  return res.json();
}

export interface CreateLinkResponse {
  success: boolean;
  linkId?: string;
  link?: string;
  error?: string;
}

export async function createLink(params: {
  amount: string;
  receiverAgentId?: 1 | 2;
  receiver?: string;
  description?: string;
  expiresInDays?: number;
}): Promise<CreateLinkResponse> {
  const res = await fetch(`${AGENT_SERVICE_URL}/create-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: params.amount,
      receiverAgentId: params.receiverAgentId,
      receiver: params.receiver,
      description: params.description,
      expiresInDays: params.expiresInDays ?? 7
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Create link failed');
  return data;
}

export async function payLink(linkId: string, agentId: 1 | 2): Promise<PayLinkResponse> {
  const res = await fetch(`${AGENT_SERVICE_URL}/pay-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkId, agentId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Pay link failed');
  return data;
}

export function isAgentServiceConfigured(): boolean {
  return Boolean(import.meta.env.VITE_AGENT_PAYMENT_SERVICE_URL || import.meta.env.VITE_API_URL);
}
