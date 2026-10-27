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

if [ $# -gt 0 ]; then
  # Narrow the run to the caller's paths; without this override the compose
  # file's default command runs the full suite.
  export TEST_COMMAND="npx tsx src/test/helpers/prepare-template-db.ts && node --import tsx --test-reporter=spec --test $TARGETS"
fi

docker compose -f docker-compose.test.yml -p feed-requests-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests
status=$?

cleanup

exit $status
