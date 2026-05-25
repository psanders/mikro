#!/bin/bash
# Run Maestro e2e tests against a mock API server.
#
# Usage: .maestro/run-tests.sh [flow.yaml ...]
#   If no flow is specified, runs all flows sequentially.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
MOCK_PID=""

cleanup() {
  if [ -n "$MOCK_PID" ]; then
    kill "$MOCK_PID" 2>/dev/null || true
  fi
  if [ -f "$MOBILE_DIR/.env.local.bak" ]; then
    mv "$MOBILE_DIR/.env.local.bak" "$MOBILE_DIR/.env.local"
  fi
}
trap cleanup EXIT

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17}"
export PATH="$JAVA_HOME/bin:$PATH"

# 1. Start mock server
lsof -ti:4400 | xargs kill 2>/dev/null || true
sleep 1
node "$SCRIPT_DIR/mock-server.js" &
MOCK_PID=$!
sleep 1

# 2. Swap .env.local to point at mock server
if [ -f "$MOBILE_DIR/.env.local" ]; then
  cp "$MOBILE_DIR/.env.local" "$MOBILE_DIR/.env.local.bak"
fi
cp "$MOBILE_DIR/.env.maestro" "$MOBILE_DIR/.env.local"

# 3. Run tests
PASSED=0
FAILED=0
TOTAL=0

if [ $# -gt 0 ]; then
  FLOWS=("$@")
else
  FLOWS=(login dashboard navigation cuadre search-client ruta-filters ruta-client-detail cobrar-payment)
fi

for f in "${FLOWS[@]}"; do
  flow="$SCRIPT_DIR/$f"
  [ "${flow%.yaml}" = "$flow" ] && flow="$flow.yaml"
  [ ! -f "$flow" ] && echo "SKIP: $flow not found" && continue

  TOTAL=$((TOTAL + 1))
  name=$(basename "$flow" .yaml)
  echo ""
  echo "━━━ $name ━━━"
  if maestro test "$flow" 2>&1; then
    PASSED=$((PASSED + 1))
    echo "✓ $name PASSED"
  else
    FAILED=$((FAILED + 1))
    echo "✗ $name FAILED"
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━"
echo "Results: $PASSED/$TOTAL passed, $FAILED failed"
[ "$FAILED" -gt 0 ] && exit 1
exit 0
