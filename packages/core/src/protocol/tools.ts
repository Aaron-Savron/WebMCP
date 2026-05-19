import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  RegisteredTool,
  ToolDefinition,
  ToolHandler,
  ToolResult,
  ToolExecutionContext,
  MCPErrorCodes,
} from '../types.js';
import { successResponse, errorResponse, methodNotFound } from './json-rpc.js';
import { InputValidator } from '../security/validator.js';
import type { JSONRPCRequest, JSONRPCResponse } from '../types.js';

/**
 * The MCP tool registry — the thing that remembers all your tools
 * and routes requests to the right handler.
 *
 * Think of it as a really fancy switchboard operator.
 */
export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  /**
   * Register a tool with the MCP server.
   *
   * This is the low-level version. Most people use registerZod() instead.
   *
   * @example
   * ```ts
   * registry.register({
   *   name: 'purchase_item',
   *   description: 'Purchase an item by ID',
   *   inputSchema: { type: 'object', properties: { itemId: { type: 'string' } } },
   *   handler: async ({ itemId }) => { ... }
   * })
   * ```
   */
  register<TInput = Record<string, unknown>, TOutput = unknown>(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    handler: ToolHandler<TInput, TOutput>,
    zodSchema?: z.ZodType<any>
  ): this {
    const definition: ToolDefinition = {
      name,
      description,
      inputSchema,
    };

    this.tools.set(name, {
      definition,
      handler: handler as ToolHandler,
      zodSchema,
    });

    return this;
  }

  /**
   * Register a tool using a Zod schema for type-safe input validation.
   *
   * This is the one you'll actually use. Give it a Zod schema, get type safety.
   * Unironically the best way to define tools.
   *
   * @example
   * ```ts
   * const PurchaseSchema = z.object({
   *   itemId: z.string(),
   *   quantity: z.number().min(1)
   * })
   *
   * registry.registerZod(
   *   'purchase_item',
   *   'Purchase an item by ID',
   *   PurchaseSchema,
   *   async ({ itemId, quantity }) => { ... }
   * )
   * ```
   */
  registerZod<TInput extends z.ZodTypeAny>(
    name: string,
    description: string,
    schema: TInput,
    handler: ToolHandler<z.infer<TInput>>
  ): this {
    // convert Zod schema to JSON Schema so AI agents know what params to pass
    // first check that the schema is actually a real Zod schema (you never know)
    if (schema && typeof schema === 'object' && '_def' in schema) {
      try {
        const jsonSchema = zodToJsonSchema(schema, {
          target: 'openApi3',
          $refStrategy: 'none',
        });
        // zodToJsonSchema wraps everything in a 'definitions' object for some reason.
        // we dig out the actual schema from definitions.root.
        const jsonSchemaRecord = jsonSchema as Record<string, unknown>;
        const definitions = jsonSchemaRecord['definitions'] as Record<string, unknown> | undefined;
        const inputSchema = definitions?.['root'] ?? jsonSchemaRecord;

        return this.register(
          name,
          description,
          inputSchema as Record<string, unknown>,
          handler,
          schema
        );
      } catch {
        // if zod-to-json-schema throws a tantrum, fall back to generic object schema
        return this.register(
          name,
          description,
          { type: 'object', properties: {} },
          handler,
          schema
        );
      }
    }

    // not a real Zod schema, just treat it as a plain object
    return this.register(
      name,
      description,
      { type: 'object', properties: {} },
      handler,
      schema
    );
  }

  /**
   * Get all registered tool definitions (for the tools/list endpoint)
   *
   * This is what AI agents call to see what you can do.
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /**
   * Get a brief overview of registered tools (for discovery manifest)
   *
   * A lighter version — just names and descriptions, no full schemas.
   */
  listToolSummaries(): Array<{ name: string; description: string }> {
    return Array.from(this.tools.entries()).map(([name, tool]) => ({
      name,
      description: tool.definition.description,
    }));
  }

  /**
   * Check if a tool is registered
   *
   * Quick peek before you try to call it.
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Remove a registered tool
   *
   * Sometimes you gotta break up with a tool. We don't judge.
   */
  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  /**
   * Handle an incoming MCP request and route it to the appropriate tool handler.
   *
   * This is the big switchboard. Figures out what the agent wants and makes it happen.
   * Returns a JSON-RPC response (error or success, depending on whether you wrote good code).
   */
  async handleRequest(
    request: JSONRPCRequest,
    context?: ToolExecutionContext
  ): Promise<JSONRPCResponse> {
    const { id, method, params } = request;

    switch (method) {
      case 'tools/list': {
        return successResponse(id, {
          tools: this.listTools(),
        });
      }

      case 'tools/call': {
        if (!params || typeof params !== 'object' || !('name' in params)) {
          return errorResponse(
            id,
            MCPErrorCodes.InvalidParams,
            'Missing required parameter: name'
          );
        }

        const toolName = (params as Record<string, unknown>).name as string;
        const toolParams = ((params as Record<string, unknown>).arguments ?? {}) as Record<string, unknown>;
        const tool = this.tools.get(toolName);

        if (!tool) {
          return methodNotFound(id, `tool:${toolName}`);
        }

        // sanitize everything before it touches your handler.
        // AI agents are cool but they can still pass garbage.
        const sanitizedParams = InputValidator.sanitizeParams(toolParams);

        // validate against Zod schema if one was provided
        if (tool.zodSchema) {
          const result = tool.zodSchema.safeParse(sanitizedParams);
          if (!result.success) {
            return errorResponse(
              id,
              MCPErrorCodes.InvalidParams,
              `Invalid parameters for tool '${toolName}'`,
              result.error.issues
            );
          }
          try {
            const output = await tool.handler(result.data, context);
            const toolResult: ToolResult = {
              content: [
                {
                  type: 'text',
                  text: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
                },
              ],
            };
            return successResponse(id, toolResult);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            const toolResult: ToolResult = {
              content: [{ type: 'text', text: `Error: ${errorMessage}` }],
              isError: true,
            };
            return successResponse(id, toolResult);
          }
        }

        // no Zod schema, just pass the sanitized raw params and hope for the best
        try {
          const output = await tool.handler(sanitizedParams, context);
          const toolResult: ToolResult = {
            content: [
              {
                type: 'text',
                text: typeof output === 'string' ? output : JSON.stringify(output, null, 2),
              },
            ],
          };
          return successResponse(id, toolResult);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const toolResult: ToolResult = {
            content: [{ type: 'text', text: `Error: ${errorMessage}` }],
            isError: true,
          };
          return successResponse(id, toolResult);
        }
      }

      default:
        return methodNotFound(id, method);
    }
  }
}
