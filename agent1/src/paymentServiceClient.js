/**
 * Agent 1 (Payer) – client for PayMe agent payment service (pay-link).
 */

const raw = (process.env.AGENT_SERVICE_URL || 'http://localhost:3001').replace(/\/$/, '');
const AGENT_SERVICE_URL = raw.replace(/localhost/, '127.0.0.1');

export async function payLink(linkId, agentId = 1) {
  const res = await fetch(`${AGENT_SERVICE_URL}/pay-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ linkId, agentId })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to pay link');
  return data;
}

export async function health() {
  const res = await fetch(`${AGENT_SERVICE_URL}/health`);
  return res.json();
}
