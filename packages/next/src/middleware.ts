import { NextRequest, NextResponse } from 'next/server';
import type { WebMCPNextOptions } from './types.js';

/**
 * Creates a Next.js middleware function that adds MCP-related headers
 * and handles CORS for AI agent access.
 *
 * Slap this in your middleware.ts and agents will find you anywhere.
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { createMCPMiddleware } from '@webmcp1/next'
 *
 * export const middleware = createMCPMiddleware({
 *   endpoint: '/api/mcp'
 * })
 * ```
 */
export function createMCPMiddleware(options: WebMCPNextOptions = {}) {
  const mcpEndpoint = options.endpoint ?? '/api/mcp';

  return async function mcpMiddleware(request: NextRequest) {
    const { pathname } = new URL(request.url);

    // only care about MCP-related paths. the rest can pass through.
    if (pathname !== mcpEndpoint && pathname !== '/.well-known/mcp.json') {
      return NextResponse.next();
    }

    const response = NextResponse.next();

    // CORS — let AI agents from anywhere talk to us
    response.headers.set('access-control-allow-origin', '*');
    response.headers.set('access-control-allow-methods', 'GET, POST, OPTIONS');
    response.headers.set('access-control-allow-headers', 'Content-Type, x-agent-id, x-api-key, authorization');
    response.headers.set('access-control-max-age', '86400');

    // tell the world we speak MCP
    response.headers.set('x-mcp-version', '1.0');
    response.headers.set('x-mcp-endpoint', mcpEndpoint);

    // basic security — no one needs to embed your MCP endpoint in an iframe
    response.headers.set('x-content-type-options', 'nosniff');
    response.headers.set('x-frame-options', 'DENY');

    // handle CORS preflight so agents don't get blocked by the browser
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 204,
        headers: response.headers,
      });
    }

    return response;
  };
}
