import { MCP, z } from '@webmcp1/core';
import { PRODUCTS } from './products';

// ── where orders live until the page refreshes ────────────
// yes it's in-memory. no we don't care. it's a demo.

interface Order {
  id: string;
  items: Array<{ productId: string; quantity: number }>;
  total: number;
  timestamp: number;
}
const orders: Order[] = [];

// ── Decorated Service Class ───────────────────────────────
// Every method with @MCP.Tool() becomes an MCP tool automatically.
// No manual registration. No boilerplate. Just vibes.

export class StoreService {
  /**
   * Search Products — Let AI agents search the catalog
   */
  @MCP.Tool({
    name: 'search_products',
    description:
      'Search for products in the store catalog. Returns matching products with prices and availability.',
    schema: z.object({
      query: z
        .string()
        .optional()
        .describe('Search query to filter products by name or category'),
      category: z
        .enum(['clothing', 'shoes', 'electronics', 'all'])
        .optional()
        .describe('Filter by product category'),
      maxPrice: z.number().optional().describe('Maximum price filter'),
      inStockOnly: z
        .boolean()
        .optional()
        .default(false)
        .describe('Only return products that are in stock'),
    }),
  })
  async searchProducts(params: {
    query?: string;
    category?: string;
    maxPrice?: number;
    inStockOnly?: boolean;
  }) {
    let results = [...PRODUCTS];

    if (params.query) {
      const q = params.query.toLowerCase();
      results = results.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q)
      );
    }

    if (params.category && params.category !== 'all') {
      results = results.filter((p) => p.category === params.category);
    }

    if (params.maxPrice !== undefined) {
      results = results.filter((p) => p.price <= params.maxPrice!);
    }

    if (params.inStockOnly) {
      results = results.filter((p) => p.inStock);
    }

    return {
      products: results,
      count: results.length,
    };
  }

  /**
   * Get Product Details — Fetch a single product by ID
   */
  @MCP.Tool({
    name: 'get_product',
    description: 'Get detailed information about a specific product by its ID.',
    schema: z.object({
      productId: z.string().describe('The unique identifier of the product'),
    }),
  })
  async getProduct(params: { productId: string }) {
    const product = PRODUCTS.find((p) => p.id === params.productId);
    if (!product) {
      throw new Error(`Product not found: ${params.productId}`);
    }
    return product;
  }

  /**
   * Purchase Items — Let AI agents spend money on your behalf
   *
   * This is where the magic (and the revenue) happens.
   */
  @MCP.Tool({
    name: 'purchase_item',
    description:
      'Purchase one or more items from the store. Creates an order and returns the order confirmation.',
    schema: z.object({
      itemId: z.string().describe('The ID of the product to purchase'),
      quantity: z
        .number()
        .int()
        .min(1)
        .max(10)
        .default(1)
        .describe('Quantity to purchase (1-10)'),
      shippingAddress: z
        .string()
        .optional()
        .describe('Shipping address for physical goods'),
    }),
  })
  async purchaseItem(params: {
    itemId: string;
    quantity: number;
    shippingAddress?: string;
  }) {
    const product = PRODUCTS.find((p) => p.id === params.itemId);
    if (!product) {
      throw new Error(`Product not found: ${params.itemId}`);
    }

    if (!product.inStock) {
      throw new Error(
        `Product '${product.name}' is currently out of stock`
      );
    }

    const total = product.price * params.quantity;
    const orderId = `MCP-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    orders.push({
      id: orderId,
      items: [{ productId: params.itemId, quantity: params.quantity }],
      total,
      timestamp: Date.now(),
    });

    return {
      success: true,
      orderId,
      product: product.name,
      quantity: params.quantity,
      total: `$${total.toFixed(2)}`,
      message: `Successfully purchased ${params.quantity}x ${product.name}. Order #${orderId} confirmed.`,
      estimatedDelivery: '2-3 business days',
    };
  }

  /**
   * Get Order Status — Find out what's happening with your stuff
   */
  @MCP.Tool({
    name: 'get_order_status',
    description: 'Get the status of a previous order by order ID.',
    schema: z.object({
      orderId: z
        .string()
        .describe('The order ID to check (e.g., MCP-XXXXXX)'),
    }),
  })
  async getOrderStatus(params: { orderId: string }) {
    const order = orders.find((o) => o.id === params.orderId);
    if (!order) {
      throw new Error(`Order not found: ${params.orderId}`);
    }
    return {
      orderId: order.id,
      total: `$${order.total.toFixed(2)}`,
      status: 'confirmed',
      timestamp: new Date(order.timestamp).toISOString(),
      items: order.items.length,
    };
  }

  /**
   * Store Info — What is this place and what can you do here?
   */
  @MCP.Tool({
    name: 'get_store_info',
    description:
      'Get information about the store, including available categories and capabilities.',
    schema: z.object({}),
  })
  async getStoreInfo() {
    return {
      name: 'WebMCP Demo Store',
      version: '1.0.0',
      description: 'AI-ready e-commerce store powered by WebMCP',
      categories: ['clothing', 'shoes', 'electronics'],
      tools: [
        'search_products',
        'get_product',
        'purchase_item',
        'get_order_status',
        'get_store_info',
      ],
      protocol: 'Model Context Protocol (MCP)',
      transactionSpeed: '0.2 seconds',
      scrapingRequired: false,
    };
  }
}
