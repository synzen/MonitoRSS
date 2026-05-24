# ADR-006 — npm workspaces for local-dev only; internal packages still publish to npm

**Status:** Accepted
**Date:** 2026-05-16

## Context

`packages/logger` is consumed via npm publish + SemVer ranges in every service `package.json`, paying ongoing publish-tax per change. The natural fix would be to convert the repo to full npm workspaces (Dockerfiles use repo-root build context; internal packages consumed via symlinks; no publish needed).

That ran into a hard constraint: **`docker-compose.yml`, `docker-compose.base.yml`, `docker-compose.dev.yml`, and per-service `docker-compose.*.yml` files are not modified outside of major version releases.** They are consumed verbatim by open-source self-hosters; mid-version changes to build contexts, paths, or service definitions break upgrades. See `README.md` § "Major Version Updates" for the release policy.

Without compose changes, Dockerfiles cannot use repo-root build context (compose dictates context per service). Without repo-root context, Dockerfiles cannot see `packages/` at install time. Therefore Docker builds cannot consume internal packages via workspace symlinks — they must consume them from the npm registry, same as today.

## Decision

Set up npm workspaces **for local-dev convenience only.** Do not touch Docker, compose, or CI build configuration.

Specifically:

1. **Root `package.json`** declares workspaces:
   ```json
   {
     "name": "monitorss",
     "private": true,
     "workspaces": [
       "packages/*",
       "services/backend-api",
       "services/bot-presence",
       "services/discord-rest-listener",
       "services/feed-requests",
       "services/user-feeds-next"
     ],
     "scripts": {
       "build:packages": "npm run build --workspaces --if-present --workspace=packages/*"
     }
   }
   ```
2. **`packages/logger/package.json`** gets a `prepare` script (`tsc`) so workspace install builds it automatically.
3. **Service `package.json` files** keep SemVer ranges for internal packages: `"@monitorss/logger": "^1.1.2"`, `"@monitorss/contracts": "^0.1.0"`. These work in both modes:
   - **Workspace mode** (local-dev `npm install` at repo root): npm sees a workspace package matching the name and creates a symlink — the local version always wins regardless of the SemVer range.
   - **Standalone mode** (Docker build inside `services/<name>/`): no root `package.json` is visible from the per-service context; npm resolves the SemVer range from the public npm registry — the published version wins.
4. **Internal packages stay publishable.** `packages/contracts/package.json` is marked `"publishConfig": { "access": "public" }` and is NOT `private`. The publish workflow is the same as `packages/logger`: bump version, `npm publish`, bump SemVer range in consuming services, install.
5. **No Dockerfile, compose, or CI changes.**

## What this gives you

- **Local IDE/TS resolution works** with a single `npm install` at the repo root. No publish, no per-service installs.
- **Local `tsc` against `packages/contracts` sees the live source** (via workspace symlink). Edit a schema, rebuild contracts, the consumer sees the change immediately.
- **Single root `node_modules`** for local dev; cleaner than per-service `node_modules` tangles.
- **Docker builds are unchanged.** Self-hosters pulling the latest see no compose-shape difference.

## What this does NOT do

- **Does not eliminate publish-tax for Docker.** Every change to an internal package still requires `npm publish` from the package directory + version bump in consuming services + `npm install` per service for the lockfile updates. Same workflow as before.
- **Does not consolidate `package-lock.json` files.** Each service still has its own lockfile (workspace mode produces a root lockfile, but the per-service ones are still what Docker installs from). Leaving the per-service lockfiles in place avoids breakage.
- **Does not change CI.** GitHub Actions still build images with per-service contexts.

## Consequences

**Easier:**
- Local development: `npm install` at root + `npm run build:packages` and the IDE finds everything.
- Editing internal packages is instant for local TS (no publish needed until you want it in a Docker image).

**Harder / unchanged:**
- Publishing `@monitorss/contracts` is still required before Docker builds can pick up new event schemas.
- Per-event change cadence is expected to be low; publish cycles are tolerable.

**Constraints on future decisions:**
- **Do not modify `docker-compose.*.yml` files outside of major version releases.** Self-hosters depend on compose stability between minor/patch upgrades. When a major release happens, compose changes are explicitly permitted and should be documented in the release notes per `README.md` § "Major Version Updates".
- New internal packages under `packages/` follow the same pattern: `private: false`, `publishConfig.access: public`, SemVer-ranged consumption, `prepare` script for workspace install.
- If a future architectural change would *require* compose modifications (e.g., adding a brand-new service with its own image), call it out explicitly and discuss migration impact with the user before executing.

## On a future major release

If a major version release is shipping and includes a coordinated compose update for self-hosters anyway, this ADR may be superseded by one that converts to full workspaces (repo-root build context for Dockerfiles, no publish-tax for any internal package). That decision is a future one; for now this ADR records the current minor/patch-compatible approach.

## See also

- ADR-007 — `packages/contracts` (consumed by services using this workspace setup).
- npm workspaces docs: https://docs.npmjs.com/cli/v10/using-npm/workspaces
