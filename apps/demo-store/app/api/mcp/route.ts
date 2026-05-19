import { createRouteHandler } from '@webmcp1/next';
import { StoreService } from '../../../lib/store-service';

// ── Set up the MCP route handler ─────────────────────────
// This creates GET and POST handlers that plug into Next.js App Router.
// AI agents hit POST /api/mcp, humans visit the page like normal.

const { server, handlers } = createRouteHandler({
  name: 'WebMCP Demo Store',
  description:
    'A revolutionary e-commerce store that AI agents can interact with directly via the Model Context Protocol. Browse products, search inventory, and purchase items — no web scraping required.',
  endpoint: '/api/mcp',
  streaming: true,
});

// ── Register the decorated service class ──────────────────
// All @MCP.Tool() methods are auto-discovered and registered.
// One line. Zero boilerplate. That's the whole point.

server.registerService(new StoreService());

// ── Export GET and POST — Next.js App Router handlers ────

export const { GET, POST } = handlers();
