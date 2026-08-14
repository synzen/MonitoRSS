#!/bin/bash
set -e

cleanup () {
  docker compose -f docker-compose.test.yml -p discord-rest-listener-test rm -f -s -v
}

if [ $# -eq 0 ]; then
  TARGETS="\$(find ./test -name '*.test.ts' -type f)"
else
  TARGETS=""
  for arg in "$@"; do
    if [ -d "$arg" ]; then
      TARGETS="$TARGETS \$(find '$arg' -name '*.test.ts' -type f)"
    else
      TARGETS="$TARGETS '$arg'"
    fi
  done
fi

export TEST_COMMAND="node --test-reporter=spec --test-force-exit --test $TARGETS"

docker compose -f docker-compose.test.yml -p discord-rest-listener-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests

cleanup
