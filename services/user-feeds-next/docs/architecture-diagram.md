# user-feeds-next Architecture Diagram

See [ADR-008](../../../docs/adr/008-user-feeds-next-internal-architecture.md) for the full decision record.

## Module Layout

```
                    ┌─────────────────────────────────────────────┐
                    │              pipeline/                      │
                    │  feed-event-handler (orchestrator)          │
                    │  delivery-result-handler                    │
                    │  feed-cleanup-handler                       │
                    │  generate-delivery-preview                  │
                    │  services/ (article fetching, feed utils)   │
                    └──┬───────┬───────┬───────┬───────┬─────────┘
                       │       │       │       │       │
            ┌──────────┘  ┌────┘  ┌────┘  ┌────┘  ┌───┘
            ▼             ▼       ▼       ▼       ▼
     ┌────────────┐ ┌────────┐ ┌──────┐ ┌─────────────────┐ ┌─────────────┐
     │ articles/  │ │deliver/│ │stores│ │shared/          │ │feed-fetcher/│
     │  parser    │ │        │ │      │ │ logger           │ │(no src deps)│
     │  comparison│ │ discord│ │ifaces│ │ consts           │ └─────────────┘
     │  filters   │ │ ┌─────┤ │pg    │ │ schemas          │
     └─────┬──────┘ │ │fmt  │ │redis │ │ delivery-preview/│
           │        │ │route│ └──────┘ └─────────────────┘
           │        │ │rslt │
     ┌─────┘        │ └─────┤
     ▼              │ rate- │
  ┌───────────┐     │ limit │
  │formatting/│     │ types │
  │placeholder│     └───┬───┘
  │splitter   │◄────────┘
  │custom-ph  │  (delivery/discord imports
  │exceptions │   formatting/ for text utils)
  └───────────┘

  ┌──────────┐
  │  http/   │ ── imports from all modules above
  │ handlers │
  │ schemas  │
  └──────────┘
```

## Dependency Rules

Arrows point from consumer to dependency. If there is no arrow, the import is **forbidden** (enforced by ESLint `import/no-restricted-paths`).

```
                    shared/  formatting/  articles/  stores/  feed-fetcher/
                      ▲         ▲           ▲         ▲          ▲
                      │         │           │         │          │
pipeline/        ─────┼─────────┼───────────┼─────────┼──────────┘
                      │         │           │         │
delivery/discord ─────┼─────────┼───────────┼─────────┘
                      │         │           │
http/            ─────┴─────────┴───────────┴─── (imports everything above) ───
```

### What each module can import

| Module | Can import from |
|--------|----------------|
| `articles/` | `shared/`, `formatting/` |
| `formatting/` | `articles/parser` (for Article type only) |
| `delivery/discord/` | `shared/`, `formatting/`, `articles/`, `stores/` |
| `delivery/` (top-level) | `shared/` |
| `pipeline/` | `shared/`, `formatting/`, `articles/`, `stores/`, `delivery/`, `feed-fetcher/` |
| `stores/` | `shared/`, `articles/` (for Article type only) |
| `http/` | Everything (it's the outermost layer) |
| `feed-fetcher/` | External packages only (no `src/` imports) |
| `shared/` | External packages only |

### Forbidden imports (enforced by ESLint)

| Module | Cannot import from |
|--------|-------------------|
| `articles/` | `delivery/`, `delivery/discord/`, `pipeline/`, `http/` |
| `formatting/` | `delivery/`, `delivery/discord/`, `pipeline/`, `http/`, `stores/` |
| `stores/` | `pipeline/`, `delivery/`, `delivery/discord/`, `http/` |
| `delivery/`, `delivery/discord/` | `pipeline/` |
| `pipeline/` | `http/` |

## Pipeline Flow

```
url.fetch-completed
  → [Parse]     articles/parser         → Article[]
  → [Compare]   articles/comparison     → articles to deliver
  → [Deliver]   delivery/discord/       → for each medium:
                                             format (Discord markdown)
                                             → filter (medium-level)
                                             → generate payloads
                                             → route to Discord API
  → [Result]    delivery/discord/       → error classification + rejection events
```

**Formatting and filtering are per-medium, not pipeline stages.** Each medium can have different formatter options, custom placeholders, and filter expressions. Medium-level filters evaluate against the formatted text. This is why both `formatArticleForDiscord` and `getArticleFilterResults` are called inside delivery's per-medium loop (`sendArticleToMedium`), not in the pipeline orchestrator.

The filter evaluation engine lives in `articles/filters/` (platform-agnostic), but delivery decides when to call it and what to pass it.
