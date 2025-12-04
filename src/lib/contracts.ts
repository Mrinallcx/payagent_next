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
  bnb: {
    chainId: 56,
    name: 'BNB Chain',
    rpcUrl: import.meta.env.VITE_BNB_RPC_URL || 'https://bsc-dataseed.binance.org/',
  },
  bnbTestnet: {
    chainId: 97,
    name: 'BNB Testnet',
    rpcUrl: import.meta.env.VITE_BNB_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
  },
} as const;

// USDC Contract Addresses per network
export const USDC_ADDRESSES = {
  // Use your custom test USDC on Sepolia
  sepolia: (import.meta.env.VITE_SEPOLIA_USDC_ADDRESS || '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87') as `0x${string}`,
  mainnet: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as `0x${string}`,
  polygon: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' as `0x${string}`,
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
  // BNB Testnet USDC - you may need to deploy or find a test token
  bnbTestnet: (import.meta.env.VITE_BNB_TESTNET_USDC_ADDRESS || '0x64544969ed7EBf5f083679233325356EbE738930') as `0x${string}`,
} as const;

// USDT Contract Addresses per network
export const USDT_ADDRESSES = {
  // Use your custom test USDT on Sepolia
  sepolia: (import.meta.env.VITE_SEPOLIA_USDT_ADDRESS || '0xF9E0643Ba46eeaf4e1059775567f67F5c867bbfc') as `0x${string}`,
  mainnet: '0xdAC17F958D2ee523a2206206994597C13D831ec7' as `0x${string}`,
  polygon: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' as `0x${string}`,
  base: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' as `0x${string}`,
  // BNB Testnet USDT - you may need to deploy or find a test token
  bnbTestnet: (import.meta.env.VITE_BNB_TESTNET_USDT_ADDRESS || '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd') as `0x${string}`,
} as const;

// BNB/WBNB Contract Addresses per network (ERC20 wrapped BNB)
export const BNB_ADDRESSES = {
  // WBNB on Sepolia
  sepolia: (import.meta.env.VITE_SEPOLIA_BNB_ADDRESS || '0xceB2b022295a3FcdeC12ac82C2Ba21227e425720') as `0x${string}`,
  // Original BNB token on Ethereum mainnet (from Binance ICO)
  mainnet: '0xB8c77482e45F1F44dE1745F52C74426C631bDD52' as `0x${string}`,
} as const;

// LCX Token Contract Addresses per network
export const LCX_ADDRESSES = {
  // LCX on Sepolia
  sepolia: (import.meta.env.VITE_SEPOLIA_LCX_ADDRESS || '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b') as `0x${string}`,
  // LCX on Ethereum mainnet
  mainnet: '0x037A54AaB062628C9Bbae1FDB1583c195585Fe41' as `0x${string}`,
} as const;

// Token decimals
export const TOKEN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  ETH: 18,
  BNB: 18,
  LCX: 18,
};

/**
 * Get chain ID from network name
 */
export function getChainId(network: string): number {
  const networkLower = network.toLowerCase();
  
  // Check for Sepolia first (testnet)
  if (networkLower.includes('sepolia')) return NETWORK_CONFIGS.sepolia.chainId;
  
  // Check for BNB Testnet specifically
  if (networkLower.includes('bnb') && networkLower.includes('test')) return NETWORK_CONFIGS.bnbTestnet.chainId;
  
  // Check for BNB Chain mainnet
  if (networkLower.includes('bnb')) return NETWORK_CONFIGS.bnb.chainId;
  
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
  
  // Check for BNB Testnet
  if (networkLower.includes('bnb') && networkLower.includes('test')) return USDC_ADDRESSES.bnbTestnet;
  
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
 * Get USDT contract address for a network
 */
export function getUsdtAddress(network: string): `0x${string}` | null {
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes('sepolia')) return USDT_ADDRESSES.sepolia;
  // Check for BNB Testnet
  if (networkLower.includes('bnb') && networkLower.includes('test')) return USDT_ADDRESSES.bnbTestnet;
  if (networkLower.includes('mainnet')) return USDT_ADDRESSES.mainnet;
  if (networkLower.includes('polygon')) return USDT_ADDRESSES.polygon;
  if (networkLower.includes('base')) return USDT_ADDRESSES.base;
  if (networkLower.includes('eth')) return USDT_ADDRESSES.sepolia;
  
  return USDT_ADDRESSES.sepolia;
}

/**
 * Get BNB/WBNB contract address for a network (ERC20 wrapped BNB)
 */
export function getBnbAddress(network: string): `0x${string}` | null {
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes('sepolia')) return BNB_ADDRESSES.sepolia;
  if (networkLower.includes('mainnet')) return BNB_ADDRESSES.mainnet;
  if (networkLower.includes('eth')) return BNB_ADDRESSES.sepolia;
  
  return BNB_ADDRESSES.sepolia;
}

/**
 * Get LCX contract address for a network
 */
export function getLcxAddress(network: string): `0x${string}` | null {
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes('sepolia')) return LCX_ADDRESSES.sepolia;
  if (networkLower.includes('mainnet')) return LCX_ADDRESSES.mainnet;
  if (networkLower.includes('eth')) return LCX_ADDRESSES.sepolia;
  
  return LCX_ADDRESSES.sepolia;
}

/**
 * Get token contract address
 */
export function getTokenAddress(network: string, token: string): `0x${string}` | null {
  const tokenUpper = token.toUpperCase();
  const networkLower = network.toLowerCase();
  
  // USDC
  if (tokenUpper === 'USDC') {
    return getUsdcAddress(network);
  }
  
  // USDT
  if (tokenUpper === 'USDT') {
    return getUsdtAddress(network);
  }
  
  // BNB - native on BNB chains, ERC20 (WBNB) on Ethereum/Sepolia
  if (tokenUpper === 'BNB') {
    // On BNB Chain/Testnet, BNB is native (no contract)
    if (networkLower.includes('bnb')) {
      return null;
    }
    // On Sepolia/Ethereum, BNB is wrapped (WBNB)
    return getBnbAddress(network);
  }
  
  // LCX
  if (tokenUpper === 'LCX') {
    return getLcxAddress(network);
  }
  
  // Native token ETH
  if (tokenUpper === 'ETH') {
    return null;
  }
  
  return null;
}

/**
 * Check if token is a native token on the given network
 */
export function isNativeToken(token: string, network?: string): boolean {
  const tokenUpper = token.toUpperCase();
  const networkLower = network?.toLowerCase() || '';
  
  // ETH is always native on Ethereum networks
  if (tokenUpper === 'ETH') return true;
  
  // BNB is native on BNB Chain/Testnet, but ERC20 on Sepolia
  if (tokenUpper === 'BNB' && networkLower.includes('bnb')) return true;
  
  return false;
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
  if (networkLower.includes('bnb') && networkLower.includes('test')) return 'BNB Testnet';
  if (networkLower.includes('bnb')) return 'BNB Chain';
  if (networkLower.includes('mainnet')) return 'Ethereum Mainnet';
  if (networkLower.includes('polygon')) return 'Polygon';
  if (networkLower.includes('base')) return 'Base';
  if (networkLower.includes('eth')) return 'Sepolia (ETH Testnet)'; // Default ETH to Sepolia
  
  return network;
}

/**
 * Get block explorer URL for a network
 */
export function getExplorerUrl(network: string): string {
  const networkLower = network.toLowerCase();
  
  if (networkLower.includes('sepolia')) return 'https://sepolia.etherscan.io';
  if (networkLower.includes('bnb') && networkLower.includes('test')) return 'https://testnet.bscscan.com';
  if (networkLower.includes('bnb')) return 'https://bscscan.com';
  if (networkLower.includes('mainnet')) return 'https://etherscan.io';
  if (networkLower.includes('polygon')) return 'https://polygonscan.com';
  if (networkLower.includes('base')) return 'https://basescan.org';
  
  return 'https://sepolia.etherscan.io';
}

