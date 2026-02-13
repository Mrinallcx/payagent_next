const { ethers } = require('ethers');
const { getFeeConfig } = require('./feeConfig');
const { getLcxPriceUsd, getEthPriceUsd } = require('./lcxPrice');
const { getRpcUrl, getTokenAddress } = require('./chainRegistry');

const ERC20_BALANCE_ABI = ['function balanceOf(address account) view returns (uint256)'];

/**
 * Calculate fee for a payment
 *
 * Checks the payer's LCX balance on the payment's network:
 * - If >= 4 LCX → fee paid in LCX (2 to platform, 2 to creator)
 * - If < 4 LCX → fee deducted from the primary payment token
 *   - USDC/USDT: fee = lcxFeeAmount * lcxPriceUsd (stablecoins ≈ $1)
 *   - ETH: fee = (lcxFeeAmount * lcxPriceUsd) / ethPriceUsd
 *   - LCX (as payment token, but balance < 4): fee = lcxFeeAmount (same denomination)
 *
 * @param {string} payerWalletAddress - The payer's wallet address
 * @param {string} [network='sepolia'] - The network to check balance on
 * @param {string} [paymentToken='USDC'] - The primary payment token (USDC, USDT, ETH, LCX)
 * @returns {Promise<object>} Fee details
 */
async function calculateFee(payerWalletAddress, network = 'sepolia', paymentToken = 'USDC') {
  const config = await getFeeConfig();
  const rpcUrl = getRpcUrl(network);
  const lcxAddress = getTokenAddress(network, 'LCX');

  let payerLcxBalance = 0;

  // Check payer's LCX balance on-chain for the correct network
  if (rpcUrl && lcxAddress && payerWalletAddress) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const lcxContract = new ethers.Contract(lcxAddress, ERC20_BALANCE_ABI, provider);
      const balanceRaw = await lcxContract.balanceOf(payerWalletAddress);
      // LCX has 18 decimals
      payerLcxBalance = Number(ethers.formatUnits(balanceRaw, 18));
    } catch (err) {
      console.error(`LCX balance check error on ${network}:`, err.message);
      // Fall through to payment-token fee path
    }
  }

  const lcxFeeAmount = Number(config.lcx_fee_amount);
  const lcxPlatformShare = Number(config.lcx_platform_share);
  const lcxCreatorReward = Number(config.lcx_creator_reward);

  // Option A: Payer has enough LCX → fee in LCX (creator gets full amount)
  if (payerLcxBalance >= lcxFeeAmount) {
    return {
      feeToken: 'LCX',
      feeTotal: lcxFeeAmount,
      platformShare: lcxPlatformShare,
      creatorReward: lcxCreatorReward,
      lcxPriceUsd: null,
      payerLcxBalance,
      feeDeductedFromPayment: false
    };
  }

  // Option B: Payer doesn't have enough LCX — fee deducted from payment token
  let lcxPriceUsd;
  try {
    lcxPriceUsd = await getLcxPriceUsd();
  } catch (err) {
    console.error('LCX price unavailable, using fallback $0.15:', err.message);
    lcxPriceUsd = 0.15; // Fallback price
  }

  const normalizedToken = paymentToken.toUpperCase();
  let feeTotal, platformShare, creatorReward;

  if (normalizedToken === 'ETH') {
    // ETH is not a stablecoin — convert USD fee to ETH
    let ethPriceUsd;
    try {
      ethPriceUsd = await getEthPriceUsd();
    } catch (err) {
      console.error('ETH price unavailable, using fallback $2500:', err.message);
      ethPriceUsd = 2500; // Conservative fallback
    }

    const usdFee = lcxFeeAmount * lcxPriceUsd;
    feeTotal = Number((usdFee / ethPriceUsd).toFixed(8));
    platformShare = Number((feeTotal / 2).toFixed(8));
    creatorReward = Number((feeTotal - platformShare).toFixed(8));
  } else if (normalizedToken === 'LCX') {
    // LCX as payment token but payer doesn't have enough separate LCX
    // Fee stays in LCX denomination
    feeTotal = lcxFeeAmount;
    platformShare = lcxPlatformShare;
    creatorReward = lcxCreatorReward;
  } else {
    // Stablecoins (USDC, USDT): assume $1 peg
    feeTotal = Number((lcxFeeAmount * lcxPriceUsd).toFixed(6));
    platformShare = Number((feeTotal / 2).toFixed(6));
    creatorReward = Number((feeTotal - platformShare).toFixed(6));
  }

  return {
    feeToken: normalizedToken, // Fee in the same token as the payment
    feeTotal,
    platformShare,
    creatorReward,
    lcxPriceUsd,
    payerLcxBalance,
    feeDeductedFromPayment: true
  };
}

module.exports = { calculateFee };
