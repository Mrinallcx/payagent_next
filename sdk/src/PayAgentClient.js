/**
 * PayAgentClient — SDK for PayAgent crypto payments.
 *
 * Uses HMAC-SHA256 request signing for authentication (api_secret never leaves your environment).
 * Handles fetching payment instructions, signing transactions with ethers.js,
 * broadcasting to the blockchain, and verifying payments via the PayAgent API.
 *
 * @example
 * const { PayAgentClient } = require('@payagent/sdk');
 *
 * const client = new PayAgentClient({
 *   apiKeyId: 'pk_live_...',
 *   apiSecret: 'sk_live_...',
 *   privateKey: '0x...',
 *   baseUrl: 'https://backend-two-chi-56.vercel.app',
 * });
 *
 * const result = await client.payLink('REQ-ABC123');
 * console.log(result.transactions); // all on-chain tx hashes
 */

const { ethers } = require('ethers');
const crypto = require('crypto');
const { TOKEN_DECIMALS, DEFAULT_RPC_URLS, CHAINS } = require('./constants');

// Minimal ERC-20 ABI for transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

class PayAgentClient {
  /**
   * Create a new PayAgentClient.
   *
   * @param {Object} options
   * @param {string} options.apiKeyId - Your PayAgent API key ID (pk_live_...)
   * @param {string} options.apiSecret - Your PayAgent API secret (sk_live_...) — used for HMAC signing, never transmitted
   * @param {string} options.privateKey - Your wallet private key
   * @param {string} [options.baseUrl='https://backend-two-chi-56.vercel.app'] - PayAgent API base URL
   * @param {string|Object} [options.rpcUrl] - Custom RPC URL(s). String for all chains, or { sepolia: '...', ethereum: '...', base: '...' }
   *
   * @deprecated options.apiKey - Use apiKeyId + apiSecret instead (backward compat removed in v0.2.0)
   */
  constructor({ apiKeyId, apiSecret, apiKey, privateKey, baseUrl, rpcUrl } = {}) {
    // Backward compat: if old-style apiKey is provided without new fields, throw helpful error
    if (apiKey && !apiKeyId) {
      throw new Error(
        'PayAgentClient v0.2.0 breaking change: Replace { apiKey } with { apiKeyId, apiSecret }.\n' +
        'Rotate your key via POST /api/agents/rotate-key to get the new credentials.'
      );
    }

    if (!apiKeyId) throw new Error('apiKeyId is required');
    if (!apiSecret) throw new Error('apiSecret is required');
    if (!privateKey) throw new Error('privateKey is required');

    this.apiKeyId = apiKeyId;
    this.apiSecret = apiSecret;
    this.baseUrl = (baseUrl || 'https://backend-two-chi-56.vercel.app').replace(/\/$/, '');

    this._wallet = new ethers.Wallet(privateKey);
    this._rpcUrl = rpcUrl || null;
  }

  // ─── Public Methods ───────────────────────────────────────────────

  /**
   * Pay a link in one call: fetch instructions, sign locally, broadcast, verify.
   *
   * @param {string} linkId - The payment link ID (e.g. 'REQ-ABC123')
   * @returns {Promise<Object>} { transactions, verification, status }
   */
  async payLink(linkId) {
    if (!linkId) throw new Error('linkId is required');

    // 1. Fetch payment instructions from the API
    const instructionsRes = await this.getInstructions(linkId);
    if (!instructionsRes.success) {
      throw new Error(instructionsRes.error || 'Failed to fetch payment instructions');
    }

    // Handle already-paid links
    if (instructionsRes.alreadyPaid) {
      return { alreadyPaid: true, message: instructionsRes.message, status: 'PAID' };
    }

    const { instructions } = instructionsRes;
    const network = instructions.payment.network;
    const transfers = instructions.transfers;

    if (!transfers || transfers.length === 0) {
      throw new Error('No transfers found in payment instructions');
    }

    // 2. Connect wallet to the correct chain's provider
    const provider = this._getProvider(network);
    const wallet = this._wallet.connect(provider);

    // 3. Sign and broadcast each transfer locally
    const results = [];
    for (const transfer of transfers) {
      const { token, tokenAddress, amount, to, description } = transfer;
      const isNative = this._isNativeToken(token, network);
      const decimals = this._getDecimals(token);

      let tx;
      if (isNative || !tokenAddress) {
        // Native ETH transfer
        const value = ethers.parseUnits(amount, decimals);
        tx = await wallet.sendTransaction({ to, value });
      } else {
        // ERC-20 transfer
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
        const parsedAmount = ethers.parseUnits(amount, decimals);
        tx = await contract.transfer(to, parsedAmount);
      }

      const receipt = await tx.wait();
      results.push({
        description,
        txHash: receipt.hash,
        token,
        amount,
        to,
        blockNumber: receipt.blockNumber,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
      });
    }

    // 4. Verify payment with the API
    const paymentTxHash = results[0]?.txHash;
    const feeTxHash = results[1]?.txHash || null;
    const rewardTxHash = results[2]?.txHash || null;

    const verification = await this.verifyPayment(linkId, paymentTxHash, feeTxHash, rewardTxHash);

    return {
      success: true,
      linkId,
      payer: this._wallet.address,
      network,
      transactions: results,
      verification,
      status: verification.status || 'PAID',
    };
  }

  /**
   * Fetch payment instructions for a link (without executing).
   * Use this for manual control over the signing/broadcast process.
   *
   * @param {string} linkId - The payment link ID
   * @returns {Promise<Object>} Raw API response with instructions
   */
  async getInstructions(linkId) {
    if (!linkId) throw new Error('linkId is required');
    return this._fetch('POST', '/api/pay-link', { linkId });
  }

  /**
   * Verify a payment by transaction hash.
   *
   * @param {string} requestId - The payment link ID
   * @param {string} txHash - Main payment transaction hash
   * @param {string} [feeTxHash] - Platform fee transaction hash
   * @param {string} [creatorRewardTxHash] - Creator reward transaction hash
   * @returns {Promise<Object>} Verification result
   */
  async verifyPayment(requestId, txHash, feeTxHash, creatorRewardTxHash) {
    if (!requestId) throw new Error('requestId is required');
    if (!txHash) throw new Error('txHash is required');

    const body = { requestId, txHash };
    if (feeTxHash) body.feeTxHash = feeTxHash;
    if (creatorRewardTxHash) body.creatorRewardTxHash = creatorRewardTxHash;

    return this._fetch('POST', '/api/verify', body);
  }

  /**
   * Create a new payment link.
   *
   * @param {Object} params
   * @param {string} params.amount - Payment amount
   * @param {string} params.network - Chain: 'sepolia', 'ethereum', or 'base'
   * @param {string} [params.token='USDC'] - Token: 'USDC', 'USDT', 'ETH', 'LCX'
   * @param {string} [params.description] - Payment description
   * @returns {Promise<Object>} { success, linkId, link, network, token, amount }
   */
  async createLink({ amount, network, token, description } = {}) {
    if (!amount) throw new Error('amount is required');
    if (!network) throw new Error('network is required');

    const body = { amount, network };
    if (token) body.token = token;
    if (description) body.description = description;

    return this._fetch('POST', '/api/create-link', body);
  }

  /**
   * Fetch supported chains from the PayAgent API.
   *
   * @returns {Promise<Object>} { success, chains: [...] }
   */
  async getChains() {
    return this._fetch('GET', '/api/chains');
  }

  /**
   * Get the wallet address derived from the local private key.
   * Useful for verifying which address the SDK will sign with.
   *
   * @returns {string} The wallet address (0x...)
   */
  get address() {
    return this._wallet.address;
  }

  // ─── Private Helpers ──────────────────────────────────────────────

  /**
   * Compute HMAC-SHA256 signature for a request.
   *
   * String-to-sign format: timestamp\nMETHOD\npath\nSHA256(body)
   *
   * @private
   */
  _sign(method, path, body) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyStr = body ? JSON.stringify(body) : '';
    const bodyHash = crypto.createHash('sha256').update(bodyStr).digest('hex');
    const stringToSign = `${timestamp}\n${method}\n${path}\n${bodyHash}`;
    const signature = crypto.createHmac('sha256', this.apiSecret).update(stringToSign).digest('hex');

    return { timestamp, signature };
  }

  /**
   * Make an authenticated HTTP request to the PayAgent API.
   * Uses HMAC-SHA256 request signing — api_secret never leaves this process.
   * @private
   */
  async _fetch(method, path, body) {
    const url = `${this.baseUrl}${path}`;

    // Compute HMAC signature
    const { timestamp, signature } = this._sign(method.toUpperCase(), path, body);

    const headers = {
      'Content-Type': 'application/json',
      'x-api-key-id': this.apiKeyId,
      'x-timestamp': timestamp,
      'x-signature': signature,
      'User-Agent': `PayAgentSDK/0.2.0`,
    };

    const options = { method, headers };
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error(`PayAgent API returned non-JSON response (status ${res.status})`);
    }

    if (!res.ok && !data.success) {
      const err = new Error(data.error || `PayAgent API error (status ${res.status})`);
      err.status = res.status;
      err.response = data;
      throw err;
    }

    return data;
  }

  /**
   * Get an ethers JsonRpcProvider for the given network.
   * @private
   */
  _getProvider(network) {
    let rpcUrl;

    if (typeof this._rpcUrl === 'string') {
      rpcUrl = this._rpcUrl;
    } else if (this._rpcUrl && typeof this._rpcUrl === 'object') {
      rpcUrl = this._rpcUrl[network];
    }

    if (!rpcUrl) {
      rpcUrl = DEFAULT_RPC_URLS[network];
    }

    if (!rpcUrl) {
      throw new Error(
        `No RPC URL for network "${network}". Pass rpcUrl in constructor: ` +
        `new PayAgentClient({ ..., rpcUrl: { ${network}: 'https://...' } })`
      );
    }

    return new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * Check if a token is the native token (ETH) on the given network.
   * @private
   */
  _isNativeToken(tokenSymbol, network) {
    const chain = CHAINS[network];
    if (!chain) return tokenSymbol.toUpperCase() === 'ETH';
    return tokenSymbol.toUpperCase() === chain.nativeToken;
  }

  /**
   * Get token decimals.
   * @private
   */
  _getDecimals(tokenSymbol) {
    const symbol = (tokenSymbol || '').toUpperCase();
    return TOKEN_DECIMALS[symbol] || 18;
  }
}

module.exports = { PayAgentClient };
