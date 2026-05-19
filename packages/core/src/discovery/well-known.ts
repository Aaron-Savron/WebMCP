import {
  WellKnownMCPManifest,
  MCPEndpoint,
  WellKnownMCPAuth,
  WellKnownMCPCapabilities,
  MCPServerConfig,
} from '../types.js';
import { ToolRegistry } from '../protocol/tools.js';

/**
 * Generates the `.well-known/mcp.json` auto-discovery manifest.
 *
 * This is the file AI agents look for to discover your MCP capabilities.
 * Think of it as a "Hello, I exist and here's what I can do" sign for bots.
 *
 * Without this file, agents have to scrape your site like it's 2019.
 * With it, they just read a neat JSON file and know everything.
 */
export class DiscoveryManifest {
  private registry: ToolRegistry;
  private config: MCPServerConfig;

  constructor(registry: ToolRegistry, config: MCPServerConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Generate the full .well-known/mcp.json manifest
   *
   * Assembles all the info about your server into a neat little package
   * that agents can read and understand.
   */
  generate(): WellKnownMCPManifest {
    const endpoints: MCPEndpoint = {};

    switch (this.config.transport.type) {
      case 'ws':
        endpoints.ws = this.buildEndpointUrl('ws');
        break;
      case 'http':
        endpoints.http = this.buildEndpointUrl('http');
        break;
      case 'sse':
        endpoints.sse = this.buildEndpointUrl('http');
        endpoints.http = this.buildEndpointUrl('http');
        break;
    }

    const capabilities: WellKnownMCPCapabilities = {
      tools: this.registry.listTools().length > 0,
      resources: false,
      prompts: false,
      streaming: this.config.transport.type === 'ws' || this.config.transport.type === 'sse',
      subscriptions: this.config.transport.type === 'ws',
    };

    const manifest: WellKnownMCPManifest = {
      mcp: {
        version: this.config.version,
        endpoints,
        authentication: this.config.authentication ?? { type: 'none' },
        capabilities,
        description: this.config.description,
        tools: this.registry.listToolSummaries(),
      },
    };

    return manifest;
  }

  /**
   * Generate the manifest as a JSON string (pretty-printed)
   *
   * Because JSON.parse() on a one-liner is no one's idea of a good time.
   */
  generateJSON(): string {
    return JSON.stringify(this.generate(), null, 2);
  }

  /**
   * Generate a route handler response for serving the manifest
   *
   * Returns the body, content type, and cache headers so you can
   * serve this from any framework without thinking about it.
   */
  generateResponse(): {
    body: string;
    headers: Record<string, string>;
  } {
    return {
      body: this.generateJSON(),
      headers: {
        'content-type': 'application/json',
        'cache-control': 'public, max-age=3600',
        'access-control-allow-origin': '*',
      },
    };
  }

  /**
   * Build the full endpoint URL based on transport type
   *
   * Takes your transport config and builds a proper URL.
   * wss:// for WebSocket, https:// for HTTP. We got you.
   */
  private buildEndpointUrl(type: 'ws' | 'http'): string {
    const port = this.config.transport.port ? `:${this.config.transport.port}` : '';
    const path = this.config.transport.path ?? '/api/mcp';
    const protocol = type === 'ws' ? 'wss' : 'https';
    return `${protocol}://localhost${port}${path}`;
  }
}
