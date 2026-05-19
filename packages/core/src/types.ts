import { z } from 'zod';

// ── JSON-RPC 2.0 — the language agents speak ──────────────

export interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JSONRPCError;
}

export interface JSONRPCError {
  code: number;
  message: string;
  data?: unknown;
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse;

// ── things you can ask the server to do ────────────────────

export type MCPMethod =
  | 'tools/list'
  | 'tools/call'
  | 'tools/subscribe'
  | 'resources/list'
  | 'resources/read'
  | 'resources/subscribe'
  | 'prompts/list'
  | 'prompts/get';

// ── what a tool looks like on paper ────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    uri?: string;
    mimeType?: string;
    data?: string;
  }>;
  isError?: boolean;
}

// ── the "hey agents, i exist" manifest ─────────────────────

export interface MCPEndpoint {
  ws?: string;
  http?: string;
  sse?: string;
}

export interface WellKnownMCPAuth {
  type: 'none' | 'api-key' | 'oauth2' | 'bearer-token';
  headerName?: string;
  tokenUrl?: string;
  authorizationUrl?: string;
  scopes?: string[];
}

export interface WellKnownMCPCapabilities {
  tools?: boolean;
  resources?: boolean;
  prompts?: boolean;
  streaming?: boolean;
  subscriptions?: boolean;
}

export interface WellKnownMCPManifest {
  mcp: {
    version: string;
    endpoints: MCPEndpoint;
    authentication: WellKnownMCPAuth;
    capabilities: WellKnownMCPCapabilities;
    description: string;
    tools?: Array<{
      name: string;
      description: string;
    }>;
  };
}

// ── the config object you pass to new MCPServer() ──────────

export interface MCPServerConfig {
  name: string;
  version: string;
  description: string;
  transport: {
    type: 'ws' | 'http' | 'sse';
    port?: number;
    path?: string;
  };
  authentication?: WellKnownMCPAuth;
  security?: {
    rateLimit?: {
      maxRequests: number;
      windowMs: number;
    };
    maxToolCallDuration?: number;
    allowedOrigins?: string[];
  };
}

// ── your tool handler — the function that actually does work ─

export type ToolHandler<TInput = Record<string, unknown>, TOutput = unknown> = (
  params: TInput,
  context?: ToolExecutionContext
) => Promise<TOutput> | TOutput;

export interface ToolExecutionContext {
  agentId?: string;
  authenticated: boolean;
  metadata?: Record<string, unknown>;
}

// ── the thing that keeps track of all your tools ───────────

export interface RegisteredTool<TInput = Record<string, unknown>, TOutput = unknown> {
  definition: ToolDefinition;
  handler: ToolHandler<TInput, TOutput>;
  zodSchema?: z.ZodType<TInput>;
}

// ── error codes because things break ───────────────────────

export const MCPErrorCodes = {
  ParseError: -32700,
  InvalidRequest: -32600,
  MethodNotFound: -32601,
  InvalidParams: -32602,
  InternalError: -32603,
  ToolError: -32000,
  ToolNotFound: -32001,
  ToolExecutionError: -32002,
  RateLimited: -32050,
  Unauthorized: -32051,
} as const;

// ── events so you can hook into things ─────────────────────

export interface MCPServerEvents {
  'tool:called': (tool: string, params: unknown, duration: number) => void;
  'tool:error': (tool: string, error: Error) => void;
  'client:connected': (clientId: string) => void;
  'client:disconnected': (clientId: string) => void;
  'error': (error: Error) => void;
}

export type MCPServerEventName = keyof MCPServerEvents;
