const crypto = require('crypto');
const { incrementRateLimit } = require('../modules/operations/repository');

function bucketKey(req, keyPrefix, windowStart) {
  const raw = `${keyPrefix}:${req.ip}:${req.path}:${windowStart}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function createRateLimiter({ windowMs, max, keyPrefix = 'global', message }) {
  return async (req, res, next) => {
    const now = Date.now();
    const windowStart = Math.floor(now / windowMs) * windowMs;
    const resetAt = new Date(windowStart + windowMs);
    const keyHash = bucketKey(req, keyPrefix, windowStart);

    try {
      const result = await incrementRateLimit(keyHash, resetAt);
      const count = Number(result.count);

      if (count > max) {
        const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          error: message || 'Too many requests, please try again later',
          retry_after_seconds: retryAfter,
        });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createRateLimiter };
