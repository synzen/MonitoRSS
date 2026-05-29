# ADR-005 — Team/org scoping: hybrid `/me` vs `/teams/:teamId` routes, optional ownership field

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/src/`. Backend changes assumed but out of scope here.

## Context

The maintainer's roadmap includes a "team plan" that lets multiple users manage feeds together, modeled as an **org/team as top-level container** (like Slack workspaces or GitHub orgs — users belong to teams, teams own feeds). The chosen URL shape is **hybrid: personal scope and team scope side-by-side**, in the style of Linear and Notion (`/me/...` for personal, `/teams/:teamId/...` for team).

This is a meaningful architectural change because today:

- All routes are user-scoped without a prefix: `/feeds`, `/feeds/:feedId`, `/feeds/:feedId/discord-channel-connections/:connectionId`, etc.
- The `UserFeed` Yup schema (`features/feed/types/UserFeed.ts`) has no `ownerUserId`, `teamId`, or any ownership field. Grep confirmed: 0 hits across the client for these names.
- `getUserFeeds()` (`features/feed/api/getUserFeeds.ts:44`) hits `/api/v1/user-feeds?<searchParams>` — implicitly the current user's feeds. No team parameter exists.
- `features/discordServers/` happens to be a scoping container of sorts (it's "what guilds can I pick from?"), but it's not a team model. A team is application-owned and can integrate with multiple Discord guilds; the existing concept is the wrong abstraction.
- `pages/index.tsx` has no layout route per scope — every route is registered at the top level.

The team plan isn't being built right now, but its design constraints affect decisions being made today (e.g., should filters live in the URL — yes, per ADR-003, because "send me a link to your filtered view of team feeds" is a natural ask).

## Decision

### Position: design the seams now, don't build the feature

Mirroring ADR-004's stance for destinations: we will **define the route shape, the API shape, and the data-model field** so that adding teams later is additive and small. We will NOT add a team picker, a team management page, or any UI that consumes the seams. The seams are forward compatibility, not vaporware.

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

Future team scope:
  /teams/:teamId/feeds
  /teams/:teamId/feeds/:feedId
  /teams/:teamId/feeds/:feedId/discord-channel-connections/:connectionId
  /teams/:teamId/settings
```

**Today's decision:** the existing unprefixed routes continue to resolve. When teams ship, they become aliases for `/me/...` routes (server-side rewrite or client-side redirect). New code should NOT add un-prefixed routes that would conflict with `/teams/:teamId/`. Specifically:

- No top-level route at `/teams` for any purpose other than the future team scope.
- `pages.userFeeds()` and similar route builders accept an optional scope, falling back to today's shape:

  ```ts
  // constants/pages.ts
  type Scope = { kind: 'personal' } | { kind: 'team'; teamId: string };

  const scopePrefix = (scope?: Scope) =>
    !scope || scope.kind === 'personal' ? '' : `/teams/${scope.teamId}`;

  userFeeds: (scope?: Scope) => `${scopePrefix(scope)}/feeds`,
  userFeed: (feedId: string, opts?: { tab?, new?: boolean }, scope?: Scope) =>
    `${scopePrefix(scope)}/feeds/${feedId}${opts?.tab ?? ''}…`,
  ```

  All call sites that don't pass a scope continue to work unchanged.

### Data model

Add an **optional** `teamId?: string | null` to the `UserFeed` Yup schema. Backend may continue to ignore it for now. When the team plan ships, the field becomes the source of truth for ownership.

```ts
// features/feed/types/UserFeed.ts
export const UserFeedSchema = object({
  // …existing fields…
  teamId: string().nullable().optional(),
});
```

API calls (`getUserFeeds`, `createUserFeed`, etc.) accept an optional `teamId` parameter; the backend can ignore it today. The seam exists.

`shareManageOptions.invites[]` (which currently references Discord user IDs) stays — that's a different concept (per-feed sharing within a personal account, vs. per-team membership) and the two should not be conflated.

### Routing tree

The `<SentryRoutes>` block in `pages/index.tsx` does NOT need to change today. When teams ship, it will gain layout routes:

```tsx
<SentryRoutes>
  {/* Existing personal routes — kept as default */}
  <Route path="/feeds" element={<UserFeeds />} />
  <Route path="/feeds/:feedId" element={<UserFeed />} />
  …

  {/* New team routes layered on top */}
  <Route path="/teams/:teamId" element={<TeamScopeLayout />}>
    <Route path="feeds" element={<UserFeeds />} />
    <Route path="feeds/:feedId" element={<UserFeed />} />
    …
  </Route>
</SentryRoutes>
```

The page components (`<UserFeeds />`, `<UserFeed />`) are scope-agnostic — they read `teamId` from `useParams()` (or get `undefined`) and pass it through to React Query hooks as an optional arg. No page is rewritten; the scope flows through as a parameter.

This is enabled by:

- Page components reading `teamId` from route params (TBD when teams ship; not today).
- React Query hooks accepting `teamId` and including it in the queryKey so personal-scope and team-scope queries are cached independently.

### Permission UI is out of scope here

Whether the team plan has roles (admin/editor/viewer), audit logs, etc. is a UX/product decision that this ADR doesn't take. The route shape and ownership-field decisions above don't presuppose any specific permission model — they support any model the team plan eventually adopts.

### What we are NOT doing now

- Not building team CRUD.
- Not adding a team picker to the header.
- Not refactoring `features/discordServers/` — it stays as a Discord guild listing (which is what it is), separate from the eventual team concept.
- Not introducing role/permission types.
- Not adding `useCurrentScope()` or similar hooks — without consumers, that's speculation.

## Consequences

**Easier:**

- When the team plan is committed, the route changes are additive (a layout route + an optional `teamId` in route builders and API calls). No global rewrite.
- Per-feed cache isolation is automatic once `teamId` is part of the queryKey — no team's data bleeds into another's.
- Existing personal-scope routes continue to work without change. No user-visible regression.

**Harder:**

- Route builders gain an optional parameter. Slightly more verbose at call sites that pass it (none today).
- The `UserFeed` schema gains a nullable field, which means form code that creates/edits feeds must handle it (today: ignore it; future: scope-aware).

**Lost:**

- The ability to introduce `/teams` for any other purpose (e.g. as a marketing page). The path is reserved.

**Specifically for the team plan implementation phase (future):**

- Backend ADR will be needed for the team membership / ownership model. The frontend ADR here is decoupled from that — only the API contract (does `getUserFeeds()` take a `teamId`?) is shared.
- An ADR-008 (or similar) will be needed for the team-picker UI, the team-management routes, and the permission UI.

**Implementation note:**

The forward-compatibility shell is in place: the route builders in `constants/pages.ts` accept an optional `RouteScope`, `getUserFeeds()` accepts an optional `teamId`, and `UserFeedSchema` carries an optional nullable `teamId`. No UI consumes these yet — they exist so the eventual team-plan work is additive rather than a rewrite.

## Alternatives considered

- **Ambient team via Context (no URL prefix).** Considered and rejected during review. URL-based scoping is required for shareable team-scoped links and is closer to GitHub/Linear/Notion conventions.
- **All routes go under `/me/` or `/teams/:teamId/` (no implicit personal default).** Rejected because it requires migrating every existing URL on day one, which breaks bookmarks and is unnecessary churn for a feature that isn't shipping yet.
- **`/orgs/:orgId/teams/:teamId/...` (two-level org/team).** Out of scope. Hybrid `/teams/:teamId` is the chosen shape; if orgs containing teams become a need, that's ADR-N.
- **Build the team feature now to "get it out of the way."** Rejected by the maintainer's roadmap framing. This ADR is forward-compatibility, not implementation.
- **Refactor `features/discordServers/` to become the team container.** Rejected — these are different concepts. A team is application-owned; a Discord guild is external. Conflating them would lock the team model to a 1:1 relationship with Discord guilds, which contradicts the destination-extensibility direction (ADR-004).

## Decisions locked in

- **Naming:** `team` / `teamId`. Familiar (Slack, Linear), short, matches the user-facing "team plan" framing. Backend and frontend share this name.
- **URL shape:** **implicit `/me`** — personal-scope routes stay unprefixed (`/feeds`, `/feeds/:feedId`). Team-scope routes use `/teams/:teamId/...` with **opaque IDs** (not slugs). Bookmarks survive; no redirect on personal URLs. Slug-based URLs are deferred — they're a UX-nicety that adds backend cost (uniqueness, rename handling) and can be added later as an ADR-N additive change if the team plan grows enough to demand readable URLs.

## Deferred (not blocking acceptance)

- **Scope-aware caching: include `teamId` in every `features/feed/hooks/useUserFeed*()` queryKey from day one (even when it's always undefined), or only at the point where the field becomes consumed?** Decision deferred to the team-plan implementation phase. Recommendation when that lands: only at the point of use, to avoid cache misses during the migration.
