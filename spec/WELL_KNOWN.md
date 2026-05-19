# WebMCP Auto-Discovery — The `.well-known/mcp.json` Spec

> Version: 1.0.0
> Status: Let's call it "vibe production"
> If you're reading this, you're about to make your site visible to AI agents. Congrats.

## What's This Even For?

You know how every time an AI tries to do something on your website, it fumbles around trying to click the right div, hallucinates a CSS selector that doesn't exist, and takes 45 seconds to do what a single API call could do in 0.2 seconds?

Yeah. That's the old web.

This spec lets your website scream "HEY AI AGENTS, I SPEAK YOUR LANGUAGE" by putting a single JSON file at `/.well-known/mcp.json`. Any AI agent that knows what's up will check for this file, find your MCP server, and talk to you directly instead of trying to parse your beautiful hand-crafted DOM.

No scraping. No hallucinated selectors. Just clean JSON-RPC calls.

## How It Works

```
┌─────────┐    1. GET /.well-known/mcp.json     ┌──────────┐
│         │ ──────────────────────────────────▶  │          │
│  AI     │                                      │  Website │
│  Agent  │    2. Manifest returned              │          │
│         │ ◀──────────────────────────────────  │          │
│         │                                      │          │
│         │    3. Connect via WebSocket/HTTP     │          │
│         │ ──────────────────────────────────▶  │  MCP     │
│         │                                      │  Server  │
│         │    4. JSON-RPC tool calls            │          │
│         │ ◀──────────────────────────────────  │          │
└─────────┘                                      └──────────┘
```

It's that simple. Four steps. No cap.

## Where Does This File Live?

Put it here. Exactly here. Don't get creative:

```
/.well-known/mcp.json
```

### The Rules (they're not hard)

- **HTTPS or bust** — Nobody's sending tool calls over plain HTTP in 2025
- **Content-Type: application/json** — Don't make me say it twice
- **CORS headers** — Throw in `Access-Control-Allow-Origin: *` so any agent can find you
- **Cache it** — `Cache-Control: public, max-age=3600` is fine, the file doesn't change every 5 minutes

## The Actual Schema

### Full Example (copy-paste this, you animal)

```json
{
  "mcp": {
    "version": "1.0.0",
    "endpoints": {
      "ws": "wss://example.com/api/mcp",
      "http": "https://example.com/api/mcp",
      "sse": "https://example.com/api/mcp/events"
    },
    "authentication": {
      "type": "api-key",
      "headerName": "X-API-Key",
      "tokenUrl": "https://example.com/auth/token"
    },
    "capabilities": {
      "tools": true,
      "resources": true,
      "prompts": false,
      "streaming": true,
      "subscriptions": false
    },
    "description": "Example.com MCP Server — AI-ready e-commerce, no scraping required",
    "tools": [
      {
        "name": "search_products",
        "description": "Search the product catalog with filters"
      },
      {
        "name": "purchase_item",
        "description": "Purchase an item by ID"
      }
    ],
    "resources": [
      {
        "name": "products",
        "uri": "mcp://example.com/products",
        "description": "Product catalog"
      }
    ]
  }
}
```

### Field Reference (the boring but important part)

| Field | Type | Required | What It Does |
|-------|------|----------|-------------|
| `mcp.version` | string | ✅ | Protocol version. Currently `"1.0.0"`. Don't make stuff up. |
| `mcp.endpoints.ws` | string | optional | WebSocket URL. For real-time chatty agents. |
| `mcp.endpoints.http` | string | optional | HTTP POST URL. The workhorse. Start here. |
| `mcp.endpoints.sse` | string | optional | Server-Sent Events. For when you want to push updates. |
| `mcp.authentication.type` | string | ✅ | One of: `none`, `api-key`, `bearer-token`, or `oauth2`. If you pick `none`, agents can do whatever. Hope you know what you're doing. |
| `mcp.authentication.headerName` | string | conditional | Only if type is `api-key` or `bearer-token`. The header agents should send. |
| `mcp.authentication.tokenUrl` | string | conditional | Required if `oauth2`. Where agents go to get a token. |
| `mcp.authentication.authorizationUrl` | string | conditional | Also required if `oauth2`. The auth flow URL. |
| `mcp.authentication.scopes` | string[] | optional | What permissions the agent needs to ask for. |
| `mcp.capabilities.tools` | boolean | ✅ | Can agents call tools? If you said no, why are you here? |
| `mcp.capabilities.resources` | boolean | ✅ | Got data endpoints? List 'em. |
| `mcp.capabilities.prompts` | boolean | ✅ | Got prompt templates for agents? |
| `mcp.capabilities.streaming` | boolean | ✅ | SSE streaming support? |
| `mcp.capabilities.subscriptions` | boolean | ✅ | Agents can subscribe to changes? |
| `mcp.description` | string | ✅ | Tell agents what your site does. Keep it real. |
| `mcp.tools` | array | optional | List of tools. Name + description. Let agents know what they can do. |
| `mcp.resources` | array | optional | List of resources agents can read. |
| `mcp.prompts` | array | optional | List of prompt templates. For the chatty agents. |

## What Agents Should Do (if they're not lazy)

If you're building an AI agent (or training one), here's the etiquette:

1. **Always check** `https://<domain>/.well-known/mcp.json` before you start scraping like a caveman
2. **Use MCP first** — If the manifest exists, USE IT. The site literally built a custom API for you. Don't be rude.
3. **Fall back gracefully** — No manifest? Fine, go scrape. But you tried.
4. **Respect rate limits** — If the server says "chill" (429), chill. Read the `Retry-After` header.
5. **Announce yourself** — Send `X-Agent-ID` or at least a decent `User-Agent`. Nobody likes anonymous bots.

## Security Stuff (don't skip this)

- **Don't put secret tools in the manifest** — Your admin panel doesn't need to be in there
- **Pick the right auth level** — Public read-only data is fine with `none`. If agents can spend real money, maybe lock it down
- **RATE LIMIT YOUR ENDPOINTS** — Seriously. AI agents can go brrrrrr.
- **Validate everything** — Agents pass whatever they want. Sanitize that input.
- **The manifest is public** — Don't put API keys, secrets, or your mother's maiden name in here

## Fancy Extensions

### Custom Capabilities

Got something unique? Add custom capabilities:

```json
{
  "mcp": {
    "capabilities": {
      "tools": true,
      "custom_payments": true,
      "custom_analytics": true
    }
  }
}
```

### Tool Tags

Help agents figure out which tools do what:

```json
{
  "tools": [
    {
      "name": "purchase_item",
      "description": "Purchase an item",
      "tags": ["write", "payment", "critical"]
    }
  ]
}
```

Tags like `"read"`, `"write"`, `"payment"`, `"admin"` help agents decide which tools to use and which to avoid.

## Changelog

- **1.0.0** (2025) — The one where we changed the web forever

---

*This spec is part of the WebMCP open standard. Go build something cool.*
