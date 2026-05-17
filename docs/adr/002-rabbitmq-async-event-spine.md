# ADR-002 — RabbitMQ is the asynchronous event spine; HTTP for synchronous queries

**Status:** Accepted (retroactive — ratifies current state)
**Date:** 2026-05-16

## Context

The system uses three inter-service communication mechanisms in production today:

1. **HTTP (Fastify)** — used between `backend-api`, `user-feeds-next`, and `feed-requests`.
2. **RabbitMQ events** — the asynchronous event bus for fan-out (`feed.deliver-articles`, `url.fetch-batch`, etc.).
3. **`@synzen/discord-rest`** — a separate RabbitMQ-based protocol for Discord REST calls between `user-feeds-next` and `discord-rest-listener`.

The codebase also contains **vestigial gRPC scaffolding** — environment variables (`USER_FEEDS_FEED_REQUESTS_GRPC_URL`, `USER_FEEDS_FEED_REQUESTS_GRPC_USE_TLS`) still appear in the legacy `user-feeds-service` definition in `docker-compose.base.yml` (kept for compose-stability; see ADR-005). The current production `user-feeds-next` service does NOT import or call any gRPC code. gRPC is therefore **not a live inter-service mechanism** despite the env var surface.

Without a stated convention, future additions would pick mechanisms by accident.

## Decision

Going forward:

- **RabbitMQ is the canonical asynchronous coordination mechanism.** Any cross-service work that can be deferred, fanned out, retried, or buffered uses RabbitMQ.
- **HTTP (Fastify) is the canonical synchronous mechanism** for direct query/command interactions where the caller needs a result before continuing. New synchronous endpoints default to HTTP.
- **gRPC is not adopted.** The vestigial env vars are kept until the next major version release (when the legacy `user-feeds-service` stub can be removed alongside its env vars per ADR-005). No new gRPC pathways are introduced.
- **`@synzen/discord-rest` is treated as a service-specific implementation detail** of the `discord-rest-listener` boundary, not a general-purpose protocol.

All RabbitMQ queue names and payload schemas live in a single source of truth (see ADR-007).

## Consequences

**Easier:**
- One mechanism to learn, monitor, and operate for each axis (sync vs async).
- Adding a future article-enrichment worker drops in cleanly as a RabbitMQ consumer/producer.

**Harder:**
- The vestigial gRPC env vars in the legacy compose stub will keep showing up in grep results until the major-version cleanup. Annotated in the stub so contributors know they're inert.

**Constraints on future decisions:**
- No new direct database access from one service to another's data. Cross-service data flow goes through HTTP or events.
- No introducing additional message brokers (Kafka, NATS, SQS) without an ADR. Stick with RabbitMQ unless there's a concrete reason.
- No reintroducing gRPC without an ADR justifying it against the HTTP default.

## See also

- ADR-005 — legacy `user-feeds-service` stub (carries the dead gRPC env vars).
- ADR-007 — packages/contracts as the source of truth for event names and schemas.
