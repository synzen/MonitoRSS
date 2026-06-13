# ADR-005 — Workspace scoping: hybrid `/me` vs `/workspaces/:workspaceSlug` routes, optional ownership field

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/src/`. Backend changes assumed but out of scope here.

## Context

The maintainer's roadmap includes a "workspace plan" that lets multiple users manage feeds together, modeled as a **workspace as top-level container** (like Slack workspaces or GitHub orgs — users belong to workspaces, workspaces own feeds). The chosen URL shape is **hybrid: personal scope and workspace scope side-by-side**, in the style of Linear and Notion (`/me/...` for personal, `/workspaces/:workspaceSlug/...` for workspace).

This is a meaningful architectural change because today:

- All routes are user-scoped without a prefix: `/feeds`, `/feeds/:feedId`, `/feeds/:feedId/discord-channel-connections/:connectionId`, etc.
- The `UserFeed` Yup schema (`features/feed/types/UserFeed.ts`) has no `ownerUserId`, `workspaceId`, or any ownership field. Grep confirmed: 0 hits across the client for these names.
- `getUserFeeds()` (`features/feed/api/getUserFeeds.ts:44`) hits `/api/v1/user-feeds?<searchParams>` — implicitly the current user's feeds. No workspace parameter exists.
- `features/discordServers/` happens to be a scoping container of sorts (it's "what guilds can I pick from?"), but it's not a workspace model. A workspace is application-owned and can integrate with multiple Discord guilds; the existing concept is the wrong abstraction.
- `pages/index.tsx` has no layout route per scope — every route is registered at the top level.

The workspace plan isn't being built right now, but its design constraints affect decisions being made today (e.g., should filters live in the URL — yes, per ADR-003, because "send me a link to your filtered view of workspace feeds" is a natural ask).

## Decision

### Position: design the seams now, don't build the feature

Mirroring ADR-004's stance for destinations: we will **define the route shape, the API shape, and the data-model field** so that adding workspaces later is additive and small. We will NOT add a workspace picker, a workspace management page, or any UI that consumes the seams. The seams are forward compatibility, not vaporware.

### URL shape

```
Personal scope (default, no prefix today):
  /feeds                          ← user's personal feeds list
  /feeds/:feedId
  /feeds/:feedId/discord-channel-connections/:connectionId
  /add-feeds
  /settings

Future personal scope (with explicit /me prefix):
  /me/feeds                       ← same as above, just explicit
  /me/feeds/:feedId
  …

Future workspace scope:
  /workspaces/:workspaceSlug/feeds
  /workspaces/:workspaceSlug/feeds/:feedId
  /workspaces/:workspaceSlug/feeds/:feedId/discord-channel-connections/:connectionId
  /workspaces/:workspaceSlug/settings
```

**Today's decision:** the existing unprefixed routes continue to resolve. When workspaces ship, they become aliases for `/me/...` routes (server-side rewrite or client-side redirect). New code should NOT add un-prefixed routes that would conflict with `/workspaces/:workspaceSlug/`. Specifically:

- No top-level route at `/workspaces` for any purpose other than the future workspace scope.
- `pages.userFeeds()` and similar route builders accept an optional scope, falling back to today's shape:

  ```ts
  // constants/pages.ts
  type RouteScope = { workspaceSlug?: string };

  const scopePrefix = (scope?: RouteScope) =>
    scope?.workspaceSlug ? `/workspaces/${scope.workspaceSlug}` : '';

  userFeeds: (scope?: RouteScope) => `${scopePrefix(scope)}/feeds`,
  userFeed: (feedId: string, opts?: { tab?, new?: boolean }, scope?: RouteScope) =>
    `${scopePrefix(scope)}/feeds/${feedId}${opts?.tab ?? ''}…`,
  ```

  All call sites that don't pass a scope continue to work unchanged.

### Data model

Add an **optional** `workspaceId?: string | null` to the `UserFeed` Yup schema. When the workspace plan ships, the field becomes the source of truth for ownership.

> **Note (2026-05-31):** The "backend may continue to ignore it" framing originally here is superseded — see the Amendment (2026-05-31) below. `workspaceId` is now an active field: backend enforces it for ownership, quota, and scope isolation.

```ts
// features/feed/types/UserFeed.ts
export const UserFeedSchema = object({
  // …existing fields…
  workspaceId: string().nullable().optional(),
});
```

API calls (`getUserFeeds`, `createUserFeed`, etc.) accept an optional `workspaceId` parameter. The seam exists.

`shareManageOptions.invites[]` (which currently references Discord user IDs) stays — that's a different concept (per-feed sharing within a personal account, vs. per-workspace membership) and the two should not be conflated.

### Routing tree

The `<SentryRoutes>` block in `pages/index.tsx` does NOT need to change today. When workspaces ship, it will gain layout routes:

```tsx
<SentryRoutes>
  {/* Existing personal routes — kept as default */}
  <Route path="/feeds" element={<UserFeeds />} />
  <Route path="/feeds/:feedId" element={<UserFeed />} />
  …

  {/* New workspace routes layered on top */}
  <Route path="/workspaces/:workspaceSlug" element={<WorkspaceScopeLayout />}>
    <Route path="feeds" element={<UserFeeds />} />
    <Route path="feeds/:feedId" element={<UserFeed />} />
    …
  </Route>
</SentryRoutes>
```

The page components (`<UserFeeds />`, `<UserFeed />`) are scope-agnostic — they read the scope from `useParams()` (or get `undefined`) and pass it through to React Query hooks as an optional arg. No page is rewritten; the scope flows through as a parameter.

This is enabled by:

- Page components reading `workspaceSlug` from route params (TBD when workspaces ship; not today).
- React Query hooks accepting the scope and including it in the queryKey so personal-scope and workspace-scope queries are cached independently.

### Permission UI is out of scope here

Whether the workspace plan has roles (owner/admin/etc.), audit logs, etc. is a UX/product decision that this ADR doesn't take. The route shape and ownership-field decisions above don't presuppose any specific permission model — they support any model the workspace plan eventually adopts.

### What we are NOT doing now

- Not building workspace CRUD.
- Not adding a workspace picker to the header.
- Not refactoring `features/discordServers/` — it stays as a Discord guild listing (which is what it is), separate from the eventual workspace concept.
- Not introducing role/permission types.
- Not adding `useCurrentScope()` or similar hooks — without consumers, that's speculation.

## Consequences

**Easier:**

- When the workspace plan is committed, the route changes are additive (a layout route + an optional scope in route builders and API calls). No global rewrite.
- Per-feed cache isolation is automatic once the scope is part of the queryKey — no workspace's data bleeds into another's.
- Existing personal-scope routes continue to work without change. No user-visible regression.

**Harder:**

- Route builders gain an optional parameter. Slightly more verbose at call sites that pass it (none today).
- The `UserFeed` schema gains a nullable field, which means form code that creates/edits feeds must handle it (today: ignore it; future: scope-aware).

**Lost:**

- The ability to introduce `/workspaces` for any other purpose (e.g. as a marketing page). The path is reserved.

**Specifically for the workspace plan implementation phase (future):**

- Backend ADR will be needed for the workspace membership / ownership model. The frontend ADR here is decoupled from that — only the API contract (does `getUserFeeds()` take a scope?) is shared.
- An ADR-008 (or similar) will be needed for the workspace-picker UI, the workspace-management routes, and the permission UI.

**Implementation note:**

The forward-compatibility shell is in place: the route builders in `constants/pages.ts` accept an optional `RouteScope`, `getUserFeeds()` accepts an optional scope, and `UserFeedSchema` carries an optional nullable `workspaceId`. No UI consumes these yet — they exist so the eventual workspace-plan work is additive rather than a rewrite.

## Alternatives considered

- **Ambient workspace via Context (no URL prefix).** Considered and rejected during review. URL-based scoping is required for shareable workspace-scoped links and is closer to GitHub/Linear/Notion conventions.
- **All routes go under `/me/` or `/workspaces/:workspaceSlug/` (no implicit personal default).** Rejected because it requires migrating every existing URL on day one, which breaks bookmarks and is unnecessary churn for a feature that isn't shipping yet.
- **`/orgs/:orgId/workspaces/:workspaceSlug/...` (two-level org/workspace).** Out of scope. Hybrid `/workspaces/:workspaceSlug` is the chosen shape; if a containing org layer becomes a need, that's ADR-N. (This is also why "team" is left unused — it's the natural name for a future *inner* grouping; see backend ADR-002 §Context.)
- **Build the workspace feature now to "get it out of the way."** Rejected by the maintainer's roadmap framing. This ADR is forward-compatibility, not implementation.
- **Refactor `features/discordServers/` to become the workspace container.** Rejected — these are different concepts. A workspace is application-owned; a Discord guild is external. Conflating them would lock the workspace model to a 1:1 relationship with Discord guilds, which contradicts the destination-extensibility direction (ADR-004).

## Decisions locked in

> **Note (2026-05-31):** The "opaque IDs (not slugs)" decision and the "Slug-based URLs are deferred" rationale below are superseded — see the Amendment (2026-05-31). URLs shipped as slug-based (`/workspaces/:workspaceSlug/...`).

- **Naming:** `workspace` / `workspaceId`. The outer membership + resource unit, matching better-auth's `organization` plugin and reference platforms (Slack/Linear/Notion workspaces, GitHub orgs); "team" is left free for a future inner grouping. Backend and frontend share this name.
- **URL shape:** **implicit `/me`** — personal-scope routes stay unprefixed (`/feeds`, `/feeds/:feedId`). Workspace-scope routes use `/workspaces/:workspaceId/...` with **opaque IDs** (not slugs). Bookmarks survive; no redirect on personal URLs. Slug-based URLs are deferred — they're a UX-nicety that adds backend cost (uniqueness, rename handling) and can be added later as an ADR-N additive change if the workspace plan grows enough to demand readable URLs.

## Deferred (not blocking acceptance)

- **Scope-aware caching: include the scope in every `features/feed/hooks/useUserFeed*()` queryKey from day one (even when it's always undefined), or only at the point where the field becomes consumed?** Decision deferred to the workspace-plan implementation phase. Recommendation when that lands: only at the point of use, to avoid cache misses during the migration.

---

## Amendment (2026-05-31) — slug-based workspace URLs; `workspaceId` is an active field

**Status:** Accepted (supersedes the "Decisions locked in" slug deferral and the "Data model" dormant-seam framing).

### Slug-based URLs replace opaque IDs

The locked-in decision of `/workspaces/:workspaceId/...` with opaque IDs was superseded before the branch shipped. Workspace scope URLs are `/workspaces/:workspaceSlug/...` throughout — backend routes, client route builders (`scopePrefix` in `constants/pages.ts`), `RouteParams` type, and `CurrentWorkspaceContext` all use `workspaceSlug`.

The `RouteScope` type shipped as `{ workspaceSlug?: string }`. `pages.workspaceSettings()` takes a `workspaceSlug` argument. Mock handlers key on `slug`. The route tree is `<Route path="/workspaces/:workspaceSlug" element={<WorkspaceScopeLayout />}>`.

**Why it was worth the backend cost.** The "Decisions locked in" rationale cited uniqueness and rename handling as the blocker. Both were addressed in the same round: a unique index on `slug` and the `WORKSPACE_SLUG_TAKEN` error code for conflicts. No backfill was needed — slugs ship with workspaces, so every workspace has one from creation. The cost was acceptable given that readable, shareable workspace URLs (e.g. `/workspaces/acme-marketing/feeds`) are materially better for UX than opaque ObjectId strings. See backend ADR-002 §6 for the full slug model (the shared `SLUG_PATTERN`/`SLUG_MAX` validation source of truth).

### `workspaceId` is now an active field (supersedes the "Data model" dormant-seam framing)

The "Backend may continue to ignore it" / dormant-seam framing in the Data model section is superseded. `workspaceId` on `UserFeed` is enforced by the backend: it gates ownership, quota, and scope isolation. See backend ADR-002 §7 for the full feed↔workspace model (workspace quota via `getWorkspaceBenefits`, insulation from personal supporter limits, scope isolation in queries). The client-side `workspaceId` in `UserFeedSchema` and the scope in `getUserFeeds()` are active, consumed parameters — not forward-compatibility seams.
