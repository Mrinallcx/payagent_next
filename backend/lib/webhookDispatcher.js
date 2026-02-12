const crypto = require('crypto');
const { getWebhooksForEvent, markWebhookSuccess, markWebhookFailure } = require('./webhooks');

// Retry delays in ms
const RETRY_DELAYS = [30000, 300000, 1800000]; // 30s, 5min, 30min

/**
 * Dispatch a webhook event to all subscribed agents
 *
 * @param {string} eventType - e.g. 'payment.paid', 'payment.created'
 * @param {object} paymentData - The payment/event data
 */
async function dispatchEvent(eventType, paymentData) {
  try {
    // Collect agent IDs involved
    const agentIds = new Set();
    if (paymentData.creatorAgentId) agentIds.add(paymentData.creatorAgentId);
    if (paymentData.payerAgentId) agentIds.add(paymentData.payerAgentId);

    if (agentIds.size === 0) return;

    // Find all active webhooks subscribed to this event
    const webhooks = await getWebhooksForEvent([...agentIds], eventType);

    if (webhooks.length === 0) return;

    // Build payload
    const payload = {
      event: eventType,
      payment: {
        id: paymentData.id,
        amount: paymentData.amount,
        token: paymentData.token,
        status: paymentData.status,
        receiver: paymentData.receiver,
        txHash: paymentData.txHash || null,
        creatorAgentId: paymentData.creatorAgentId || null,
        payerAgentId: paymentData.payerAgentId || null,
        network: paymentData.network,
        paidAt: paymentData.paidAt || null
      },
      timestamp: new Date().toISOString()
    };

    // If there's fee info, include it
    if (paymentData.fee) {
      payload.fee = paymentData.fee;
    }

    // Dispatch to each webhook (non-blocking)
    for (const webhook of webhooks) {
      deliverWebhook(webhook, payload, 0).catch(err => {
        console.error(`Webhook delivery failed for ${webhook.id}:`, err.message);
      });
    }
  } catch (error) {
    console.error('Webhook dispatch error:', error);
  }
}

/**
 * Deliver a webhook payload to a single endpoint
 */
async function deliverWebhook(webhook, payload, attempt) {
  const timestamp = String(Date.now());

  // Generate HMAC signature
  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', webhook.secret)
    .update(payloadStr)
    .digest('hex');

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PayAgent-Event': payload.event,
        'X-PayAgent-Timestamp': timestamp,
        'X-PayAgent-Signature': `sha256=${signature}`,
        'User-Agent': 'PayAgent-Webhook/1.0'
      },
      body: payloadStr,
      signal: AbortSignal.timeout(15000) // 15s timeout
    });

    if (response.ok || (response.status >= 200 && response.status < 300)) {
      await markWebhookSuccess(webhook.id);
      return;
    }

    throw new Error(`HTTP ${response.status}`);
  } catch (error) {
    console.error(`Webhook ${webhook.id} delivery attempt ${attempt + 1} failed:`, error.message);
    await markWebhookFailure(webhook.id);

    // Retry if attempts remain
    if (attempt < RETRY_DELAYS.length) {
      const delay = RETRY_DELAYS[attempt];
      console.log(`Retrying webhook ${webhook.id} in ${delay / 1000}s (attempt ${attempt + 2})`);
      setTimeout(() => {
        deliverWebhook(webhook, payload, attempt + 1).catch(() => {});
      }, delay);
    }
  }
}

module.exports = { dispatchEvent };
