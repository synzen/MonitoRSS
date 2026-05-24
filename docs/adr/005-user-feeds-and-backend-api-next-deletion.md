# ADR-005 — Retire `services/user-feeds/` to a stub; delete `services/backend-api-next/`

**Status:** Accepted
**Date:** 2026-05-16

## Context

Two directories in `services/` carry no production weight but pollute the repo:

1. **`services/user-feeds/`** is the pre-cutover NestJS + MikroORM article-pipeline service. It was replaced in production by `services/user-feeds-next/` (plain Fastify + raw `pg`). The production `docker-compose.yml` runs `user-feeds-next` under the alias `user-feeds-service` via `extends:`. The old `user-feeds/` source tree has not been maintained since cutover.

2. **`services/backend-api-next/`** is an empty stub. It contains only an `e2e/tests/nul` artifact (a Windows-specific filesystem artifact) and no source code. It was reserved for an aspirational `backend-api` rewrite that did not happen. The naming string `backend-api-next` does appear elsewhere — in `services/backend-api/test.sh` (used as a Docker Compose project name label), `services/backend-api/src/main.ts` (a startup log message), and `services/backend-api/src/infra/logger.ts` (a service label). Those are vestigial naming inside `services/backend-api/` itself, not references to the empty stub directory.

Both are deletable with no design needed.

A first-draft of this ADR proposed deleting both the source trees AND removing the legacy `user-feeds-service` + `user-feeds-postgres-migration` definitions from `docker-compose.base.yml`. That collided with a hard constraint: **compose files must not change outside of major version releases** (they are consumed by open-source self-hosters; mid-version changes risk breaking upgrades — see `README.md` § "Major Version Updates" for the release policy).

## Decision

1. **`services/user-feeds/` is replaced by a stub directory.**
   - The original ~6-test NestJS source tree is gone.
   - In its place: a minimal `services/user-feeds/Dockerfile` (Alpine-based, builds a no-op image with a `build` target) and a `services/user-feeds/README.md` explaining the stub.
   - The legacy `user-feeds-service` and `user-feeds-postgres-migration` definitions in `docker-compose.base.yml` are **kept unchanged** — the stub Dockerfile preserves the contract those definitions rely on (`context: services/user-feeds`, `dockerfile: Dockerfile`, `target: build`).
   - The production and dev compose overlays do not build from this stub; they `extends: user-feeds-next-service` for the `user-feeds-service` alias. The stub is therefore inert in any normal deployment path.

2. **`services/backend-api-next/` is fully deleted.**
   - No compose file references it.
   - No code lived in it.
   - Pure subtraction.

3. **`bot.code-workspace`** — the `services/user-feeds` folder entry is removed. The stub directory is not worth surfacing in the IDE workspace.

**Not changed:**

- `docker-compose.base.yml`, `docker-compose.yml`, `docker-compose.dev.yml`, and all per-service `docker-compose.*.yml` files are byte-identical to the original. Self-hosters pulling the new code see zero compose diff.
- The vestigial `backend-api-next` strings inside `services/backend-api/` (project names, log labels) are left alone. Renaming them is cosmetic and out of scope.

## Consequences

**Easier:**
- Self-host upgrade is safe — no compose file shape changes.
- Repo-wide grep returns one answer per concept (the old code is gone; only stub + README remain in `services/user-feeds/`).
- New contributors and future agents understand `services/user-feeds-next/` is canonical (README at `services/user-feeds/README.md` is explicit).
- The dead `MessageBrokerQueue` enum that used to live in `services/user-feeds/src/...` is gone — no risk of silent drift from the live one.

**Harder:**
- The stub directory must be kept in sync with the legacy compose definitions. If the `user-feeds-service` definition in `docker-compose.base.yml` ever changes its `context`/`dockerfile`/`target` fields, the stub must adapt — but those fields shouldn't change (the whole point is compose stability).
- A self-hoster who calls `docker compose -f docker-compose.base.yml build user-feeds-service` directly will produce a tiny image that does nothing. Acceptable — the docs (README + CMD message) make it obvious.

**Constraints on future decisions:**
- No further "next" rewrites in parallel directories. If a service is being rewritten, do it in-place on a feature branch and cut over, or do it under a feature flag inside the existing service. Sibling-directory rewrites tend not to get cleaned up.
- On the next major version release (when `README.md`'s breaking-changes-allowed policy applies), the legacy `user-feeds-service` and `user-feeds-postgres-migration` definitions in `docker-compose.base.yml` can be removed and this stub directory deleted. Document the change in the release notes per the normal major-version upgrade flow.

## See also

- ADR-006 — npm workspaces (also affected by the same mid-version compose-stability constraint).
