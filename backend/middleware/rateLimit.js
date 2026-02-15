const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter: 100 requests/minute per IP
 */
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: true },
  message: { error: 'Too many requests. Please try again later.', retryAfterMs: 60000 },
});

/**
 * Sensitive endpoint rate limiter: 20 requests/minute per IP
 * Used for registration, verification, key rotation
 */
const sensitiveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: true },
  message: { error: 'Too many requests to this endpoint. Please try again later.', retryAfterMs: 60000 },
});

module.exports = { globalLimiter, sensitiveLimiter };
