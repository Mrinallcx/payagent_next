/**
 * Embedded chain constants for the PayAgent SDK.
 * Mirrors the backend chainRegistry so the SDK can resolve
 * token decimals and default RPC URLs without an API call.
 */

const CHAINS = {
  sepolia: {
    name: 'sepolia',
    displayName: 'Sepolia (ETH Testnet)',
    chainId: 11155111,
    isTestnet: true,
    nativeToken: 'ETH',
    tokens: {
      USDC: '0x3402d41aa8e34e0df605c12109de2f8f4ff33a87',
      USDT: '0xF9E0643Ba46eeaf4e1059775567f67F5c867bbfc',
      LCX:  '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b',
    },
  },
  ethereum: {
    name: 'ethereum',
    displayName: 'Ethereum Mainnet',
    chainId: 1,
    isTestnet: false,
    nativeToken: 'ETH',
    tokens: {
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      LCX:  '0x037A54AaB062628C9Bbae1FDB1583c195585Fe41',
    },
  },
  base: {
    name: 'base',
    displayName: 'Base Mainnet',
    chainId: 8453,
    isTestnet: false,
    nativeToken: 'ETH',
    tokens: {
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
      LCX:  '0xd7468c14ae76C3Fc308aEAdC223D5D1F71d3c171',
    },
  },
};

const TOKEN_DECIMALS = {
  USDC: 6,
  USDT: 6,
  LCX: 18,
  ETH: 18,
};

const DEFAULT_RPC_URLS = {
  sepolia: 'https://rpc.sepolia.org',
  ethereum: 'https://eth.llamarpc.com',
  base: 'https://mainnet.base.org',
};

module.exports = { CHAINS, TOKEN_DECIMALS, DEFAULT_RPC_URLS };
