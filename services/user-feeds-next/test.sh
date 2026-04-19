#!/bin/bash
set -e

cleanup () {
  docker compose -f docker-compose.test.yml -p user-feeds-next-test rm -f -s -v
}

if [ $# -eq 0 ]; then
  # Run everything
  TARGETS="\$(find ./src -name '*.test.ts' -type f) \$(find ./test/e2e -name '*.e2e-spec.ts' -type f)"
else
  # Run whatever paths the caller passed — files, directories, or globs.
  # Quote each arg so spaces survive; directories get expanded via find.
  TARGETS=""
  for arg in "$@"; do
    if [ -d "$arg" ]; then
      TARGETS="$TARGETS \$(find '$arg' \\( -name '*.test.ts' -o -name '*.e2e-spec.ts' \\) -type f)"
    else
      TARGETS="$TARGETS '$arg'"
    fi
  done
fi

export TEST_COMMAND="npx tsx ./test/helpers/prepare-template-db.ts && node --import tsx --test-reporter=spec --test $TARGETS"

docker compose -f docker-compose.test.yml -p user-feeds-next-test up \
  --build \
  --force-recreate \
  --abort-on-container-exit \
  --exit-code-from tests \
  --attach tests

cleanup
