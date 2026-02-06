/**
 * OpenClaw PayMe plugin: registers payme_create_link and payme_pay_link tools.
 * Requires plugins.entries.payme.enabled and optionally plugins.entries.payme.config.baseUrl.
 */

const DEFAULT_BASE = "https://backend-two-chi-56.vercel.app/api";

function getBaseUrl(api) {
  const cfg = api.config?.plugins?.entries?.payme?.config;
  return (cfg?.baseUrl || process.env.PAYME_AGENT_SERVICE_URL || DEFAULT_BASE).replace(/\/$/, "");
}

async function post(api, path, body) {
  const base = getBaseUrl(api);
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { content: [{ type: "text", text: `PayMe API error ${res.status}: ${JSON.stringify(data)}` }] };
  }
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export default function register(api) {
  api.registerTool({
    name: "payme_create_link",
    description:
      "Create a PayMe payment link so Agent 1 or Agent 2 receives USDC on Sepolia. Returns linkId and link; share linkId with whoever should pay.",
    parameters: {
      type: "object",
      properties: {
        amount: { type: "string", description: "USDC amount, e.g. '5' or '0.5'" },
        receiverAgentId: { type: "number", description: "1 or 2 – which agent receives the USDC" },
        description: { type: "string", description: "Optional description for the payment" },
      },
      required: ["amount", "receiverAgentId"],
    },
    async execute(_id, params) {
      return post(api, "/create-link", {
        amount: String(params.amount),
        receiverAgentId: Number(params.receiverAgentId),
        ...(params.description != null && params.description !== "" && { description: String(params.description) }),
      });
    },
  });

  api.registerTool({
    name: "payme_pay_link",
    description:
      "Pay a PayMe link (send USDC from an agent wallet). Use the linkId from create-link. Returns txHash and explorerUrl, or alreadyPaid if already paid.",
    parameters: {
      type: "object",
      properties: {
        linkId: { type: "string", description: "The link ID (e.g. REQ-XXXXXXXXX)" },
        agentId: { type: "number", description: "1 or 2 – which agent pays (sends USDC)" },
      },
      required: ["linkId", "agentId"],
    },
    async execute(_id, params) {
      return post(api, "/pay-link", {
        linkId: String(params.linkId).trim(),
        agentId: Number(params.agentId),
      });
    },
  });
}
