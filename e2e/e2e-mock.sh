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

STRIDE=1000

# True if something is already listening on the given TCP port (any owner: the dev
# stack, a leaked mock-server from a prior run, or another e2e instance). Uses bash's
# /dev/tcp so it needs no lsof/netstat and behaves the same on Git Bash and Linux CI.
port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- && return 0
  return 1
}

# Every host port a given instance would bind. The mock-rss (3001) / mock-discord
# (3002) servers are started by Playwright on the HOST, so they must be checked here
# too — checking only the compose project name let instance 0 collide with whatever
# already held 3001/3002.
instance_ports() {
  local off=$(($1 * STRIDE))
  echo "$((8100 + off)) $((3100 + off)) $((27019 + off)) $((3001 + off)) $((3002 + off)) $((3006 + off))"
}

instance_is_free() {
  local candidate="$1"
  local project="monitorss-e2e$([ "$candidate" = 0 ] && echo '' || echo "-$candidate")"
  if echo "$USED_COMPOSE_PROJECTS" | grep -qx "$project"; then
    return 1
  fi
  local port
  for port in $(instance_ports "$candidate"); do
    if port_in_use "$port"; then
      return 1
    fi
  done
  return 0
}

# A single integer (E2E_INSTANCE) isolates a run so multiple suites can run at once.
# When unset, pick the lowest instance whose compose project AND all host ports are
# free, so a run can never collide with the dev stack, a leaked mock server, or
# another concurrent e2e run. Instance 0 uses today's ports/names verbatim.
USED_COMPOSE_PROJECTS="$(docker compose ls --format json 2>/dev/null \
  | grep -oE 'monitorss-e2e(-[0-9]+)?' || true)"
if [ -z "${E2E_INSTANCE:-}" ]; then
  E2E_INSTANCE=0
  while ! instance_is_free "$E2E_INSTANCE"; do
    E2E_INSTANCE=$((E2E_INSTANCE + 1))
  done
elif ! instance_is_free "$E2E_INSTANCE"; then
  echo "WARNING: E2E_INSTANCE=$E2E_INSTANCE has a busy compose project or port ($(instance_ports "$E2E_INSTANCE")); the run may fail." >&2
fi

OFF=$((E2E_INSTANCE * STRIDE))
export E2E_INSTANCE
export E2E_BACKEND_PORT=$((8100 + OFF))
export E2E_FRONTEND_PORT=$((3100 + OFF))
export E2E_MONGO_PORT=$((27019 + OFF))
export E2E_MOCK_RSS_PORT=$((3001 + OFF))
export E2E_MOCK_DISCORD_PORT=$((3002 + OFF))
export E2E_MOCK_REDDIT_PORT=$((3006 + OFF))

# Enable the mandatory-Reddit-connection gate for the mocked suite. Reddit OAuth
# and authenticated feed fetches are served by the host-side mock reddit server
# (see docker-compose.e2e.yml BACKEND_API_REDDIT_* env vars), so the full
# connect -> fetch flow can be exercised; any non-empty id will do.
export BACKEND_API_REDDIT_CLIENT_ID="${BACKEND_API_REDDIT_CLIENT_ID:-e2e-reddit-client-id}"

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
# Single file an agent can read top-to-bottom after a failure: Playwright run +
# every container's logs + all three host-side mock servers, with section headers.
COMBINED_LOG="$LOG_DIR/combined${INSTANCE_SUFFIX}.log"
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
  # Stop the live `logs --follow` (started after stack boot). $DOCKER_LOG is already
  # populated in real time, so there's nothing to capture here — just end the stream.
  if [ -n "${DOCKER_LOGS_PID:-}" ]; then
    kill "$DOCKER_LOGS_PID" 2>/dev/null || true
    wait "$DOCKER_LOGS_PID" 2>/dev/null || true
  fi

  # Fold everything into one file so an agent can read a single log after a failure.
  # The mock-*.log files are written by Playwright's webServers (see playwright.config.ts).
  echo "Writing combined log to $COMBINED_LOG ..."
  {
    echo "===== PLAYWRIGHT ====="
    cat "$RUN_LOG" 2>/dev/null || echo "(no playwright log)"
    echo
    echo "===== DOCKER STACK ====="
    cat "$DOCKER_LOG" 2>/dev/null || echo "(no docker log)"
    for mock in rss discord smtp reddit; do
      echo
      echo "===== MOCK: $mock ====="
      cat "$LOG_DIR/mock-${mock}${INSTANCE_SUFFIX}.log" 2>/dev/null || echo "(no mock-$mock log)"
    done
  } >"$COMBINED_LOG" 2>&1 || true

  echo "Tearing down E2E Docker stack..."
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" down --volumes --remove-orphans
  echo "Combined log (read this first if the run failed): $COMBINED_LOG"
}
trap cleanup EXIT

if [ "$E2E_INSTANCE" = 0 ]; then
  rm -rf test-results playwright-report
else
  rm -rf "test-results${INSTANCE_SUFFIX}" "playwright-report${INSTANCE_SUFFIX}"
fi

echo "Starting E2E Docker stack (instance: $E2E_INSTANCE, project: $COMPOSE_PROJECT_NAME)..."
echo "  backend=$E2E_BACKEND_PORT frontend=$E2E_FRONTEND_PORT mongo=$E2E_MONGO_PORT rss-mock=$E2E_MOCK_RSS_PORT discord-mock=$E2E_MOCK_DISCORD_PORT reddit-mock=$E2E_MOCK_REDDIT_PORT"
# On startup failure, dump container status + logs to stdout before the EXIT trap
# tears the stack down — the live log follower below hasn't started yet, so this
# output is the only diagnosable record of why a container exited (e.g. web-api
# crashing before becoming healthy).
if ! docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" up -d --build --wait; then
  echo "E2E stack failed to start; container status and recent logs follow:"
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" ps -a || true
  docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" logs --no-color --tail=200 || true
  exit 1
fi

# Follow container logs into $DOCKER_LOG live, so an agent inspecting a hung/slow run
# sees current container output without waiting for teardown. The follower is stopped
# in cleanup. (Playwright and mock-server logs are already written live elsewhere.)
docker compose -f "$COMPOSE_FILE" -p "$COMPOSE_PROJECT_NAME" logs --no-color --timestamps --follow \
  >"$DOCKER_LOG" 2>&1 &
DOCKER_LOGS_PID=$!

echo "Running E2E tests... (output also written to $RUN_LOG)"
echo "On failure, read the combined log (Playwright + all containers + mock servers): $COMBINED_LOG"
# Playwright discovers its config from the CURRENT WORKING DIRECTORY, and the only
# config is e2e/playwright.config.ts (there is none at the repo root). This script
# does not cd, so it must be run with cwd = e2e/ (the `npm run e2e*` aliases do this).
# Run it from the repo root instead and Playwright finds no config: it falls back to
# an implicit unnamed project with no baseURL, so `page.goto("/feeds")` fails with
# "Cannot navigate to invalid URL" and `--project=e2e-web` errors with
# 'Available projects: ""'. Run from e2e/ (or via `npm run e2e -- <spec>`).
E2E_BACKEND_URL="$BACKEND_URL" E2E_BASE_URL="$FRONTEND_URL" \
  npx playwright test $PLAYWRIGHT_ARGS 2>&1 | tee "$RUN_LOG"
