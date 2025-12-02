// ERC20 Token Contract ABI (minimal - just transfer function)
export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

// Network configurations
export const NETWORK_CONFIGS = {
  sepolia: {
    chainId: 11155111,
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/',
  },
  mainnet: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: import.meta.env.VITE_MAINNET_RPC_URL || '',
  },
  polygon: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: import.meta.env.VITE_POLYGON_RPC_URL || 'https://polygon-rpc.com',
  },
  base: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: import.meta.env.VITE_BASE_RPC_URL || '',
  },
} as const;

// USDC Contract Addresses per network
export const USDC_ADDRESSES = {
  // Use your custom test USDC on Sepolia
  sepolia: (import.meta.env.VITE_SEPOLIA_USDC_ADDRESS || '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87') as `0x${string}`,
  mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as `0x${string}`,
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
} as const;

// Token decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  ETH: 18,
};

/**
 * Get chain ID from network name
 */
export function getChainId(network: string): number {
  const networkLower = network.toLowerCase();
  
  // Check for Sepolia first (testnet)
  if (networkLower.includes('sepolia')) return NETWORK_CONFIGS.sepolia.chainId;
  
  // Check for mainnet (only if explicitly "mainnet" or "ethereum mainnet")
  if (networkLower.includes('mainnet')) return NETWORK_CONFIGS.mainnet.chainId;
  
  // Other networks
  if (networkLower.includes('polygon')) return NETWORK_CONFIGS.polygon.chainId;
  if (networkLower.includes('base')) return NETWORK_CONFIGS.base.chainId;
  
  // If just "ETH" without specifier, default to Sepolia for testing
  if (networkLower.includes('eth')) return NETWORK_CONFIGS.sepolia.chainId;
  
  // Default to Sepolia for testing
  return NETWORK_CONFIGS.sepolia.chainId;
}

/**
 * Get USDC contract address for a network
 */
export function getUsdcAddress(network: string): `0x${string}` | null {
  const networkLower = network.toLowerCase();
  
  // Check for Sepolia first (testnet)
  if (networkLower.includes('sepolia')) return USDC_ADDRESSES.sepolia;
  
  // Check for mainnet (only if explicitly "mainnet")
  if (networkLower.includes('mainnet')) return USDC_ADDRESSES.mainnet;
  
  // Other networks
  if (networkLower.includes('polygon')) return USDC_ADDRESSES.polygon;
  if (networkLower.includes('base')) return USDC_ADDRESSES.base;
  
  // If just "ETH" without specifier, default to Sepolia for testing
  if (networkLower.includes('eth')) return USDC_ADDRESSES.sepolia;
  
  // Default to Sepolia for testing
  return USDC_ADDRESSES.sepolia;
}

/**
 * Get token contract address
 */
export function getTokenAddress(network: string, token: string): `0x${string}` | null {
  const tokenUpper = token.toUpperCase();
  
  // For now, only USDC is supported
  if (tokenUpper === 'USDC' || tokenUpper === 'USDT') {
    return getUsdcAddress(network);
  }
  
  // Native tokens (ETH) don't have a contract address
  if (tokenUpper === 'ETH') {
    return null;
  }
  
  return null;
}

/**
 * Get token decimals
 */
export function getTokenDecimals(token: string): number {
  return TOKEN_DECIMALS[token.toUpperCase()] || 18;
}

/**
 * Get network display name
 */
export function getNetworkName(network: string): string {
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes('sepolia')) return 'Sepolia (ETH Testnet)';
  if (networkLower.includes('mainnet')) return 'Ethereum Mainnet';
  if (networkLower.includes('polygon')) return 'Polygon';
  if (networkLower.includes('base')) return 'Base';
  if (networkLower.includes('eth')) return 'Sepolia (ETH Testnet)'; // Default ETH to Sepolia
  
  return network;
}

