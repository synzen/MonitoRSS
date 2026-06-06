#!/bin/bash
set -e
set -o pipefail

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
# Args after the script name are forwarded to `playwright test`, so you can run a
# single file: ./e2e-mock.sh tests/feeds/bulk-delete-feeds.spec.ts
# Defaults to the whole e2e-web project when no args are given.
PLAYWRIGHT_ARGS="${@:---project=e2e-web}"

# Logs persist after the stack is torn down. The container logs (esp. web-api)
# are the only place to see things like inbound Paddle webhooks, so capture them
# before `down` removes the containers.
LOG_DIR="$SCRIPT_DIR/logs"
RUN_LOG="$LOG_DIR/playwright.log"
DOCKER_LOG="$LOG_DIR/docker-stack.log"
mkdir -p "$LOG_DIR"

cleanup() {
  echo "Capturing container logs to $DOCKER_LOG ..."
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" logs --no-color \
    >"$DOCKER_LOG" 2>&1 || true
  echo "Tearing down E2E Docker stack..."
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --volumes --remove-orphans
}
trap cleanup EXIT

rm -rf test-results/

echo "Starting E2E Docker stack (project: $COMPOSE_PROJECT_NAME)..."
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build --wait

echo "Running E2E tests... (output also written to $RUN_LOG)"
E2E_BACKEND_URL="$BACKEND_URL" E2E_BASE_URL="$FRONTEND_URL" \
  npx playwright test $PLAYWRIGHT_ARGS 2>&1 | tee "$RUN_LOG"
