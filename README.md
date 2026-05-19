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
