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
