const crypto = require('crypto');
const pool = require('../db');

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
      const result = await pool.query(
        `INSERT INTO rate_limit_buckets (key_hash, count, expires_at)
         VALUES ($1, 1, $2)
         ON CONFLICT (key_hash) DO UPDATE SET count = rate_limit_buckets.count + 1
         RETURNING count`,
        [keyHash, resetAt]
      );
      const count = Number(result.rows[0].count);

      if (count > max) {
        const retryAfter = Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000));
        res.setHeader('Retry-After', retryAfter);
        return res.status(429).json({
          error: message || 'Too many requests, please try again later',
          retry_after_seconds: retryAfter,
        });
      }

      if (Math.random() < 0.01) {
        pool.query('DELETE FROM rate_limit_buckets WHERE expires_at < NOW()').catch(error => {
          console.error('Rate-limit cleanup failed:', error.message);
        });
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { createRateLimiter };
