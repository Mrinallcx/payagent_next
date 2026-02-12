const { ethers } = require('ethers');
const { getFeeConfig } = require('./feeConfig');
const { getLcxPriceUsd } = require('./lcxPrice');
const { getRpcUrl, getTokenAddress } = require('./chainRegistry');

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'];

/**
 * Calculate fee for a payment
 *
 * Checks the payee's LCX balance on the payment's network:
 * - If >= 4 LCX → fee paid in LCX (2 to platform, 2 to creator)
 * - If < 4 LCX → fee paid in USDC equivalent (50/50 split)
 *
 * @param {string} payerWalletAddress - The payee's wallet address
 * @param {string} [network='sepolia'] - The network to check balance on
 * @returns {Promise<object>} Fee details
 */
async function calculateFee(payerWalletAddress, network = 'sepolia') {
  const config = await getFeeConfig();
  const rpcUrl = getRpcUrl(network);
  const lcxAddress = getTokenAddress(network, 'LCX');

  let payerLcxBalance = 0;

  // Check payee's LCX balance on-chain for the correct network
  if (rpcUrl && lcxAddress && payerWalletAddress) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const lcxContract = new ethers.Contract(lcxAddress, ERC20_BALANCE_ABI, provider);
      const balanceRaw = await lcxContract.balanceOf(payerWalletAddress);
      // LCX has 18 decimals
      payerLcxBalance = Number(ethers.formatUnits(balanceRaw, 18));
    } catch (err) {
      console.error(`LCX balance check error on ${network}:`, err.message);
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
