/**
 * In-memory rate limiter for MCP endpoints.
 *
 * AI agents are cool, but 10,000 requests per second from a single agent
 * is not cool. This keeps things in check.
 *
 * Sliding window. In-memory. No Redis. No drama.
 */
export class RateLimiter {
  private hits: Map<string, { count: number; resetAt: number }> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if a client is allowed to make a request.
   *
   * Returns true if they're within the limit, false if they need to chill.
   * The agent version of a bouncer checking your ID.
   */
  check(clientId: string): boolean {
    const now = Date.now();
    const record = this.hits.get(clientId);

    if (!record || now > record.resetAt) {
      this.hits.set(clientId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      return false;
    }

    record.count++;
    return true;
  }

  /**
   * Get rate limit info for a client
   *
   * Tells them how many requests they have left and when they can try again.
   * Transparency builds trust, even between humans and bots.
   */
  getInfo(clientId: string): {
    remaining: number;
    resetAt: number;
    limit: number;
  } {
    const now = Date.now();
    const record = this.hits.get(clientId);

    if (!record || now > record.resetAt) {
      return { remaining: this.maxRequests, resetAt: now + this.windowMs, limit: this.maxRequests };
    }

    return {
      remaining: Math.max(0, this.maxRequests - record.count),
      resetAt: record.resetAt,
      limit: this.maxRequests,
    };
  }

  /**
   * Reset the rate limit for a client
   *
   * For when someone says "I'm sorry, I'll be good."
   */
  reset(clientId: string): void {
    this.hits.delete(clientId);
  }

  /**
   * Clear all rate limit data
   *
   * The nuclear option. Everyone starts fresh.
   */
  clear(): void {
    this.hits.clear();
  }
}
