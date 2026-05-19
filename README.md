# WebMCP

Your website's API routes become tools that AI agents can call directly. No web scraping. No brittle selectors. Just clean JSON in and out.

## What it does

WebMCP serves a `.well-known/mcp.json` endpoint that tells AI agents how to interact with your site programmatically. Drop in the plugin, register your tools, and any MCP-compatible agent can browse products, search inventory, or purchase items through your native API instead of scraping your HTML.

### The short version

```ts
// 1. Wrap your next.config
// next.config.ts
import { withWebMCP } from '@webmcp1/next/plugin'

export default withWebMCP({
  name: 'My Store',
  description: 'Products API',
})({ reactStrictMode: true })
```

```ts
// 2. Create one route file
// app/api/mcp/route.ts
import { createRouteHandler } from '@webmcp1/next'

export const { GET, POST } = createRouteHandler({
  name: 'My Store',
  description: 'Products, search, checkout',
}).handlers()
```

```ts
// 3. Decorate your service
class StoreService {
  @MCP.Tool({
    name: 'search_products',
    description: 'Search products by query',
    schema: { query: z.string() }
  })
  async searchProducts(params: { query: string }) {
    return db.products.findMany({ where: { name: { contains: params.query } } })
  }
}
```

```ts
// 4. Register it
server.registerService(new StoreService())
```

That's it. Your site is now agent-callable.

## Packages

| Package | What |
|---------|------|
| `@webmcp1/core` | Protocol engine, decorators, server |
| `@webmcp1/next` | Next.js plugin + route handler |
| `@webmcp1/express` | Express middleware |

## Auto-discover (Next.js)

Have an existing app with API routes in `app/api/**/route.ts`? The auto-discover module scans them at startup and registers GET/POST tools for every route automatically. Zero code changes.

```ts
// app/api/mcp/route.ts
export { handlers } from '@webmcp1/next/auto'
```

Every route becomes an MCP tool named `{path}_{method}` (e.g., `products_get`, `products_search_post`). Tool calls are forwarded to the real route handler. Dynamic routes like `products/[id]` hint `id` as a parameter in the tool schema.

## Quick verify

Clone the repo, install deps, and run the verification script to see MCP in action:

```bash
git clone https://github.com/Aaron-Savron/WebMCP.git
cd WebMCP
npm install
npm run verify
```

Or do it manually with curl against any running WebMCP server:

```bash
# List all available tools
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}'

# Expected output (abbreviated):
# {"jsonrpc":"2.0","id":"1","result":{"tools":[
#   {"name":"health_get","description":"GET /api/health"},
#   {"name":"products_get","description":"GET /api/products"},
#   {"name":"search_products","description":"Search for products..."},
#   ...
# ]}}

# Call an auto-discovered tool (no decorator needed)
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"health_get","arguments":{}}}'

# Expected:
# {"jsonrpc":"2.0","id":"2","result":{"content":[{"type":"text","text":"{\n  \"status\": \"ok\",\n  \"uptime\": 1.23,\n  \"timestamp\": 1712345678901\n}"}]}}

# Call a decorated tool
curl -s -X POST http://localhost:3000/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"search_products","arguments":{"query":"hoodie"}}}'

# Expected:
# {"jsonrpc":"2.0","id":"3","result":{"content":[{"type":"text","text":"{\n  \"products\": [{...}],\n  \"count\": 1\n}"}]}}
```

## How it works

1. You register tools on an MCPServer (via decorators or manually)
2. The server generates a `.well-known/mcp.json` manifest
3. AI agents discover it, list available tools, and call them via POST
4. Each call returns structured JSON instead of HTML

## Spec

- [Well-Known Discovery](https://github.com/Aaron-Savron/WebMCP/blob/main/spec/WELL_KNOWN.md)
- [Protocol](https://github.com/Aaron-Savron/WebMCP/blob/main/spec/PROTOCOL.md)

## License

MIT
