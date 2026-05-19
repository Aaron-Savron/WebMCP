#!/usr/bin/env bash
set -e

# WebMCP Verification Script
# Tests the MCP endpoint end-to-end: starts the demo-store,
# hits it with curl, and shows the results.
#
# Usage:
#   bash scripts/verify.sh          # uses default port 3456
#   MCP_PORT=4000 bash scripts/verify.sh  # custom port

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PORT="${MCP_PORT:-3456}"
SERVER_PID=""
PASS=0
FAIL=0

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo ""
    echo "  Stopping demo-store server..."
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

check() {
  local label="$1"
  local expected="$2"
  local result="$3"
  if echo "$result" | grep -q "$expected"; then
    echo "  PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL: $label"
    echo "    Expected to contain: $expected"
    echo "    Full response (first 500 chars):"
    echo "$result" | head -c 500
    echo ""
    FAIL=$((FAIL + 1))
  fi
}

echo ""
echo "=== WebMCP Verification ==="
echo ""

# Install deps if needed
if [ ! -d "$PROJECT_DIR/node_modules" ]; then
  echo "  Installing dependencies..."
  cd "$PROJECT_DIR" && npm install --silent 2>/dev/null || true
fi

# Build packages
echo "  Building packages..."
cd "$PROJECT_DIR"
npm run build --workspaces --if-present 2>/dev/null || true

# Start demo-store server
echo "  Starting demo-store on port $PORT..."
cd "$PROJECT_DIR/apps/demo-store"
npx next dev -p "$PORT" > /tmp/webmcp-verify.log 2>&1 &
SERVER_PID=$!

# Wait for server to be ready and detect actual port
sleep 5
DETECTED_PORT=$(grep -o 'http://localhost:[0-9]*' /tmp/webmcp-verify.log 2>/dev/null | head -1 | grep -o '[0-9]*$')
if [ -n "$DETECTED_PORT" ]; then
  PORT="$DETECTED_PORT"
fi

# Give it more time if needed
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

if ! curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
  echo "  ERROR: Server did not start in time. Log follows:"
  tail -20 /tmp/webmcp-verify.log
  exit 1
fi

echo "  Server ready on http://localhost:$PORT"
echo ""

# --- Test 1: /.well-known/mcp.json ---
echo "--- Test 1: Well-Known Discovery ---"
RESULT=$(curl -s "http://localhost:$PORT/.well-known/mcp.json")
check "Serves /.well-known/mcp.json manifest" "mcp_servers" "$RESULT"

# --- Test 2: GET /api/mcp ---
echo ""
echo "--- Test 2: GET /api/mcp (Server Info) ---"
RESULT=$(curl -s "http://localhost:$PORT/api/mcp")
check "Returns server info" "autoDiscovered" "$RESULT"

# --- Test 3: tools/list ---
echo ""
echo "--- Test 3: List Tools ---"
RESULT=$(curl -s -X POST "http://localhost:$PORT/api/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/list","params":{}}')
check "Lists tools result" "tools" "$RESULT"
check "Has auto-discovered health_get" "health_get" "$RESULT"
check "Has auto-discovered products_get" "products_get" "$RESULT"
check "Has manual search_products" "search_products" "$RESULT"
check "Has manual purchase_item" "purchase_item" "$RESULT"

# --- Test 4: Call auto-discovered health endpoint ---
echo ""
echo "--- Test 4: Call Auto-Discovered health_get ---"
RESULT=$(curl -s -X POST "http://localhost:$PORT/api/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"2","method":"tools/call","params":{"name":"health_get","arguments":{}}}')
check "Health tool responds" "status" "$RESULT"
check "Health status is ok" "ok" "$RESULT"

# --- Test 5: Call auto-discovered products endpoint ---
echo ""
echo "--- Test 5: Call Auto-Discovered products_get ---"
RESULT=$(curl -s -X POST "http://localhost:$PORT/api/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"3","method":"tools/call","params":{"name":"products_get","arguments":{}}}')
check "Products tool responds" "products" "$RESULT"
check "Returns product count" "count" "$RESULT"

# --- Test 6: Call manual search_products tool ---
echo ""
echo "--- Test 6: Call Manual search_products ---"
RESULT=$(curl -s -X POST "http://localhost:$PORT/api/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"search_products","arguments":{"query":"hoodie"}}}')
check "Search tool responds" "content" "$RESULT"
check "Found product" "Hoodie" "$RESULT"

# --- Test 7: Call manual purchase_item tool ---
echo ""
echo "--- Test 7: Call Manual purchase_item ---"
RESULT=$(curl -s -X POST "http://localhost:$PORT/api/mcp" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":"5","method":"tools/call","params":{"name":"purchase_item","arguments":{"itemId":"1","quantity":1}}}')
check "Purchase tool responds" "success" "$RESULT"
check "Order confirmed" "confirmed" "$RESULT"

# --- Summary ---
echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
echo ""

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
