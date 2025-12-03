function create402Response(request) {
  return {
    statusCode: 402,
    headers: {
      'X-Payment-Scheme': 'x402',
      'X-Payment-Amount': request.amount,
      'X-Payment-Token': request.token,
      'X-Payment-Network': request.network,
      'X-Payment-Receiver': request.receiver,
      'Content-Type': 'application/json'
    },
    body: {
      error: 'Payment Required',
      code: 402,
      payment: {
        id: request.id,
        amount: request.amount,
        token: request.token,
        network: request.network,
        receiver: request.receiver,
        description: request.description,
        expiresAt: request.expiresAt || request.expires_at,
        createdAt: request.createdAt || request.created_at,
        instructions: `Send ${request.amount} ${request.token} on ${request.network} to ${request.receiver}`
      }
    }
  };
}

function validatePaymentProof(request, txHash, txData) {
  // Basic validation - in production, verify on-chain
  if (!txHash || !txData) return false;

  // Check if amount, token, receiver match
  const amountMatches = txData.amount === request.amount;
  const tokenMatches = txData.token === request.token;
  const receiverMatches = txData.to.toLowerCase() === request.receiver.toLowerCase();

  return amountMatches && tokenMatches && receiverMatches;
}

module.exports = {
  create402Response,
  validatePaymentProof
};