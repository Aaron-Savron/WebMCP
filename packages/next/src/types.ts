/**
 * Options for configuring WebMCP on a Next.js site.
 *
 * The config object you pass to createRouteHandler or createMCPMiddleware.
 * Fill out what you want, skip what you don't. That's the whole deal.
 */
export interface WebMCPNextOptions {
  /**
   * The MCP endpoint path (default: '/api/mcp')
   */
  endpoint?: string;

  /**
   * The site name shown in the discovery manifest
   */
  name?: string;

  /**
   * The site description shown in the discovery manifest
   */
  description?: string;

  /**
   * Rate limiting — keep the bots from going brrrrrr
   */
  rateLimit?: {
    maxRequests: number;
    windowMs: number;
  };

  /**
   * Enable SSE streaming support for real-time data
   */
  streaming?: boolean;
}
