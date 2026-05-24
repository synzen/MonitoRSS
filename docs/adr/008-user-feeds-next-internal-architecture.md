# ADR-008 — `user-feeds-next` internal architecture: pipeline with domain-partitioned modules

**Status:** Accepted
**Date:** 2026-05-24

## Context

`services/user-feeds-next/` is the canonical article-delivery pipeline. Before this change, the service had three files over 750 lines each (`article-formatter.ts` at 1,792, `delivery.ts` at 1,569, `feed-event-handler.ts` at 755) with high efferent coupling — each imported from 5+ other modules and mixed platform-agnostic logic with Discord-specific code.

An architecture audit using the framework from *Fundamentals of Software Architecture* (Richards & Ford, 2nd ed.) identified:
- Low cohesion in the large files (5 distinct responsibility clusters in `article-formatter.ts` alone)
- Connascence of algorithm (callers must know to call formatting before filtering before payload generation)
- Discord-specific types (`DiscordMessageApiPayload`, component types) defined in `articles/formatter/` despite the CLAUDE.md rule that events upstream of delivery must not carry Discord shapes
- No structural enforcement of pipeline stage ordering

## Decision

Restructure the service's `src/` directory into a **pipeline architecture with domain-partitioned modules and a platform branching point at the delivery boundary**.

### Module layout

```
src/
├── articles/           Platform-agnostic article processing
│   ├── parser/           Parse RSS/Atom into Article objects
│   ├── comparison/       Deduplicate articles against stored state
│   └── filters/          Evaluate filter expressions against articles
│
├── formatting/          Platform-agnostic text utilities
│   ├── placeholder-engine   {{placeholder}} template resolution
│   ├── text-splitter        Split text to fit character limits
│   ├── custom-placeholders  Regex/URL-encode/date-format pipeline
│   └── exceptions           Shared exception classes
│
├── delivery/            Delivery domain (platform branching point)
│   ├── discord/           All Discord-specific code
│   │   ├── html-to-discord          HTML→Discord markdown conversion
│   │   ├── discord-payload-builder  Discord API payload generation
│   │   ├── formatting-types         Discord component/embed/payload types
│   │   ├── delivery-routing         Channel/webhook/forum delivery methods
│   │   ├── result-processor         Discord HTTP status→error classification
│   │   ├── preview-diagnostics      Rate limit/filter diagnostic recording
│   │   ├── discord-rest-client      REST client abstraction
│   │   └── synzen-discord-rest      Production REST client (RabbitMQ-backed)
│   ├── rate-limiting      Platform-agnostic rate limit checks
│   └── types              Shared delivery types (DeliveryMedium, etc.)
│
├── pipeline/            Orchestration (event handlers)
│   ├── feed-event-handler       Main pipeline: parse→compare→filter→deliver
│   ├── delivery-result-handler  Process delivery callback results
│   ├── feed-cleanup-handler     Feed deletion cleanup
│   ├── generate-delivery-preview  Delivery preview orchestration
│   └── services/                Shared article/feed services for HTTP API
│
├── stores/              Centralized persistence (Postgres + Redis)
├── http/                REST API handlers
├── feed-fetcher/        Feed HTTP fetching (leaf module)
└── shared/              Logger, constants, schemas
    └── delivery-preview/  Preview instrumentation SDK (context, types, stage builder)
```

### Key architectural rules

1. **`articles/` is platform-agnostic.** No Discord types, no Discord imports. Parser, comparison, and filters operate on generic `Article` objects.

2. **`formatting/` is platform-agnostic.** Placeholder resolution, text splitting, and custom placeholder processing are reusable across any delivery platform.

3. **All Discord-specific code lives in `delivery/discord/`.** This includes HTML-to-Discord-markdown conversion, payload generation, component builders, and delivery routing. Adding a new platform means creating `delivery/slack/` (or similar) alongside `delivery/discord/` without touching any other module.

4. **Formatting is a per-medium transformation, not a pipeline stage.** `formatArticleForDiscord` is called inside the per-medium delivery loop in `delivery-routing.ts` because each medium can have different formatter options and custom placeholders. Medium-level filters also evaluate against formatted text. This is intentional — do not move formatting to the pipeline orchestrator.

5. **`pipeline/` is the only module that imports from both `articles/` and `delivery/`.** It enforces pipeline ordering. Other modules should not reach across this boundary.

6. **`stores/` remains centralized** rather than distributed into domain modules. The store interfaces are clean and the shared migration/connection pool infrastructure makes centralization pragmatic.

## Consequences

- Adding a new delivery platform (Slack, email) requires only creating a new subdirectory under `delivery/` with its own formatting, types, and routing — no changes to `articles/`, `formatting/`, `pipeline/`, or `stores/`.
- The largest implementation file is now ~570 lines (`delivery-routing.ts`), down from 1,792.
- Import paths are longer for some files (e.g., `../../delivery/discord/html-to-discord` instead of `../../articles/formatter`), but the domain ownership is unambiguous.
- The `delivery/` barrel (`index.ts`) absorbs internal restructuring — external consumers import from `../delivery` and are insulated from file moves within `delivery/discord/`.
