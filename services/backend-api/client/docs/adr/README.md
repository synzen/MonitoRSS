# Frontend Architecture Decision Records

This folder contains ADRs for `services/backend-api/client/` — the React app served by `backend-api`.

The repo-root `docs/adr/` and the backend's `services/backend-api/docs/adr/` capture decisions for the backend and the wider system. This folder is scoped to the frontend only. Cross-references to other ADR folders are explicit (e.g. "root ADR-003", "backend ADR-001").

## Status

ADR-001 through ADR-006 were authored and Accepted on 2026-05-28 after maintainer review. Changes from the initial drafts are recorded in each ADR's "Decisions locked in" section. The restructuring they describe has since been carried out in the codebase.

ADR-007 was authored and Accepted on 2026-06-05. It is the durable, self-contained successor to the `client/docs/chakra-v3-visual-audit/` working folder (a Chakra v3 migration scaffold, now deleted); the role system, theming mechanism, contrast gate, and `--app-*` boundary it describes are live in the codebase.

## Format

Each ADR follows the [Michael Nygard one-pager template](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions):

- **Title:** ADR-NNN — short imperative summary.
- **Status:** Proposed / Accepted / Deprecated / Superseded.
- **Context:** the forces at play.
- **Decision:** what we chose.
- **Consequences:** what becomes easier, harder, or impossible.

## Index

| # | Title | Status |
|---|---|---|
| [001](001-architecture-characteristics.md) | Driving architecture characteristics: a11y, maintainability, extensibility | Accepted |
| [002](002-folder-model.md) | Folder model: thin pages, fat features (with destination sub-features), narrow shared base | Accepted |
| [003](003-state-ownership.md) | State ownership: React Query for server, URL for shareable, Context only for cross-cutting | Accepted |
| [004](004-destination-extensibility.md) | Destination extensibility: keep the FeedConnectionType shell honest via destination sub-features | Accepted |
| [005](005-workspace-scoping.md) | Workspace scoping: implicit `/me` + slug-based `/workspaces/:workspaceSlug/...` | Accepted |
| [006](006-fitness-functions.md) | Frontend fitness functions: three ESLint architecture rules | Accepted |
| [007](007-styling-roles-tiers-contrast.md) | Styling: a semantic role system, encoding mechanisms, and a contrast gate | Accepted |
| [008](008-workspace-ui.md) | Workspace UI: a count-gated header workspace switcher, scope-agnostic pages, owner/admin settings | Accepted |

## When to write a new frontend ADR

- A decision constrains where future code goes (folder model, state ownership).
- A decision records a trade-off the maintainer will second-guess later.
- A library or framework is being replaced.
- A feature crosses architectural boundaries (destinations, workspace scoping).

Implementation details visible from code don't need ADRs.
