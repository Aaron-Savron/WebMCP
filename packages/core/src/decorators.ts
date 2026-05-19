/**
 * WebMCP Decorators — Declarative MCP tool registration.
 *
 * Slap @MCP.Tool() on a class method and it magically becomes an MCP tool.
 * No boilerplate. No manual registration. Just vibes and decorators.
 *
 * @example
 * ```ts
 * import { MCP, z } from '@webmcp1/core'
 *
 * class StoreService {
 *   @MCP.Tool({
 *     name: 'purchase_item',
 *     description: 'Purchase an item by ID',
 *     schema: z.object({ itemId: z.string(), quantity: z.number() })
 *   })
 *   async purchaseItem({ itemId, quantity }: { itemId: string; quantity: number }) {
 *     return { success: true, orderId: 'abc-123' }
 *   }
 * }
 * ```
 */

import { z } from 'zod';
import type { ToolHandler } from './types.js';

// ── where we secretly store all tool metadata ─────────────
// WeakMap keyed by class prototype → array of tool metadata
// Why WeakMap? So if your class gets garbage collected, the metadata
// goes with it. No memory leaks on our watch.

interface ToolDecoratorMetadata {
  name: string;
  description: string;
  schema: z.ZodTypeAny;
  propertyKey: string | symbol;
}

const toolMetadataMap = new WeakMap<object, ToolDecoratorMetadata[]>();

/**
 * Get stored tool metadata for a given prototype.
 * @internal — you probably don't need this unless you're doing something fancy
 */
export function getToolMetadata(prototype: object): ToolDecoratorMetadata[] {
  return toolMetadataMap.get(prototype) ?? [];
}

// ── @MCP.Tool() Decorator — the star of the show ──────────

export interface ToolDecoratorOptions<TInput extends z.ZodTypeAny = z.ZodTypeAny> {
  /** The MCP tool name (e.g., 'purchase_item'). Auto-derived from method name if omitted. */
  name?: string;
  /** Human-readable description so AI agents know what this does */
  description: string;
  /** Zod schema for input validation. Yes, you need one. */
  schema: TInput;
}

/**
 * Convert a camelCase string to snake_case.
 * 'searchProducts' → 'search_products'
 * 'getStoreInfo' → 'get_store_info'
 * Science. Amazing.
 */
function camelToSnake(str: string): string {
  return str
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, '');
}

/**
 * Decorator that marks a class method as an MCP tool.
 *
 * This is the whole reason you're here. Slap this on a method,
 * give it a description and schema, and boom — instant MCP tool.
 *
 * @example
 * ```ts
 * class StoreService {
 *   @MCP.Tool({
 *     name: 'search_products',
 *     description: 'Search the product catalog',
 *     schema: z.object({ query: z.string().optional() })
 *   })
 *   async searchProducts(params: { query?: string }) {
 *     return db.products.findMany({ where: { name: { contains: params.query } } })
 *   }
 * }
 * ```
 */
export function Tool<TInput extends z.ZodTypeAny>(
  options: ToolDecoratorOptions<TInput>
): MethodDecorator {
  return function (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const prototype = target;

    // grab any existing metadata for this class
    const existing = toolMetadataMap.get(prototype) ?? [];

    // figure out the tool name: either explicit, or auto-convert the method name
    const toolName = options.name ?? camelToSnake(String(propertyKey));

    // store it so registerService() can find it later
    existing.push({
      name: toolName,
      description: options.description,
      schema: options.schema,
      propertyKey,
    });

    toolMetadataMap.set(prototype, existing);

    return descriptor;
  };
}

// ── namespace export — keeps things clean ─────────────────

/**
 * @MCP namespace — contains the @MCP.Tool() decorator.
 * Usage: @MCP.Tool({ ... }) on your class methods.
 */
export const MCP = {
  Tool,
} as const;

export type { ToolDecoratorMetadata };
