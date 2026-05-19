/**
 * @webmcp1/core - The foundation of the WebMCP protocol.
 *
 * The boring-but-essential brain of the operation.
 * Makes websites "Agent-Ready" via the Model Context Protocol.
 * Zero vibes. One hundred percent functions that do stuff.
 */

// ── things we expose so you can actually use this ──────────
export { ToolRegistry } from './protocol/tools.js';
export {
  parseRequest,
  successResponse,
  errorResponse,
  methodNotFound,
  internalError,
  serializeResponse,
} from './protocol/json-rpc.js';

// ── shiny decorator stuff ──────────────────────────────────
export { MCP, getToolMetadata } from './decorators.js';
export type { ToolDecoratorOptions, ToolDecoratorMetadata } from './decorators.js';

// ── how data actually travels ──────────────────────────────
export { WebSocketTransport } from './transport/websocket.js';
export type { WebSocketServerHandle } from './transport/websocket.js';
export { HTTPTransport } from './transport/http.js';

// ── "hey agents, i exist" auto-discovery ───────────────────
export { DiscoveryManifest } from './discovery/well-known.js';

// ── keeping the bots in check ──────────────────────────────
export { RateLimiter } from './security/rate-limiter.js';
export { InputValidator } from './security/validator.js';

// ── TypeScript's finest exports ────────────────────────────
export type {
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCMessage,
  MCPMethod,
  ToolDefinition,
  ToolResult,
  ToolHandler,
  ToolExecutionContext,
  RegisteredTool,
  MCPEndpoint,
  WellKnownMCPAuth,
  WellKnownMCPCapabilities,
  WellKnownMCPManifest,
  MCPServerConfig,
  MCPServerEvents,
  MCPServerEventName,
} from './types.js';

export { MCPErrorCodes } from './types.js';

// ── the main attraction: MCP Server Builder ────────────────

import { ToolRegistry } from './protocol/tools.js';
import { WebSocketTransport } from './transport/websocket.js';
import type { WebSocketServerHandle } from './transport/websocket.js';
import { HTTPTransport } from './transport/http.js';
import { DiscoveryManifest } from './discovery/well-known.js';
import { RateLimiter } from './security/rate-limiter.js';
import { InputValidator } from './security/validator.js';
import { getToolMetadata } from './decorators.js';
import type { MCPServerConfig, ToolExecutionContext, ToolHandler, ToolDefinition } from './types.js';
import { z } from 'zod';

export { z };

/**
 * The main MCP Server builder — a fluent API for creating MCP-compatible servers.
 *
 * Think of it as the conductor of your AI-agent orchestra.
 *
 * @example
 * ```ts
 * import { MCPServer } from '@webmcp1/core'
 * import { z } from '@webmcp1/core'
 *
 * const server = new MCPServer({
 *   name: 'my-site',
 *   version: '1.0.0',
 *   description: 'My awesome MCP server',
 *   transport: { type: 'http', path: '/api/mcp' }
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
 * // Generate the .well-known/mcp.json manifest
 * const manifest = server.discovery()
 * ```
 */
export class MCPServer {
  public readonly registry: ToolRegistry;
  public readonly config: MCPServerConfig;
  public readonly http: HTTPTransport;
  public readonly ws: WebSocketTransport;
  public readonly discovery: DiscoveryManifest;
  public readonly rateLimiter: RateLimiter;

  constructor(config: MCPServerConfig) {
    this.config = config;
    this.registry = new ToolRegistry();
    this.rateLimiter = new RateLimiter(
      config.security?.rateLimit?.maxRequests ?? 100,
      config.security?.rateLimit?.windowMs ?? 60000
    );
    this.http = new HTTPTransport(this.registry, config);
    this.ws = new WebSocketTransport(this.registry, config);
    this.discovery = new DiscoveryManifest(this.registry, config);
  }

  /**
   * Register a tool with Zod schema validation.
   *
   * This is the main way to tell the world what your site can do.
   *
   * @example
   * ```ts
   * server.tool(
   *   'get_weather',
   *   'Get the weather for a city',
   *   z.object({ city: z.string() }),
   *   async ({ city }) => {
   *     const data = await fetchWeather(city)
   *     return data
   *   }
   * )
   * ```
   */
  tool<TInput extends z.ZodTypeAny>(
    name: string,
    description: string,
    schema: TInput,
    handler: ToolHandler<z.infer<TInput>>
  ): this {
    this.registry.registerZod(name, description, schema, handler);
    return this;
  }

  /**
   * Register a raw tool without Zod validation.
   *
   * For when you want to live dangerously. No schema, no safety net.
   */
  toolRaw<TInput = Record<string, unknown>>(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler<TInput>
  ): this {
    this.registry.register(name, description, inputSchema, handler as ToolHandler);
    return this;
  }

  /**
   * Get the .well-known/mcp.json manifest as a JSON string
   *
   * This is the file AI agents look for to discover your MCP capabilities.
   */
  getDiscoveryManifest(): string {
    return this.discovery.generateJSON();
  }

  /**
   * List all registered tools with their definitions and schemas.
   */
  listTools(): ToolDefinition[] {
    return this.registry.listTools();
  }

  /**
   * Create a context for tool execution (sets agentId, auth status)
   *
   * Basically tells the tool who's calling and whether they're allowed in.
   */
  createContext(overrides?: Partial<ToolExecutionContext>): ToolExecutionContext {
    return {
      agentId: overrides?.agentId,
      authenticated: overrides?.authenticated ?? false,
      metadata: overrides?.metadata,
    };
  }

  /**
   * Register all @MCP.Tool() decorated methods from a service instance.
   *
   * This is where the magic happens. Scans your class for @MCP.Tool() decorators,
   * finds all the methods, and registers them as MCP tools automatically.
   * Methods stay bound to the instance so `this` still works. We're not monsters.
   *
   * @example
   * ```ts
   * class StoreService {
   *   @MCP.Tool({
   *     name: 'purchase_item',
   *     description: 'Purchase an item',
   *     schema: z.object({ itemId: z.string() })
   *   })
   *   async purchaseItem(params: { itemId: string }) {
   *     return db.orders.create(params)
   *   }
   * }
   *
   * const server = new MCPServer({ ... })
   * server.registerService(new StoreService())
   * ```
   */
  registerService(instance: object): this {
    const prototype = Object.getPrototypeOf(instance);
    const metadata = getToolMetadata(prototype);

    for (const tool of metadata) {
      const method = (instance as any)[tool.propertyKey];
      if (typeof method !== 'function') {
        console.warn(
          `[MCP] Tool '${tool.name}': method '${String(tool.propertyKey)}' not found on instance`
        );
        continue;
      }

      // gotta keep `this` pointing at the right thing. it's 2025, we know this by now.
      const boundHandler: ToolHandler = async (params, context) => {
        return method.call(instance, params, context);
      };

      this.registry.registerZod(tool.name, tool.description, tool.schema, boundHandler);
    }

    return this;
  }

  /**
   * Start a WebSocket MCP server on the specified port.
   *
   * Requires the `ws` package to be installed. If you haven't installed it,
   * this will yell at you at runtime instead of compile time. Sorry.
   *
   * @example
   * ```ts
   * const server = new MCPServer({ ... })
   * const handle = await server.listenWebSocket()
   * console.log(`MCP WebSocket server running on port ${handle.server.address().port}`)
   * ```
   */
  async listenWebSocket(port?: number): Promise<WebSocketServerHandle> {
    if (port !== undefined) {
      this.config.transport.port = port;
    }
    return this.ws.listen();
  }
}
