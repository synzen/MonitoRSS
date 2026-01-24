#!/bin/bash
cleanup () {
  docker compose -f docker-compose.test.yml -p backend-api-next-test rm -f -s -v
}

export TEST_COMMAND="node --import tsx --test --test-reporter=spec \"test/**/*.test.ts\""

docker compose -f docker-compose.test.yml -p backend-api-next-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests

cleanup
