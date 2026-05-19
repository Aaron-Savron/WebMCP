'use client';

import { useState } from 'react';
import { PRODUCTS } from '../lib/products';

// ── what's in your cart? ─────────────────────────────────

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

// ── THE main component ────────────────────────────────────

export default function Home() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);

  const addToCart = (product: typeof PRODUCTS[0]) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: 1,
        },
      ];
    });
    setCheckoutMessage(null);
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
    setCheckoutMessage(null);
  };

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const checkout = async () => {
    // simulate a purchase in 0.2 seconds. web scraping could never.
    setCheckoutMessage(
      `✨ Purchase complete! Your order #MCP-${Math.random().toString(36).slice(2, 8).toUpperCase()} has been processed in 0.2 seconds via WebMCP protocol.`
    );
    setCart([]);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* glowing background that screams "this is cyberpunk" */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full opacity-20 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full opacity-20 blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-600/10 to-blue-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* site header with the fancy W logo */}
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl font-bold animate-glow">
                W
              </div>
              <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-500 opacity-20 blur-sm animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                WebMCP Store
              </h1>
              <p className="text-sm text-slate-400">Agent-Ready™ since 2025</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* the "we speak robot" badge */}
            <div className="mcp-badge">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              MCP Enabled
            </div>

            {/* shopping cart — the universal language of commerce */}
            <div className="relative glass-strong rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🛒</span>
                <span className="font-bold text-purple-400">{cart.reduce((s, i) => s + i.quantity, 0)}</span>
                <span className="text-slate-400 text-sm">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* hero section — where we flex on web scraping */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            AI Agent Ready — No UI Required
          </div>
          <h2 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            The{' '}
            <span className="bg-gradient-to-r from-purple-400 via-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Future
            </span>{' '}
            of Commerce
          </h2>
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            AI agents can browse, search, and purchase products directly through the{' '}
            <span className="text-purple-400 font-semibold">WebMCP protocol</span>.
            0.2 second transactions. Zero scraping. Pure protocol.
          </p>

          {/* stats that make scraping look dumb */}
          <div className="grid grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="glass rounded-xl p-4">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">0.2s</div>
              <div className="text-slate-500 text-sm">Transaction Speed</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">0</div>
              <div className="text-slate-500 text-sm">DOM Elements Parsed</div>
            </div>
            <div className="glass rounded-xl p-4">
              <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">∞</div>
              <div className="text-slate-500 text-sm">Hallucinations</div>
            </div>
          </div>
        </div>

        {/* the products — where the magic (and revenue) lives */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {PRODUCTS.map((product) => (
            <div
              key={product.id}
              className={`glass rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
                hoveredProduct === product.id
                  ? 'scale-[1.02] shadow-2xl shadow-purple-500/20 border-purple-500/30'
                  : 'hover:border-purple-500/20'
              }`}
              onMouseEnter={() => setHoveredProduct(product.id)}
              onMouseLeave={() => setHoveredProduct(null)}
            >
              <div className="text-6xl mb-4 text-center animate-float">{product.image}</div>
              <h3 className="text-xl font-bold mb-2">{product.name}</h3>
              <p className="text-slate-400 text-sm mb-4 min-h-[40px]">{product.description}</p>

              {/* color swatches — because details matter */}
              <div className="flex gap-2 mb-4">
                {product.colors.map((color) => (
                  <div
                    key={color}
                    className="w-4 h-4 rounded-full border border-white/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-purple-400">${product.price}</span>
                <button
                  onClick={() => addToCart(product)}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold text-sm transition-all duration-200 hover:shadow-lg hover:shadow-purple-500/25 active:scale-95"
                >
                  Add to Cart
                </button>
              </div>

              {/* little MCP hint showing the agent-side call */}
              <div className="mt-4 pt-4 border-t border-white/5">
                <code className="text-xs text-slate-500 block truncate">
                  mcp.call(&ldquo;search_products&rdquo;, &#123; query: &ldquo;{product.name.toLowerCase().slice(0, 15)}&rdquo; &#125;)
                </code>
              </div>
            </div>
          ))}
        </div>

        {/* cart — where good intentions go to be totaled */}
        {cart.length > 0 && (
          <div className="glass-strong rounded-2xl p-6 mb-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              🛒 Your Cart
              <span className="text-sm text-slate-400 font-normal">
                ({cart.reduce((s, i) => s + i.quantity, 0)} items)
              </span>
            </h3>

            <div className="space-y-3 mb-4">
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex items-center justify-between glass rounded-xl p-3"
                >
                  <div>
                    <span className="font-medium">{item.name}</span>
                    <span className="text-slate-400 text-sm ml-2">
                      x{item.quantity}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-purple-400 font-bold">
                      ${(item.price * item.quantity).toFixed(2)}
                    </span>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-4 pt-4 border-t border-white/10">
              <span className="text-lg font-bold">Total</span>
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                ${total.toFixed(2)}
              </span>
            </div>

            <button
              onClick={checkout}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500 text-white font-bold text-lg transition-all duration-200 hover:shadow-xl hover:shadow-purple-500/25 active:scale-[0.98]"
            >
              ⚡ Checkout via MCP (0.2s)
            </button>

            {checkoutMessage && (
              <div className="mt-4 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
                {checkoutMessage}
              </div>
            )}
          </div>
        )}

        {/* footer — the "try it yourself" section with code examples */}
        <footer className="text-center py-8 border-t border-white/5">
          <div className="glass rounded-2xl p-6 max-w-3xl mx-auto mb-6">
            <h3 className="text-lg font-bold mb-4">🔌 Try it yourself</h3>
            <p className="text-slate-400 text-sm mb-4">
              Any AI agent can interact with this store directly through the WebMCP protocol.
              Point your agent to:
            </p>
            <div className="bg-black/40 rounded-xl p-4 font-mono text-sm text-left">
              <div className="text-green-400 mb-2"># find the endpoint</div>
              <div className="text-purple-400 mb-3">GET /.well-known/mcp.json</div>
              <div className="text-green-400 mb-2"># see what tools exist</div>
              <div className="text-slate-300 mb-1">POST /api/mcp</div>
              <div className="text-slate-500 ml-4">{'{'} &ldquo;jsonrpc&rdquo;: &ldquo;2.0&rdquo;, &ldquo;method&rdquo;: &ldquo;tools/list&rdquo;, &ldquo;id&rdquo;: 1 {'}'}</div>
              <div className="text-green-400 mt-3 mb-2"># buy something in 0.2s</div>
              <div className="text-slate-500 ml-4">{'{'}</div>
              <div className="text-slate-500 ml-6">&ldquo;jsonrpc&rdquo;: &ldquo;2.0&rdquo;,</div>
              <div className="text-slate-500 ml-6">&ldquo;method&rdquo;: &ldquo;tools/call&rdquo;,</div>
              <div className="text-slate-500 ml-6">&ldquo;params&rdquo;: {'{'} &ldquo;name&rdquo;: &ldquo;purchase_item&rdquo;, &ldquo;arguments&rdquo;: {'{'} &ldquo;itemId&rdquo;: &ldquo;1&rdquo;, &ldquo;quantity&rdquo;: 1 {'}'} {'}'},</div>
              <div className="text-slate-500 ml-6">&ldquo;id&rdquo;: 2</div>
              <div className="text-slate-500 ml-4">{'}'}</div>
            </div>
          </div>

          <p className="text-slate-600 text-xs">
            WebMCP Demo Store — Part of the WebMCP open standard. All transactions simulated.
          </p>
        </footer>
      </div>
    </main>
  );
}
