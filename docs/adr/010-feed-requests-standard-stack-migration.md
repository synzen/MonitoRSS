# ADR-010 — Cutover record: migrate `feed-requests` off NestJS to the standard stack

**Status:** Accepted
**Date:** 2026-10-25

## Context

`feed-requests` was the last service on the pre-ADR-004 heterogeneous tooling: NestJS wrapping Fastify, MikroORM for Postgres, `@golevelup/nestjs-rabbitmq` for queues, and class-validator for input validation. ADR-004 names it explicitly as a source of tooling heterogeneity but scopes migration to opportunistic moments; with `user-feeds-next` and `backend-api` both cut over, this was that moment.

Two constraints dominated every decision:

1. **Compose files are frozen outside major releases** (see ADR-005). `docker-compose.base.yml` builds two services from `services/feed-requests`: the app (Dockerfile `build` stage target, `CMD node ./dist/main`, port 5000, healthcheck on `/v1/feed-requests/health`) and a migration container whose command is `npm run migration:up`. A parallel-run `-next` directory was unattractive anyway — the old and new consumer cannot share `url.fetch-batch` without duplicate consumption.
2. **The MikroORM runtime was already vestigial.** Every live read/write went through raw SQL against `request_partitioned`/`response_bodies` via the ORM's connection; no `em.persist()` existed, so `em.flush()` flushed nothing, and read-replica routing never applied to the raw-SQL paths. Dropping the ORM runtime was low-risk — only the migration tooling needed a real replacement.

## Decision

- **In-place rewrite** of `services/feed-requests` onto the ADR-004 stack: plain Fastify, raw `pg`, `rabbitmq-client`, Zod. The compose-visible contract is preserved byte-for-byte: build context, stage names, entrypoint `node ./dist/main` (hence `src/main.ts`), default port, health route, all `FEED_REQUESTS_*` env var names (dropped variables are simply unread), and the `migration:up` npm script name.
- **Strict behavioral parity** for everything externally observable: HTTP response bodies including validation-error structure and status codes, `/v1` route layout, API-key guard semantics (including the Nest-style 403/404 bodies), the three-mode process model (`api` / `service` / both, with the partition prune-and-create cron in the api process), queue semantics, and log event payloads.
- **Migrations moved to the house-pattern runner** (`schema_migrations` tracking table + a `run-migrations` script), matching `user-feeds-next`. All 36 MikroORM migrations were pure `addSql` strings and were extracted **verbatim** into a generated data module. A **history-cutover step** seeds `schema_migrations` from the ORM's `mikro_orm_migrations` table on first run so existing databases (production and every self-hoster) do not re-execute anything. MikroORM is fully removed, devDependencies included; new migrations are hand-written entries.
- **Internal wiring follows `user-feeds-next` discipline, explicitly avoiding the `backend-api` container anti-pattern:** `src/main.ts` is the sole composition root; every module is a factory taking exactly its own dependencies; tests construct only the unit under test; dependency direction is strictly one-way with no cycles.
- **Dead weight deleted:** the gRPC proto (no server existed), the Split.io feature flagger (registered but never consumed), Mongoose (unused), class-validator/class-transformer, rxjs, reflect-metadata, the stale service-local dev compose stack, and the SQS-compat config. The ECS deploy scripts are retained (used personally for deployments).
- Query strings for `GET /v1/feed-requests` are parsed from the raw URL with `qs`, matching the old nested-query decorator's semantics rather than Fastify's default parser.

## Consequences

**Easier:**
- One HTTP framework, DB driver, queue client, and validation library repo-wide; the service's wiring is traceable function calls instead of DI indirection.
- One migration format repo-wide; migration runner is auditable in ~150 lines instead of an ORM CLI.
- The dependency surface reflects what actually runs (dependency count roughly halved).

**Harder / risks:**
- Validation-error *messages* are close-but-not-byte-identical to class-validator's (structure, ordering, and status codes are preserved; message wording mirrors the old constraints). Callers matching on exact message strings would notice — none are known to.
- The migration history cutover is the one genuinely novel code path; it is covered by integration tests for both fresh databases and ORM-historied databases.
- The maintainer's ECS deploy scripts build this image and should be exercised on the next deploy (build internals changed from the framework CLI to `tsc`; stages and entrypoint are unchanged).
- Read-replica support is dropped (it was already unrouted in practice); `FEED_REQUESTS_POSTGRES_REPLICA1_URI` is tolerated but ignored.

## See also

- ADR-004 — standard tooling this migration completes.
- ADR-005 — the compose-freeze constraint and the in-place precedent.
- ADR-007 — contracts validation on consume; queue names from `MessageBrokerQueue`.
- `docs/specs/feed-requests-standard-stack-migration.md` — the full spec, testing seams, and definition of done.
