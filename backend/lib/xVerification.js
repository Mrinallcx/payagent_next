const crypto = require('crypto');
const dns = require('dns').promises;

/**
 * Security C3: Validate a URL is safe to fetch (not SSRF-able).
 * Blocks non-HTTPS, private IPs, and DNS resolution failures.
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

/**
 * Generate a unique verification challenge for an agent
 */
function generateChallenge(username) {
  const randomPart = crypto.randomBytes(3).toString('hex');
  return `payagent-verify-${username}-${randomPart}`;
}

/**
 * Validate tweet URL format
 * Accepts: https://x.com/user/status/123 or https://twitter.com/user/status/123
 */
function isValidTweetUrl(url) {
  return /^https?:\/\/(x\.com|twitter\.com)\/[^/]+\/status\/\d+/.test(url);
}

/**
 * Extract X username from tweet URL
 */
function extractUsernameFromUrl(url) {
  const match = url.match(/^https?:\/\/(?:x\.com|twitter\.com)\/([^/]+)\/status\/\d+/);
  return match ? match[1] : null;
}

/**
 * Verify a tweet contains the expected challenge code.
 *
 * Strategy: Fetch the tweet page with a browser-like user-agent and check
 * if the HTML contains the challenge string. This is a best-effort approach
 * that avoids the need for an X API key.
 *
 * @param {string} tweetUrl - Full tweet URL
 * @param {string} expectedChallenge - The challenge string to find
 * @returns {Promise<{ valid: boolean, x_username: string|null, error?: string }>}
 */
async function verifyTweet(tweetUrl, expectedChallenge) {
  if (!tweetUrl || !expectedChallenge) {
    return { valid: false, x_username: null, error: 'Missing tweetUrl or challenge' };
  }

  if (!isValidTweetUrl(tweetUrl)) {
    return { valid: false, x_username: null, error: 'Invalid tweet URL format. Use https://x.com/username/status/id' };
  }

  const xUsername = extractUsernameFromUrl(tweetUrl);

  // Security C3: Validate URL before fetching to prevent SSRF
  if (!await isSafeUrl(tweetUrl)) {
    return { valid: false, x_username: xUsername, error: 'URL failed safety check' };
  }

  try {
    // Fetch the tweet page — redirect: 'error' blocks SSRF via redirects (Security C3)
    const response = await fetch(tweetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; PayAgentBot/1.0; +https://payagent.dev)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'error',
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      return { valid: false, x_username: xUsername, error: `Failed to fetch tweet (HTTP ${response.status})` };
    }

    const html = await response.text();

    // Check if the page contains the challenge string
    if (html.includes(expectedChallenge)) {
      return { valid: true, x_username: xUsername };
    }

    // Twitter might serve JS-rendered content; also check for nitter/alternative
    // As a fallback, try the nitter.net mirror
    try {
      const nitterUrl = tweetUrl
        .replace('https://x.com/', 'https://nitter.net/')
        .replace('https://twitter.com/', 'https://nitter.net/');

      // Security C3: Validate Nitter URL before fetching
      if (!await isSafeUrl(nitterUrl)) {
        // Nitter URL failed safety — skip this fallback
      } else {
        const nitterResponse = await fetch(nitterUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PayAgentBot/1.0)' },
          redirect: 'error',
          signal: AbortSignal.timeout(10000)
        });

        if (nitterResponse.ok) {
          const nitterHtml = await nitterResponse.text();
          if (nitterHtml.includes(expectedChallenge)) {
            return { valid: true, x_username: xUsername };
          }
        }
      }
    } catch {
      // Nitter fallback failed — continue with original result
    }

    return {
      valid: false,
      x_username: xUsername,
      error: `Challenge string not found in tweet. Make sure your tweet contains: ${expectedChallenge}`
    };
  } catch (err) {
    return {
      valid: false,
      x_username: xUsername,
      error: `Failed to verify tweet: ${err.message}`
    };
  }
}

module.exports = { generateChallenge, verifyTweet, isValidTweetUrl, extractUsernameFromUrl, isSafeUrl };
