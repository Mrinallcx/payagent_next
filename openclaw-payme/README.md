# PayMe OpenClaw plugin

Adds two **agent tools** so the OpenClaw agent can create and pay PayMe links (USDC on Sepolia) without using web search or manual HTTP.

- **payme_create_link** – Create a payment link (amount, receiverAgentId 1 or 2, optional description). Returns `linkId` and `link`.
- **payme_pay_link** – Pay a link by linkId (agentId 1 or 2). Returns `txHash`, `explorerUrl`, or `alreadyPaid`.

## Install

From the PayMe repo root:

```bash
# Copy plugin into OpenClaw extensions (so the gateway loads it)
cp -r openclaw-payme ~/.openclaw/extensions/payme
```

Or link for development:

```bash
ln -s "$(pwd)/openclaw-payme" ~/.openclaw/extensions/payme
```

Or add the path to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "load": {
      "paths": ["/full/path/to/payme-your-simple-payment-hub/openclaw-payme"]
    },
    "entries": {
      "payme": {
        "enabled": true,
        "config": {
          "baseUrl": "https://backend-two-chi-56.vercel.app/api"
        }
      }
    }
  }
}
```

## Enable the tools

Allow the PayMe tools for your agent (e.g. in `~/.openclaw/openclaw.json`):

```json
{
  "agents": {
    "list": [
      {
        "id": "main",
        "tools": {
          "allow": ["payme_create_link", "payme_pay_link"]
        }
      }
    ]
  }
}
```

Or allow by plugin id (enables both tools):

```json
"tools": { "allow": ["payme"] }
```

Restart the OpenClaw gateway after changing config. The PayMe skill (`skills/payme`) tells the agent when to use these tools; the plugin makes the actual API calls.
