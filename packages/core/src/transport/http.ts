import { ToolRegistry } from '../protocol/tools.js';
import { parseRequest, serializeResponse, successResponse } from '../protocol/json-rpc.js';
import { ToolExecutionContext, ToolResult, MCPServerConfig } from '../types.js';

/**
 * HTTP transport handler for MCP.
 *
 * Handles HTTP POST requests (the boring workhorse of the web)
 * and SSE connections for when you want to push data without being asked.
 */
export class HTTPTransport {
  private registry: ToolRegistry;
  private config: MCPServerConfig;

  constructor(registry: ToolRegistry, config: MCPServerConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Handle a standard HTTP POST request to the MCP endpoint.
   *
   * Works with Next.js App Router, Express, plain Node servers, carrier pigeons —
   * anything that can speak HTTP. You pass in the body, we do the rest.
   */
  async handleHTTPPost(
    body: string | Record<string, unknown>,
    metadata?: { agentId?: string; headers?: Record<string, string> }
  ): Promise<{ status: number; body: string; headers?: Record<string, string> }> {
    const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
    const { request, error } = parseRequest(rawBody);

    if (error) {
      return {
        status: 400,
        body: serializeResponse(error),
        headers: { 'content-type': 'application/json' },
      };
    }

    if (request) {
      const context: ToolExecutionContext = {
        agentId: metadata?.agentId,
        authenticated: false,
        metadata: metadata?.headers,
      };

      const response = await this.registry.handleRequest(request, context);
      return {
        status: 200,
        body: serializeResponse(response),
        headers: { 'content-type': 'application/json' },
      };
    }

    return {
      status: 400,
      body: serializeResponse({
        jsonrpc: '2.0',
        id: null,
        error: { code: -32600, message: 'Invalid request' },
      }),
      headers: { 'content-type': 'application/json' },
    };
  }

  /**
   * Handle an SSE (Server-Sent Events) connection for streaming responses.
   *
   * For when you want to stream data to an agent over time.
   * Returns the initial headers and a close function so you can end it when
   * you're done talking.
   */
  handleSSEConnection(
    onData: (data: string) => void
  ): { headers: Record<string, string>; close: () => void } {
    let closed = false;

    const send = (data: string) => {
      if (!closed) {
        onData(data);
      }
    };

    return {
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      },
      close: () => {
        closed = true;
      },
    };
  }

  /**
   * Format a response as SSE data
   *
   * Takes your data and wraps it in SSE formatting so browsers and agents
   * can stream it properly.
   */
  formatSSEMessage(data: unknown, event?: string): string {
    const lines = [`data: ${JSON.stringify(data)}`];
    if (event) lines.unshift(`event: ${event}`);
    return lines.join('\n') + '\n\n';
  }
}
