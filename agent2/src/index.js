import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const PORT = parseInt(process.env.PORT || '3002', 10);
const rawServiceUrl = (process.env.AGENT_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '');
// Use 127.0.0.1 so Node fetch reaches agent-payment-service (localhost can fail with IPv6)
const AGENT_SERVICE_URL = rawServiceUrl.replace(/localhost/, '127.0.0.1');
const PAYMENT_LINK_BASE = (process.env.PAYMENT_LINK_BASE_URL || '').replace(/\/$/, '');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

/**
 * Agent 2 (Payee): Request a payment link.
 * Body: { amount (required), description?, requester? }
 * Calls PayMe agent payment service create-link with receiverAgentId: 2 (Agent 2 receives USDC).
 */
app.post('/request-payment', async (req, res) => {
  try {
    const { amount, description, requester } = req.body || {};
    const amountStr = amount != null && amount !== '' ? String(amount).trim() : null;
    if (!amountStr || isNaN(Number(amountStr))) {
      return res.status(400).json({ error: 'Missing or invalid amount' });
    }

    let createRes;
    try {
      createRes = await fetch(`${AGENT_SERVICE_URL}/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountStr,
          receiverAgentId: 2,
          description: description || (requester ? `Payment from ${requester}` : ''),
          expiresInDays: 7
        })
      });
    } catch (fetchErr) {
      throw new Error(
        `Cannot reach agent-payment-service at ${AGENT_SERVICE_URL}. Is it running? Start: cd agent-payment-service && npm run dev. (${fetchErr.message})`
      );
    }

    const data = await createRes.json();
    if (!createRes.ok) {
      return res.status(createRes.status).json(data);
    }

    const linkPath = data.link || `/r/${data.linkId}`;
    const paymentLink = PAYMENT_LINK_BASE ? `${PAYMENT_LINK_BASE}${linkPath}` : linkPath;

    return res.json({
      success: true,
      payment_link: paymentLink,
      link_id: data.linkId,
      link: data.link,
      amount: amountStr,
      receiver: 'Agent 2'
    });
  } catch (err) {
    console.error('Request payment error:', err);
    res.status(500).json({
      error: err.message || 'Failed to create payment link',
      hint: err.message?.includes('Cannot reach agent-payment-service')
        ? 'Start the agent-payment-service in another terminal (port 3001).'
        : undefined
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', agent: 'Agent 2 (Payee)', service_url: AGENT_SERVICE_URL });
});

const server = app.listen(PORT, () => {
  console.log(`Agent 2 (Payee) running on port ${PORT}`);
  console.log(`  Agent service: ${AGENT_SERVICE_URL}`);
  console.log(`  Keep this terminal open; then run Agent 1 in another terminal.`);
});

server.on('error', (err) => {
  // Only exit if we failed to bind (e.g. port in use); ignore errors after we're already listening
  if (!server.listening) {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the other process or set PORT in .env.`);
    } else {
      console.error('Server error:', err);
    }
    process.exit(1);
  } else {
    console.error('Server error (continuing):', err.message);
  }
});
