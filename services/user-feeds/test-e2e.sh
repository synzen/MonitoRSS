#!/bin/sh
alias cleanup='docker-compose -f docker-compose.test.yml down --volumes --remove-orphans'
export TEST_COMMAND="sh -c \"npx mikro-orm migration:up && npm run test:e2e\""
(docker-compose -f docker-compose.test.yml -p user-feeds-test up --no-log-prefix --build --force-recreate --abort-on-container-exit --exit-code-from tests --attach tests)

cleanup
