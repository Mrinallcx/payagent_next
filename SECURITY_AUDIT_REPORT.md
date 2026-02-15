# PayAgent Security Audit Report

**Scope:** Full codebase (backend, frontend, SDK)
**Date:** 2026-02-15
**Branch:** `claude/elastic-satoshi`
**Files Analyzed:** 50+ across `backend/`, `src/`, `sdk/`

---

## Table of Contents

- [Executive Summary](#executive-summary)
- [Severity Classification](#severity-classification)
- [Critical Severity](#critical-severity-fix-immediately)
  - [C1. Private Key Accepted Over HTTP](#c1-private-key-accepted-over-http-in-deprecated-endpoint)
  - [C2. CORS Allows All Origins](#c2-cors-allows-all-origins)
  - [C3. SSRF via X (Twitter) Verification](#c3-ssrf-via-x-twitter-verification)
  - [C4. No Payment Replay Protection](#c4-no-payment-replay-protection-on-apiverify)
- [High Severity](#high-severity)
  - [H1. Webhook URL Not Validated (SSRF)](#h1-webhook-url-not-validated-ssrf)
  - [H2. Fuzzy Network Matching](#h2-fuzzy-network-matching-allows-bypass)
  - [H3. Rate Limiting Ineffective Behind Proxy](#h3-rate-limiting-ineffective-behind-proxy)
  - [H4. Hardcoded Fallback Prices](#h4-fee-calculation-uses-hardcoded-fallback-prices)
  - [H5. Webhook Secrets Stored in Plaintext](#h5-webhook-secrets-stored-in-plaintext)
  - [H6. No Request Body Size Limits](#h6-no-request-body-size-limits)
  - [H7. Missing Security Headers](#h7-missing-security-headers)
- [Medium Severity](#medium-severity)
  - [M1. Agent Enumeration](#m1-public-endpoints-allow-agent-enumeration)
  - [M2. Wallet Address in Query String](#m2-payer-wallet-address-in-url-query-string)
  - [M3. Non-Atomic Fee Transactions](#m3-fee-transaction-not-atomic-with-payment-update)
  - [M4. Math.random() for Fee IDs](#m4-fee-transaction-ids-use-mathrandom)
  - [M5. Silent Auth Error Swallowing](#m5-optional-auth-silently-swallows-errors)
  - [M6. IP Anomaly Detection Overly Aggressive](#m6-ip-anomaly-detection-overly-aggressive)
  - [M7. Supabase Anon Key Usage](#m7-supabase-anon-key-used-for-backend-operations)
  - [M8. In-Memory Fallback Unbounded](#m8-in-memory-fallback-store-has-no-persistence)
  - [M9. Cookie Missing Security Attributes](#m9-cookie-missing-security-attributes)
  - [M10. TypeScript Strict Mode Disabled](#m10-typescript-strict-mode-disabled)
- [Low Severity](#low-severity)
- [What's Done Well](#whats-done-well)
- [Priority Remediation Order](#priority-remediation-order)
- [Summary Table](#summary-table)

---

## Executive Summary

PayAgent is a non-custodial crypto payment hub with solid foundational security (AES-256-GCM encryption, HMAC-SHA256 signing, constant-time comparisons, in-memory JWT storage). However, the audit uncovered **4 critical**, **7 high**, and **10 medium** severity vulnerabilities that should be addressed before production deployment.

---

## Severity Classification

| Severity | Count | Description |
|----------|-------|-------------|
| **Critical** | 4 | Immediate risk of fund loss, data breach, or full system compromise |
| **High** | 7 | Significant risk if exploited; should be fixed before production |
| **Medium** | 10 | Moderate risk; should be fixed in the next release cycle |
| **Low** | 8 | Minor issues; fix as part of ongoing maintenance |

---

## Critical Severity (Fix Immediately)

### C1. Private Key Accepted Over HTTP in Deprecated Endpoint

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:874-898` |
| **Endpoint** | `POST /api/execute-payment` |
| **CVSS Estimate** | 9.1 |

**Description:**

Even though marked DEPRECATED, this endpoint is live and reachable. It accepts a user's private key in the request body, transmits it over the wire, and uses it to instantiate an `ethers.Wallet` on the server to sign transactions.

```javascript
app.post('/api/execute-payment', authMiddleware, async (req, res) => {
  const { linkId, privateKey } = req.body;
  // ...
  const tempWallet = new ethers.Wallet(privateKey);
```

**Impact:**
- If request logging, error handlers, or any middleware serializes `req.body`, the private key is leaked to logs/database
- The server has full custody of funds during execution
- Any MITM (if TLS is misconfigured) gains complete wallet control

**Recommendation:**

Remove this endpoint entirely. The SDK already handles client-side signing.

```javascript
// DELETE THE ENTIRE ENDPOINT or replace with:
app.post('/api/execute-payment', (req, res) => {
  return res.status(410).json({
    error: 'This endpoint has been permanently removed.',
    message: 'Use the @payagent/sdk for client-side transaction signing.'
  });
});
```

---

### C2. CORS Allows All Origins

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:9`, `backend/vercel.json` |
| **CVSS Estimate** | 8.2 |

**Description:**

```javascript
app.use(cors({ origin: '*' }));
```

Combined with the `optionalAuthMiddleware` on payment creation (`POST /api/create`), any website can create payment requests on behalf of visiting users. The open CORS also means any site can probe public endpoints for agent enumeration.

**Impact:**
- Any malicious website can make authenticated API calls using a visitor's cookies/tokens
- Payment requests can be created from phishing sites
- Agent information can be enumerated from any origin

**Recommendation:**

Restrict to known frontend domain(s):

```javascript
const ALLOWED_ORIGINS = [
  'https://payagent.dev',
  'https://app.payagent.dev',
  process.env.NODE_ENV === 'development' && 'http://localhost:3000'
].filter(Boolean);

app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
```

For the public SDK API, consider separate CORS policies per route group.

---

### C3. SSRF via X (Twitter) Verification

| Field | Value |
|-------|-------|
| **File** | `backend/lib/xVerification.js:51-58` |
| **CVSS Estimate** | 8.6 |

**Description:**

```javascript
const response = await fetch(tweetUrl, {
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PayAgentBot/1.0; ...)' },
  redirect: 'follow',
  signal: AbortSignal.timeout(10000)
});
```

The `tweetUrl` passes a basic regex check (`isValidTweetUrl`) but the `redirect: 'follow'` flag means an attacker could craft a URL like `https://x.com/attacker/status/123` that 302-redirects to an internal service. On AWS, this could reach the instance metadata endpoint (`http://169.254.169.254/latest/meta-data/`), leaking IAM credentials.

Additionally at line 74, the Nitter fallback constructs a URL via string replacement with no further validation.

**Impact:**
- Access to internal services (localhost, private IPs)
- Cloud metadata credential theft (AWS IAM, GCP service accounts)
- Port scanning of internal network

**Recommendation:**

Validate resolved IPs against private ranges before fetching:

```javascript
const dns = require('dns').promises;
const url = require('url');

async function isSafeUrl(targetUrl) {
  const parsed = new URL(targetUrl);
  const { address } = await dns.lookup(parsed.hostname);
  const blocked = [
    /^127\./, /^10\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./,
    /^169\.254\./, /^0\./, /^::1$/, /^fc00:/
  ];
  return !blocked.some(re => re.test(address));
}
```

---

### C4. No Payment Replay Protection on `/api/verify`

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:1057-1196` |
| **CVSS Estimate** | 8.1 |

**Description:**

The verify endpoint uses `optionalAuthMiddleware` (auth not required) and checks `if (request.status === 'PAID')` to prevent double-payment. However, there is a **race condition**: two concurrent verify requests for the same `requestId` with the same `txHash` can both pass the status check before either updates the DB, resulting in:

- Double webhook dispatch
- Double fee recording
- Corrupted agent counter increments

There is also no check preventing a txHash used for one payment request from being submitted against a different payment request (cross-request replay).

**Impact:**
- Financial data corruption
- Double-charging of fees
- A single on-chain transaction can "pay" multiple payment requests

**Recommendation:**

1. Add a unique constraint on `tx_hash` in the `payment_requests` table:
```sql
ALTER TABLE payment_requests ADD CONSTRAINT unique_tx_hash UNIQUE (tx_hash);
```

2. Use optimistic locking or `SELECT ... FOR UPDATE`:
```javascript
const { data, error } = await supabase
  .from('payment_requests')
  .update({ status: 'PAID', tx_hash: txHash })
  .eq('id', requestId)
  .eq('status', 'PENDING')  // Only update if still PENDING
  .select()
  .single();

if (!data) {
  return res.status(409).json({ error: 'Payment already processed or not found' });
}
```

3. Implement idempotency keys for the verify endpoint.

---

## High Severity

### H1. Webhook URL Not Validated (SSRF)

| Field | Value |
|-------|-------|
| **File** | `backend/lib/webhooks.js:10-36` |
| **CVSS Estimate** | 7.5 |

**Description:**

`registerWebhook()` accepts any URL with zero validation. An attacker can register `http://localhost:3000/api/agents/deactivate` or cloud metadata URLs as webhook targets. When payment events fire, the server makes POST requests to attacker-controlled internal endpoints.

```javascript
async function registerWebhook(agentId, url, events) {
  const id = 'wh_' + crypto.randomBytes(12).toString('hex');
  const secret = 'whsec_' + crypto.randomBytes(32).toString('hex');
  const webhook = { id, agent_id: agentId, url, secret, /* ... */ };
  // No URL validation
```

**Recommendation:**

```javascript
function isValidWebhookUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) return false;
    // Block private IPs via DNS resolution before saving
    return true;
  } catch { return false; }
}
```

---

### H2. Fuzzy Network Matching Allows Bypass

| Field | Value |
|-------|-------|
| **File** | `backend/lib/chainRegistry.js` (resolveNetwork function) |
| **CVSS Estimate** | 7.3 |

**Description:**

```javascript
function resolveNetwork(network) {
  const key = network.toLowerCase().trim();
  if (NETWORK_ALIASES[key]) return NETWORK_ALIASES[key];
  // FUZZY MATCHING:
  if (key.includes('sepolia')) return 'sepolia';
  if (key.includes('base'))    return 'base';
```

Input like `"not-sepolia-mainnet"` resolves to `sepolia`. An attacker could manipulate which network a payment is processed on by crafting ambiguous network strings, potentially causing funds to be sent on the wrong chain.

**Recommendation:**

Use strict exact-match only with a predefined alias map. Remove all fuzzy matching.

```javascript
function resolveNetwork(network) {
  if (!network) return null;
  const key = network.toLowerCase().trim();
  return NETWORK_ALIASES[key] || null;  // Exact match only
}
```

---

### H3. Rate Limiting Ineffective Behind Proxy

| Field | Value |
|-------|-------|
| **File** | `backend/middleware/rateLimit.js` |
| **CVSS Estimate** | 7.0 |

**Description:**

```javascript
validate: { xForwardedForHeader: false }
```

In production (Vercel), all traffic comes through a reverse proxy. With X-Forwarded-For validation disabled, the rate limiter sees all requests as coming from the proxy's IP, making the 100 req/min and 30 req/min limits apply **globally** instead of per-user.

**Recommendation:**

```javascript
// For Vercel deployment:
app.set('trust proxy', 1);

// In rate limiter config:
validate: { xForwardedForHeader: true }
```

---

### H4. Fee Calculation Uses Hardcoded Fallback Prices

| Field | Value |
|-------|-------|
| **File** | `backend/lib/feeCalculator.js:66-67, 79-80` |
| **CVSS Estimate** | 6.8 |

**Description:**

```javascript
lcxPriceUsd = 0.15; // Fallback price
ethPriceUsd = 2500; // Conservative fallback
```

If CoinGecko is down, fees are calculated at potentially stale prices. If LCX price spikes to $1 while fallback is $0.15, the platform collects 6.7x less in fees. Conversely, if LCX crashes to $0.01, users overpay 15x.

**Recommendation:**

- Reject payments when price feed is unavailable
- Or use multiple price sources (CoinGecko + CoinMarketCap + on-chain oracle)
- Add staleness checks (reject prices older than 5 minutes)

```javascript
const MAX_PRICE_STALENESS_MS = 5 * 60 * 1000;
if (Date.now() - lastPriceFetchTime > MAX_PRICE_STALENESS_MS) {
  throw new Error('Price data is stale. Cannot calculate fees safely.');
}
```

---

### H5. Webhook Secrets Stored in Plaintext

| Field | Value |
|-------|-------|
| **File** | `backend/lib/webhooks.js:12` |
| **CVSS Estimate** | 6.5 |

**Description:**

```javascript
const secret = 'whsec_' + crypto.randomBytes(32).toString('hex');
```

The column is named `webhook_secret_hash` (suggesting it should be hashed) but stores the raw secret. If the database is compromised, an attacker can forge webhook signatures for all registered webhooks.

**Recommendation:**

Store `SHA256(secret)` in the database. Return the raw secret only once during registration. For signature computation during dispatch, hash the stored value:

```javascript
// On registration:
const rawSecret = 'whsec_' + crypto.randomBytes(32).toString('hex');
const secretHash = crypto.createHash('sha256').update(rawSecret).digest('hex');
// Store secretHash in DB, return rawSecret to user only once

// On dispatch:
const signature = crypto.createHmac('sha256', storedSecretHash).update(payload).digest('hex');
```

---

### H6. No Request Body Size Limits

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:12-16` |
| **CVSS Estimate** | 6.2 |

**Description:**

```javascript
app.use(express.json({
  verify: (req, res, buf) => {
    req._rawBody = buf.toString('utf8');
  }
}));
```

No `limit` parameter is set on `express.json()`. While Express defaults to `100kb`, the raw body capture (`req._rawBody = buf.toString('utf8')`) doubles memory usage per request. Combined with the open CORS and rate limiter issues, this is exploitable for memory exhaustion.

**Recommendation:**

```javascript
app.use(express.json({
  limit: '50kb',
  verify: (req, res, buf) => {
    req._rawBody = buf.toString('utf8');
  }
}));
```

---

### H7. Missing Security Headers

| Field | Value |
|-------|-------|
| **Files** | `backend/api/index.js`, `backend/vercel.json` |
| **CVSS Estimate** | 5.8 |

**Description:**

No security headers are set anywhere:

- No `Strict-Transport-Security` (HSTS)
- No `X-Content-Type-Options: nosniff`
- No `X-Frame-Options: DENY`
- No `Content-Security-Policy`
- No `X-XSS-Protection`
- No `Referrer-Policy`

**Recommendation:**

```javascript
const helmet = require('helmet');
app.use(helmet());

// Or manually:
app.use((req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

---

## Medium Severity

### M1. Public Endpoints Allow Agent Enumeration

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js` - `GET /api/agents/by-wallet` |
| **CVSS Estimate** | 5.3 |

Anyone can query `?wallet=0x...` to discover whether a wallet has a registered agent, plus their username, status, and payment counts. No authentication or rate limiting beyond the global 100/min.

**Recommendation:** Require authentication or return minimal info (`{ exists: true/false }`).

---

### M2. Payer Wallet Address in URL Query String

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:261` - `GET /api/request/:id/fee` |
| **CVSS Estimate** | 4.8 |

```
GET /api/request/:id/fee?payer=0xAbC123...
```

Wallet addresses in query parameters appear in browser history, proxy logs, CDN logs, and `Referer` headers.

**Recommendation:** Switch to POST body for payer wallet parameter.

---

### M3. Fee Transaction Not Atomic with Payment Update

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:979-1000` |
| **CVSS Estimate** | 4.7 |

Payment is marked `PAID`, then fee is recorded separately. If fee insertion fails, the payment stays PAID but fee data is lost.

```javascript
// Payment marked PAID here...
await supabase.from('payment_requests').update({ status: 'PAID' /*...*/ });

// Fee recorded separately (can fail independently)
try {
  await supabase.from('fee_transactions').insert({/*...*/});
} catch (feeErr) {
  console.error('Fee recording error (non-fatal):', feeErr);
}
```

**Recommendation:** Use a database transaction or implement a compensating action (rollback payment status on fee error).

---

### M4. Fee Transaction IDs Use `Math.random()`

| Field | Value |
|-------|-------|
| **File** | `backend/api/index.js:984` |
| **CVSS Estimate** | 4.5 |

```javascript
id: 'FEE-' + Math.random().toString(36).substr(2, 9).toUpperCase()
```

`Math.random()` is not cryptographically secure and can produce collisions. For financial records, this is unacceptable.

**Recommendation:**

```javascript
const crypto = require('crypto');
id: 'FEE-' + crypto.randomUUID()
```

---

### M5. Optional Auth Silently Swallows Errors

| Field | Value |
|-------|-------|
| **File** | `backend/middleware/auth.js:273, 295, 302` |
| **CVSS Estimate** | 4.3 |

```javascript
} catch (e) { /* silently skip if decrypt fails */ }
```

Three separate catch blocks silently swallow authentication errors. A legitimate user with a corrupted token sees no error and proceeds unauthenticated, potentially losing access to their own payment data in the response.

**Recommendation:** Log the error type (without leaking secrets) and consider returning a warning header:

```javascript
} catch (e) {
  console.warn('Optional auth failed:', e.message);
  res.setHeader('X-Auth-Warning', 'Authentication was provided but invalid');
}
```

---

### M6. IP Anomaly Detection Overly Aggressive

| Field | Value |
|-------|-------|
| **File** | `backend/lib/ipMonitor.js` |
| **CVSS Estimate** | 4.2 |

5 unique IPs in 24h triggers a warning; 10 events auto-suspends the account. Global users, VPN users, and mobile users regularly exceed this. Auto-suspension with no notification or appeal mechanism creates a denial-of-service vector: an attacker who knows a victim's API key could rotate through proxies to trigger suspension.

**Recommendation:** Increase thresholds, add whitelist capability, require manual review before suspension, and notify agents via webhook/email before suspension.

---

### M7. Supabase Anon Key Used for Backend Operations

| Field | Value |
|-------|-------|
| **File** | `backend/lib/supabase.js` |
| **CVSS Estimate** | 4.0 |

The backend uses `SUPABASE_ANON_KEY` which has limited permissions. However, if RLS (Row Level Security) is not properly configured, the anon key could allow broader access than intended. No RLS policies were found in `schema.sql`.

**Recommendation:** Use the `service_role` key for backend operations (with proper server-side restrictions), or implement comprehensive RLS policies.

---

### M8. In-Memory Fallback Store Has No Persistence

| Field | Value |
|-------|-------|
| **File** | `backend/lib/store.js` |
| **CVSS Estimate** | 3.8 |

When Supabase is unavailable, all data falls back to in-memory storage. This means:

- Payments created during outage are lost on restart
- No authentication state persists
- Memory grows unbounded

**Recommendation:** Add bounded size limits and document clearly that in-memory mode is dev-only. Reject payment creation if Supabase is unavailable.

---

### M9. Cookie Missing Security Attributes

| Field | Value |
|-------|-------|
| **File** | `src/components/ui/sidebar.tsx:68` |
| **CVSS Estimate** | 3.5 |

```javascript
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE};`
```

No `Secure`, `HttpOnly`, or `SameSite` attributes. While this is only a UI state cookie, it sets a pattern.

**Recommendation:**

```javascript
document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; Secure; SameSite=Strict`;
```

---

### M10. TypeScript Strict Mode Disabled

| Field | Value |
|-------|-------|
| **File** | `tsconfig.json` |
| **CVSS Estimate** | 3.2 |

```json
"noImplicitAny": false,
"strictNullChecks": false
```

Disabled strict checks increase the risk of runtime type errors, null pointer exceptions, and implicit type coercion bugs.

**Recommendation:** Enable strict mode incrementally.

---

## Low Severity

| # | Issue | Location | Description |
|---|-------|----------|-------------|
| L1 | Error messages leak internal details | `auth.js:91, 108` | Expiry times, drift windows, endpoint hints exposed to unauthenticated users |
| L2 | Old API keys not revoked on rotation | `agents.js` | 10-day grace period means compromised keys remain valid |
| L3 | No key rotation for HMAC_ENCRYPTION_KEY | `crypto.js` | Single static encryption key with no rotation mechanism |
| L4 | `touchAgent()` fire-and-forget | `auth.js:142` | Unhandled promise rejection possible |
| L5 | Webhook failure count not atomic | `webhooks.js:143-160` | Read-then-write pattern; concurrent failures may undercount |
| L6 | WalletConnect Project ID hardcoded | `WalletProvider.tsx` | Should be in environment variable |
| L7 | No dependency vulnerability scanning | `package.json` | No `npm audit` or Snyk/Dependabot in CI |
| L8 | Console.error in production | Multiple files | Sensitive data may leak to stdout/log aggregators |

---

## What's Done Well

The codebase demonstrates strong security awareness in several areas:

- **AES-256-GCM** for API secret storage with random IVs and auth tags
- **HMAC-SHA256** with constant-time comparison (`timingSafeEqual`)
- **JWT stored in memory only** - never localStorage (excellent XSS mitigation)
- **EIP-191 nonce-based wallet auth** with 5-min TTL and one-time use
- **Replay protection** via timestamp validation on HMAC (5-minute window)
- **Webhook HMAC signatures** with retry/backoff and auto-disable after failures
- **Soft deletes** preserving audit history for agents
- **No `eval()`/`exec()`/`innerHTML`** patterns anywhere in the codebase
- **Parameterized Supabase queries** throughout (no SQL injection vectors)
- **Comprehensive audit logging** with IP tracking and request logging middleware
- **API key expiration** with rotation support
- **Dual-mode authentication** (HMAC for server-to-server, JWT for browser)

---

## Priority Remediation Order

### Phase 1: Before Production (Critical)

| Priority | Issue | Action |
|----------|-------|--------|
| 1 | C1 | Remove `/api/execute-payment` endpoint entirely |
| 2 | C2 | Restrict CORS to known frontend origins |
| 3 | C3 | Fix SSRF in X verification (validate IPs, block redirects to private networks) |
| 4 | C4 | Add idempotency and atomic locking to payment verification |

### Phase 2: High Priority (Next Sprint)

| Priority | Issue | Action |
|----------|-------|--------|
| 5 | H1 | Validate webhook URLs (HTTPS only, block private IPs) |
| 6 | H3 | Fix rate limiting for Vercel proxy deployment |
| 7 | H7 | Add security headers (helmet or manual) |
| 8 | H2 | Replace fuzzy network matching with strict alias map |

### Phase 3: Medium Priority (Next Release)

| Priority | Issue | Action |
|----------|-------|--------|
| 9 | M4 | Replace `Math.random()` with `crypto.randomUUID()` for fee IDs |
| 10 | H5 | Hash webhook secrets in database |
| 11 | H4 | Add multiple price sources and staleness checks |
| 12 | H6 | Set explicit body size limits on Express |

### Phase 4: Ongoing Maintenance

| Priority | Issue | Action |
|----------|-------|--------|
| 13 | M1-M10 | Address remaining medium severity items |
| 14 | L1-L8 | Address low severity items incrementally |
| 15 | - | Set up automated dependency scanning (Snyk/Dependabot) |
| 16 | - | Add security-focused integration tests |

---

## Summary Table

| ID | Severity | Category | Finding | Location |
|----|----------|----------|---------|----------|
| C1 | **Critical** | Secrets | Private key accepted in HTTP body | `api/index.js:874-898` |
| C2 | **Critical** | CORS | All origins allowed (`*`) | `api/index.js:9` |
| C3 | **Critical** | SSRF | X verification follows redirects to internal IPs | `xVerification.js:51-58` |
| C4 | **Critical** | Race Condition | No replay protection on payment verify | `api/index.js:1057-1196` |
| H1 | High | SSRF | Webhook URLs not validated | `webhooks.js:10-36` |
| H2 | High | Validation | Fuzzy network matching allows bypass | `chainRegistry.js` |
| H3 | High | Rate Limiting | Ineffective behind reverse proxy | `rateLimit.js` |
| H4 | High | Pricing | Hardcoded fallback prices | `feeCalculator.js:66-80` |
| H5 | High | Secrets | Webhook secrets stored plaintext | `webhooks.js:12` |
| H6 | High | DoS | No request body size limits | `api/index.js:12-16` |
| H7 | High | Headers | Missing security headers | `api/index.js`, `vercel.json` |
| M1 | Medium | Privacy | Agent enumeration via public endpoint | `api/index.js` |
| M2 | Medium | Privacy | Wallet address in URL query string | `api/index.js:261` |
| M3 | Medium | Atomicity | Fee transaction not atomic with payment | `api/index.js:979-1000` |
| M4 | Medium | Randomness | `Math.random()` for financial record IDs | `api/index.js:984` |
| M5 | Medium | Auth | Silent auth error swallowing | `auth.js:273, 295, 302` |
| M6 | Medium | DoS | IP anomaly auto-suspension too aggressive | `ipMonitor.js` |
| M7 | Medium | Auth | Supabase anon key for backend operations | `supabase.js` |
| M8 | Medium | Reliability | In-memory fallback unbounded | `store.js` |
| M9 | Medium | Cookies | Missing Secure/SameSite attributes | `sidebar.tsx:68` |
| M10 | Medium | Type Safety | TypeScript strict mode disabled | `tsconfig.json` |
| L1 | Low | Info Leak | Error messages expose internal details | `auth.js` |
| L2 | Low | Auth | Old API keys valid for 10 days after rotation | `agents.js` |
| L3 | Low | Crypto | No encryption key rotation mechanism | `crypto.js` |
| L4 | Low | Error Handling | `touchAgent()` fire-and-forget | `auth.js:142` |
| L5 | Low | Atomicity | Webhook failure count read-then-write | `webhooks.js:143-160` |
| L6 | Low | Secrets | WalletConnect Project ID hardcoded | `WalletProvider.tsx` |
| L7 | Low | Dependencies | No automated vulnerability scanning | `package.json` |
| L8 | Low | Info Leak | `console.error` in production | Multiple files |

---

*Report generated by comprehensive static analysis of the PayAgent codebase. This audit does not include dynamic testing, penetration testing, or smart contract analysis. A follow-up engagement is recommended for runtime security testing.*
