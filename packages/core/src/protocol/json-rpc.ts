import { JSONRPCRequest, JSONRPCResponse, JSONRPCError, MCPErrorCodes } from '../types.js';

/**
 * Parse and validate a JSON-RPC 2.0 request message.
 *
 * Takes a raw JSON string and either gives you a nice parsed request
 * or an error response if the agent sent garbage. No in-between.
 */
export function parseRequest(raw: string): { request?: JSONRPCRequest; error?: JSONRPCResponse } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      error: {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: MCPErrorCodes.ParseError,
          message: 'Parse error: Invalid JSON',
        },
      },
    };
  }

  const req = parsed as Partial<JSONRPCRequest>;

  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return {
      error: {
        jsonrpc: '2.0',
        id: (req.id ?? null) as string | number | null,
        error: {
          code: MCPErrorCodes.InvalidRequest,
          message: 'Invalid Request: Must set jsonrpc to "2.0" and provide a method string',
        },
      },
    };
  }

  return {
    request: {
      jsonrpc: '2.0',
      id: req.id ?? '',
      method: req.method,
      params: req.params ?? {},
    },
  };
}

/**
 * Create a success response
 *
 * Everything worked! Here's your data. Go tell your friends.
 */
export function successResponse(id: string | number | null, result: unknown): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

/**
 * Create an error response
 *
 * Something broke. Here's a code and a message so you (maybe) know why.
 */
export function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JSONRPCResponse {
  const error: JSONRPCError = { code, message };
  if (data !== undefined) error.data = data;

  return {
    jsonrpc: '2.0',
    id,
    error,
  };
}

/**
 * Create a method-not-found error
 *
 * "I'm sorry Dave, I'm afraid I can't find that method."
 */
export function methodNotFound(id: string | number | null, method: string): JSONRPCResponse {
  return errorResponse(id, MCPErrorCodes.MethodNotFound, `Method not found: ${method}`);
}

/**
 * Create an internal error
 *
 * It's not you, it's me. (it's actually also me, but shh)
 */
export function internalError(id: string | number | null, message: string): JSONRPCResponse {
  return errorResponse(id, MCPErrorCodes.InternalError, message);
}

/**
 * Serialize a response to JSON string
 *
 * Turns your response object back into a string so it can travel across the internet.
 * The final boss of the request-response lifecycle.
 */
export function serializeResponse(response: JSONRPCResponse): string {
  return JSON.stringify(response);
}
