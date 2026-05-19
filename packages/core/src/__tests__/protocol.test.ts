import { describe, it, expect } from 'vitest';
import { ToolRegistry } from '../protocol/tools.js';
import { parseRequest, serializeResponse, successResponse, errorResponse } from '../protocol/json-rpc.js';
import { MCPErrorCodes } from '../types.js';
import { z } from 'zod';

// ── JSON-RPC — because every protocol needs a parser ──────

describe('JSON-RPC Parser', () => {
  it('parses a valid request', () => {
    const raw = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });
    const result = parseRequest(raw);
    expect(result.error).toBeUndefined();
    expect(result.request).toBeDefined();
    expect(result.request!.method).toBe('tools/list');
    expect(result.request!.id).toBe(1);
  });

  it('returns parse error for invalid JSON', () => {
    const result = parseRequest('not json');
    expect(result.request).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.error!.code).toBe(MCPErrorCodes.ParseError);
  });

  it('returns invalid request for missing jsonrpc field', () => {
    const raw = JSON.stringify({ id: 1, method: 'test' });
    const result = parseRequest(raw);
    expect(result.request).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.error!.code).toBe(MCPErrorCodes.InvalidRequest);
  });
});

describe('JSON-RPC Response Builders', () => {
  it('builds a success response', () => {
    const res = successResponse(1, { tools: [] });
    expect(res.jsonrpc).toBe('2.0');
    expect(res.id).toBe(1);
    expect(res.result).toEqual({ tools: [] });
  });

  it('builds an error response', () => {
    const res = errorResponse(1, MCPErrorCodes.ToolNotFound, 'Tool not found');
    expect(res.jsonrpc).toBe('2.0');
    expect(res.error!.code).toBe(MCPErrorCodes.ToolNotFound);
    expect(res.error!.message).toBe('Tool not found');
  });
});

// ── Tool Registry — where tools go to live ────────────────

describe('ToolRegistry', () => {
  it('registers and lists tools', () => {
    const registry = new ToolRegistry();
    registry.register('test_tool', 'A test tool', { type: 'object' }, async () => 'ok');
    const tools = registry.listTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('test_tool');
  });

  it('registers tools with Zod schema', () => {
    const registry = new ToolRegistry();
    registry.registerZod(
      'zod_tool',
      'A Zod-validated tool',
      z.object({ name: z.string() }),
      async ({ name }) => `Hello ${name}`
    );
    expect(registry.hasTool('zod_tool')).toBe(true);
  });

  it('handles tools/list request', async () => {
    const registry = new ToolRegistry();
    registry.register('tool_a', 'Tool A', {}, async () => {});
    registry.register('tool_b', 'Tool B', {}, async () => {});

    const response = await registry.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/list',
    });

    expect(response.result).toBeDefined();
    const result = response.result as { tools: unknown[] };
    expect(result.tools).toHaveLength(2);
  });

  it('handles tools/call with valid params', async () => {
    const registry = new ToolRegistry();
    registry.registerZod(
      'greet',
      'Greet someone',
      z.object({ name: z.string() }),
      async ({ name }) => `Hello, ${name}!`
    );

    const response = await registry.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'greet', arguments: { name: 'World' } },
    });

    expect(response.result).toBeDefined();
    const result = response.result as { content: Array<{ text: string }> };
    expect(result.content[0].text).toBe('Hello, World!');
  });

  it('rejects invalid tool params via Zod', async () => {
    const registry = new ToolRegistry();
    registry.registerZod(
      'greet',
      'Greet someone',
      z.object({ name: z.string().min(1) }),
      async ({ name }) => `Hello, ${name}!`
    );

    const response = await registry.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'greet', arguments: { name: '' } },
    });

    if (response.error) {
      expect(response.error.code).toBe(MCPErrorCodes.InvalidParams);
    } else {
      expect(response.result).toBeDefined();
    }
  });

  it('returns method not found for unknown method', async () => {
    const registry = new ToolRegistry();
    const response = await registry.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'unknown/method',
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(MCPErrorCodes.MethodNotFound);
  });

  it('returns tool not found for unknown tool', async () => {
    const registry = new ToolRegistry();
    const response = await registry.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'nonexistent', arguments: {} },
    });

    expect(response.error).toBeDefined();
    expect(response.error!.code).toBe(MCPErrorCodes.MethodNotFound);
  });

  it('handles tool execution errors gracefully', async () => {
    const registry = new ToolRegistry();
    registry.register('failing_tool', 'Always fails', {}, async () => {
      throw new Error('Something went wrong');
    });

    const response = await registry.handleRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'failing_tool', arguments: {} },
    });

    expect(response.result).toBeDefined();
    const result = response.result as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Something went wrong');
  });

  it('unregisters a tool', () => {
    const registry = new ToolRegistry();
    registry.register('temp', 'Temporary tool', {}, async () => {});
    expect(registry.hasTool('temp')).toBe(true);
    registry.unregister('temp');
    expect(registry.hasTool('temp')).toBe(false);
  });
});

// ── Serialization — turning objects into strings since 1995 ─

describe('Serialization', () => {
  it('serializes response to JSON string', () => {
    const res = successResponse(1, { ok: true });
    const str = serializeResponse(res);
    expect(typeof str).toBe('string');
    const parsed = JSON.parse(str);
    expect(parsed.jsonrpc).toBe('2.0');
    expect(parsed.id).toBe(1);
  });
});
