import { describe, it, expect } from 'vitest';
import { MCPServer, z } from '../index.js';

describe('DiscoveryManifest', () => {
  it('generates valid .well-known/mcp.json manifest', () => {
    const server = new MCPServer({
      name: 'test-server',
      version: '1.0.0',
      description: 'Test MCP server',
      transport: { type: 'http', path: '/api/mcp' },
    });

    server.tool('test_tool', 'A test tool', z.object({}).describe('A test tool'), async () => 'ok');

    const manifest = server.getDiscoveryManifest();
    const parsed = JSON.parse(manifest);

    expect(parsed.mcp).toBeDefined();
    expect(parsed.mcp.version).toBe('1.0.0');
    expect(parsed.mcp.endpoints.http).toBeDefined();
    expect(parsed.mcp.capabilities.tools).toBe(true);
    expect(parsed.mcp.tools).toHaveLength(1);
    expect(parsed.mcp.tools[0].name).toBe('test_tool');
  });

  it('includes authentication config when provided', () => {
    const server = new MCPServer({
      name: 'secure-server',
      version: '1.0.0',
      description: 'Secure MCP server',
      transport: { type: 'ws', path: '/api/mcp' },
      authentication: {
        type: 'api-key',
        headerName: 'X-API-Key',
      },
    });

    const manifest = JSON.parse(server.getDiscoveryManifest());
    expect(manifest.mcp.authentication.type).toBe('api-key');
    expect(manifest.mcp.authentication.headerName).toBe('X-API-Key');
  });

  it('sets streaming capability based on transport type', () => {
    const wsServer = new MCPServer({
      name: 'ws-server',
      version: '1.0.0',
      description: 'WS server',
      transport: { type: 'ws' },
    });

    const httpServer = new MCPServer({
      name: 'http-server',
      version: '1.0.0',
      description: 'HTTP server',
      transport: { type: 'http' },
    });

    const wsManifest = JSON.parse(wsServer.getDiscoveryManifest());
    const httpManifest = JSON.parse(httpServer.getDiscoveryManifest());

    expect(wsManifest.mcp.capabilities.streaming).toBe(true);
    expect(wsManifest.mcp.capabilities.subscriptions).toBe(true);
    expect(httpManifest.mcp.capabilities.streaming).toBe(false);
    expect(httpManifest.mcp.capabilities.subscriptions).toBe(false);
  });

  it('generates correct response headers', () => {
    const server = new MCPServer({
      name: 'test',
      version: '1.0.0',
      description: 'Test',
      transport: { type: 'http' },
    });

    const { headers } = server.discovery.generateResponse();
    expect(headers['content-type']).toBe('application/json');
    expect(headers['cache-control']).toBe('public, max-age=3600');
    expect(headers['access-control-allow-origin']).toBe('*');
  });
});
