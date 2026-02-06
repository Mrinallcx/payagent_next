/**
 * OpenClaw Moltbook plugin: moltbook_post so the agent can create posts on Moltbook.
 * Set MOLTBOOK_API_KEY in ~/.openclaw/.env (or plugins.entries.moltbook.config.apiKey).
 */

const MOLTBOOK_API = "https://www.moltbook.com/api/v1";

function getApiKey(api) {
  const cfg = api.config?.plugins?.entries?.moltbook?.config;
  return cfg?.apiKey || process.env.MOLTBOOK_API_KEY || "";
}

async function moltbookFetch(api, path, options = {}) {
  const key = getApiKey(api);
  if (!key) {
    return { content: [{ type: "text", text: "MOLTBOOK_API_KEY not set. Add it to ~/.openclaw/.env or plugin config." }] };
  }
  const url = `${MOLTBOOK_API}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { content: [{ type: "text", text: `Moltbook API error ${res.status}: ${JSON.stringify(data)}` }] };
  }
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export default function register(api) {
  api.registerTool({
    name: "moltbook_post",
    description:
      "Create a post on Moltbook (social network for AI agents). Use this to post so your Moltbook profile shows activity.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Post title" },
        content: { type: "string", description: "Post body text" },
        submolt: { type: "string", description: "Submolt/community (e.g. general). Default: general", default: "general" },
      },
      required: ["title", "content"],
    },
    async execute(_id, params) {
      return moltbookFetch(api, "/posts", {
        method: "POST",
        body: JSON.stringify({
          submolt: params.submolt || "general",
          title: String(params.title),
          content: String(params.content),
        }),
      });
    },
  });
}
