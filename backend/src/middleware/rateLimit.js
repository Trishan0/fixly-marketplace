const buckets = new Map();

function cleanupExpired(now) {
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt <= now) buckets.delete(key);
  }
}

function createRateLimiter({ windowMs, max, keyPrefix = 'global', message }) {
  return (req, res, next) => {
    const now = Date.now();
    cleanupExpired(now);

    const identifier = `${keyPrefix}:${req.ip}:${req.path}`;
    const current = buckets.get(identifier);

    if (!current || current.resetAt <= now) {
      buckets.set(identifier, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (current.count >= max) {
      const retryAfter = Math.ceil((current.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: message || 'Too many requests, please try again later',
        retry_after_seconds: retryAfter,
      });
    }

    current.count += 1;
    buckets.set(identifier, current);
    next();
  };
}

module.exports = { createRateLimiter };
