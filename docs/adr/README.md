# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for MonitoRSS. Each ADR captures one significant architectural decision: the context that forced the decision, what was decided, and the consequences.

## Format

Each ADR follows the [Michael Nygard one-pager template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):

- **Title:** ADR-NNN — short imperative summary.
- **Status:** Proposed / Accepted / Deprecated / Superseded.
- **Context:** the forces at play. Why is this decision needed now?
- **Decision:** what we chose to do.
- **Consequences:** what becomes easier, harder, more expensive, or impossible as a result.

## Index

| # | Title | Status |
|---|---|---|
| [001](001-service-based-architecture.md) | Service-based architecture with event spine | Accepted (retroactive) |
| [002](002-rabbitmq-async-event-spine.md) | RabbitMQ is the asynchronous event spine; HTTP for synchronous queries | Accepted (retroactive) |
| [003](003-polyglot-persistence-per-service.md) | Per-service data ownership; cross-service access via events or API | Accepted (retroactive, with known caveat) |
| [004](004-standard-tooling-for-new-services.md) | Standard tooling for new services: Fastify + pg + rabbitmq-client + Zod | Accepted |
| [005](005-user-feeds-and-backend-api-next-deletion.md) | Cutover record: delete `services/user-feeds/` and `services/backend-api-next/` | Accepted |
| [006](006-npm-workspaces.md) | Convert repo to npm workspaces (internal packages by symlink, not publish) | Accepted |
| [007](007-packages-contracts.md) | `packages/contracts` is the single source of truth for RabbitMQ event names and payload schemas | Accepted |
| [008](008-user-feeds-next-internal-architecture.md) | `user-feeds-next` internal architecture: pipeline with domain-partitioned modules | Accepted |

## Per-service ADRs

Some services keep their own ADR folders for decisions scoped to a single service's internals. The root `docs/adr/` folder is reserved for repo-wide / cross-cutting decisions.

- [`services/backend-api/docs/adr/`](../../services/backend-api/docs/adr/) — internal architecture conventions for the backend-api service.

## When to write a new ADR

- The decision is **non-obvious** from reading the code.
- The decision **constrains future work** (e.g., "all new services use stack X").
- The decision **records a trade-off** that future-you will second-guess without context.
- The decision **reverses or supersedes** a previous decision.

When in doubt, write the ADR. They're cheap.

## When NOT to write an ADR

- Style preferences (prettier rules, naming conventions).
- Implementation details visible from the code itself.
- Decisions specific to a single PR that don't constrain future work.

