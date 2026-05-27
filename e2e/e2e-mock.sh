#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

COMPOSE_PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$COMPOSE_PROJECT_DIR/docker-compose.e2e.yml"
COMPOSE_PROJECT_NAME="monitorss-e2e"
BACKEND_URL="http://127.0.0.1:8100"
FRONTEND_URL="http://localhost:3100"
PLAYWRIGHT_ARGS="${@:---project=chromium}"

cleanup() {
  echo "Tearing down E2E Docker stack..."
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --volumes --remove-orphans
}
trap cleanup EXIT

rm -rf test-results/

echo "Starting E2E Docker stack (project: $COMPOSE_PROJECT_NAME)..."
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build --wait

echo "Running E2E tests..."
E2E_BACKEND_URL="$BACKEND_URL" E2E_BASE_URL="$FRONTEND_URL" \
  npx playwright test $PLAYWRIGHT_ARGS
