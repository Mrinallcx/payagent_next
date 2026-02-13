const { logRequest, upsertIpHistory } = require('../lib/apiLogs');
const { getClientIp } = require('./auth');

/**
 * Request logger middleware — records every API call for audit trail.
 * Must be applied AFTER auth middleware (needs req.agent).
 * Non-blocking: errors are swallowed to avoid impacting the request.
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  const ip = req.clientIp || getClientIp(req);

  // Hook into response finish to capture status code
  res.on('finish', () => {
    const responseTimeMs = Date.now() - startTime;
    const agentId = req.agent ? req.agent.id : null;

    // Fire-and-forget: log the request
    logRequest({
      agentId,
      endpoint: req.originalUrl || req.path,
      method: req.method,
      ip,
      userAgent: req.headers['user-agent'] || null,
      statusCode: res.statusCode,
      responseTimeMs,
      error: res.statusCode >= 400 ? `HTTP ${res.statusCode}` : null
    }).catch(() => {});

    // Update IP history for authenticated requests
    if (agentId && ip) {
      upsertIpHistory(agentId, ip).catch(() => {});
    }
  });

  next();
}

module.exports = { requestLogger };
