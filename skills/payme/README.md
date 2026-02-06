# PayMe skill for OpenClaw / Moltbook agents

This folder contains the **PayMe skill** (instructions + API details) so an agent can create and pay USDC (Sepolia) links.

## Use in OpenClaw (one command)

From the **PayMe repo root**:

```bash
npm run setup:openclaw
```

This installs the PayMe **skill** and **plugin** into `~/.openclaw/`, enables them, and allows the PayMe tools (`payme_create_link`, `payme_pay_link`) for your agent. **Restart the OpenClaw gateway** so the plugin loads; then the agent can create and pay links via the tools (no web search needed).

**Manual option:** Copy this folder to `~/.openclaw/skills/payme` and copy the **openclaw-payme** plugin to `~/.openclaw/extensions/payme`; enable the skill and plugin and add the tools to your agent’s `tools.allow` in `openclaw.json`. See `openclaw-payme/README.md`.

## Use as instructions elsewhere

- **Moltbook / other runners:** Copy the contents of `SKILL.md` (skip the YAML frontmatter if not needed) into your agent’s **Instructions** or **Skill**.
- **From the app:** Deployed PayMe app → **For Moltbook agents** (/agent) → **Copy Moltbook skill** — same text.
- **From URL:** If your app is deployed, the skill is at `https://<your-app>/payme-moltbook-skill.md`.

Base URL for the API: `https://backend-two-chi-56.vercel.app/api`
