/**
 * @webmcp1/express - Express.js SDK for WebMCP.
 *
 * Make your Express server "Agent-Ready" without rewriting everything.
 * You've got routes. Now give them to the robots.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { MCPServer } from '@webmcp1/core';
import type { MCPServerConfig } from '@webmcp1/core';

export { MCPServer, z } from '@webmcp1/core';

/**
 * Creates an Express Router with MCP endpoints.
 *
 * Gives you a router, a discovery handler, and full MCP support.
 * Everything an AI agent could want, none of the setup headache.
 *
 * @example
 * ```ts
 * import express from 'express'
 * import { createMCPRouter } from '@webmcp1/express'
 * import { z } from '@webmcp1/core'
 *
 * const app = express()
 * const mcp = createMCPRouter({
 *   name: 'My API',
 *   description: 'AI-ready API server',
 *   transport: { type: 'http', path: '/api/mcp' }
 * })
 *
 * mcp.server.tool(
 *   'get_data',
 *   'Get some data',
 *   z.object({ id: z.string() }),
 *   async ({ id }) => ({ id, data: 'hello' })
 * )
 *
 * app.use('/api/mcp', mcp.router)
 * app.get('/.well-known/mcp.json', mcp.discoveryHandler)
 * ```
 */
export function createMCPRouter(config: MCPServerConfig) {
  const server = new MCPServer(config);
  const router = Router();

  // parse JSON bodies because Express doesn't do it by default
  router.use(expressJsonMiddleware());

  // POST /api/mcp — where agents send their JSON-RPC requests
  router.post('/', async (req: Request, res: Response) => {
    const agentId = (req.headers['x-agent-id'] as string) ?? 'unknown';

    // rate limiting — even AI agents need to learn patience
    if (!server.rateLimiter.check(agentId)) {
      const info = server.rateLimiter.getInfo(agentId);
      res.status(429);
      res.set('retry-after', String(Math.ceil((info.resetAt - Date.now()) / 1000)));
      res.set('x-ratelimit-remaining', String(info.remaining));
      res.set('x-ratelimit-reset', String(info.resetAt));
      res.json({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32050,
          message: 'Rate limited. Too many requests.',
          data: { retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000) },
        },
      });
      return;
    }

    const { status, body, headers } = await server.http.handleHTTPPost(
      JSON.stringify(req.body),
      {
        agentId,
        headers: req.headers as Record<string, string>,
      }
    );

    res.status(status);
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        res.set(key, value as string);
      }
    }
    res.set('x-mcp-version', '1.0');
    res.send(body);
  });

  // GET /api/mcp — quick health check
  router.get('/', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      name: config.name,
      version: config.version,
      tools: server.registry.listTools().length,
    });
  });

  return {
    server,
    router,
    /**
     * Handler for GET /.well-known/mcp.json
     *
     * The file agents look for to discover your MCP capabilities.
     * Mount this at `/.well-known/mcp.json` in your Express app.
     */
    discoveryHandler: (_req: Request, res: Response) => {
      const { body, headers } = server.discovery.generateResponse();
      if (headers) {
        for (const [key, value] of Object.entries(headers)) {
          res.set(key, value as string);
        }
      }
      res.send(body);
    },
  };
}

/**
 * Minimal Express JSON body parser
 *
 * Express doesn't include body-parser anymore.
 * We could import the package, but that's another dependency.
 * So here's a 10-line JSON parser that does the job.
 * You're welcome.
 */
function expressJsonMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
      next();
      return;
    }

    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('application/json')) {
      next();
      return;
    }

    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        req.body = JSON.parse(body);
      } catch {
        req.body = {};
      }
      next();
    });
  };
}
