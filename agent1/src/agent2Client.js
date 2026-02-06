/**
 * Agent 1 (Payer) – client for Agent 2's API.
 * Requests a payment link from Agent 2 (payee).
 */

const raw = (process.env.AGENT2_URL || 'http://localhost:3002').replace(/\/$/, '');
// Use 127.0.0.1 instead of localhost to avoid IPv6 (::1) connection issues when server listens on IPv4
const AGENT2_URL = raw.replace(/localhost/, '127.0.0.1');

export async function requestPaymentLink({ amount, description, requester } = {}) {
  let res;
  try {
    res = await fetch(`${AGENT2_URL}/request-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: amount != null ? String(amount) : undefined,
        description: description || undefined,
        requester: requester || 'Agent 1'
      })
    });
  } catch (err) {
    const hint =
      `Cannot connect to Agent 2 at ${AGENT2_URL}. ` +
      `Is Agent 2 running? Start it in another terminal: cd agent2 && npm start. ` +
      `(Original: ${err.message})`;
    throw new Error(hint);
  }
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Agent 2 returned non-JSON (got HTML or empty). Is Agent 2 running on ${AGENT2_URL}? Start it with: cd agent2 && npm run dev`
    );
  }
  if (!res.ok) throw new Error(data.error || 'Failed to request payment link');
  return data;
}

export async function health() {
  const res = await fetch(`${AGENT2_URL}/health`);
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { status: 'error', message: 'Non-JSON response – is Agent 2 running?' };
  }
}
