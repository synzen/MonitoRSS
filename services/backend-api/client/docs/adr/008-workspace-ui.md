# ADR-008 — Workspace UI: a count-gated header workspace switcher, scope-agnostic pages, owner/admin settings

**Status:** Accepted
**Date:** 2026-05-29 (header switcher 2026-05-30; slugs + real workspace feeds 2026-05-31)
**Scope:** `services/backend-api/client/src/`. The API contract and data model are backend ADR-002.

## Addendum (2026-06-10) — navigation clauses revised

The navigation-freeze parts of this ADR no longer hold: §10's "permanent header order … the header layout never changes" (the switcher is now a path-connected chip after the logo), §8's outline-button trigger presentation (accessible name, keyboard pattern, and gating are reaffirmed), and the E2E plan's "default landing" assertion (#4 — landing is now sticky-scope via `preferences.lastActiveWorkspaceSlug`). Everything else here stands.

## Addendum (2026-06-07) — user-facing label is "Team", code/URLs/API stay "Workspace"

The entity is named **Workspace** throughout the code, data model, URLs (`/workspaces/:workspaceSlug`), API routes, env vars, and error codes (see [[project_teams_renamed_workspaces]] for why `Workspace` was chosen over `Team` at the model layer — it aligns with better-auth's `organization` plugin and keeps `team` free for a future inner sub-grouping).

However, **all user-visible copy presents it as "Team"** — it is the more obvious, familiar word for end users. So: headings, field labels, buttons, validation/error messages, `aria-label`s, live-region announcements, placeholders, and the standard error-code message map all say "team" (e.g. "Create a team", "Team name", "Team settings", "Your teams", "Switch team"). Component names, hooks, contexts, the `features/workspaces/` slice, route builders, query keys, and the `featureFlags.workspaces` flag remain "workspace".

**Deliberately kept as "workspace" in UI:** the literal `/workspaces/` URL prefix shown in the slug input addon and the "URL preview: /workspaces/…" helper text — these display the real, navigable path (routes are unchanged), so showing anything else would be inaccurate.

This is a copy-only mapping (label ≠ identifier); there is no second entity. When adding new workspace UI, write user-facing strings as "team" and keep all identifiers "workspace". The prose below predates this addendum and still says "workspace" when describing the UI — read those as the user seeing "team".

## Context

Client ADR-005 ("Workspace scoping") reserved this ADR for "the workspace-picker UI, the workspace-management routes, and the permission UI." ADR-005 built only seams (`RouteScope`/`scopePrefix` in `constants/pages.ts`, `getUserFeeds()`'s optional scope, `UserFeedSchema.workspaceId`) and consumed none. This ADR designs the UI that consumes them.

Requirements:
- A way to enter either a workspace's dashboard or the existing personal dashboard (req #3).
- The **existing personal dashboard works exactly as before** (req #4) — no regression, no forced `/feeds` migration.
- Creating a workspace needs a verified email + a name (req #5); inviting members is out of scope (req #2).
- Two roles — owner/admin; every member edits, only an owner does owner-only actions (delete / transfer ownership).
- All workspace UI is feature-flag gated (req #7).
- Testable with existing E2E patterns, **no mail server** (NFR #1).

Ground truth reused (not reinvented):
- **Routing:** react-router-dom v6, routes in `pages/index.tsx`, builders in `constants/pages.ts` (already scope-aware).
- **Server state:** React Query v4 + `fetchRest()` API layer + per-feature hooks (ADR-003: server state ⇒ React Query, shareable ⇒ URL, cross-cutting ⇒ Context).
- **Feature flags:** `useUserMe().featureFlags` (`externalProperties` precedent); backend adds `workspaces?: boolean`.
- **Current-entity context precedent:** `UserFeedContext` — id prop → query hook → memoized value → `useX()`.
- **No global sidebar:** navigation is the top header (`NewHeader`/`AppHeader`) + centered content; `SidebarLink` is page-local.
- **Client conventions (`client/CLAUDE.md`):** every request needs a mock handler + a visible, announced loading state + a near-the-action error state; native HTML preferred; forms = react-hook-form + yup → mutation → PageAlert + InlineErrorAlert.

## Decision

### 1. Switching lives in a count-gated header workspace switcher

> An earlier draft made a dedicated hidden `/workspaces` page the entry point. It was replaced before shipping — there is no global sidebar to host a workspace list, and workspaces is a low-cardinality paid feature (most users have 0 workspaces; payers typically 1), so a full-width page rendering 1–2 rows is mostly empty space. Switching belongs in a content-proportional control, not a page. The `/workspaces` route name stays free for future use.

A `workspaceSlot` on `NewHeader` (rendered between the logo and the search cluster; wired by `AppHeader` so the shared-base `NewHeader` stays feature-free). It is a native Chakra `Menu`: a button labelled with the active workspace, opening a list of "Personal" + each workspace. Selecting routes (`Personal → pages.userFeeds()`, workspace → `/workspaces/:workspaceSlug/feeds`). Active scope is **derived** from the router + `useCurrentWorkspace()` (`null` ⇒ Personal) — no new state mechanism.

**Count-gated (progressive disclosure):** when `useWorkspaces()` returns **0 workspaces**, the switcher is not rendered — the header is byte-for-byte today's. It appears only at ≥1 workspace. Feature-flag gating (`useIsWorkspacesEnabled()`) still applies on top: flag off ⇒ no switcher regardless of count.

**Two gating layers, both client-checked for rendering and re-enforced server-side** (backend ADR-002 §6/§8): the deployment toggle (self-hoster opt-in, surfaced through the `/users/@me` capability path — off ⇒ no workspaces surface at all) and the per-user rollout flag (`useUserMe().featureFlags.workspaces`). The client gate is UX only; correctness is the server's (it won't register routes / will `403`).

### 2. Workspace scope reuses the existing pages via a layout route

Page components stay scope-agnostic, read the workspace from `useParams()`, and pass it to hooks:

```tsx
// pages/index.tsx — additive; existing personal routes untouched
<Route path="/workspaces/:workspaceSlug" element={<WorkspaceScopeLayout />}>
  <Route path="feeds" element={<UserFeeds />} />
  <Route path="feeds/:feedId" element={<UserFeed />} />
  {/* …mirrors the personal subtree… */}
</Route>
```

`<UserFeeds />`/`<UserFeed />` are **not forked** — they read the route param (`undefined` in personal scope) and forward it to `useUserFeeds({ workspaceId })` etc. The hooks add it to their **queryKey** so personal and workspace caches never bleed (ADR-005's "include at point of use" recommendation, followed only now that it's consumed). `WorkspaceScopeLayout` self-gates via `useIsWorkspacesEnabled()` and validates the slug against the user's memberships (`useWorkspaces()`); a non-member or unknown slug renders not-found/forbidden rather than leaking an empty dashboard.

URLs are **slug-based** (`/workspaces/:workspaceSlug`, not `:workspaceId`) — see backend ADR-002 §6 and ADR-005 Amendment for the slug model. `RouteParams` carries `workspaceSlug`; `RouteScope` is `{ workspaceSlug?: string }`; `scopePrefix` builds `/workspaces/${scope.workspaceSlug}`; `useWorkspace({ workspaceSlug })` and `["workspace", { workspaceSlug }]` keys are slug-keyed throughout.

### 3. `CurrentWorkspaceContext` — the one new Context (ADR-003 Q4)

Workspace scope needs `{ id, name, slug, myRole }` in two unrelated places — the header (which workspace you're in) and the settings page (role-gating). That's "cross-cutting, ≥2 unrelated consumers" ⇒ Context. Mirrors `UserFeedContext`: provided by `WorkspaceScopeLayout` from a `useWorkspace()` query, memoized, exposed via `useCurrentWorkspace()`. Personal scope renders no provider; `useCurrentWorkspace()` returns `null` and pages treat `null` as personal. No `useCurrentScope()` mega-hook (ADR-005 rejected speculative scope hooks).

### 4. Workspace creation: gated on a verified, owned email captured passwordlessly

Two UI steps, because the gate is an owned-and-verified email, not the Discord email (backend ADR-002 §4):

- **Step A — verify an owned email (one-time, passwordless).** If `useUserMe()` shows no `verifiedEmail`, the create action becomes a "Verify an email" prompt: an email field pre-filled with the Discord email → `useSendEmailVerification()` emails a one-time code → a code input calls `useConfirmEmailVerification()` → on success `['user-me']` is invalidated and the verified email appears. Rate-limited resend + change-email available. No password field — this is proof-of-ownership.
- **Step B — create the workspace.** With `verifiedEmail` present, a name+slug form (the client previews a derived slug live via `slugifyPreview`; the slug is validated server-side) follows the standard pattern: `yupResolver` → `useCreateWorkspace()` → on success invalidate `['workspaces']` and navigate to the new workspace's feeds; on error `InlineErrorAlert` + `PageAlert`.

The gate is **server-authoritative** (`403` if unverified); the client read of `verifiedEmail` only decides which step to show.

### 5. Role-gated settings, built on role not identity

A workspace settings surface (rename, change slug) reads `myRole` from `useCurrentWorkspace()`. Every member can edit these fields — there is no read-only tier — so the form is editable for owner and admin alike, wired to `useUpdateWorkspace()` (a taken slug surfaces `WORKSPACE_SLUG_TAKEN`, handled inline). The only role gate is **owner-only** actions (delete / transfer ownership), which are not built this round; when they land they'll be `can('deleteWorkspace', role)`-shaped client-side for UX and re-enforced by the backend `403`. No permissions framework — a single role check matching the backend's two-role model (ADR-002 §3).

### 6. Data layer + mocks (client/CLAUDE.md compliance)

New API files + hooks under a `features/workspaces/` slice, each with a mock handler in `src/mocks/handlers.ts` and `pickMockDelayMs`/`mockHasFlag` toggles so loading/error states are inspectable via `npm run dev-mockapi`. Every hook renders a visible + announced loading state and a near-the-action, recoverable error state (no swallowed `error`); lists use `<Skeleton />` on initial load and `keepPreviousData` on background refetch. (The email-verification mutations may live in the user-settings slice instead, since verified email is not workspace-specific — decided at implementation.)

### 7. Workspace-scoped feed data is wired

The workspace-scoped `<UserFeeds />` renders **real** feeds: `UserFeed.workspaceId` is active (backend ADR-002 §7), membership gates access, and `useUserFeeds({ workspaceId })` passes the scope to the backend query with `workspaceId` in the queryKey for cache isolation. (An earlier draft showed an explicit empty state until feed↔workspace association landed; it shipped in the same round, so that state is gone.)

### 8. Switcher behaviour and accessibility (WCAG 2.1 AA)

- **Rows carry no role badge** — a row is monogram + name + active mark. Switching is choosing *where to work*, not auditing permissions; role surfaces where it gates action (§5). At >7 workspaces the list shows an inline `type="search"` filter (Personal and footer actions never filtered out).
- **Active vs. hover are distinct, non-color-only states.** Rows use `MenuRadioItemGroup` + `MenuRadioItem`, so the active row has a real `role="menuitemradio"` + `aria-checked`. Active is carried by a persistent mark (✓ + weight + left accent); hover/focus by a transient background — independent channels, never color- or background-alone (WCAG 1.4.1, 2.4.7). Keyboard focus and mouse hover share one visual state. (Exact tokens live in the component.)
- **Native Chakra `Menu` keyboard pattern** (Enter/Space/↓ open, arrows, Home/End, type-ahead, Esc restores focus to the trigger). The button's accessible name includes the current workspace ("Switch workspace, current: `<name>`"). Workspaces loading: `aria-busy` + a visually-hidden `aria-live="polite"` region; error: `role="alert"` + a real Retry button (Personal is always present, needing no network). No false `aria-current`. Mobile: a compact trigger keeps its full accessible name, ≥44px targets (folding into the account menu is a kept fallback if header width proves tight).

### 9. Entry points for create/manage

- **Create a workspace** is reached from the switcher footer (`+ Create workspace`) and, at 0 workspaces (no switcher), from the top-right account menu. Both open `CreateWorkspaceDialog` (§4).
- **Manage a workspace** is reached from the switcher footer when the active workspace is a workspace (`⚙ <Workspace> settings` → `/workspaces/:workspaceSlug/settings`), hidden in Personal scope. Workspace management hangs off the workspace control (the Slack/Linear pattern), not the account menu — the account menu stays identity-only to avoid a scope mismatch between an identity surface and a role-gated workspace action.
- **A "Your workspaces" section** also lives on the existing Account Settings page (`UserSettings`, as `WorkspacesSettingsSection`, gated by `useIsWorkspacesEnabled()`), between Integrations and Preferences. It lists each workspace with a role badge + **Open** and **Settings** actions + a **Create workspace** action, with loading/error(+retry)/empty states. It complements the switcher footer: the footer reaches the *active* workspace's settings from anywhere; this section reaches *any* workspace's settings without switching first. **No "Leave" action** — there is no leave endpoint yet, and dead/disabled UI implying a working action is avoided; a Leave slots in per-row when the endpoint lands.

### 10. Search stays scope-aware (feature parity)

The header search (`SearchFeedsModal`, `SearchIcon` button → modal, Cmd/Ctrl+K) stays in the left cluster; permanent header order is **logo → switcher → search** (scope sets context, search acts within it). It reads the active scope (from `useCurrentWorkspace()`/params) and passes it to its `useUserFeeds`/`useUserFeedsInfinite` queries + `/feeds` nav targets, so it searches the active workspace's feeds. The header layout never changes.

### What we are NOT building (this round)

- No member list / invite / remove UI (req #2) — additive via the backend's email-keyed invitations (ADR-002 §10); an accept page would reuse the email-verification flow.
- No alternate-login UI — the identity seam is `request.userId` + unique `verifiedEmail` (ADR-002 §9); the consuming UI defers with that work.
- No new state mechanism — React Query + URL + the single `CurrentWorkspaceContext`.

## E2E plan (NFR #1)

Reuses the existing harness (`e2e/`, Playwright, mock Discord session via `/__test__/set-session`, direct-DB seeding):

1. **Feature enabled:** deployment toggle on for the e2e stack (env in the backend service, no structural compose change); per-user `featureFlags.workspaces = true` seeded for the test user.
2. **Verified email without a mail server:** a `setVerifiedEmailInDb` helper (mirroring `setSupporterStatusInDb`) writes the verified state directly. The real send/confirm can be exercised against a mock mailer or asserted at the mutation boundary.
3. **Create flow:** with the email seeded, open `CreateWorkspaceDialog` from its entry (account menu at 0 workspaces, or the switcher footer once present) → fill name → submit → assert redirect to the new workspace's feeds and that the workspace appears in the switcher (open it, assert listed + active).
4. **Regression:** assert the personal `/feeds` dashboard is unchanged and the default landing (req #4), and that a 0-workspace user sees **no switcher** (count-gating).
5. **Negatives:** with no `verifiedEmail`, assert create is blocked and the backend `403` path runs; with the deployment toggle off, assert workspace routes `404`, the switcher is absent, and no workspaces surface renders (req #7).

## Consequences

**Easier:**
- Workspace scope is a layout route + a context + scope-aware hooks — additive, no rewrite (the payoff ADR-005 paid for upfront).
- Personal dashboard is provably unchanged (its routes/components aren't touched).
- Flag-gating is the existing `useUserMe()` pattern; flipping the flag GAs the feature with no code change.
- The empty-surface problem is resolved structurally (a content-proportional control + count-gating, no standalone page).

**Harder:**
- Page components must stay genuinely scope-agnostic — a hard-coded personal assumption becomes a workspace-scope bug. Mitigated by the scope flowing params→hooks→queryKey uniformly.
- The switcher is globally mounted, so it must stay memoized and runs `useWorkspaces()` for flagged users on every page (cheap, `keepPreviousData`-cached; Personal renders without it). Active-state correctness depends on workspace routes being wrapped by `CurrentWorkspaceContext` (§3).

**Lost:**
- The dedicated `/workspaces` page (and a single "see all workspaces" view, until the Account-Settings "Your workspaces" section, §9). The route name stays free.

## Alternatives considered

- **A dedicated `/workspaces` chooser page.** Rejected before shipping (§1) — no sidebar to host it, low cardinality makes it mostly empty, and its one durable job (member management) is per-workspace and belongs on `/workspaces/:workspaceSlug/settings`.
- **A read-only `member` role beneath `admin`.** Rejected — collaboration means every member edits, so a read-only tier is friction without benefit; the real gate is owner-only destructive actions (§5, backend ADR-002 §3 Alternatives).
- **Fork `UserFeeds`/`UserFeed` into workspace variants.** Rejected — doubles maintenance; the only difference is a parameter.
- **Ambient current-workspace via Context, no URL prefix.** Rejected (as ADR-005 did) — shareable workspace links require the scope in the URL.
- **Workspace settings in the top-right account menu.** Rejected (§9) — scope mismatch between an identity surface and a role-gated workspace action; management hangs off the workspace control.
- **Client-only feature gate.** Rejected — re-enforced server-side (ADR-002 §6); the client gate is UX, not security.
