const { supabase } = require('./supabase');

// In-memory cache for fee config
let cachedConfig = null;
let cacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute cache for config

// Default fee config (used when no DB)
const DEFAULT_CONFIG = {
  id: 'default',
  lcx_fee_amount: 4.00,
  lcx_platform_share: 2.00,
  lcx_creator_reward: 2.00,
  lcx_contract_address: process.env.LCX_CONTRACT_ADDRESS || '0x037a54aab062628c9bbae1fdb1583c195585fe41',
  treasury_wallet: process.env.PLATFORM_TREASURY_WALLET || '0x0000000000000000000000000000000000000000',
  price_cache_ttl_sec: 300
};

/**
 * Get fee configuration (cached)
 */
async function getFeeConfig() {
  const now = Date.now();
  if (cachedConfig && (now - cacheTime) < CACHE_TTL_MS) {
    return cachedConfig;
  }

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('fee_config')
        .select('*')
        .eq('id', 'default')
        .single();

      if (!error && data) {
        cachedConfig = data;
        cacheTime = now;
        return data;
      }
    } catch (e) {
      console.error('Fee config fetch error:', e);
    }
  }

  // Fallback to defaults
  cachedConfig = DEFAULT_CONFIG;
  cacheTime = now;
  return DEFAULT_CONFIG;
}

/**
 * Update fee configuration
 */
async function updateFeeConfig(updates) {
  if (!supabase) {
    Object.assign(DEFAULT_CONFIG, updates);
    cachedConfig = null;
    return DEFAULT_CONFIG;
  }

  const { data, error } = await supabase
    .from('fee_config')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 'default')
    .select()
    .single();

  if (error) throw error;

  cachedConfig = null; // Invalidate cache
  return data;
}

module.exports = { getFeeConfig, updateFeeConfig };
