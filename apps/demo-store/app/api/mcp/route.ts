import { setupAutoDiscover } from '@webmcp1/next/auto';
import { StoreService } from '../../../lib/store-service';
import type { NextRequest } from 'next/server';

// ── Use auto-discover to register app/api routes as MCP tools ──
// Then also register the decorated StoreService for manual tools.

const { handlers, server } = setupAutoDiscover({
  name: 'WebMCP Demo Store',
  description:
    'A revolutionary e-commerce store that AI agents can interact with directly via the Model Context Protocol. Browse products, search inventory, and purchase items — no web scraping required.',
  endpoint: '/api/mcp',
});

// Register the decorated service class alongside auto-discovered tools
server.registerService(new StoreService());

// Export for debugging
export { server };

export const POST = handlers.POST;
export const GET = handlers.GET;
