const { getRecentUniqueIpCount } = require('./apiLogs');
const { updateAgentIp, incrementIpChangeCount, suspendAgent } = require('./agents');

const MAX_UNIQUE_IPS_24H = 5;    // Threshold: more than 5 unique IPs in 24h triggers warning
const SUSPEND_THRESHOLD = 10;     // Auto-suspend after 10 cumulative IP anomaly events

/**
 * Check IP for anomalies after each authenticated request.
 * Called non-blocking from request logger.
 *
 * @param {string} agentId
 * @param {string} currentIp
 * @param {string|null} lastKnownIp
 * @param {number} ipChangeCount - current cumulative count from agent record
 */
async function checkIpAnomaly(agentId, currentIp, lastKnownIp, ipChangeCount) {
  try {
    // Update the agent's last known IP
    await updateAgentIp(agentId, currentIp);

    // If the IP changed from last known, check for anomalies
    if (lastKnownIp && currentIp !== lastKnownIp) {
      const uniqueIps = await getRecentUniqueIpCount(agentId, 24);

      if (uniqueIps > MAX_UNIQUE_IPS_24H) {
        const newCount = await incrementIpChangeCount(agentId);
        console.warn(`[IP-ANOMALY] Agent ${agentId}: ${uniqueIps} unique IPs in 24h (change count: ${newCount})`);

        if (newCount >= SUSPEND_THRESHOLD) {
          console.warn(`[IP-ANOMALY] Agent ${agentId}: auto-suspending (ip_change_count=${newCount} >= ${SUSPEND_THRESHOLD})`);
          await suspendAgent(agentId);
          return { suspended: true, reason: 'Frequent IP changes detected', uniqueIps, changeCount: newCount };
        }

        return { warning: true, uniqueIps, changeCount: newCount };
      }
    }

    return { ok: true };
  } catch (err) {
    // Non-fatal: don't block the request
    console.error('[IP-MONITOR] Error:', err.message);
    return { ok: true, error: err.message };
  }
}

module.exports = { checkIpAnomaly, MAX_UNIQUE_IPS_24H, SUSPEND_THRESHOLD };
