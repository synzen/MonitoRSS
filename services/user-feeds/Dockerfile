# Stub Dockerfile.
#
# The original `services/user-feeds/` service (NestJS + MikroORM) was retired in
# production and replaced by `services/user-feeds-next/`. See:
#   - docs/adr/005-user-feeds-and-backend-api-next-deletion.md
#   - services/user-feeds/README.md
#
# This stub exists only because `docker-compose.base.yml` still defines the
# legacy `user-feeds-service` and `user-feeds-postgres-migration` services for
# backwards-compatibility with self-hosters whose compose overlays may still
# reference them. The production and dev compose overlays do NOT build from this
# stub; they `extends:` `user-feeds-next-service` instead.
#
# If you find yourself actually invoking a build of the legacy service:
#   - Stop. Use user-feeds-next-service instead.
#   - Migrate your compose overlay to `extends: user-feeds-next-service`.

FROM alpine:3.20 AS build

WORKDIR /usr/src/app

RUN echo "This is the legacy user-feeds stub image. It does nothing." > /usr/src/app/README

# Provide a no-op command so `docker compose run user-feeds-service` exits cleanly
# instead of crashing in a confusing way.
CMD ["sh", "-c", "echo 'Legacy user-feeds service is retired. Use user-feeds-next-service.'; exit 0"]
