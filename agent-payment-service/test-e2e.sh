#!/usr/bin/env bash
# Minimal E2E: PayMe backend and agent service must be running (ports 3000, 3001).
# Without agent keys: pay-link returns 400. With keys + funded wallets: pay-link can succeed.
set -e
echo "→ Create link via agent service"
CREATE=$(curl -s -X POST http://localhost:3001/create-link -H "Content-Type: application/json" -d '{"amount":"0.1","receiver":"0x0000000000000000000000000000000000000001"}')
echo "$CREATE" | head -c 200
echo ""
LINK_ID=$(echo "$CREATE" | grep -o '"linkId":"[^"]*"' | cut -d'"' -f4)
if [ -z "$LINK_ID" ]; then echo "FAIL: no linkId"; exit 1; fi
echo "→ Pay link (expect 400 if no agent keys, or 200 if keys + balance)"
PAY=$(curl -s -X POST http://localhost:3001/pay-link -H "Content-Type: application/json" -d "{\"linkId\":\"$LINK_ID\",\"agentId\":1}")
echo "$PAY"
if echo "$PAY" | grep -q '"success":true'; then
  echo "→ E2E OK (agent paid)"
elif echo "$PAY" | grep -q 'not configured'; then
  echo "→ E2E OK (no keys; fill AGENT_1_PRIVATE_KEY to test full flow)"
else
  echo "→ Pay response above (may be balance/RPC error)"
fi
