# WebMCP Protocol Spec — How AI Agents Talk to Your Site

> Version: 1.0.0
> Status: Production-ready, mostly
> If you're reading this, you're about to learn how the new web works

## 1. What Are We Doing Here?

WebMCP takes the **Model Context Protocol (MCP)** — that thing Anthropic made so AI models can use tools — and turns it into a **website-to-agent hotline**. Instead of an AI blindly scraping your HTML and praying the CSS selectors haven't changed since last week, it just... calls your API. Like a normal program would.

### The Philosophy (we have one, sorry)

1. **Discovery-first** — Agents find your capabilities via `/.well-known/mcp.json`. No guessing.
2. **No scraping** — No DOM parsing, no hallucinated selectors, none of that garbage.
3. **Security by default** — Rate limiting, input validation, auth. The basics, but done right.
4. **Works everywhere** — Any framework, any AI, any transport. We don't discriminate.

## 2. How Agents Actually Talk to Your Server

Three ways. Pick your fighter.

### 2.1 WebSocket — For the Chatty Ones

**Best for:** Real-time, streaming, subscriptions, agents that can't shut up

```
Agent                          Server
  │                              │
  │── WebSocket Connect ────────▶│  "yo u up?"
  │                              │
  │── tools/list ───────────────▶│  "what can you do?"
  │◀── tool definitions ────────│  "here's my whole bag"
  │                              │
  │── tools/call (purchase) ────▶│  "buy me that hoodie"
  │◀── result (order ID) ───────│  "done, here's your receipt"
  │                              │
  │── resources/subscribe ──────▶│  "tell me if stuff changes"
  │◀── stream updates ──────────│  "bet. pinging you now"
```

### 2.2 HTTP POST — The Workhorse

**Best for:** Simple request-response, serverless, "make it work yesterday"

```
Agent                          Server
  │                              │
  │── POST /api/mcp ───────────▶│  Content-Type: application/json
  │   Body: JSON-RPC message    │  "here's what I need"
  │                              │
  │◀── 200 OK ──────────────────│  "gotchu, here's the data"
  │   Body: JSON-RPC response   │
```

### 2.3 SSE — When You Want to Push

**Best for:** Streaming responses, progress bars, "hey something changed"

```
Agent                          Server
  │                              │
  │── GET /api/mcp/events ──────▶│  "gimme that sweet event stream"
  │   Accept: text/event-stream │
  │                              │
  │◀── event: tool_start ───────│  "ok i'm starting"
  │◀── data: {progress: 0.5} ───│  "halfway there"
  │◀── event: tool_complete ────│  "all done chief"
  │◀── data: {result: ...} ─────│  "here's what you wanted"
```

## 3. The Message Format (JSON-RPC 2.0)

We use **JSON-RPC 2.0**. It's a standard. It's boring. It works. Let's move on.

### 3.1 Request (Agent → Server)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "purchase_item",
    "arguments": {
      "itemId": "1",
      "quantity": 2
    }
  }
}
```

The `id` is how you match requests to responses. Don't reuse IDs. It gets messy.

### 3.2 Success Response (Server → Agent, everything went well)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Successfully purchased 2x Neon Phantom Hoodie. Order #MCP-ABC123 confirmed."
      }
    ]
  }
}
```

Clean. Simple. The agent knows what happened.

### 3.3 Error Response (Server → Agent, oops)

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32002,
    "message": "Product 'Holo-Watch Pro' is currently out of stock"
  }
}
```

Errors happen. At least now they're machine-readable.

### 3.4 Error Codes (the ones that matter)

| Code | Name | When You'll See It |
|------|------|-------------|
| -32700 | ParseError | Agent sent trash JSON. Rude. |
| -32600 | InvalidRequest | The request structure is wrong. Read the spec. |
| -32601 | MethodNotFound | That tool doesn't exist. Did you make it up? |
| -32602 | InvalidParams | Wrong arguments. Check the schema next time. |
| -32603 | InternalError | Something broke on our end. It happens. |
| -32000 | ToolError | The tool ran but something was wrong. |
| -32001 | ToolNotFound | Explicit "I don't have that tool." |
| -32002 | ToolExecutionError | The tool crashed. Bad input? Bad code? Who knows. |
| -32050 | RateLimited | You're going too fast. Chill for a sec. |
| -32051 | Unauthorized | You're not who you say you are. Fix your auth. |

## 4. The Methods (what agents actually call)

### 4.1 tools/list — "What can you do?"

Returns every tool your server has with their full JSON Schemas so the AI knows exactly what params to pass.

**Request:** (trivially simple)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Response:** (actually useful)
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "search_products",
        "description": "Search the product catalog with filters for query, category, price, and stock",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string", "description": "Search query" },
            "maxPrice": { "type": "number", "description": "Maximum price" }
          }
        }
      }
    ]
  }
}
```

The `inputSchema` is JSON Schema. Every AI model worth its salt can read JSON Schema. This is how the agent knows what to send.

### 4.2 tools/call — "Do the thing"

Executes a tool. This is where the magic (and the money) happens.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "purchase_item",
    "arguments": {
      "itemId": "1",
      "quantity": 1
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Order confirmed: MCP-ABC123"
      }
    ]
  }
}
```

### 4.3-4.6 Other Methods (less exciting, still useful)

- **resources/list** — List data endpoints. Like `ls` for your API.
- **resources/read** — Read a specific resource by URI.
- **prompts/list** — List prompt templates. For agents that need hand-holding.
- **prompts/get** — Get a specific prompt template.

## 5. WebMCP Extras (the stuff we added)

Standard MCP is great. This makes it work for websites.

### 5.1 Agent ID

Agents should tell you who they are. Headers:

| Header | What It Is | Example |
|--------|-----------|---------|
| `X-Agent-ID` | Who's calling? | `claude-3.5-sonnet-20241022` |
| `X-Agent-Session` | Is this a conversation? | `sess_abc123` |
| `X-Agent-Capabilities` | What can this agent do? | `tools,streaming` |

### 5.2 Rate Limiting (please don't DDoS me)

Servers should rate limit. Agents should respect it. Headers:

| Header | What It Means |
|--------|--------------|
| `Retry-After` | How many seconds until you can try again |
| `X-RateLimit-Limit` | Max requests in this window |
| `X-RateLimit-Remaining` | How many you've got left |
| `X-RateLimit-Reset` | When the counter resets (Unix timestamp) |

### 5.3 Tool Naming (don't be chaotic)

A little consistency goes a long way:

| Category | Prefix | Examples |
|----------|--------|---------|
| Search | `search_` | `search_products`, `search_articles` |
| Read | `get_`, `read_` | `get_product`, `get_user_profile` |
| Write | `create_`, `update_` | `create_order`, `update_cart` |
| Action | `purchase_`, `book_`, `subscribe_` | `purchase_item`, `book_flight` |

Agents look for patterns. Make it easy for them.

## 6. Security (the boring but important part)

### 6.1 Authentication Levels

| Level | What It Means | When To Use It |
|-------|--------------|----------------|
| None | Open bar | Public data, search, read-only |
| API Key | Key goes in header | Read + limited writes |
| Bearer Token | Token auth | Anything that costs money |
| OAuth2 | Full delegation | User-specific operations, logins |

### 6.2 Input Validation — DO THIS

Every parameter an agent sends should be validated:
- Strings have max lengths (no one needs a 10MB product name)
- Numbers have ranges (quantity: 1-10, not 999999)
- Arrays have size limits (don't let them query 100k items at once)
- Block injection patterns (XSS, SQLi, template injection — the usual suspects)

**WebMCP's `InputValidator` does this automatically.** But you knew that because you're using it. Right?

### 6.3 Rate Limiting — Defaults That Won't Get You Hacked

- 100 requests/minute per agent (generous)
- 10 requests/second burst (prevents spam)
- Exponential backoff on 429 (agents, be cool)

## 7. For Agent Developers (how to implement this)

### 7.1 The Discovery Flow

```
1. Check https://site.com/.well-known/mcp.json
2. Parse the manifest → get endpoints + capabilities
3. Connect (ws if you need real-time, http if you're simple)
4. Call tools/list → get ALL the tool schemas
5. Pick the right tool for the job
6. Call it with validated params
7. Give the user their result
```

### 7.2 When Things Go Wrong (fallback)

If the site returns 404 on `.well-known/mcp.json`:
1. Wait 5 seconds (don't hammer them)
2. Fall back to scraping (old web, 🙄)
3. Cache the 404 so you don't keep checking

### 7.3 Error Handling

- **429 (rate limited):** Back off exponentially, max 3 retries. The server WILL remember if you're an asshole.
- **5xx:** Try once more, then tell the user it's down.
- **Tool error:** Tell the user what happened. Suggest something else.

## 8. Compliance — What Makes a Server "WebMCP Ready"

Your server is officially WebMCP compliant if it:

1. ✅ Serves `/.well-known/mcp.json` at the correct path
2. ✅ Implements `tools/list` and `tools/call` at minimum
3. ✅ Returns valid JSON-RPC 2.0 (it's not that hard)
4. ✅ Returns proper error codes when things break
5. ✅ Supports at LEAST HTTP POST (WebSocket is bonus points)
6. ✅ Has basic rate limiting and input validation (don't be that site)

---

*This spec is part of the WebMCP open standard. Go make the web agent-ready.*
