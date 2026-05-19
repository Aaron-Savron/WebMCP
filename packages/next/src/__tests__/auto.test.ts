import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { scanRoutes, segmentsToToolName, extractRouteParams, setupAutoDiscover } from '../auto';

// ── Mock next/server ──────────────────────────────────────
// The auto module imports NextRequest/NextResponse from next/server.
// For unit tests we provide lightweight mocks.

vi.mock('next/server', () => {
  class MockNextRequest {
    public readonly nextUrl: URL;
    public readonly headers: Map<string, string>;

    constructor(input: string | URL, init?: RequestInit & { headers?: Record<string, string> }) {
      this.nextUrl = new URL(input);
      this.headers = new Map(Object.entries(init?.headers ?? {}));
    }

    json() {
      return Promise.resolve({});
    }
    text() {
      return Promise.resolve(JSON.stringify({
        jsonrpc: '2.0',
        id: 'test-1',
        method: 'tools/list',
        params: {},
      }));
    }
  }

  class MockNextResponse {
    static json(body: unknown, init?: { status?: number; headers?: Headers }) {
      return {
        status: init?.status ?? 200,
        body: JSON.stringify(body),
        headers: init?.headers ?? new Headers(),
      } as any;
    }

    constructor(public body: string, public init?: { status?: number; headers?: Headers }) {}
  }

  return {
    NextRequest: MockNextRequest,
    NextResponse: MockNextResponse,
  };
});

describe('segmentsToToolName', () => {
  it('handles root API route', () => {
    expect(segmentsToToolName([], 'GET')).toBe('get');
    expect(segmentsToToolName([], 'POST')).toBe('post');
  });

  it('handles flat routes', () => {
    expect(segmentsToToolName(['products'], 'GET')).toBe('products_get');
    expect(segmentsToToolName(['products'], 'POST')).toBe('products_post');
  });

  it('handles nested routes', () => {
    expect(segmentsToToolName(['products', 'search'], 'GET')).toBe('products_search_get');
    expect(segmentsToToolName(['admin', 'users'], 'POST')).toBe('admin_users_post');
  });

  it('handles dynamic segments', () => {
    expect(segmentsToToolName(['products', '[id]'], 'GET')).toBe('products_id_get');
    expect(segmentsToToolName(['users', '[userId]', 'posts'], 'GET')).toBe('users_userId_posts_get');
  });
});

describe('extractRouteParams', () => {
  it('returns empty for static routes', () => {
    expect(extractRouteParams(['products'])).toEqual([]);
    expect(extractRouteParams([])).toEqual([]);
    expect(extractRouteParams(['a', 'b', 'c'])).toEqual([]);
  });

  it('extracts single dynamic param', () => {
    expect(extractRouteParams(['products', '[id]'])).toEqual(['id']);
  });

  it('extracts multiple dynamic params', () => {
    expect(extractRouteParams(['[category]', '[productId]'])).toEqual(['category', 'productId']);
  });

  it('handles mixed static and dynamic', () => {
    expect(extractRouteParams(['api', 'v2', '[slug]'])).toEqual(['slug']);
  });
});

describe('scanRoutes', () => {
  let tmpDir: string;
  let apiDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webmcp-auto-test-'));
    apiDir = path.join(tmpDir, 'app', 'api');
    fs.mkdirSync(apiDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty when apiDir does not exist', () => {
    const result = scanRoutes('/nonexistent/path', '/api/mcp');
    expect(result).toEqual([]);
  });

  it('returns empty when no route files exist', () => {
    // Create a non-route file to verify it's ignored
    fs.writeFileSync(path.join(apiDir, 'hello.ts'), 'export const x = 1');
    const result = scanRoutes(apiDir, '/api/mcp');
    expect(result).toEqual([]);
  });

  it('discovers flat route files', () => {
    const productsDir = path.join(apiDir, 'products');
    fs.mkdirSync(productsDir, { recursive: true });
    fs.writeFileSync(path.join(productsDir, 'route.ts'), 'export async function GET() {}');

    const result = scanRoutes(apiDir, '/api/mcp');
    expect(result).toHaveLength(1);
    expect(result[0].segments).toEqual(['products']);
  });

  it('discovers nested route files', () => {
    const searchDir = path.join(apiDir, 'products', 'search');
    fs.mkdirSync(searchDir, { recursive: true });
    fs.writeFileSync(path.join(searchDir, 'route.ts'), 'export async function GET() {}');

    const result = scanRoutes(apiDir, '/api/mcp');
    // should now have 2 routes: products, products/search
    const segments = result.map((r) => r.segments.join('/')).sort();
    expect(segments).toContain('products');
    expect(segments).toContain('products/search');
  });

  it('discovers dynamic route files', () => {
    const idDir = path.join(apiDir, 'products', '[id]');
    fs.mkdirSync(idDir, { recursive: true });
    fs.writeFileSync(path.join(idDir, 'route.ts'), 'export async function GET() {}');

    const result = scanRoutes(apiDir, '/api/mcp');
    const segments = result.map((r) => r.segments.join('/')).sort();
    expect(segments).toContain('products/[id]');
    expect(segments).toContain('products/search');
    expect(segments).toContain('products');
    expect(segments).toHaveLength(3);
  });

  it('excludes the MCP endpoint path', () => {
    const mcpDir = path.join(apiDir, 'mcp');
    fs.mkdirSync(mcpDir, { recursive: true });
    fs.writeFileSync(path.join(mcpDir, 'route.ts'), 'export async function POST() {}');

    // scanRoutes compares against urlPath relative to apiDir, so excludePath
    // should be '/mcp' (not '/api/mcp' — that's the full endpoint path)
    const result = scanRoutes(apiDir, '/mcp');
    const segments = result.map((r) => r.segments.join('/'));
    expect(segments).not.toContain('mcp');
  });

  it('discovers .js route files too', () => {
    const otherJsDir = path.join(apiDir, 'webhooks');
    fs.mkdirSync(otherJsDir, { recursive: true });
    fs.writeFileSync(path.join(otherJsDir, 'route.js'), 'exports.GET = async () => {}');

    const result = scanRoutes(apiDir, '/api/mcp');
    const segments = result.map((r) => r.segments.join('/'));
    expect(segments).toContain('webhooks');
  });
});

describe('setupAutoDiscover', () => {
  let tmpDir: string;
  let apiDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webmcp-setup-auto-test-'));
    apiDir = path.join(tmpDir, 'app', 'api');

    // Create routes: products/, products/[id]/, products/search/
    fs.mkdirSync(path.join(apiDir, 'products'), { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'products', 'route.ts'), 'export async function GET() { return new Response(\"[]\") }');

    fs.mkdirSync(path.join(apiDir, 'products', '[id]'), { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'products', '[id]', 'route.ts'), 'export async function GET() { return new Response(\"{}\") }');

    fs.mkdirSync(path.join(apiDir, 'products', 'search'), { recursive: true });
    fs.writeFileSync(path.join(apiDir, 'products', 'search', 'route.ts'), 'export async function POST() { return new Response(\"[]\") }');
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('registers tools for discovered routes', () => {
    const result = setupAutoDiscover({
      name: 'Test Auto API',
      baseDir: tmpDir,
      endpoint: '/api/mcp',
    });

    // 3 routes * 2 methods (GET, POST) = 6 tools
    const tools = result.server.listTools();
    expect(tools).toHaveLength(6);

    const names = tools.map((t) => t.name).sort();
    expect(names).toContain('products_get');
    expect(names).toContain('products_id_get');
    expect(names).toContain('products_search_get');
    expect(names).toContain('products_search_post');
    expect(names).toContain('products_post');
    expect(names).toContain('products_id_post');
  });

  it('creates tools with correct descriptions', () => {
    const result = setupAutoDiscover({
      name: 'Test Auto API',
      baseDir: tmpDir,
      endpoint: '/api/mcp',
    });

    const tools = result.server.listTools();
    const getProducts = tools.find((t) => t.name === 'products_get');
    expect(getProducts).toBeDefined();
    expect(getProducts!.description).toBe('GET /products');

    const postSearch = tools.find((t) => t.name === 'products_search_post');
    expect(postSearch).toBeDefined();
    expect(postSearch!.description).toBe('POST /products/search');
  });

  it('builds schemas with dynamic params for [segment] routes', () => {
    const result = setupAutoDiscover({
      name: 'Test Auto API',
      baseDir: tmpDir,
      endpoint: '/api/mcp',
    });

    const tool = result.server.listTools().find((t) => t.name === 'products_id_get');
    expect(tool).toBeDefined();
    // Should hint the id parameter in the schema
    expect(tool!.inputSchema).toBeDefined();
    const schema = tool!.inputSchema as any;
    expect(schema.properties).toBeDefined();
    expect(schema.properties!.id).toBeDefined();
    expect(schema.properties!.id.type).toBe('string');
  });

  it('returns handlers with POST method', async () => {
    const result = setupAutoDiscover({
      name: 'Test Auto API',
      baseDir: tmpDir,
      endpoint: '/api/mcp',
    });

    // The POST handler should be a function
    expect(typeof result.handlers.POST).toBe('function');
    expect(typeof result.handlers.GET).toBe('function');
  });
});

describe('setupAutoDiscover config integration', () => {
  it('uses defaults when no config is provided', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'webmcp-noconfig-test-'));
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmpDir);

    try {
      const result = setupAutoDiscover();
      const tools = result.server.listTools();
      expect(tools).toHaveLength(0);
      expect(typeof result.handlers.POST).toBe('function');
      expect(typeof result.handlers.GET).toBe('function');
    } finally {
      cwdSpy.mockRestore();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
