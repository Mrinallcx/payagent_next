/**
 * LCX Price Service
 *
 * Fetches the current LCX/USD price from CoinGecko with a 5-minute cache.
 */

let priceCache = {
  price: null,
  fetchedAt: 0
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get current LCX price in USD
 * @returns {Promise<number>} LCX price in USD
 */
async function getLcxPriceUsd() {
  const now = Date.now();

  // Return cached price if fresh
  if (priceCache.price !== null && (now - priceCache.fetchedAt) < CACHE_TTL_MS) {
    return priceCache.price;
  }

  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=lcx&vs_currencies=usd',
      {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(10000) // 10s timeout
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }

    const data = await response.json();

    if (!data.lcx || typeof data.lcx.usd !== 'number') {
      throw new Error('Invalid CoinGecko response format');
    }

    const price = data.lcx.usd;

    // Update cache
    priceCache = { price, fetchedAt: now };

    return price;
  } catch (error) {
    console.error('LCX price fetch error:', error.message);

    // Return stale cache if available
    if (priceCache.price !== null) {
      console.warn('Using stale LCX price from cache');
      return priceCache.price;
    }

    // No cache at all — throw
    throw new Error('Failed to fetch LCX price and no cached price available');
  }
}

/**
 * Get cached price info (for diagnostics)
 */
function getPriceCacheInfo() {
  return {
    price: priceCache.price,
    fetchedAt: priceCache.fetchedAt ? new Date(priceCache.fetchedAt).toISOString() : null,
    ageMs: priceCache.fetchedAt ? Date.now() - priceCache.fetchedAt : null,
    isStale: priceCache.fetchedAt ? (Date.now() - priceCache.fetchedAt) > CACHE_TTL_MS : true
  };
}

module.exports = { getLcxPriceUsd, getPriceCacheInfo };
