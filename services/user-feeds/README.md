# services/user-feeds (RETIRED — stub directory)

This directory is a **stub** retained for backwards-compatibility with self-hosters whose `docker-compose` overlays may still reference the legacy `user-feeds-service` / `user-feeds-postgres-migration` services defined in `docker-compose.base.yml`.

## What was here

The original `services/user-feeds/` was a NestJS + MikroORM article-delivery pipeline service. It was replaced in production by `services/user-feeds-next/` (plain Fastify + raw `pg`).

## Why this stub exists

- `docker-compose.base.yml` still defines `user-feeds-service` and `user-feeds-postgres-migration` so that no self-hoster's existing overlay breaks on upgrade.
- The production compose (`docker-compose.yml`) and dev compose (`docker-compose.dev.yml`) both use `extends: user-feeds-next-service` for the `user-feeds-service` name — so the *aliases* in those overlays point at the new service, even though the legacy definitions in base remain.
- Removing the full source tree (per ADR-005) without this stub would break `docker-compose -f docker-compose.base.yml build` calls.

The stub `Dockerfile` produces a tiny Alpine-based image that does nothing. It exists so the build does not fail; it is not intended to run.

## What to do if you're maintaining a self-hosted instance

Use `user-feeds-next-service` going forward. The existing `user-feeds-service` alias in the standard compose overlays already resolves to it. If you've cloned the legacy `user-feeds-service` definition into your own overlay (rare), update your overlay to:

```yaml
user-feeds-service:
  extends:
    file: ./docker-compose.base.yml
    service: user-feeds-next-service
  # ...your overrides
```

## See also

- `docs/adr/005-user-feeds-and-backend-api-next-deletion.md`
- `services/user-feeds-next/` — the canonical implementation
