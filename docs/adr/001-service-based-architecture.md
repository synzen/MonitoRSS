# ADR-001 — Service-based architecture with event spine

**Status:** Accepted (retroactive — ratifies current state)
**Date:** 2026-05-16

## Context

MonitoRSS has evolved into roughly half a dozen separately deployable services around a shared RabbitMQ event bus and polyglot persistence. The shape was not deliberately designed; it accumulated. The de facto style is **service-based architecture** in the Richards/Ford taxonomy (Ch. 14 of *Fundamentals of Software Architecture, 2nd Ed.*) — not microservices, not a modular monolith.

The plan is to evolve from the current state rather than rewrite. That makes the implicit architecture style load-bearing: every architectural decision going forward composes against it.

## Decision

We officially adopt **service-based architecture** as the system's architectural style. Specifically:

- **Coarse-grained services** — roughly one per major domain capability (article fetching, article delivery, Discord REST proxying, Discord presence, public HTTP API). Not microservices; the count is intentionally small.
- **Each service owns a meaningful chunk of business work.** A service is sized so a solo operator can hold its responsibilities in their head.
- **Inter-service coordination** is by HTTP (synchronous queries) and RabbitMQ events (asynchronous fan-out). See ADR-002.
- **Per-service data ownership.** See ADR-003.
- **Standardized tooling for new services.** See ADR-004.

We do **not** adopt microservices (overhead too high for a solo operator), modular monolith (would lose independent scaling, independent deployment, and process-level failure isolation — particularly load-bearing for `bot-presence`'s long-lived Discord Gateway connection and `discord-rest-listener`'s centralized rate-limit budget), or event-sourcing/CQRS (premature complexity).

## Consequences

**Easier:**
- Independent deployment of services that have genuine reason to deploy independently.
- Adding a new bounded capability (e.g., a future article-enrichment worker) — drop in a new service that subscribes to existing events.
- Bounded blast radius: a bug in one service is contained.

**Harder:**
- Cross-service refactors (require coordinated changes).
- Local development setup (Docker Compose with ~7 services).
- Schema/contract management across the event bus (addressed by ADR-007).

**Constraints on future decisions:**
- New capabilities default to "extend an existing service" *unless* the capability has a distinct lifecycle, data model, or scaling profile.
- Inter-service communication must use one of the named mechanisms (HTTP, RabbitMQ). No new protocols added without an ADR.

**Known violations (to be addressed):**
- `feed-requests` and `user-feeds-next` share a Postgres instance (different schemas). Tracked in ADR-003.
- The `monolith` Docker image serves three distinct processes (HTTP API, schedule-emitter, SPA bundle). Resolution deferred — splitting requires compose-file changes that are reserved for major version releases.

## See also

- ADR-002 — communication mechanisms.
- ADR-004 — standard tooling for new services.
