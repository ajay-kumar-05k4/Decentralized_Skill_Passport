// Minimal fixed-window rate limiter with no external dependency.
//
// It exists to protect the PUBLIC verification endpoints, which take no auth
// and would otherwise let anyone brute-force the hash space. For a
// multi-instance deployment, swap the in-process Map for Redis - the
// middleware signature stays the same.
const buckets = new Map();

const rateLimit = ({ windowMs = 60 * 1000, max = 30, message } = {}) => {
  return (req, res, next) => {
    if (process.env.DISABLE_RATE_LIMIT === 'true') return next();

    const key = `${req.ip}:${req.baseUrl}${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.status(429);
      return next(new Error(message || 'Too many requests. Please try again shortly.'));
    }
    return next();
  };
};

// Keeps the Map from growing without bound on a long-running process
const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 5 * 60 * 1000);
if (sweeper.unref) sweeper.unref();

module.exports = { rateLimit };
