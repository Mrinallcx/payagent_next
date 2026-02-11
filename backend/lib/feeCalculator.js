const { ethers } = require('ethers');
const { getFeeConfig } = require('./feeConfig');
const { getLcxPriceUsd } = require('./lcxPrice');

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'];

/**
 * Calculate fee for a payment
 *
 * Checks the payee's LCX balance:
 * - If >= 4 LCX → fee paid in LCX (2 to platform, 2 to creator)
 * - If < 4 LCX → fee paid in USDC equivalent (50/50 split)
 *
 * @param {string} payerWalletAddress - The payee's wallet address
 * @returns {Promise<object>} Fee details
 */
async function calculateFee(payerWalletAddress) {
  const config = await getFeeConfig();
  const rpcUrl = process.env.SEPOLIA_RPC_URL || process.env.NEXT_PUBLIC_ETH_RPC_URL;

  let payerLcxBalance = 0;

  // Check payee's LCX balance on-chain
  if (rpcUrl && config.lcx_contract_address && payerWalletAddress) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const lcxContract = new ethers.Contract(config.lcx_contract_address, ERC20_BALANCE_ABI, provider);
      const balanceRaw = await lcxContract.balanceOf(payerWalletAddress);
      // LCX has 18 decimals
      payerLcxBalance = Number(ethers.formatUnits(balanceRaw, 18));
    } catch (err) {
      console.error('LCX balance check error:', err.message);
      // Fall through to USDC fee path
    }
  }

  const lcxFeeAmount = Number(config.lcx_fee_amount);
  const lcxPlatformShare = Number(config.lcx_platform_share);
  const lcxCreatorReward = Number(config.lcx_creator_reward);

  // Option A: Payee has enough LCX
  if (payerLcxBalance >= lcxFeeAmount) {
    return {
      feeToken: 'LCX',
      feeTotal: lcxFeeAmount,
      platformShare: lcxPlatformShare,
      creatorReward: lcxCreatorReward,
      lcxPriceUsd: null,
      payerLcxBalance
    };
  }

  // Option B: Payee doesn't have enough LCX — fee in USDC equivalent
  let lcxPriceUsd;
  try {
    lcxPriceUsd = await getLcxPriceUsd();
  } catch (err) {
    console.error('LCX price unavailable, using fallback $0.15:', err.message);
    lcxPriceUsd = 0.15; // Fallback price
  }

  const usdcFeeTotal = Number((lcxFeeAmount * lcxPriceUsd).toFixed(6));
  const usdcPlatformShare = Number((usdcFeeTotal / 2).toFixed(6));
  const usdcCreatorReward = Number((usdcFeeTotal - usdcPlatformShare).toFixed(6));

  return {
    feeToken: 'USDC',
    feeTotal: usdcFeeTotal,
    platformShare: usdcPlatformShare,
    creatorReward: usdcCreatorReward,
    lcxPriceUsd,
    payerLcxBalance
  };
}

module.exports = { calculateFee };
