#!/bin/bash
# Run Maestro e2e tests against a mock API server.
#
# Usage: .maestro/run-tests.sh [flow.yaml]
#   If no flow is specified, runs all flows in .maestro/

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MOBILE_DIR="$(dirname "$SCRIPT_DIR")"
MOCK_PID=""

cleanup() {
  if [ -n "$MOCK_PID" ]; then
    kill "$MOCK_PID" 2>/dev/null || true
    echo "Mock server stopped."
  fi
  # Restore original .env.local if backed up
  if [ -f "$MOBILE_DIR/.env.local.bak" ]; then
    mv "$MOBILE_DIR/.env.local.bak" "$MOBILE_DIR/.env.local"
    echo "Restored .env.local"
  fi
}
trap cleanup EXIT

# 1. Start mock server
echo "Starting mock API server on :4400..."
node "$SCRIPT_DIR/mock-server.js" &
MOCK_PID=$!
sleep 1

# 2. Swap .env.local to point at mock server
if [ -f "$MOBILE_DIR/.env.local" ]; then
  cp "$MOBILE_DIR/.env.local" "$MOBILE_DIR/.env.local.bak"
fi
cp "$MOBILE_DIR/.env.maestro" "$MOBILE_DIR/.env.local"

echo ""
echo "NOTE: If Expo is already running, restart it to pick up the mock API URL."
echo "      Press Enter once the app is reloaded, or Ctrl+C to abort."
read -r

# 3. Run Maestro tests
if [ -n "$1" ]; then
  maestro test "$SCRIPT_DIR/$1"
else
  maestro test "$SCRIPT_DIR/"
fi
