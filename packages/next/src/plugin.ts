import type { NextConfig } from 'next';
import { MCPServer } from '@webmcp1/core';

/**
 * WebMCP Next.js Configuration Plugin.
 *
 * Automatically generates the `.well-known/mcp.json` file at build time
 * and adds headers so agents know you're MCP-ready.
 *
 * Just wrap your next.config and forget about it.
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withWebMCP } from '@webmcp1/next/plugin'
 *
 * export default withWebMCP({
 *   name: 'My Store',
 *   description: 'AI-ready e-commerce',
 *   tools: [
 *     { name: 'purchase_item', description: 'Buy an item' }
 *   ]
 * })({
 *   // your regular Next.js config
 * })
 * ```
 */
export interface WebMCPPluginOptions {
  name: string;
  description: string;
  endpoint?: string;
  tools?: Array<{ name: string; description: string }>;
}

export function withWebMCP(options: WebMCPPluginOptions) {
  return (nextConfig: NextConfig): NextConfig => {
    return {
      ...nextConfig,

      async headers() {
        const existingHeaders = (await nextConfig.headers?.()) ?? [];

        // add MCP headers to every route so agents know you're out here
        existingHeaders.push({
          source: '/:path*',
          headers: [
            {
              key: 'x-mcp-version',
              value: '1.0',
            },
            {
              key: 'x-mcp-endpoint',
              value: options.endpoint ?? '/api/mcp',
            },
          ],
        });

        return existingHeaders;
      },

      // redirect /.well-known/mcp.json to your actual MCP endpoint
      async rewrites() {
        const existingRewrites = (await nextConfig.rewrites?.()) ?? [];

        const mcpRewrites = {
          source: '/.well-known/mcp.json',
          destination: options.endpoint ?? '/api/mcp',
        };

        if (Array.isArray(existingRewrites)) {
          return [...existingRewrites, mcpRewrites];
        }

        return {
          ...existingRewrites,
          beforeFiles: [...(existingRewrites.beforeFiles ?? []), mcpRewrites],
        };
      },

      webpack(config: any, context: any) {
        // generate the manifest during production builds so it's there at runtime
        if (context.isServer && context.nextBuildPhase === 'phase-production-build') {
          const server = new MCPServer({
            name: options.name,
            version: '1.0.0',
            description: options.description,
            transport: {
              type: 'http',
              path: options.endpoint ?? '/api/mcp',
            },
          });

          // pre-register tools so the manifest knows about them
          if (options.tools) {
            for (const tool of options.tools) {
              server.toolRaw(tool.name, tool.description, {}, async () => ({}));
            }
          }

          const manifest = server.getDiscoveryManifest();
          process.env.__WEBMCP_MANIFEST = manifest;
        }

        if (nextConfig.webpack && typeof nextConfig.webpack === 'function') {
          return nextConfig.webpack(config, context);
        }

        return config;
      },
    };
  };
}
