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

# A single integer (E2E_INSTANCE) isolates a run so multiple suites can run at once.
# When unset, pick the lowest instance whose compose project isn't already running.
# Instance 0 uses today's ports/names verbatim, so default behavior is unchanged.
if [ -z "${E2E_INSTANCE:-}" ]; then
  used="$(docker compose ls --format json 2>/dev/null \
    | grep -oE 'monitorss-e2e(-[0-9]+)?' || true)"
  E2E_INSTANCE=0
  while echo "$used" | grep -qx "monitorss-e2e$([ "$E2E_INSTANCE" = 0 ] && echo '' || echo "-$E2E_INSTANCE")"; do
    E2E_INSTANCE=$((E2E_INSTANCE + 1))
  done
fi

STRIDE=1000
OFF=$((E2E_INSTANCE * STRIDE))
export E2E_INSTANCE
export E2E_BACKEND_PORT=$((8100 + OFF))
export E2E_FRONTEND_PORT=$((3100 + OFF))
export E2E_MONGO_PORT=$((27019 + OFF))
export E2E_MOCK_RSS_PORT=$((3001 + OFF))
export E2E_MOCK_DISCORD_PORT=$((3002 + OFF))

if [ "$E2E_INSTANCE" = 0 ]; then
  COMPOSE_PROJECT_NAME="monitorss-e2e"
  INSTANCE_SUFFIX=""
else
  COMPOSE_PROJECT_NAME="monitorss-e2e-${E2E_INSTANCE}"
  INSTANCE_SUFFIX="-${E2E_INSTANCE}"
fi
export COMPOSE_PROJECT_NAME

BACKEND_URL="http://127.0.0.1:${E2E_BACKEND_PORT}"
FRONTEND_URL="http://localhost:${E2E_FRONTEND_PORT}"
# Args after the script name are forwarded to `playwright test`, so you can run a
# single file: ./e2e-mock.sh tests/feeds/bulk-delete-feeds.spec.ts
# Defaults to the whole e2e-web project when no args are given.
PLAYWRIGHT_ARGS="${@:---project=e2e-web}"

# Logs persist after the stack is torn down. The container logs (esp. web-api)
# are the only place to see things like inbound Paddle webhooks, so capture them
# before `down` removes the containers. Suffixed per instance so concurrent runs
# don't clobber each other.
LOG_DIR="$SCRIPT_DIR/logs"
RUN_LOG="$LOG_DIR/playwright${INSTANCE_SUFFIX}.log"
DOCKER_LOG="$LOG_DIR/docker-stack${INSTANCE_SUFFIX}.log"
mkdir -p "$LOG_DIR"

# When a Paddle key is present, create an EPHEMERAL notification setting for this run
# instead of repointing a shared one (which would hijack local dev's webhook delivery).
# Its signing secret must be known before the backend boots (the backend reads
# BACKEND_API_PADDLE_WEBHOOK_SECRET once at startup), so create it here, not in Playwright.
#
# To use your OWN notification setting instead, set E2E_PADDLE_NOTIFICATION_SETTING_ID
# (and the matching BACKEND_API_PADDLE_WEBHOOK_SECRET) in e2e/.env: the script then skips
# create/delete and leaves your setting in place (only repointing its destination to the
# tunnel during setup).
PADDLE_SETTING_EPHEMERAL=""
if [ -n "${E2E_PADDLE_NOTIFICATION_SETTING_ID:-}" ]; then
  echo "Using provided Paddle notification setting: $E2E_PADDLE_NOTIFICATION_SETTING_ID"
elif [ -n "${BACKEND_API_PADDLE_KEY:-}" ]; then
  echo "Creating ephemeral Paddle notification setting..."
  created="$(npx tsx "$SCRIPT_DIR/scripts/paddle-notification-setting.ts" create)"
  PADDLE_SETTING_EPHEMERAL="$(echo "$created" | sed -n '1p')"
  PADDLE_SETTING_SECRET="$(echo "$created" | sed -n '2p')"
  export E2E_PADDLE_NOTIFICATION_SETTING_ID="$PADDLE_SETTING_EPHEMERAL"
  export BACKEND_API_PADDLE_WEBHOOK_SECRET="$PADDLE_SETTING_SECRET"
  echo "Created Paddle notification setting: $PADDLE_SETTING_EPHEMERAL"
fi

cleanup() {
  if [ -n "$PADDLE_SETTING_EPHEMERAL" ]; then
    echo "Deleting ephemeral Paddle notification setting: $PADDLE_SETTING_EPHEMERAL"
    npx tsx "$SCRIPT_DIR/scripts/paddle-notification-setting.ts" delete "$PADDLE_SETTING_EPHEMERAL" || true
  fi
  echo "Capturing container logs to $DOCKER_LOG ..."
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" logs --no-color \
    >"$DOCKER_LOG" 2>&1 || true
  echo "Tearing down E2E Docker stack..."
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --volumes --remove-orphans
}
trap cleanup EXIT

if [ "$E2E_INSTANCE" = 0 ]; then
  rm -rf test-results playwright-report
else
  rm -rf "test-results${INSTANCE_SUFFIX}" "playwright-report${INSTANCE_SUFFIX}"
fi

echo "Starting E2E Docker stack (instance: $E2E_INSTANCE, project: $COMPOSE_PROJECT_NAME)..."
echo "  backend=$E2E_BACKEND_PORT frontend=$E2E_FRONTEND_PORT mongo=$E2E_MONGO_PORT rss-mock=$E2E_MOCK_RSS_PORT discord-mock=$E2E_MOCK_DISCORD_PORT"
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build --wait

echo "Running E2E tests... (output also written to $RUN_LOG)"
E2E_BACKEND_URL="$BACKEND_URL" E2E_BASE_URL="$FRONTEND_URL" \
  npx playwright test $PLAYWRIGHT_ARGS 2>&1 | tee "$RUN_LOG"
