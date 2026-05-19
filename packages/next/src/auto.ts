/**
 * @webmcp1/next/auto — Auto-inference MCP module.
 *
 * Scans your app/api directory at startup, finds all route files,
 * and registers them as MCP tools automatically. When a tool is
 * called, forwards the request to the actual route via fetch().
 *
 * @example
 * ```ts
 * // app/api/mcp/route.ts — the ONE file you need
 * export { handlers } from '@webmcp1/next/auto'
 * export const { POST, GET } = handlers
 * ```
 */

import { NextRequest, NextResponse } from 'next/server';
import { MCPServer, z } from '@webmcp1/core';
import fs from 'fs';
import path from 'path';

// captures the origin from incoming MCP requests so tool handlers
// can forward calls to the right address via fetch
let currentOrigin = 'http://localhost:3000';

// ── config ─────────────────────────────────────────────────

function getConfig(): { name: string; description: string; endpoint: string } {
  try {
    const raw = process.env.__WEBMCP_CONFIG__;
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    name: 'WebMCP Auto-Discovered API',
    description: 'Automatically discovered API routes',
    endpoint: '/api/mcp',
  };
}

// ── file scanning ──────────────────────────────────────────

/** @internal exported for testing */
export function scanRoutes(apiDir: string, excludePath: string): { segments: string[] }[] {
  const results: { segments: string[] }[] = [];
  if (!fs.existsSync(apiDir)) return results;

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.isFile() &&
        (entry.name === 'route.ts' || entry.name === 'route.js') &&
        !full.includes('node_modules')
      ) {
        const rel = path.relative(apiDir, path.dirname(full));
        const segs = rel === '' ? [] : rel.split(path.sep);
        const urlPath = '/' + segs.join('/');
        if (urlPath === excludePath || urlPath === excludePath.replace(/\/+$/, '')) continue;
        results.push({ segments: segs });
      }
    }
  }

  walk(apiDir);
  return results;
}

// ── tool naming ────────────────────────────────────────────

/** @internal exported for testing */
export function segmentsToToolName(segs: string[], method: string): string {
  const clean = segs.map((s) => s.replace(/^\[(.+)\]$/, '$1'));
  // root API route: just use the method name
  if (clean.length === 0) return method.toLowerCase();
  return [...clean, method.toLowerCase()].join('_');
}

// ── extract dynamic param names from segments ──────────────

/** @internal exported for testing */
export function extractRouteParams(segs: string[]): string[] {
  return segs.filter((s) => /^\[.+\]$/.test(s)).map((s) => s.replace(/^\[(.+)\]$/, '$1'));
}

// ── main factory ───────────────────────────────────────────

export interface AutoDiscoverResult {
  server: MCPServer;
  handlers: {
    POST: (request: NextRequest) => Promise<NextResponse>;
    GET: (request: NextRequest) => Promise<NextResponse>;
  };
}

/**
 * Scans app/api at startup and registers every route file as an MCP tool.
 * Tool calls are forwarded to the real route handler via fetch().
 * Works in both dev and production — no dynamic imports needed.
 */
export function setupAutoDiscover(config?: Partial<{ name: string; description: string; endpoint: string; baseDir: string }>): AutoDiscoverResult {
  const final = { ...getConfig(), ...config };

  const server = new MCPServer({
    name: final.name,
    version: '1.0.0',
    description: final.description,
    transport: { type: 'http', path: final.endpoint },
  });

  const apiDir = path.join(final.baseDir ?? process.cwd(), 'app', 'api');
  // endpoint like '/api/mcp' -> relative path from app/api is '/mcp'
  // only strip the /api prefix if present; otherwise use the endpoint as-is
  const exclude = '/' + final.endpoint
    .replace(/^\/api\/?/, '')
    .replace(/^\/\//, '/');  // normalize accidental double-slash
  const routes = scanRoutes(apiDir, exclude);
  const methods = ['GET', 'POST'] as const;
  let toolCount = 0;

  for (const route of routes) {
    // segments are relative to app/api, so the actual URL needs /api/ prefix
    const urlPath = route.segments.length === 0 ? '/api' : '/api/' + route.segments.join('/');
    const routeParams = extractRouteParams(route.segments);

    for (const method of methods) {
      const name = segmentsToToolName(route.segments, method);
      const desc = `${method.toUpperCase()} ${urlPath}`;

      // build a schema that hints at URL params from dynamic segments
      // this gives AI agents at least SOME clue about what to pass
      let schema: z.ZodTypeAny = z.object({}).passthrough();
      if (routeParams.length > 0) {
        const shape: Record<string, z.ZodTypeAny> = {};
        for (const p of routeParams) {
          shape[p] = z.string().optional();
        }
        schema = z.object(shape).passthrough();
      }

      server.tool(name, desc, schema, async (params: Record<string, unknown>) => {
        try {
          const target = new URL(urlPath, currentOrigin);

          if (method === 'GET') {
            if (params && typeof params === 'object') {
              for (const [key, val] of Object.entries(params)) {
                if (val !== undefined && val !== null) {
                  const bracketKey = `[${key}]`;
                  if (target.pathname.includes(bracketKey)) {
                    target.pathname = target.pathname.replace(bracketKey, String(val));
                  } else {
                    target.searchParams.set(key, String(val));
                  }
                }
              }
            }
          }

          const opts: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' },
          };

          if (method !== 'GET' && params) {
            opts.body = JSON.stringify(params);
          }

          const res = await fetch(target.toString(), opts);
          const text = await res.text();

          if (!res.ok) {
            return { error: `${method} ${urlPath} returned ${res.status}`, status: res.status };
          }

          try { return JSON.parse(text); } catch { return { data: text }; }
        } catch (err) {
          return { error: `Could not reach ${method} ${urlPath}: ${err instanceof Error ? err.message : err}` };
        }
      });

      toolCount++;
    }
  }

  const handler = {
    POST: async (request: NextRequest) => {
      currentOrigin = request.nextUrl.origin;

      const agentId = request.headers.get('x-agent-id') ?? 'unknown';
      const body = await request.text();

      if (!server.rateLimiter.check(agentId)) {
        const info = server.rateLimiter.getInfo(agentId);
        return NextResponse.json(
          {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32050, message: 'Rate limited.', data: { retryAfter: Math.ceil((info.resetAt - Date.now()) / 1000) } },
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

      const { status, body: rBody, headers } = await server.http.handleHTTPPost(body, {
        agentId,
        headers: Object.fromEntries(request.headers.entries()),
      });

      return new NextResponse(rBody, {
        status,
        headers: new Headers({ ...headers, 'x-mcp-version': '1.0' }),
      });
    },

    GET: async (request: NextRequest) => {
      // Next.js rewrites may change request.url, so check both the
      // original request URL and nextUrl for /.well-known/mcp.json
      const requestUrl = request.url;
      const isWellKnown =
        requestUrl.includes('/.well-known/mcp.json') ||
        requestUrl.includes('/.well-known/mcp') ||
        request.nextUrl.pathname === '/.well-known/mcp.json';

      if (isWellKnown) {
        const { body, headers } = server.discovery.generateResponse();
        return new NextResponse(body, { status: 200, headers: new Headers(headers) });
      }

      return NextResponse.json({
        ok: true,
        name: final.name,
        version: '1.0.0',
        tools: toolCount,
        autoDiscovered: true,
      });
    },
  };

  return { server, handlers: handler };
}

/**
 * Pre-configured auto-discover instance. Reads config from
 * process.env.__WEBMCP_CONFIG__ (set by the withWebMCP plugin).
 * Import this from your app/api/mcp/route.ts file.
 */
export const handlers = setupAutoDiscover().handlers;
