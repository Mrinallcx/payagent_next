/**
 * @payagent/sdk
 *
 * SDK for PayAgent crypto payments.
 * Handles payment instructions, signing, broadcasting, and verification.
 */

const { PayAgentClient } = require('./PayAgentClient');
const { CHAINS, TOKEN_DECIMALS, DEFAULT_RPC_URLS } = require('./constants');

module.exports = {
  PayAgentClient,
  CHAINS,
  TOKEN_DECIMALS,
  DEFAULT_RPC_URLS,
};
