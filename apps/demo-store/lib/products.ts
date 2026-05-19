// ── The Product Data ──────────────────────────────────────
// Shared between the UI and the MCP endpoint.
// If you add something here, both humans AND robots can see it.
// Power of one source of truth. No duality on our watch.

export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'clothing' | 'shoes' | 'electronics';
  inStock: boolean;
  description: string;
  image: string;
  colors: string[];
}

export const PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Neon Phantom Hoodie',
    price: 89.99,
    category: 'clothing',
    inStock: true,
    description:
      'Limited edition cyberpunk hoodie with reflective panels. The official WebMCP developer merch.',
    image: '🧥',
    colors: ['#a855f7', '#3b82f6', '#10b981'],
  },
  {
    id: '2',
    name: 'Quantum Sneakers',
    price: 129.99,
    category: 'shoes',
    inStock: true,
    description: 'Smart sneakers with adaptive cushioning. AI-ready, just like your site.',
    image: '👟',
    colors: ['#ef4444', '#f59e0b', '#6366f1'],
  },
  {
    id: '3',
    name: 'NeuralLink Headphones',
    price: 249.99,
    category: 'electronics',
    inStock: true,
    description:
      'Noise-cancelling headphones with AI-powered sound optimization. 0.2ms latency.',
    image: '🎧',
    colors: ['#000000', '#ffffff', '#a855f7'],
  },
  {
    id: '4',
    name: 'Cyberdeck Keyboard',
    price: 199.99,
    category: 'electronics',
    inStock: true,
    description:
      'Mechanical keyboard with holographic keycaps. Every keystroke is a JSON-RPC call.',
    image: '⌨️',
    colors: ['#1e293b', '#a855f7', '#06b6d4'],
  },
  {
    id: '5',
    name: 'MCP Developer Tee',
    price: 34.99,
    category: 'clothing',
    inStock: true,
    description:
      'The official "I speak MCP" t-shirt. 100% organic cotton. 0% web scraping.',
    image: '👕',
    colors: ['#0f172a', '#a855f7', '#ffffff'],
  },
  {
    id: '6',
    name: 'Holo-Watch Pro',
    price: 399.99,
    category: 'electronics',
    inStock: false,
    description:
      'Holographic display smartwatch. Runs MCP natively. Your wrist, now Agent-Ready.',
    image: '⌚',
    colors: ['#a855f7', '#3b82f6', '#10b981'],
  },
] as const;
