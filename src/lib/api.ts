const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface PaymentRequest {
  id: string;
  token: string;
  amount: string;
  receiver: string;
  payer: string | null;
  description: string;
  network: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED';
  createdAt: number;
  expiresAt: number | null;
  txHash: string | null;
  paidAt: number | null;
  creatorWallet: string | null;
  isExpired?: boolean;
  isPaid?: boolean;
}

export interface PaymentResponse {
  success: boolean;
  status?: string;
  request?: PaymentRequest;
  error?: string;
  payment?: {
    id: string;
    amount: string;
    token: string;
    network: string;
    receiver: string;
    description: string;
    instructions: string;
    expiresAt?: string | number;
    createdAt?: string | number;
  };
}

export interface CreatePaymentLinkData {
  token: string;
  amount: string;
  receiver: string;
  description?: string;
  network: string;
  expiresInDays: number;
  creatorWallet?: string;
}

export interface CreatePaymentLinkResponse {
  success: boolean;
  request: {
    id: string;
    link: string;
  };
}

export interface VerifyPaymentData {
  requestId: string;
  txHash: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  status: string;
  request: PaymentRequest;
  verification?: {
    valid: boolean;
    txHash: string;
    amount: string;
    receiver: string;
    blockNumber: number;
  };
}

export interface FeeTransfer {
  description: string;
  token: string;
  tokenAddress: string | null;
  amount: string;
  to: string;
}

export interface FeeInfoResponse {
  success: boolean;
  alreadyPaid?: boolean;
  message?: string;
  error?: string;
  payment?: {
    token: string;
    amount: string;
    network: string;
    to: string;
    description: string;
  };
  fee?: {
    feeToken: string;
    feeTotal: number;
    platformShare: number;
    creatorReward: number;
    feeDeductedFromPayment: boolean;
    lcxPriceUsd: number | null;
    payerLcxBalance: number;
  };
  transfers?: FeeTransfer[];
  creatorReceives?: string;
}

export interface GetAllPaymentsResponse {
  success: boolean;
  requests: PaymentRequest[];
  count: number;
}

export interface DeletePaymentResponse {
  success: boolean;
  message: string;
  id: string;
}

// ============ JWT Session Management ============

let _jwtToken: string | null = null;
let _jwtExpiresAt: number | null = null;

/**
 * Store JWT token in memory (never in localStorage for security)
 */
function setJwt(token: string, expiresIn: number) {
  _jwtToken = token;
  _jwtExpiresAt = Date.now() + expiresIn * 1000;
}

/**
 * Clear JWT session
 */
export function clearJwt() {
  _jwtToken = null;
  _jwtExpiresAt = null;
}

/**
 * Check if JWT is valid (exists and not expired)
 */
export function isJwtValid(): boolean {
  if (!_jwtToken || !_jwtExpiresAt) return false;
  // Add 30-second buffer to prevent edge-case expiry during request
  return Date.now() < (_jwtExpiresAt - 30000);
}

/**
 * Get JWT auth headers for dashboard API calls
 */
function getJwtHeaders(): Record<string, string> {
  if (!_jwtToken) {
    throw new Error('Not authenticated. Call walletLogin() first.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${_jwtToken}`,
  };
}

/**
 * Login to dashboard using wallet signature (EIP-191).
 *
 * 1. Fetches a nonce challenge from the server
 * 2. Signs it using the provided signMessage function (from wagmi)
 * 3. Sends the signature to verify and receive a JWT
 *
 * @param walletAddress - The connected wallet address
 * @param signMessage - A function that signs a message string (e.g. wagmi's signMessage)
 * @returns Agent profile data
 */
export async function walletLogin(
  walletAddress: string,
  signMessage: (message: string) => Promise<string>
): Promise<AgentProfile> {
  // Step 1: Get challenge nonce
  const challengeRes = await fetch(`${API_BASE_URL}/api/auth/challenge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress }),
  });

  if (!challengeRes.ok) {
    const err = await challengeRes.json();
    throw new Error(err.error || 'Failed to get login challenge');
  }

  const { nonce } = await challengeRes.json();

  // Step 2: Sign the nonce with the wallet
  const signature = await signMessage(nonce);

  // Step 3: Verify signature and get JWT
  const verifyRes = await fetch(`${API_BASE_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ wallet_address: walletAddress, signature }),
  });

  if (!verifyRes.ok) {
    const err = await verifyRes.json();
    throw new Error(err.error || 'Wallet verification failed');
  }

  const { token, expires_in, agent } = await verifyRes.json();

  // Store JWT in memory
  setJwt(token, expires_in);

  return agent;
}

// ============ Public API Functions (no auth) ============

/**
 * Fetch payment request details from backend
 * Returns 402 if payment is pending, 200 if paid
 */
export async function getPaymentRequest(requestId: string): Promise<PaymentResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/request/${requestId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Payment request not found');
      }
      if (response.status === 410) {
        throw new Error('Payment request expired');
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching payment request:', error);
    throw error;
  }
}

/**
 * Fetch fee info for a payment request (public, no auth)
 * Returns fee breakdown and transfer instructions for human payers
 */
export async function getFeeInfo(requestId: string, payerAddress: string): Promise<FeeInfoResponse> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/request/${requestId}/fee?payer=${encodeURIComponent(payerAddress)}`
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to get fee info');
    }

    return data;
  } catch (error) {
    console.error('Error fetching fee info:', error);
    throw error;
  }
}

/**
 * Create a new payment request
 */
export async function createPaymentLink(data: CreatePaymentLinkData): Promise<CreatePaymentLinkResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create payment link');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error creating payment link:', error);
    throw error;
  }
}

/**
 * Get all payment requests (optionally filtered by wallet)
 */
export async function getAllPaymentRequests(walletAddress?: string): Promise<GetAllPaymentsResponse> {
  try {
    const url = walletAddress 
      ? `${API_BASE_URL}/api/requests?wallet=${walletAddress}`
      : `${API_BASE_URL}/api/requests`;
      
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Failed to fetch payment requests');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching payment requests:', error);
    throw error;
  }
}

/**
 * Delete a payment request
 */
export async function deletePaymentRequest(requestId: string): Promise<DeletePaymentResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/request/${requestId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Payment request not found');
      }
      throw new Error('Failed to delete payment request');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error deleting payment request:', error);
    throw error;
  }
}

/**
 * Verify a payment transaction on blockchain
 */
export async function verifyPayment(data: VerifyPaymentData): Promise<VerifyPaymentResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Payment verification failed');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
}

/**
 * Get platform stats (for dashboard)
 */
export interface PlatformStats {
  totalAgents: number;
  totalPayments: number;
  totalFeesCollected: number;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/stats`);
    if (!response.ok) throw new Error('Failed to fetch stats');
    const result = await response.json();
    return result.stats;
  } catch (error) {
    console.error('Error fetching platform stats:', error);
    return { totalAgents: 0, totalPayments: 0, totalFeesCollected: 0 };
  }
}

// ============ Agent Management API Functions (JWT auth) ============

/**
 * Rotate (regenerate) API key for authenticated agent.
 * Returns the new api_key_id + api_secret (shown once).
 */
export async function rotateApiKey(): Promise<{ api_key_id: string; api_secret: string; expires_at: string }> {
  const response = await fetch(`${API_BASE_URL}/api/agents/rotate-key`, {
    method: 'POST',
    headers: getJwtHeaders(),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err.code === 'JWT_EXPIRED') throw new Error('SESSION_EXPIRED');
    throw new Error(err.error || 'Failed to rotate API key');
  }

  const result = await response.json();
  return { api_key_id: result.api_key_id, api_secret: result.api_secret, expires_at: result.expires_at };
}

/**
 * Deactivate agent
 */
export async function deactivateAgent(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/agents/deactivate`, {
    method: 'POST',
    headers: getJwtHeaders(),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err.code === 'JWT_EXPIRED') throw new Error('SESSION_EXPIRED');
    throw new Error(err.error || 'Failed to deactivate agent');
  }
}

/**
 * Delete agent (soft delete)
 */
export async function deleteAgent(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/agents/me`, {
    method: 'DELETE',
    headers: getJwtHeaders(),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err.code === 'JWT_EXPIRED') throw new Error('SESSION_EXPIRED');
    throw new Error(err.error || 'Failed to delete agent');
  }
}

/**
 * Get agent profile via JWT
 */
export async function getAgentProfile(): Promise<AgentProfile> {
  const response = await fetch(`${API_BASE_URL}/api/agents/me`, {
    headers: getJwtHeaders(),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err.code === 'JWT_EXPIRED') throw new Error('SESSION_EXPIRED');
    throw new Error(err.error || 'Failed to get agent profile');
  }

  const result = await response.json();
  return result.agent;
}

/**
 * Get agent API logs (paginated)
 */
export interface ApiLogEntry {
  id: string;
  agent_id: string;
  endpoint: string;
  method: string;
  ip_address: string | null;
  user_agent: string | null;
  status_code: number | null;
  response_time_ms: number | null;
  error: string | null;
  created_at: string;
}

export interface AgentLogsResponse {
  success: boolean;
  logs: ApiLogEntry[];
  total: number;
  limit: number;
  offset: number;
}

export async function getAgentLogs(page = 1, limit = 50): Promise<AgentLogsResponse> {
  const offset = (page - 1) * limit;
  const response = await fetch(`${API_BASE_URL}/api/agents/logs?limit=${limit}&offset=${offset}`, {
    headers: getJwtHeaders(),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err.code === 'JWT_EXPIRED') throw new Error('SESSION_EXPIRED');
    throw new Error(err.error || 'Failed to get agent logs');
  }

  return response.json();
}

/**
 * Get agent IP history
 */
export interface IpHistoryEntry {
  id: string;
  agent_id: string;
  ip_address: string;
  first_seen_at: string;
  last_seen_at: string;
  request_count: number;
  is_vpn: boolean;
}

export async function getAgentIpHistory(): Promise<IpHistoryEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/agents/ip-history`, {
    headers: getJwtHeaders(),
  });

  if (!response.ok) {
    const err = await response.json();
    if (err.code === 'JWT_EXPIRED') throw new Error('SESSION_EXPIRED');
    throw new Error(err.error || 'Failed to get IP history');
  }

  const result = await response.json();
  return result.ip_history;
}

/**
 * Get agent by wallet address (public — for checking if wallet has an agent)
 */
export interface AgentProfile {
  id: string;
  username: string;
  email: string;
  wallet_address: string | null;
  chain: string;
  status: string;
  created_at: string;
  verification_status: string;
  x_username: string | null;
  api_key_expires_at: string | null;
  total_payments_sent: number;
  total_payments_received: number;
  total_fees_paid: number;
  deleted_at: string | null;
}

export async function getAgentByWallet(walletAddress: string): Promise<AgentProfile | null> {
  const response = await fetch(`${API_BASE_URL}/api/agents/by-wallet?wallet=${walletAddress}`);
  if (!response.ok) {
    return null;
  }
  const result = await response.json();
  return result.agent || null;
}
