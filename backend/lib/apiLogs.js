const crypto = require('crypto');
const { supabase } = require('./supabase');

// In-memory fallback
const memoryLogs = [];
const memoryIpHistory = {};

/**
 * Log an API request
 */
async function logRequest({ agentId, endpoint, method, ip, userAgent, statusCode, responseTimeMs, error }) {
  const entry = {
    id: 'LOG-' + crypto.randomBytes(6).toString('hex'),
    agent_id: agentId || null,
    endpoint,
    method,
    ip_address: ip || null,
    user_agent: userAgent || null,
    status_code: statusCode || null,
    response_time_ms: responseTimeMs || null,
    error: error || null
  };

  if (supabase) {
    await supabase.from('api_logs').insert(entry).catch(err => {
      console.error('Failed to insert api_log:', err.message);
    });
  } else {
    memoryLogs.push({ ...entry, created_at: new Date().toISOString() });
    // Keep in-memory logs bounded
    if (memoryLogs.length > 10000) memoryLogs.shift();
  }
}

/**
 * Upsert IP history record for an agent
 */
async function upsertIpHistory(agentId, ip) {
  if (!agentId || !ip) return;

  if (supabase) {
    // Security H7: Insert-first pattern to avoid TOCTOU race condition.
    // Try insert (atomic via UNIQUE constraint); if duplicate, fall back to update.
    try {
      const { error: insertErr } = await supabase.from('ip_history').insert({
        id: 'IP-' + crypto.randomBytes(6).toString('hex'),
        agent_id: agentId,
        ip_address: ip
      });

      if (insertErr && insertErr.code === '23505') {
        // Duplicate — update existing row (safe: concurrent updates just overwrite timestamp)
        await supabase.from('ip_history')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('agent_id', agentId)
          .eq('ip_address', ip);
      }
    } catch {
      // Non-fatal: IP history is best-effort
    }
  } else {
    const key = `${agentId}:${ip}`;
    if (memoryIpHistory[key]) {
      memoryIpHistory[key].last_seen_at = new Date().toISOString();
      memoryIpHistory[key].request_count += 1;
    } else {
      memoryIpHistory[key] = {
        id: 'IP-' + crypto.randomBytes(6).toString('hex'),
        agent_id: agentId,
        ip_address: ip,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        request_count: 1,
        is_vpn: false
      };
    }
  }
}

/**
 * Get API logs for an agent (paginated)
 */
async function getAgentLogs(agentId, { limit = 50, offset = 0 } = {}) {
  if (supabase) {
    const { data, error, count } = await supabase
      .from('api_logs')
      .select('*', { count: 'exact' })
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return { logs: data || [], total: count || 0 };
  }

  const agentLogs = memoryLogs.filter(l => l.agent_id === agentId);
  const sorted = agentLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return {
    logs: sorted.slice(offset, offset + limit),
    total: sorted.length
  };
}

/**
 * Get IP history for an agent
 */
async function getAgentIpHistory(agentId) {
  if (supabase) {
    const { data, error } = await supabase
      .from('ip_history')
      .select('*')
      .eq('agent_id', agentId)
      .order('last_seen_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  return Object.values(memoryIpHistory)
    .filter(ip => ip.agent_id === agentId)
    .sort((a, b) => new Date(b.last_seen_at) - new Date(a.last_seen_at));
}

/**
 * Get unique IP count for an agent in the last N hours
 */
async function getRecentUniqueIpCount(agentId, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  if (supabase) {
    const { data, error } = await supabase
      .from('ip_history')
      .select('ip_address')
      .eq('agent_id', agentId)
      .gte('last_seen_at', since);

    if (error) return 0;
    return (data || []).length;
  }

  return Object.values(memoryIpHistory)
    .filter(ip => ip.agent_id === agentId && new Date(ip.last_seen_at) >= new Date(since))
    .length;
}

module.exports = {
  logRequest,
  upsertIpHistory,
  getAgentLogs,
  getAgentIpHistory,
  getRecentUniqueIpCount
};
