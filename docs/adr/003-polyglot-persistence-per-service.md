# ADR-003 — Per-service data ownership; cross-service access via events or API

**Status:** Accepted (retroactive, with known caveat)
**Date:** 2026-05-16

## Context

The system uses multiple persistence technologies:

- MongoDB — owned by `backend-api` (and `discord-rest-listener` for its delivery audit data).
- PostgreSQL — owned by `feed-requests` (`feedrequests` schema) and `user-feeds-next` (`userfeeds` schema). Both live in the **same Postgres container** today (`feed-requests-postgres-db`), which is a violation of strict per-service ownership.
- Redis — shared cache layer (`feed-requests-redis-cache`) used by `feed-requests` and `user-feeds-next`.
- S3 — used by `feed-requests` for large response bodies.

Each persistence choice fits its service's needs. The problem is not the polyglot nature itself — it's the absence of a stated rule about who owns what.

## Decision

- **Each service owns its data.** A service may not directly read or write another service's database.
- **Cross-service data flow happens via:** (a) HTTP API calls when synchronous, or (b) RabbitMQ events when asynchronous. See ADR-002.
- **Polyglot persistence is permitted.** Mongo, Postgres, Redis, S3, future stores — choose what fits the service. The rule is about ownership, not technology.
- **New services own their own schema.** No reusing another service's schema even for "convenience."

## Known caveat

`feed-requests` and `user-feeds-next` currently share a Postgres container instance (different schemas). This is a violation of the spirit of per-service ownership at the *infrastructure* level, though not at the *schema* level (since each service writes only to its own schema).

**Tolerated short-term** because:
- Splitting requires migration work + extra container + extra monitoring.
- At current scale a single Postgres instance has plenty of headroom.

**Tracked for resolution** when:
- Either service's load profile causes the other to suffer (long-running migration locks the other, vacuum pressure, etc.).
- Backup/restore scheduling becomes a coordination problem.

When that happens, split into two Postgres instances, each with its own backup and monitoring.

## Consequences

**Easier:**
- Schema changes are local to one service.
- A service can be sized, backed up, and migrated independently of others.

**Harder:**
- Any "join across services" requires API/event aggregation in application code.
- Cross-service consistency is eventual, not transactional. Live with it.

**Constraints on future decisions:**
- A new service may not store data in an existing service's database. Spin up your own.
- The Mongo connection in `backend-api` is shared between the HTTP API and the schedule-emitter today because they are *the same image* serving different processes (Smell #6). After Smell #6 is resolved, the schedule-emitter must talk to its data via the same boundaries any other service would.

## See also

- ADR-002 — communication mechanisms.
