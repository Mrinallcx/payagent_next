/**
 * Chain Registry
 *
 * Single source of truth for all supported chains, RPC URLs,
 * token contract addresses, and chain metadata.
 *
 * All backend modules import from here instead of reading
 * individual env vars for token addresses.
 */

// ============ Supported Chains ============

const SUPPORTED_CHAINS = {
  sepolia: {
    canonicalName: 'sepolia',
    displayName: 'Sepolia (ETH Testnet)',
    chainId: 11155111,
    isTestnet: true,
    rpcEnvVar: 'SEPOLIA_RPC_URL',
    rpcFallbackEnvVar: 'NEXT_PUBLIC_ETH_RPC_URL',
    rpcDefault: null,
    explorer: 'https://sepolia.etherscan.io',
    nativeToken: 'ETH',
    tokens: {
      USDC: '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87',
      USDT: '0xF9E0643Ba46eeaf4e1059775567f67F5c867bbfc',
      LCX:  '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b',
      // ETH is native — no contract address
    },
    tokenDecimals: {
      USDC: 6,
      USDT: 6,
      LCX: 18,
      ETH: 18,
    },
  },

  ethereum: {
    canonicalName: 'ethereum',
    displayName: 'Ethereum Mainnet',
    chainId: 1,
    isTestnet: false,
    rpcEnvVar: 'ETH_MAINNET_RPC_URL',
    rpcFallbackEnvVar: null,
    rpcDefault: null,
    explorer: 'https://etherscan.io',
    nativeToken: 'ETH',
    tokens: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      LCX:  '0x037A54AaB062628C9Bbae1FDB1583c195585Fe41',
    },
    tokenDecimals: {
      USDC: 6,
      USDT: 6,
      LCX: 18,
      ETH: 18,
    },
  },

  base: {
    canonicalName: 'base',
    displayName: 'Base Mainnet',
    chainId: 8453,
    isTestnet: false,
    rpcEnvVar: 'BASE_MAINNET_RPC_URL',
    rpcFallbackEnvVar: null,
    rpcDefault: 'https://mainnet.base.org',
    explorer: 'https://basescan.org',
    nativeToken: 'ETH',
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      LCX:  '0xd7468c14ae76C3Fc308aEAdC223D5D1F71d3c171',
    },
    tokenDecimals: {
      USDC: 6,
      USDT: 6,
      LCX: 18,
      ETH: 18,
    },
  },
};

// ============ Aliases ============
// Maps alternative names to canonical chain names

const NETWORK_ALIASES = {
  // Sepolia
  'sepolia':         'sepolia',
  'eth-sepolia':     'sepolia',
  'sepolia-testnet': 'sepolia',

  // Ethereum mainnet
  'ethereum':     'ethereum',
  'mainnet':      'ethereum',
  'eth-mainnet':  'ethereum',
  'eth':          'ethereum',

  // Base mainnet
  'base':         'base',
  'base-mainnet': 'base',
};

// ============ Helpers ============

/**
 * Resolve a network string to its canonical name.
 * Returns null if not supported.
 */
function resolveNetwork(network) {
  if (!network) return null;
  const key = network.toLowerCase().trim();
  return NETWORK_ALIASES[key] || null;
}

/**
 * Get the full chain config for a network.
 * @param {string} network - Network name (canonical or alias)
 * @returns {object|null} Chain config or null if unsupported
 */
function getChainConfig(network) {
  const canonical = resolveNetwork(network);
  if (!canonical) return null;
  return SUPPORTED_CHAINS[canonical] || null;
}

/**
 * Get the RPC URL for a network (reads from env).
 * @param {string} network
 * @returns {string|null}
 */
function getRpcUrl(network) {
  const config = getChainConfig(network);
  if (!config) return null;

  const primary = process.env[config.rpcEnvVar];
  if (primary) return primary;

  if (config.rpcFallbackEnvVar) {
    const fallback = process.env[config.rpcFallbackEnvVar];
    if (fallback) return fallback;
  }

  return config.rpcDefault || null;
}

/**
 * Get the contract address for a token on a network.
 * Returns null for native tokens (ETH on EVM chains).
 * @param {string} network
 * @param {string} tokenSymbol - e.g. 'USDC', 'USDT', 'LCX', 'ETH'
 * @returns {string|null}
 */
function getTokenAddress(network, tokenSymbol) {
  const config = getChainConfig(network);
  if (!config) return null;

  const symbol = (tokenSymbol || '').toUpperCase();

  // Native token has no contract address
  if (symbol === config.nativeToken) return null;

  return config.tokens[symbol] || null;
}

/**
 * Get token decimals for a token on a network.
 * @param {string} network
 * @param {string} tokenSymbol
 * @returns {number}
 */
function getTokenDecimals(network, tokenSymbol) {
  const config = getChainConfig(network);
  if (!config) return 18; // safe default
  const symbol = (tokenSymbol || '').toUpperCase();
  return config.tokenDecimals[symbol] || 18;
}

/**
 * Get the block explorer URL for a network.
 * @param {string} network
 * @returns {string}
 */
function getExplorerUrl(network) {
  const config = getChainConfig(network);
  return config ? config.explorer : 'https://sepolia.etherscan.io';
}

/**
 * Check if a network name is valid / supported.
 * @param {string} network
 * @returns {boolean}
 */
function isValidNetwork(network) {
  return resolveNetwork(network) !== null;
}

/**
 * Check if a token is a native token on the given network.
 * @param {string} tokenSymbol
 * @param {string} network
 * @returns {boolean}
 */
function isNativeToken(tokenSymbol, network) {
  const config = getChainConfig(network);
  if (!config) return false;
  return (tokenSymbol || '').toUpperCase() === config.nativeToken;
}

/**
 * Get the canonical network name (normalises aliases).
 * @param {string} network
 * @returns {string|null}
 */
function getCanonicalName(network) {
  return resolveNetwork(network);
}

/**
 * Get list of all supported canonical network names.
 * @returns {string[]}
 */
function getSupportedNetworks() {
  return Object.keys(SUPPORTED_CHAINS);
}

/**
 * Get display-friendly list of supported networks.
 * @returns {Array<{name: string, displayName: string, isTestnet: boolean}>}
 */
function getSupportedNetworkList() {
  return Object.values(SUPPORTED_CHAINS).map(c => ({
    name: c.canonicalName,
    displayName: c.displayName,
    chainId: c.chainId,
    isTestnet: c.isTestnet,
  }));
}

module.exports = {
  SUPPORTED_CHAINS,
  resolveNetwork,
  getChainConfig,
  getRpcUrl,
  getTokenAddress,
  getTokenDecimals,
  getExplorerUrl,
  isValidNetwork,
  isNativeToken,
  getCanonicalName,
  getSupportedNetworks,
  getSupportedNetworkList,
};
