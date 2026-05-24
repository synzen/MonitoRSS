# ADR-004 — Standard tooling for new services: Fastify + pg + rabbitmq-client + Zod

**Status:** Accepted
**Date:** 2026-05-16

## Context

The system currently uses heterogeneous tooling per service:

- **HTTP frameworks:** NestJS-wrapped Fastify (`feed-requests`, the dead `user-feeds`) and plain Fastify (`user-feeds-next`, `backend-api`).
- **Persistence:** Mongoose (`backend-api`), MikroORM (`feed-requests`, `discord-rest-listener`, the dead `user-feeds`), raw `pg` (`user-feeds-next`).
- **RabbitMQ clients:** `@golevelup/nestjs-rabbitmq` (`feed-requests`), `rabbitmq-client` (`backend-api`, `user-feeds-next`), `amqplib`/`amqp-connection-manager` (`bot-presence`).

This heterogeneity is a solo-operator maintainability tax: a bug fix or pattern improvement has to be applied N ways.

The most recent service rewrite (`user-feeds-next`, now canonical in prod) deliberately moved off NestJS + MikroORM to plain Fastify + raw `pg` + `rabbitmq-client` + Zod. That stack is the de facto target.

## Decision

The standard tooling for **new services** is:

- **HTTP:** plain Fastify (no NestJS wrapper, no decorators).
- **Persistence:** raw `pg` for Postgres. Mongoose only when the service genuinely needs MongoDB. No new MikroORM consumers.
- **RabbitMQ:** `rabbitmq-client` (the modern Node-native library). No new `@golevelup` or `amqplib` consumers.
- **Validation:** Zod (for request bodies, event payloads, environment config).
- **Worker pool (for CPU-bound work):** `workerpool`.

**Existing services are not rewritten** on this basis alone. Migration happens opportunistically when a service is being touched substantively for other reasons. Tooling-parity churn for its own sake is explicitly out of scope.

## Consequences

**Easier:**
- New services look the same as the most recent one (`user-feeds-next`); transfer of knowledge is high.
- Future workers (article enrichment, multi-platform delivery adapters, etc.) inherit a known shape.
- Standard answers for "how do I add a Fastify route?" / "how do I run a Postgres migration?" / "how do I consume a RabbitMQ queue?"

**Harder:**
- Discipline required to resist NestJS muscle memory on new services.
- Service Dockerfiles and CI patterns need to converge over time as services migrate.

**Constraints on future decisions:**
- Choosing a non-standard tool for a new service requires an ADR.
- The bar for "let's introduce a new HTTP framework" or "let's add a different ORM" is now explicit and high.

## See also

- ADR-001 — service-based architecture.
- `services/user-feeds-next/` — the canonical example of the standard stack.
