#!/bin/bash

cleanup () {
  docker compose -f docker-compose.test.yml -p feed-requests-test rm -f -s -v
}

if [ $# -eq 0 ]; then
  # Run everything
  TARGETS="\$(find ./src -name '*.test.ts' -type f)"
else
  # Run whatever paths the caller passed, expanding directories to their test files.
  TARGETS=""
  for arg in "$@"; do
    # Git Bash and PowerShell may hand over Windows-style paths.
    arg="${arg//\\//}"

    if [ -d "$arg" ]; then
      TARGETS="$TARGETS \$(find '$arg' -name '*.test.ts' -type f)"
    else
      TARGETS="$TARGETS '$arg'"
    fi
  done
fi

export TEST_COMMAND="node --import tsx --test-reporter=spec --test $TARGETS"

docker compose -f docker-compose.test.yml -p feed-requests-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests
status=$?

cleanup

exit $status
