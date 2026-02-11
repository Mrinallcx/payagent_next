/**
 * Intent Router
 *
 * Routes parsed AI actions to their corresponding backend functions.
 */
const { updateWalletAddress, getAgentById } = require('../agents');
const { calculateFee } = require('../feeCalculator');
const { getFeeConfig } = require('../feeConfig');

/**
 * Route an AI action to the appropriate handler
 *
 * @param {string} action - The action name
 * @param {object} params - Action parameters
 * @param {object} agent - The authenticated agent
 * @param {object} context - { supabase, memoryStore }
 * @returns {Promise<object>} Action result
 */
async function routeIntent(action, params, agent, context) {
  const { supabase, memoryStore } = context;

  switch (action) {
    case 'create_link':
      return handleCreateLink(params, agent, supabase, memoryStore);

    case 'check_status':
      return handleCheckStatus(params, supabase, memoryStore);

    case 'pay_link':
      return handlePayLink(params, agent, supabase, memoryStore);

    case 'register_wallet':
      return handleRegisterWallet(params, agent);

    case 'list_payments':
      return handleListPayments(agent, supabase, memoryStore);

    case 'clarify':
      return { message: params.message || 'How can I help you?' };

    default:
      return { message: `Unknown action: ${action}` };
  }
}

async function handleCreateLink(params, agent, supabase, memoryStore) {
  const amount = params.amount;
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    throw new Error('Invalid amount. Please specify a positive number.');
  }

  if (!agent.wallet_address) {
    throw new Error('You need to register a wallet address first. Send me your wallet address (0x...).');
  }

  const id = 'REQ-' + Math.random().toString(36).substr(2, 9).toUpperCase();
  const request = {
    id,
    token: 'USDC',
    amount: String(amount),
    receiver: agent.wallet_address,
    payer: null,
    description: params.description || '',
    network: 'sepolia',
    status: 'PENDING',
    expires_at: null,
    tx_hash: null,
    paid_at: null,
    creator_wallet: agent.wallet_address,
    creator_agent_id: agent.id
  };

  if (supabase) {
    const { data, error } = await supabase.from('payment_requests').insert(request).select().single();
    if (error) throw error;
    return { linkId: data.id, link: `/r/${data.id}`, amount, token: 'USDC' };
  }

  memoryStore.requests[id] = { ...request, createdAt: Date.now() };
  return { linkId: id, link: `/r/${id}`, amount, token: 'USDC' };
}

async function handleCheckStatus(params, supabase, memoryStore) {
  const linkId = params.linkId;
  if (!linkId) {
    throw new Error('Please provide a link ID (e.g., REQ-XXXXXXX).');
  }

  if (supabase) {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('id, status, amount, token, receiver, tx_hash, created_at, paid_at')
      .eq('id', linkId)
      .single();
    if (error) throw new Error('Payment link not found');
    return data;
  }

  const req = memoryStore.requests[linkId];
  if (!req) throw new Error('Payment link not found');
  return {
    id: req.id,
    status: req.status,
    amount: req.amount,
    token: req.token,
    receiver: req.receiver,
    tx_hash: req.tx_hash
  };
}

async function handlePayLink(params, agent, supabase, memoryStore) {
  const linkId = params.linkId;
  if (!linkId) {
    throw new Error('Please provide a link ID (e.g., REQ-XXXXXXX).');
  }

  if (!agent.wallet_address) {
    throw new Error('You need to register a wallet address first.');
  }

  let request;
  if (supabase) {
    const { data, error } = await supabase.from('payment_requests').select('*').eq('id', linkId).single();
    if (error) throw new Error('Payment link not found');
    request = data;
  } else {
    request = memoryStore.requests[linkId];
    if (!request) throw new Error('Payment link not found');
  }

  if (request.status === 'PAID') {
    return { alreadyPaid: true, message: 'This link is already paid.' };
  }

  // Calculate fee
  const feeInfo = await calculateFee(agent.wallet_address);
  const feeConfig = await getFeeConfig();

  return {
    linkId,
    amount: request.amount,
    token: request.token,
    receiver: request.receiver,
    fee: feeInfo,
    treasuryWallet: feeConfig.treasury_wallet,
    message: `To pay this link, submit ${request.amount} USDC to ${request.receiver} plus the fee. Then call POST /api/verify with the txHash.`
  };
}

async function handleRegisterWallet(params, agent) {
  const wallet = params.wallet;
  if (!wallet || !/^0x[a-fA-F0-9]{40}$/.test(wallet)) {
    throw new Error('Invalid wallet address. Must be 0x followed by 40 hex characters.');
  }

  await updateWalletAddress(agent.id, wallet, agent.chain || 'sepolia');
  return { wallet_address: wallet, message: 'Wallet registered successfully.' };
}

async function handleListPayments(agent, supabase, memoryStore) {
  if (supabase) {
    const { data, error } = await supabase
      .from('payment_requests')
      .select('id, status, amount, token, receiver, created_at')
      .or(`creator_agent_id.eq.${agent.id},payer_agent_id.eq.${agent.id}`)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error) throw error;
    return { payments: data || [], count: (data || []).length };
  }

  const payments = Object.values(memoryStore.requests)
    .filter(r => r.creator_agent_id === agent.id || r.payer_agent_id === agent.id)
    .slice(0, 20);
  return { payments, count: payments.length };
}

module.exports = { routeIntent };
