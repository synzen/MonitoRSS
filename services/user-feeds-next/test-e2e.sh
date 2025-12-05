#!/bin/bash
cleanup () {
  docker compose -f docker-compose.test.yml -p user-feeds-next-test rm -f -s -v
}

export TEST_COMMAND="bun test test/app.test.ts"

docker compose -f docker-compose.test.yml -p user-feeds-next-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests

cleanup
