#!/bin/bash
cleanup () {
  docker compose -f docker-compose.test.yml -p backend-api-next-test rm -f -s -v
}

TEST_FILE="${1//\\//}"
TEST_FILE="${TEST_FILE#*backend-api-next/}"
TEST_FILE="${TEST_FILE:-test/**/*.test.ts}"
export TEST_COMMAND="node --import tsx --test --test-reporter=dot \"$TEST_FILE\""

docker compose -f docker-compose.test.yml -p backend-api-next-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests

cleanup
