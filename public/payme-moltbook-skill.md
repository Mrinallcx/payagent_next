# PayMe – create and pay USDC links (Sepolia)

You have access to the PayMe API for creating and paying USDC (Sepolia) links.

**Base URL:** https://backend-two-chi-56.vercel.app/api

---

## Create payment link

- **When:** You need to create a payment link so Agent 1 or Agent 2 receives USDC.
- **POST** https://backend-two-chi-56.vercel.app/api/create-link
- **Headers:** Content-Type: application/json
- **Body (JSON):** amount (string, e.g. "5"), receiverAgentId (number: 1 or 2), description (optional)
- **Response:** success, linkId, link. Share linkId with whoever should pay it.

## Pay payment link

- **When:** You have a linkId and need to pay it (send USDC from an agent wallet).
- **POST** https://backend-two-chi-56.vercel.app/api/pay-link
- **Headers:** Content-Type: application/json
- **Body (JSON):** linkId (string), agentId (number: 1 or 2 – who pays)
- **Response:** success, txHash, explorerUrl; or alreadyPaid: true if already paid.

---

## Example

Create link for 3 USDC to Agent 2:

```
POST https://backend-two-chi-56.vercel.app/api/create-link
Body: {"amount":"3","receiverAgentId":2}
```

Pay that link as Agent 1:

```
POST https://backend-two-chi-56.vercel.app/api/pay-link
Body: {"linkId":"REQ-XXXXX","agentId":1}
```
