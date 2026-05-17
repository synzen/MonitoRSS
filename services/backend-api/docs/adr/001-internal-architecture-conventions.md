# ADR-001 — Internal architecture conventions for `backend-api`

**Status:** Accepted
**Date:** 2026-05-16
**Scope:** `services/backend-api/` only.
**Numbering note:** This ADR folder uses its own sequence, starting at 001. Cross-references to repo-root ADRs are explicit (e.g. "root ADR-003").

## Context

`backend-api` has accumulated five effective internal layers over its lifetime:

```
src/features/<x>/<x>.routes.ts         → HTTP route registration (Fastify)
src/features/<x>/<x>.handlers.ts       → HTTP-shaped handlers
src/services/<x>/<x>.service.ts        → Domain / orchestration logic
src/repositories/interfaces/<x>.types.ts → Repository contract (TypeScript interface)
src/repositories/mongoose/<x>.mongoose.repository.ts → Mongoose implementation
```

Some of these layers do meaningful work; others are ceremony. Concrete observations from a structural review of the service:

- **Repository interfaces are 1:1 ceremony.** 20 interfaces match 20 Mongoose implementations exactly. No second implementation exists, none is planned, and `Types.ObjectId` from Mongoose already leaks past the interface into four services (`feed-connections-discord-channels`, `user-feed-management-invites`, `user-feeds`, `legacy-feed-conversion`). The interfaces also expose Mongoose-shaped operators (`Record<string, unknown>` for `filter` / `update` arguments that callers fill with `$set`, `$push`, etc.) — they're typed escape hatches over the Mongo query language, not a portable abstraction. They do not enable the DB swap they purport to enable.
- **Pass-through service methods proliferate.** Many `UserFeedsService` (and sibling) methods are bodies like `return this.deps.userFeedRepository.findById(id)`. The service adds no value at the call site; the layer exists only because the handler-above-doesn't-talk-to-repo-below convention says so.
- **`src/services/<x>/` overlaps with `src/features/<x>/`** for 8 capabilities (`user-feeds`, `discord-auth`, `discord-servers`, `discord-users`, `discord-webhooks`, `user-feed-management-invites`, `supporter-subscriptions`, `users`). The split-by-layer cohabits awkwardly with the split-by-feature.
- **`request.container` is a service locator** — every Fastify request carries the full DI container, and handlers reach in for whatever they need. The dependency surface of a handler is invisible from its signature.
- **`src/services/` mixes two kinds of services:** external-API wrappers (Discord, Paddle, Reddit, etc.) where DI for testability earns its keep, and domain-logic services that overlap with feature folders.
- **Legacy `.js` files in `src/shared/utils/`** (`Article.js`, `ArticleIDResolver.js`, `Filter.js`, `FilterRegex.js`, `FilterResults.js`, `FlattenedJSON.js`) are v6 JavaScript carryover.
- **Cross-feature handler imports exist** (e.g. `features/user-feeds/user-feeds.handlers.ts` imports a formatter from `features/feed-connections/feed-connections.handlers.ts`). The "feature" boundary isn't actually enforced.

None of this is broken — the service works in production. But the layered shape is *accidental*: it accreted rather than being chosen, and several of the layers do not carry their weight.

This ADR makes the going-forward conventions explicit so new code stops adding to the ceremony while existing code is improved opportunistically.

## Decision

### What to do for new code

1. **New features go vertical** under `src/features/<name>/`:
   - `<name>.routes.ts` — Fastify route registration (auth hooks, schema binding)
   - `<name>.handlers.ts` — HTTP-shaped handlers (validation, error mapping, response shaping)
   - `<name>.schemas.ts` — JSON Schema / Zod for request and response
   - `<name>.service.ts` — *(optional)* domain logic specific to this feature, when handler bodies grow beyond simple compose-and-call

2. **Domain logic for new features stays inside the feature folder.** Do not create `src/services/<name>/` directories that mirror feature names. The 8 existing pairs are being phased out — do not add a 9th.

3. **External-API service wrappers continue to live under `src/services/<name>/`** (Discord, Paddle, Reddit, feed-fetcher-api, etc.). These are legitimate DI candidates because they wrap things you want to mock in tests.

4. **Repository pattern for new entities:**
   - Write the Mongoose repository class directly. Do not create a sibling interface in `src/repositories/interfaces/`.
   - Service constructors depend on the concrete repository class.
   - If you ever need a second implementation (e.g., an in-memory repo for a test scenario that the Mongo memory server can't satisfy), extract the interface *then*.

5. **No pass-through service methods.** A method whose body is `return this.deps.repo.findById(id)` should not be written. The handler can call the repo directly via `request.container.someRepo`. If validation, auth, or event emission is being added, that's the value the service method provides — name it for that, not for the underlying read.

6. **No new files in `src/shared/utils/*.js`.** If you must edit one of the existing JavaScript utilities, convert it to TypeScript first as a separate commit, then make the substantive change.

7. **No cross-feature handler imports.** A handler in `features/X/` must not `import` from a sibling feature's `*.handlers.ts`. If a formatter or helper is genuinely shared, move it to `src/shared/` (or duplicate the small case).

8. **`request.container` is the existing dependency-access pattern.** New routes may prefer the dependency-injected route-plugin pattern (the route registration function receives a typed `deps` object and closes over them) for handler signatures that declare their dependencies. Match existing handlers when modifying in place; do not mix patterns inside a single handler.

### What to do for existing code (opportunistic)

When you touch a service for substantive other reasons:

- Collapse pass-through methods. Have the handler call the repo directly.
- If the service file mirrors a feature name and there's a feature folder for the same capability, consider folding the service file into the feature folder.
- Mongoose `Types.ObjectId` use in services is fine where it already exists; do not add new sites if a `string` ID would suffice.

These are clean-as-you-go fixes, not a dedicated refactor pass. There is no plan to mass-rewrite existing code on this basis alone.

## Consequences

**Easier:**
- New feature work has one place to live and one shape to match. Knowledge transfers between features.
- Onboarding (new contributors and future AI agents) needs only this ADR + CLAUDE.md to know where new code goes.
- The performative repository-interface ceremony stops growing.

**Harder:**
- The existing `src/repositories/interfaces/`, `src/services/<feature-mirror>/`, and pass-through methods stay around longer than a clean-slate rewrite would. Accepted: a rewrite is not worth the cost at solo-operator scale.
- Code reviewers will sometimes need to push back on PRs that add new repository interfaces or service-mirror files out of habit. The CLAUDE.md adjacent to this service is the first defense.

**Constraints on future decisions:**
- A new top-level service (not a backend-api subdirectory) follows the standard stack from root ADR-004. backend-api conventions in this ADR are scoped to backend-api only.
- A future decision to mass-collapse `src/repositories/interfaces/` (a substantial cleanup) deserves its own ADR in this folder.
- A future decision to migrate off `request.container` as a service locator (e.g., adopting the route-plugin DI pattern broadly) deserves its own ADR in this folder.

## See also

- Root `docs/adr/001-service-based-architecture.md` (parent decision about overall style).
- Root `docs/adr/004-standard-tooling-for-new-services.md` (applies to *new* top-level services; backend-api predates it).
- `services/backend-api/CLAUDE.md` (the imperative rule list derived from this ADR).
