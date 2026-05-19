import { NextRequest, NextResponse } from 'next/server';
import { MCPServer } from '@webmcp1/core';

/**
 * Creates a Next.js App Router route handler for the MCP endpoint.
 *
 * Gives you GET and POST handlers that plug directly into your App Router.
 * Handles discovery, health checks, SSE streaming, and tool calls.
 * One stop shop. Less code. More vibes.
 *
 * @example
 * ```ts
 * // app/api/mcp/route.ts
 * import { createRouteHandler } from '@webmcp1/next'
 * import { z } from '@webmcp1/core'
 *
 * const server = createRouteHandler({
 *   name: 'My Store',
 *   description: 'AI-ready e-commerce site',
 * })
 *
 * server.tool(
 *   'purchase_item',
 *   'Purchase an item by ID',
 *   z.object({ itemId: z.string(), quantity: z.number().min(1) }),
 *   async ({ itemId, quantity }) => {
 *     return { success: true, orderId: 'abc-123' }
 *   }
 * )
 *
 * export const { GET, POST } = server.handlers()
 * ```
 */
export function createRouteHandler(options: {
  name: string;
  description: string;
  endpoint?: string;
  streaming?: boolean;
}) {
  const server = new MCPServer({
    name: options.name,
    version: '1.0.0',
    description: options.description,
    transport: {
      type: options.streaming ? 'http' : 'http',
      path: options.endpoint ?? '/api/mcp',
    },
  });

  return {
    server,

    /**
     * Returns the Next.js App Router handlers (GET for discovery, POST for MCP calls)
     */
    handlers() {
      return {
        /**
         * GET /.well-known/mcp.json — "hey agents, i'm right here"
         * GET /api/mcp — health check / SSE handshake
         */
        GET: async (request: NextRequest) => {
          const url = new URL(request.url);

          // serve the auto-discovery manifest if they're hitting the .well-known path
          if (url.pathname === '/.well-known/mcp.json') {
            const { body, headers } = server.discovery.generateResponse();
            return new NextResponse(body, {
              status: 200,
              headers: new Headers(headers),
            });
          }

          // SSE streaming — for agents that want real-time data
          if (options.streaming && request.headers.get('accept') === 'text/event-stream') {
            const { headers, close } = server.http.handleSSEConnection((data: string) => {
              // in prod, this would actually write to the SSE stream.
              // Next.js does this differently depending on your version.
              // yay, web standards!
            });
            return new NextResponse(null, {
              status: 200,
              headers: new Headers({
                ...headers,
                'x-mcp-version': '1.0',
              }),
            });
          }

          // regular health check — confirms the server is alive
          return NextResponse.json({
            ok: true,
            message: `${options.name} MCP Server`,
            version: '1.0.0',
            tools: server.registry.listTools().length,
          });
        },

        /**
         * POST /api/mcp — the main event
         *
         * This is where agents send JSON-RPC requests and get stuff done.
         * Buy things, search products, check order status — whatever tools you defined.
         */
        POST: async (request: NextRequest) => {
          const agentId = request.headers.get('x-agent-id') ?? 'unknown';
          const body = await request.text();

          // check if this agent is being polite about rate limits
          if (!server.rateLimiter.check(agentId)) {
            const info = server.rateLimiter.getInfo(agentId);
            return NextResponse.json(
              {
                jsonrpc: '2.0',
                id: null,
                error: {
                  code: -32050,
                  message: 'Rate limited. Too many requests.',
                  data: {
                    retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000),
                  },
                },
              },
              {
                status: 429,
                headers: {
                  'retry-after': String(Math.ceil((info.resetAt - Date.now()) / 1000)),
                  'x-ratelimit-remaining': String(info.remaining),
                  'x-ratelimit-reset': String(info.resetAt),
                },
              }
            );
          }

          const { status, body: responseBody, headers } = await server.http.handleHTTPPost(body, {
            agentId,
            headers: Object.fromEntries(request.headers.entries()),
          });

          return new NextResponse(responseBody, {
            status,
            headers: new Headers({
              ...headers,
              'x-mcp-version': '1.0',
            }),
          });
        },
      };
    },
  };
}
