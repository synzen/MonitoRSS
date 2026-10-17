#!/bin/bash

cleanup () {
  docker compose -f docker-compose.test.yml -p feed-requests-test rm -f -s -v
}

TEST_TARGET="${1//\\//}"
export TEST_COMMAND="npx jest ${TEST_TARGET}"

docker compose -f docker-compose.test.yml -p feed-requests-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests
status=$?

cleanup

exit $status
