# ADR-003 — State ownership: React Query for server, URL for shareable, Context only for cross-cutting

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/src/`.

## Context

The app has five state mechanisms in use:

| Mechanism | Today's role |
|---|---|
| React Query (`@tanstack/react-query` v4) | Server state. ~17 query hooks, all in `features/<f>/hooks/`. Uses a shared `fetchRest()` wrapper. Consistent usage. |
| URL state via `react-router-dom` v6 | Route params only (`feedId`, `connectionId`, `priceId`). One known `useSearchParams()` consumer in `pages/UserFeeds.tsx`. |
| Component state (`useState`, `useReducer`) | Local UI. Heavy use of `useReducer` in MessageBuilder state machine — appropriate scope. |
| `react-hook-form` + `yup` | Form-in-progress. 10+ forms, all same shape. |
| React Context | 14 contexts in `src/contexts/`. Mix of: cross-cutting (UserFeedContext at 222 consumer hits, PageAlertContext, PaddleContext), page-local (NavigableTreeContext at 19-27 hits within MessageBuilder only, MultiSelectUserFeedContext at 4 hits within UserFeeds only, UserFeedStatusFilterContext at 2 hits within UserFeeds only), and questionable (FeedFormatOptionsContext appears unused; PricingDialogContext use is ambiguous). |

The first four are used correctly. **The fifth has lost discipline** — Context has become the dumping ground for state that doesn't naturally fit elsewhere, including:

- *Server-persisted state that pretends to be local:* `UserFeedStatusFilterContext` writes user filter prefs to the backend via debounced mutation. The "context" is really just an ergonomic wrapper around a server roundtrip that should probably be a React Query mutation + URL search param.
- *State that only exists to avoid prop-drilling two levels:* `SourceFeedContext` (3 consumers — `AddUserFeeds` page + `SourceFeedSelector` component) is a one-page concern that uses Context to avoid passing a value through a single intermediate component. Local state + a prop would be clearer.
- *State that should be URL-deep-linkable but isn't:* feed list filters, selected tab on a detail page, current page in a paginated list. Currently lives in Context (or component state); doesn't survive reload, doesn't share via link.

The lack of a rule for what goes where is also the lack of a story for the planned team plan, where "send me a link to your filtered feed view" is a natural ask that the current shape doesn't support.

## Decision

### A 5-question lookup for state placement

Apply in order. The first "yes" wins.

```
1. Does the value come from the server?
   YES → React Query. Hook lives in features/<feature>/hooks/.
         Mutations invalidate the relevant query keys on success.
         Never store the server response in Context — Context-of-server-state is a
         cache that fights the existing one.

2. Should the value be in the URL (deep-linkable, shareable, survives reload)?
   YES → URL state via useSearchParams or route params.
         Examples that SHOULD be in the URL today and aren't:
           - feed list status filters
           - feed detail selected tab
           - any "selected X" in a picker that opens a deeper view
         Examples that already are: feedId, connectionId, priceId route params.

3. Is the value form-in-progress?
   (The in-memory draft of a form the user is editing — field values, touched/dirty
   flags, per-field validation, submitting state. Discarded on close or reset on
   successful submit.)
   YES → react-hook-form (yupResolver + onSubmit → useMutation pattern).
         No new form libraries. Match the existing 10+ forms.

   EXCEPTION — structured editors. Recursive trees, drag-drop component graphs,
   IDE-style tools (the MessageBuilder is the canonical example) use useReducer
   (Q5) with a Context for distribution. react-hook-form is for forms with a
   known flat-or-nested-but-bounded shape; it fights tree editors with polymorphic
   nodes, undo-able edits, and per-node action types. The Context in this pattern
   is doing DISTRIBUTION, not state ownership — the state itself is useReducer,
   which is the Q5 answer. This is the same shape react-hook-form's own
   FormProvider uses internally.
   If you're not sure which you're building, default to react-hook-form; if you
   find yourself fighting it, you're probably in the editor case.

4. Is the value cross-cutting — consumed by ≥2 unrelated features OR by App-level chrome?
   YES → React Context, defined in src/contexts/. Memoize the value object.
         Today's qualifying contexts: UserFeedContext, UserFeedConnectionContext,
         PageAlertContext, PaddleContext. Possibly MentionDataContext (depends on
         where DiscordView lands per ADR-002).

5. Otherwise — it's local UI state.
   → useState / useReducer in the component (or page, or feature root component).
     Pass values down via props. Lift state up to the nearest common ancestor when
     two children need to coordinate. If you'd reach for Context to "avoid prop
     drilling" between adjacent components, don't — pass the prop. Context's cost
     (extra Provider scope, extra re-render fan-out) only earns its keep when the
     value is consumed many levels away by many consumers.
```

### Context co-location

Contexts that pass question 4 (cross-cutting) live in `src/contexts/`. Contexts that fail it but are consumed inside one feature live in `features/<feature>/contexts/`. Examples:

- `NavigableTreeContext`, `NavigableTreeItemContext`, `SendTestArticleContext` → the Discord channel connection's `messageBuilder/contexts/`.
- `MultiSelectUserFeedContext`, `UserFeedStatusFilterContext` → `features/feed/contexts/` (a later URL-state conversion of the status filter is still desirable — see below).
- `SourceFeedContext` → `features/feed/contexts/`.

### Server-derived "preferences" pattern

`UserFeedStatusFilterContext` is the only example today, but the pattern is likely to recur as the user-prefs API grows. The decision: **server-derived preferences are React Query state, not Context.**

```
useUserMe()                          // React Query — single source of truth
  ↓
preferences.feedListStatusFilters   // server value
useUpdateUserMe()                    // React Query mutation — invalidates ['user-me']
```

UI components that want to "filter the list" should read the filter value from `useUserMe()` (or from URL search params, see below), and dispatch updates via `useUpdateUserMe()`. No intermediate Context.

For values that should also be deep-linkable (the feed-status filter qualifies), **URL search params take precedence** and the server pref is initialized-from / written-to in the background. The URL is the truth for the *current* view; the pref is the truth for *future* visits.

### Form ↔ mutation wiring

Keep the existing pattern. Documented for new contributors:

```
yup schema (features/<f>/components/<Form>/schema.ts)
  ↓
useForm({ resolver: yupResolver(schema) })
  ↓
onSubmit = handleSubmit(async (data) => { await mutateAsync(data); })
  ↓
mutation onSuccess: invalidate the affected query keys
  ↓
PageAlert via usePageAlertContext().createSuccessAlert / .createErrorAlert
  AND inline error via InlineErrorAlert (per client/CLAUDE.md a11y rules)
```

No deviations without a documented reason.

## Consequences

**Easier:**

- A new piece of state has a one-decision-tree home, not a "well, there are five places…" conversation.
- Bug class eliminated: "Context value changed → 50 components re-rendered" doesn't happen because Context isn't being used for non-cross-cutting state.
- Deep links and shareable filtered views become trivial once filters move to URL. Particularly important for the planned team plan ("my teammate sent me this link").
- React Query becomes the *single* source of truth for server state — no shadow caches in Context.

**Harder:**

- URL state has its own ergonomics — encoding arrays in search params, decoding back to typed values, debouncing writes to avoid history spam. We'll write small helpers (e.g., `useUrlArrayParam<T>(name)`) the first time we need them, but won't pre-build.
- Migrating the existing misplaced Context consumers was a one-time cost (since paid).
- Some contributors will prefer Context "for convenience" over passing props 2-3 levels. The decision tree says no — discipline tax.

**Lost:**

- The "wrap something in a Context for testability" pattern. Use React Query's QueryClientProvider for server state, and component props for local. The genuinely-cross-cutting contexts that remain can use Context-based test wrappers.

**Specifically for `UserFeedStatusFilterContext`:** it has been relocated to `features/feed/contexts/`, but it still stores filter state in user preferences rather than the URL. The remaining (optional) improvement is to convert it to `useSearchParams()` for `?statuses=active,disabled,...` — reading from and writing to the URL, while the existing `useUserMe` / `useUpdateUserMe` calls continue to seed-from / persist-to user prefs in the background — and then delete the context. This is a small change with outsized value for the team-plan roadmap.

## Alternatives considered

- **Redux Toolkit (or Zustand) as a global store.** Rejected. The maintainer confirmed React Query + Context is the chosen model; the contexts that hurt are the *misplaced* ones, not the Context mechanism. Adding a third state-management library would *increase* the number of "where does this go" choices, not reduce them.
- **Jotai / Recoil for atomic state.** Same reason as above. The current architecture is one mechanism per layer; introducing a fifth mechanism for "atomic shared state" doubles the surface.
- **URL state via a router-aware library (TanStack Router, etc.).** Out of scope; we're staying on react-router-dom v6. Plain `useSearchParams` is enough.
- **Make every page-level filter a React Query query keyed on filter args.** Considered. React Query is for *server* state; the filter is a client-side input. Treating it as a query introduces a fake source of truth (the queryKey). Native URL state is cleaner.
- **Keep the current model, just document it.** Rejected; the maintainer's pain is precisely that the current model isn't a model.
- **Force the MessageBuilder onto react-hook-form for consistency with other forms.** Rejected. The MessageBuilder edits a recursive tree of polymorphic components with drag-drop, per-node validation, undo-able edits, and dozens of component types. RHF is a flat/bounded-shape form library; it fights every one of those concerns. `useReducer` is the right primitive (clear action types, deterministic transitions, testable); Context is just distribution. This is the documented exception in the Q3 decision tree, not a violation. The signal that you're in the editor case (and not the form case) is when you start needing action types, custom undo, or per-node lifecycle hooks — at which point switching back to RHF would be the cost.
