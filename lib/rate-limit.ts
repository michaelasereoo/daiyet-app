interface RateLimitConfig {
  interval: number; // Time window in milliseconds
  uniqueTokenPerInterval: number; // Max unique tokens to track
}

interface TokenData {
  timestamps: number[];
  lastCleanup: number;
}

export function rateLimit(config: RateLimitConfig) {
  const tokens = new Map<string, TokenData>();
  const CLEANUP_INTERVAL = config.interval * 2; // Clean up old entries periodically

  // Cleanup old entries periodically
  const cleanup = () => {
    const now = Date.now();
    for (const [key, data] of tokens.entries()) {
      if (now - data.lastCleanup > CLEANUP_INTERVAL) {
        // Remove old timestamps outside the window
        const windowStart = now - config.interval;
        data.timestamps = data.timestamps.filter(ts => ts > windowStart);
        data.lastCleanup = now;

        // Remove entry if no timestamps left
        if (data.timestamps.length === 0) {
          tokens.delete(key);
        }
      }
    }
  };

  return {
    async check(request: Request, limit: number, identifier: string): Promise<void> {
      // Get IP address
      const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

      const key = `${identifier}:${ip}`;
      const now = Date.now();
      const windowStart = now - config.interval;

      // Cleanup old entries
      cleanup();

      // Limit number of tracked tokens
      if (tokens.size > config.uniqueTokenPerInterval) {
        // Remove oldest entries
        const entries = Array.from(tokens.entries());
        entries.sort((a, b) => a[1].lastCleanup - b[1].lastCleanup);
        const toRemove = entries.slice(0, entries.length - config.uniqueTokenPerInterval);
        toRemove.forEach(([key]) => tokens.delete(key));
      }

      // Get or create token data
      if (!tokens.has(key)) {
        tokens.set(key, {
          timestamps: [],
          lastCleanup: now,
        });
      }

      const tokenData = tokens.get(key)!;

      // Remove timestamps outside the window
      tokenData.timestamps = tokenData.timestamps.filter(ts => ts > windowStart);

      // Check if limit exceeded
      if (tokenData.timestamps.length >= limit) {
        throw new Error(`Rate limit exceeded: ${limit} requests per ${config.interval}ms`);
      }

      // Add current timestamp
      tokenData.timestamps.push(now);
      tokenData.lastCleanup = now;
    },
  };
}

// Pre-configured rate limiters for common use cases
export const authRateLimit = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
});

export const apiRateLimit = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 1000,
});
