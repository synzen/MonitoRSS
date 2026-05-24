# ADR-007 — `packages/contracts` as the single source of truth for RabbitMQ event names and payload schemas

**Status:** Accepted
**Date:** 2026-05-16

## Context

Before this change, the canonical list of RabbitMQ event names did not exist anywhere. The `MessageBrokerQueue` enum was duplicated as three separate string-enum declarations:

- `services/backend-api/src/infra/rabbitmq.ts` — 10 queues
- `services/user-feeds-next/src/shared/constants.ts` — 5 queues
- (Until ADR-005, also `services/user-feeds/src/shared/constants/message-broker-queue.constants.ts` — 5 queues; deleted with the dead service.)

The three lists *partially* overlapped. Adding a queue, renaming one, or typoing one anywhere produced a silent contract break: producer publishes to `foo.bar`, consumer subscribes to `foo.baz`, messages vanish into the broker, no compile-time signal, no runtime signal until someone notices missing deliveries.

Payload shapes were also drift-prone. Types like `DiscordMediumEvent` and `UserFeedForDelivery` are defined in `backend-api/src/services/message-broker-events/types.ts` and consumed structurally by `user-feeds-next` via JSON. A producer-side field rename gives no signal to the consumer.

ADR-006 (npm workspaces) removed the obstacle that would have made this change painful: extracting a shared package no longer requires publishing to npm. A `packages/contracts` package is now consumed by symlink at install time.

## Decision

Create `packages/contracts` as the single source of truth for everything that crosses the RabbitMQ bus.

### Structure

```
packages/contracts/
├── package.json          (name: "@monitorss/contracts", private, depends on Zod)
├── tsconfig.json
├── README.md             (usage examples)
└── src/
    ├── index.ts          (re-exports)
    ├── queues.ts         (canonical MessageBrokerQueue enum — 11 queues)
    └── events/
        ├── url-fetch-batch.ts
        ├── url-fetch-completed.ts
        ├── url-failing.ts
        ├── url-failed-disable-feeds.ts
        ├── url-rejected-disable-feeds.ts
        ├── sync-supporter-discord-roles.ts
        ├── feed-deliver-articles.ts
        ├── feed-article-delivery-result.ts
        ├── feed-deleted.ts
        ├── feed-rejected-disable-feed.ts
        └── feed-rejected-article-disable-connection.ts
```

### Conventions

1. **One file per event** under `src/events/`.
2. **Each event file exports a Zod schema + an inferred TS type.** Both are named after the event (`FeedDeliverArticlesSchema`, `FeedDeliverArticlesPayload`).
3. **Strict outer structure, freeform inner where unavoidable.** Top-level event keys are pinned (Zod object), but deeply nested freeform shapes (Discord embeds, components, custom placeholders) use `z.record(z.unknown())`. The discipline is: pin what's worth catching drift on; let Discord's API evolution stay opaque until ADR-driven multi-platform work forces typing.
4. **Permissive schemas for events with `as any` consumers today** are marked with a `TODO:` comment instead of being skipped. Even a permissive Zod schema produces runtime validation of the envelope; tightening can happen incrementally.
5. **Never declare a queue name as a string literal** in a service. Import from `@monitorss/contracts`.
6. **Producers MUST validate** with `Schema.parse(payload)` before publish — fail loud on producer-side misshape.
7. **Consumers MUST `safeParse`** incoming messages and log + skip/DLQ on validation failure — fail loud on producer-side drift.

### Zod is exported, not wrapped

The package exports Zod schemas (`z.object({...})`) directly rather than wrapping them in package-owned parser functions. The leak is acknowledged:

- Zod is already a direct dependency in `backend-api`, `user-feeds-next`, and `discord-rest-listener`.
- ADR-004 names Zod as the standard validation library for new services.
- Wrapping (Option B in the audit discussion) would cost ongoing maintenance per event for a benefit (validator-swap) that almost never actually happens in practice.
- If polyglot services ever become a near-term plan (e.g., a future Go or Python service), Zod schemas can be exported as JSON Schema via `zod-to-json-schema` — a downstream concern, easy to add.

### Service updates

- `services/backend-api/src/infra/rabbitmq.ts` — the local 10-entry enum is replaced with `export { MessageBrokerQueue } from "@monitorss/contracts"` so existing imports continue to work.
- `services/user-feeds-next/src/shared/constants.ts` — same pattern: re-export from contracts.
- `services/discord-rest-listener` — does not have a duplicated enum (uses `@synzen/discord-rest` for its own queues, not the shared bus); no change.
- Both services declare `"@monitorss/contracts": "^0.1.0"` in their `package.json`.

### Distribution and consumption

`packages/contracts` is published to the public npm registry, same as `@monitorss/logger`. ADR-006 explains why: the constraint on not modifying docker-compose files means Docker builds cannot consume internal packages via workspace symlinks. The workflow is therefore:

- **Local dev:** `npm install` at the repo root creates a workspace symlink; the IDE and `tsc` see live edits to `packages/contracts/src/` immediately. No publish needed for local-only work.
- **Docker builds (dev or prod):** Each service's Dockerfile runs `npm install` inside `services/<name>/`, which resolves `@monitorss/contracts` from the npm registry. **The package must be published before the Docker build will succeed.**
- **Per-change workflow for new/modified events:** edit the schema → bump `packages/contracts` version → `npm publish` → bump the SemVer range in consuming services → `npm install` per service to refresh the lockfile.

Cadence is expected to be low (a handful of new events over the foreseeable roadmap), so the publish overhead is real per-event but small in aggregate.

## Consequences

**Easier:**
- Adding a new event = create one file in `packages/contracts/src/events/`, add to `src/index.ts`, done. Producers and consumers import and use immediately (via workspaces — no publish).
- Typing a queue name wrong is a TypeScript error, not a silent prod incident.
- Consumer-side `safeParse` catches contract drift on the first message of the new shape, with a precise error pointing at the divergent field.
- Future pipeline events (e.g., `article.parsed`, `article.filtered`, `article.enriched` for a future enrichment worker) have a known home and pattern.

**Harder:**
- Zod is a runtime dep for every consuming service. Already true; now formalized.
- Future contract changes require a coordinated edit (the schema file) — but that's the whole point. The lift moves from "5 packages to publish" to "1 file to edit."

**Constraints on future decisions:**
- New events go into `packages/contracts` first. A service that publishes a not-yet-canonicalized event is a code-review-blocker bug.
- Renaming a queue requires a deprecation path (old + new for one release cycle, then drop the old). The contract change is the gate.
- Switching validation library would require updating `packages/contracts` AND every consumer's parse-site call — same scope as today's heterogeneous Zod usage. Net zero churn.

## Known caveats and follow-ups

1. **Permissive schemas need tightening.** Five of the 11 event schemas use `z.record(z.unknown())` because the current consumer code parses payloads as `any`. Each is marked with a `TODO`. As those producers or consumers get touched, the schemas should be pinned.
2. **`FeedDeliverArticlesSchema`** is the most coupled event and has the most freeform escape hatches. The `userFeed` field is `z.record(z.string(), z.unknown())` because `IUserFeed` has 30+ fields; tightening it would be a substantial Zod-translation exercise. Plan to tighten this when a future enrichment worker or other pipeline addition needs to subscribe to a related event.
3. **The `parseMessageBody` helper** in `services/backend-api/src/infra/rabbitmq.ts` and the equivalent in `user-feeds-next` still hand JSON to consumers as `unknown`. Consumers should adopt the pattern of `safeParse`-at-entry — that's a follow-up cleanup, not part of this ADR.
4. **HTTP contracts are not in this package** yet. The scope is intentionally limited to RabbitMQ events for now. Adding an `http/` folder for REST schemas is a reasonable extension when there's demonstrated value in pinning request/response shapes across the HTTP boundary.

## See also

- ADR-006 — npm workspaces (covers the publish-vs-symlink tradeoff and the compose-stability constraint).
- ADR-004 — standard tooling (Zod as the chosen validation library).
- `packages/contracts/README.md` — usage examples.
