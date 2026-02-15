const { ethers } = require('ethers');
const { getRpcUrl, getChainConfig, isNativeToken: registryIsNative, getTokenDecimals } = require('./chainRegistry');

// Minimal ERC20 ABI for transfer events + transfers
const ERC20_ABI = [
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'function decimals() view returns (uint8)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

/**
 * Get RPC provider based on network.
 * Uses the chain registry to resolve the correct RPC URL.
 */
function getProvider(network) {
  const rpcUrl = getRpcUrl(network || 'sepolia');
  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for network: ${network}`);
  }
  return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Check if token is native on the given network
 */
function isNativeTokenOnNetwork(tokenSymbol, network) {
  return registryIsNative(tokenSymbol, network || 'sepolia');
}

/**
 * Verify a transaction on the blockchain
 * Supports both ERC20 tokens and native transfers (ETH)
 */
async function verifyTransaction(txHash, expectedAmount, expectedToken, expectedReceiver, tokenSymbol = 'USDC', network = 'sepolia') {
  try {
    const provider = getProvider(network);

    // Get transaction receipt
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      return { valid: false, error: 'Transaction not found' };
    }

    // Check if transaction was successful
    if (receipt.status !== 1) {
      return { valid: false, error: 'Transaction failed' };
    }

    // Check if this is a native token transfer based on token and network
    const isNative = isNativeTokenOnNetwork(tokenSymbol, network);

    if (isNative) {
      return await verifyNativeTransfer(txHash, expectedAmount, expectedReceiver, provider, receipt, tokenSymbol.toUpperCase());
    } else {
      return await verifyErc20Transfer(txHash, expectedAmount, expectedToken, expectedReceiver, provider, receipt);
    }

  } catch (error) {
    console.error('Verification error:', error);
    return { valid: false, error: error.message };
  }
}

/**
 * Verify native token transfer (ETH)
 */
async function verifyNativeTransfer(txHash, expectedAmount, expectedReceiver, provider, receipt, tokenSymbol = 'ETH') {
  try {
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return { valid: false, error: 'Transaction not found' };
    }

    const transferredAmount = ethers.formatEther(tx.value);
    const transferredTo = tx.to.toLowerCase();

    const amountValid = parseFloat(transferredAmount) >= parseFloat(expectedAmount);
    const receiverValid = transferredTo === expectedReceiver.toLowerCase();

    if (!amountValid || !receiverValid) {
      return {
        valid: false,
        error: 'Amount or receiver mismatch',
        details: {
          expected: { amount: expectedAmount, receiver: expectedReceiver },
          actual: { amount: transferredAmount, receiver: transferredTo }
        }
      };
    }

    return {
      valid: true,
      txHash,
      amount: transferredAmount,
      receiver: transferredTo,
      blockNumber: receipt.blockNumber,
      tokenType: tokenSymbol
    };

  } catch (error) {
    console.error(`${tokenSymbol} verification error:`, error);
    return { valid: false, error: error.message };
  }
}

// Alias for backwards compatibility
async function verifyEthTransfer(txHash, expectedAmount, expectedReceiver, provider, receipt) {
  return verifyNativeTransfer(txHash, expectedAmount, expectedReceiver, provider, receipt, 'ETH');
}

/**
 * Verify ERC20 token transfer
 */
async function verifyErc20Transfer(txHash, expectedAmount, expectedToken, expectedReceiver, provider, receipt) {
  try {
    const expectedTokenLower = expectedToken.toLowerCase();
    const contract = new ethers.Contract(expectedToken, ERC20_ABI, provider);
    const decimals = await contract.decimals();

    // Only consider logs from the expected token contract
    const tokenLogs = receipt.logs.filter(log => log.address && log.address.toLowerCase() === expectedTokenLower);
    const transferLog = tokenLogs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed?.name === 'Transfer';
      } catch {
        return false;
      }
    });

    if (!transferLog) {
      return { valid: false, error: 'No transfer event found for this token contract' };
    }

    const parsedLog = contract.interface.parseLog(transferLog);
    const transferredAmount = ethers.formatUnits(parsedLog.args.value, decimals);
    const transferredTo = (parsedLog.args.to || '').toLowerCase();
    const expectedReceiverLower = (expectedReceiver || '').toLowerCase();

    // Validate amount (allow tiny tolerance for float) and receiver
    const expectedNum = parseFloat(expectedAmount);
    const actualNum = parseFloat(transferredAmount);
    const amountValid = !isNaN(expectedNum) && !isNaN(actualNum) && actualNum >= expectedNum;
    const receiverValid = transferredTo === expectedReceiverLower;

    if (!amountValid || !receiverValid) {
      return {
        valid: false,
        error: 'Amount or receiver mismatch',
        details: {
          expected: { amount: expectedAmount, receiver: expectedReceiver },
          actual: { amount: transferredAmount, receiver: transferredTo }
        }
      };
    }

    return {
      valid: true,
      txHash,
      amount: transferredAmount,
      receiver: transferredTo,
      blockNumber: receipt.blockNumber,
      tokenType: 'ERC20'
    };

  } catch (error) {
    console.error('ERC20 verification error:', error);
    return { valid: false, error: error.message };
  }
}

async function getTokenBalance(address, tokenAddress, provider) {
  try {
    const contract = new ethers.Contract(
      tokenAddress,
      ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'],
      provider
    );

    const balance = await contract.balanceOf(address);
    const decimals = await contract.decimals();

    return ethers.formatUnits(balance, decimals);
  } catch (error) {
    console.error('Balance check error:', error);
    return '0';
  }
}

module.exports = {
  getProvider,
  verifyTransaction,
  verifyNativeTransfer,
  verifyEthTransfer,
  verifyErc20Transfer,
  getTokenBalance
};
