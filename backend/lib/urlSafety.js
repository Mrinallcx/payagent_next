const dns = require('dns').promises;

/**
 * Validate a URL is safe to fetch (SSRF prevention).
 * Blocks non-HTTPS, private IPs, and DNS resolution failures.
 *
 * Used by: xVerification.js (C3), webhooks.js (H1), webhookDispatcher.js (H1)
 */
async function isSafeUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);

    // Block non-HTTPS
    if (parsed.protocol !== 'https:') return false;

    // Block obvious private/local hostnames
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'];
    if (blockedHosts.includes(parsed.hostname)) return false;

    // Resolve DNS and block private IP ranges
    const { address } = await dns.lookup(parsed.hostname);
    const blockedRanges = [
      /^127\./,                       // loopback
      /^10\./,                        // class A private
      /^172\.(1[6-9]|2\d|3[01])\./,  // class B private
      /^192\.168\./,                  // class C private
      /^169\.254\./,                  // link-local
      /^0\./,                         // current network
      /^::1$/,                        // IPv6 loopback
      /^fc00:/,                       // IPv6 unique local
      /^fe80:/,                       // IPv6 link-local
    ];
    if (blockedRanges.some(re => re.test(address))) return false;

    return true;
  } catch {
    return false; // DNS resolution failed or invalid URL — block
  }
}

module.exports = { isSafeUrl };
