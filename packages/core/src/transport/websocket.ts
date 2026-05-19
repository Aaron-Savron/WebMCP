import { ToolRegistry } from '../protocol/tools.js';
import { parseRequest, serializeResponse } from '../protocol/json-rpc.js';
import { ToolExecutionContext, MCPServerEvents, MCPServerConfig } from '../types.js';

/**
 * Lazy-load the 'ws' module.
 *
 * We do this instead of a top-level import so that environments without 'ws'
 * (Bun, Deno, people who forgot to npm install) don't crash at import time.
 * You'll only get the error if you actually try to listen() on WebSocket.
 * That's called "graceful degradation" and it sounds way better than "lazy hack".
 */
async function loadWS() {
  try {
    return await import('ws');
  } catch {
    throw new Error(
      'WebSocket transport requires the "ws" package. Install it with: npm install ws'
    );
  }
}

/**
 * Result of creating a WebSocket server.
 *
 * Contains the server, a close function, and info about who's connected.
 */
export interface WebSocketServerHandle {
  /** The underlying WebSocketServer instance */
  server: any;
  /** Close the server and disconnect all clients */
  close: () => Promise<void>;
  /** Number of currently connected clients */
  connectedClients: number;
  /** List of connected client IDs */
  clientIds: string[];
}

/**
 * MCP WebSocket transport handler.
 *
 * Manages real-time bidirectional chat between AI agents and your server.
 * It's like HTTP but with feelings. And persistent connections.
 *
 * @example
 * ```ts
 * import { MCPServer, createWebSocketServer } from '@webmcp1/core'
 *
 * const server = new MCPServer({
 *   name: 'my-app',
 *   description: 'MCP server',
 *   transport: { type: 'ws', port: 8080, path: '/mcp' },
 * })
 *
 * const ws = await createWebSocketServer(server.registry, server.config)
 * ```
 */
export class WebSocketTransport {
  private registry: ToolRegistry;
  private config: MCPServerConfig;
  private clients: Map<string, any> = new Map();
  private clientIdCounter = 0;
  private eventListeners: Map<string, Set<(...args: any[]) => void>> = new Map();
  private _server: any = null;

  constructor(registry: ToolRegistry, config: MCPServerConfig) {
    this.registry = registry;
    this.config = config;
  }

  /**
   * Create and start a WebSocket server.
   *
   * Requires the `ws` package to be installed. If it's not, you'll get
   * a very unhelpful error at this point. Sorry about that.
   *
   * @returns A handle to the running WebSocket server
   *
   * @example
   * ```ts
   * const ws = await transport.listen()
   * console.log(`WebSocket MCP server running on port ${ws.server.address().port}`)
   * ```
   */
  async listen(): Promise<WebSocketServerHandle> {
    const wsModule = await loadWS();
    const { WebSocketServer } = wsModule;

    const port = this.config.transport.port ?? 8080;
    const path = this.config.transport.path ?? '/mcp';

    const wss = new WebSocketServer({
      port,
      path,
      maxPayload: 1024 * 1024, // 1MB max — no one needs to send more than that
    });

    this._server = wss;

    wss.on('connection', (ws: any, req: any) => {
      const clientId = `ws_${++this.clientIdCounter}_${Date.now()}`;
      this.clients.set(clientId, ws);

      const agentId =
        req.headers?.['x-agent-id'] ?? req.headers?.['user-agent'] ?? clientId;
      this.emit('client:connected', clientId);

      ws.on('message', async (raw: Buffer | string) => {
        const data = typeof raw === 'string' ? raw : raw.toString('utf-8');

        try {
          const { request, error } = parseRequest(data);

          if (error) {
            ws.send(serializeResponse(error));
            return;
          }

          if (request) {
            const startTime = Date.now();
            const context: ToolExecutionContext = {
              agentId: String(agentId),
              authenticated: this.config.authentication?.type === 'none' || false,
            };

            const response = await this.registry.handleRequest(request, context);
            const duration = Date.now() - startTime;

            if (request.method === 'tools/call') {
              this.emit(
                'tool:called',
                (request.params as any)?.name as string ?? 'unknown',
                request.params,
                duration
              );
            }

            ws.send(serializeResponse(response));
          }
        } catch (err) {
          const error = err instanceof Error ? err : new Error(String(err));
          this.emit('error', error);

          // send SOMETHING back so the client isn't hanging forever
          ws.send(
            serializeResponse({
              jsonrpc: '2.0',
              id: null,
              error: { code: -32603, message: 'Internal server error' },
            })
          );
        }
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.emit('client:disconnected', clientId);
      });

      ws.on('error', (err: Error) => {
        this.clients.delete(clientId);
        this.emit('error', err);
      });

      // say hi to new friends
      ws.send(
        serializeResponse({
          jsonrpc: '2.0',
          id: null,
          result: {
            content: [
              {
                type: 'text',
                text: `Connected to ${this.config.name} MCP Server v${this.config.version}`,
              },
            ],
          },
        })
      );
    });

    wss.on('error', (err: Error) => {
      this.emit('error', err);
    });

    return {
      server: wss,
      connectedClients: this.connectedClients,
      clientIds: this.clientIds,
      close: () => this.close(),
    };
  }

  /**
   * Close the WebSocket server and disconnect all clients.
   *
   * Poliely tells everyone to leave, then shuts the doors.
   */
  async close(): Promise<void> {
    if (this._server) {
      for (const ws of this.clients.values()) {
        try {
          ws.close(1001, 'Server shutting down');
        } catch {
          // client probably already left, no big deal
        }
      }
      this.clients.clear();

      return new Promise<void>((resolve) => {
        this._server.close(() => {
          this._server = null;
          resolve();
        });
      });
    }
  }

  /**
   * Broadcast a message to all connected clients
   *
   * Like a group chat but for AI agents. Use wisely.
   */
  broadcast(message: string): void {
    for (const ws of this.clients.values()) {
      try {
        if (ws.readyState === 1) {
          ws.send(message);
        }
      } catch {
        // they disconnected, skip 'em
      }
    }
  }

  /**
   * How many AI agents are talking to us right now?
   */
  get connectedClients(): number {
    return this.clients.size;
  }

  /**
   * List of connected client IDs, so you can yell at them by name
   */
  get clientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Is the server actually running or did we just pretend?
   */
  get isRunning(): boolean {
    return this._server !== null;
  }

  // ── Event System — for when you need to know what's happening ──

  on<K extends keyof MCPServerEvents>(event: K, listener: MCPServerEvents[K]): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener as any);
  }

  off<K extends keyof MCPServerEvents>(event: K, listener: MCPServerEvents[K]): void {
    this.eventListeners.get(event)?.delete(listener as any);
  }

  private emit<K extends keyof MCPServerEvents>(
    event: K,
    ...args: Parameters<MCPServerEvents[K]>
  ): void {
    this.eventListeners.get(event)?.forEach((listener) => {
      try {
        (listener as any)(...args);
      } catch {
        // one bad listener shouldn't ruin it for everyone
      }
    });
  }
}
