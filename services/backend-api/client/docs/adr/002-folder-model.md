# ADR-002 — Folder model: thin pages, fat features, narrow shared base

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/src/` only.

## Context

The current `src/` tree mixes three layers without an enforced rule:

- **Pages** (`pages/`) was meant to be route entry shells. Today, `pages/MessageBuilder.tsx` is 933 lines, `pages/AddUserFeeds.tsx` is 864 lines, and `pages/MessageBuilder/` is a folder of 20+ files (including `ComponentPropertiesPanel.tsx` at 1244 lines and `MessageBuilderContext.tsx` at 414 lines). Pages contain business logic, state machines, dialog trees, and per-page React Contexts. They are features in disguise.
- **Features** (`features/`) is a vertical-slice layer with 8 modules (auth, discordServers, discordUser, discordWebhooks, feed, feedConnections, subscriptionProducts, templates). Each module has its own `api/`, `components/`, `hooks/`, `types/`, `constants/`, `utils/`. Cross-feature imports are minimal (3 across the codebase) and justified. This part is healthy.
- **Shared base** (top-level `components/`, `contexts/`, `hooks/`, `constants/`, `types/`, `utils/`) was meant for genuinely-cross-cutting code. At the time this ADR was written, ~25-30% of its contents were feature-local code that had been promoted upward by a single consumer reaching for it — e.g. 13 of 47 top-level components imported from a feature, and 7 of 14 contexts were consumed only inside one page.

The result is the maintainer's top reported pain: a new component could plausibly go in any of three places, and the existing distribution doesn't telegraph which is "right."

## Decision

### Three layers, with a rule per layer

**Layer 1 — Pages (`src/pages/`):**

Pages are **thin route entry shells**. A page file:

- Composes feature exports (`<UserFeeds />`, `<MessageBuilder />`, etc.).
- Reads route params and passes them down.
- Mounts auth/page-level providers required by the page.
- Should fit comfortably under ~200 lines.

A page MUST NOT contain:

- Business logic (validation, state machines, domain transformations).
- Multi-component dialog/modal trees inline.
- Per-page React Contexts of meaningful size — those belong inside the feature.

When a page grows past the threshold, **promote the body to `features/<page>/`** and reduce the page to `export { <Page>Page as <Page> } from '../features/<page>'`.

**Layer 2 — Features (`src/features/<name>/`):**

A feature is a **vertical slice** that owns one cohesive domain concept. The internal shape is the existing one, kept consistent:

```
features/<name>/
├── api/         — HTTP calls; uses the shared fetchRest wrapper
├── components/  — UI specific to this feature
├── constants/   — values used inside this feature
├── contexts/    — React Contexts consumed only inside this feature
├── hooks/       — React Query hooks, custom hooks for this feature
├── types/       — type / schema definitions for this feature
├── utils/       — pure helpers for this feature
└── index.ts     — public surface (see "Barrel exports" below)
```

**Sub-features.** A feature MAY contain sub-features when its scope is genuinely composite. The canonical case is destination-specific code inside `features/feedConnections/` (see ADR-004): the feature splits into a generic dispatcher shell plus one sub-feature per destination.

**One partitioning axis per folder level.** A folder partitions its children along exactly one axis. Upper levels partition by domain/capability; **technical folders (`components/`, `hooks/`, `api/`, `utils/`, `types/`, `constants/`, `contexts/`) appear only at the leaf — the capability that owns them.** A folder must not place a technical child (`components/`) beside a capability child (`messageBuilder/`) at the same level: that is two axes in one folder, and is the violation this rule forbids. Reading any one level should answer a single question ("which capability?" or "which technical role?"), never both.

Applied to `feedConnections/`, that is three levels, one axis each:

- `feedConnections/` partitions into **the generic shell + destinations**: the destination-agnostic `AddConnectionDialog` dispatcher (which switches on `FeedConnectionType`) and one folder per destination (`discordChannel/`, later `slackChannel/`). It holds no destination-specific technical folders.
- `discordChannel/` partitions into **capabilities**: `connection/`, `messageBuilder/`, `templates/`, and the `shared/` kernel.
- each capability partitions into **technical roles** — the familiar `api/ components/ hooks/ types/ utils/ contexts/` leaf shape.

```
features/feedConnections/
├── AddConnectionDialog/        — generic dispatcher shell; switches on FeedConnectionType
├── discordChannel/             — the Discord destination
│   ├── connection/             — capability: create / configure / manage a connection
│   │   ├── api/                (createDiscordChannelConnection.ts, …)
│   │   ├── components/         (DiscordMessageForm, ConnectionSettings, the *TabSection family, …)
│   │   ├── hooks/              (useDiscordChannelConnection, useTestSendFlow, …)
│   │   ├── types/  utils/  constants/
│   │   └── index.ts
│   ├── messageBuilder/         — capability: the message editor
│   ├── templates/              — capability: the template gallery
│   ├── shared/                 — the destination's shared kernel (see below)
│   │   ├── components/         (DiscordMessageDisplay, DiscordView)
│   │   ├── contexts/           (MentionDataContext)
│   │   ├── utils/              (getChannelIcon, extractRgbFromInt, …)
│   │   └── index.ts
│   └── index.ts
├── slackChannel/               — future: where Slack would land, mirroring this shape
└── index.ts
```

**The `shared/` kernel.** When a primitive is used by ≥2 of a destination's capabilities — e.g. `DiscordMessageDisplay` is rendered by `connection/`, `messageBuilder/`, and `templates/` — it belongs in that destination's `shared/`, a per-destination kernel of cross-capability primitives. `shared/` is scoped to **one destination, not a global junk drawer**: it holds only that destination's primitives, and a primitive consumed by a single capability stays inside that capability. A genuinely cross-_feature_ concern is not a `shared/` case — it goes through a feature barrel or the top-level shared base per the rules above.

Sub-features follow the same barrel rule (an explicit `index.ts` defines the public surface). Cross-capability imports inside one destination use relative paths (`../shared` and `../templates` from `connection/`); from outside the parent feature, consumers go through the parent feature's barrel.

A feature MAY import:

- From the shared base (`components/`, `hooks/`, `utils/`, etc.).
- From `mocks/`, `test/`, etc. (only test files).
- From a _sibling feature's barrel_ (`features/<other>/index.ts`) when there's a real dependency. Cross-feature deep imports (`features/<other>/components/Foo`) are forbidden.

A feature MUST NOT import from `pages/`.

**Layer 3 — Shared base (top-level `components/`, `contexts/`, `hooks/`, `constants/`, `types/`, `utils/`):**

The shared base is for code that is **truly generic** (no domain knowledge) or **truly cross-cutting** (consumed by ≥2 unrelated features).

A file belongs in the shared base if **and only if**:

- It does not `import` anything from `features/`.
- AND it has no domain-specific names (`Discord*`, `UserFeed*`, `Connection*`, `Template*`, `Subscription*`, etc.).
- AND (for `contexts/`) it is consumed by ≥2 unrelated features OR by `App.tsx` directly.

This is the rule violated by today's `components/SearchFeedsModal`, `contexts/NavigableTreeContext`, `utils/getPrettyConnectionName.ts`, etc. Per ADR-006, the rule is mechanically enforced by ESLint.

**Optional Layer 2.5 — `shared/` (introduce when needed):**

If a piece of code is cross-feature but _not_ generic UI (e.g., a domain type that several features consume but that has no place in a single feature), introduce a `src/shared/` folder for it. Do NOT add it now speculatively — wait for the first real case. (Today there are no such cases; everything cross-feature is also generic, so the top-level shared base is enough.)

### Barrel exports for features (`features/<name>/index.ts`)

Every feature exports its public surface via `index.ts`. Consumers (pages, sibling features) import from the barrel:

```ts
// good
import { UserFeedsTable, useUserFeeds } from "@/features/feed";

// bad — internal path, breaks the seam
import { useUserFeeds } from "@/features/feed/hooks/useUserFeeds";
```

Internal-to-the-feature imports use relative paths and may reach anywhere inside the feature. The barrel is the only seam exposed outward.

(Many features already have an `index.ts`. The new rule is: consumers MUST go through it. Enforced by ESLint per ADR-006.)

### Route entries (pages/) may not name a destination — features MAY

`pages/ConnectionDiscordChannelSettings.tsx` is the model to _avoid_ going forward for **route entries**. A page should name what it does (`ConnectionSettings`), not which destination it does it for; it composes a generic shell that dispatches to a destination-specific sub-feature based on `connectionType`. The page is destination-agnostic so the URL is too.

**Feature folders, however, MAY name a destination** when the feature is inherently destination-specific. `features/feedConnections/discordChannel/` honestly describes what's inside: code that only ever pertains to Discord channel connections. Pretending otherwise (e.g., calling it `features/messageBuilder/` while filling it with Discord-only code) creates the "abstraction never realized" trap that ADR-004 is designed to prevent.

Such a destination-named folder is _structural anticipation_ — a factual grouping, not a runtime abstraction — and so is permitted now even though only one destination exists. Per ADR-004's structural-vs-runtime distinction, the folder seam stays while a runtime destination abstraction (generic adapters, registries, `destinationConfig` props) waits for destination #2. The two ADRs therefore agree, not conflict: this blessing of `discordChannel/` is the same structural anticipation ADR-004 permits.

The rule, more precisely:

- A **route file** (`pages/*.tsx`) names the _capability_ (`ConnectionSettings`, `MessageBuilder`), not the destination.
- A **feature or sub-feature folder** names what it _actually contains_. Destination-neutral if the contents are neutral; destination-specific if the contents are specific.

This decision is fleshed out in ADR-004.

## Consequences

**Easier:**

- "Where does this go?" answered by a 3-question lookup: (1) Is it a route shell? → `pages/`. (2) Is it about one feature's domain? → `features/<feature>/`. (3) Is it generic AND non-feature-coupled? → top-level base.
- New contributors (humans or LLMs) can follow the rule mechanically.
- The shared base shrinks. The original 47 top-level `components/` mixed purposes; after demotion it is ~31 entries, all genuinely generic.
- Feature ownership becomes real. The Discord channel connection feature owns its components, its contexts, its message-builder editor, and its panels — there's one home to look in.

**Harder:**

- Adopting the model required a one-time migration moving many files into their owning features.
- Cross-feature _code reuse_ requires either duplication (preferred for small cases) or lifting to `shared/` (deliberate). The friction is the point; it forces the question.
- Pages no longer hold inline JSX trees for complex flows — the body moves to a feature. A page becomes ~50 lines of composition.

**Lost / costs:**

- The "I'll just put it in `components/` for now" escape hatch. Going forward, the ESLint rule (ADR-006) fails CI for feature-coupled top-level files.
- Some currently-shared modules become locked inside a single feature. If a second feature later wants to reach for them, it pays the "lift to shared" tax — but this is the right incentive.

**For existing code:**

- The pre-existing violations were migrated as part of adopting this model, then the ESLint rules from ADR-006 were turned on. A handful of genuinely cross-cutting exceptions carry inline `// eslint-disable` annotations documenting why.

## Alternatives considered

- **Keep the current 3-way ambiguity, document conventions in `CLAUDE.md` prose only.** Rejected: prose doesn't get enforced and the maintainer is one person. We need lint rules (ADR-006), and lint rules need a model to enforce.
- **Collapse `pages/` into `features/` entirely (no `pages/` folder).** Considered. Adds little — React Router needs an entry point per route, and a `pages/` folder is the conventional place to register them. The thin-shell rule gives 95% of the benefit at zero ecosystem cost.
- **Replace `features/` with `domains/`, or with feature-bounded contexts à la DDD bounded contexts.** Out of scope; the current vertical-slice model is working (3 cross-feature imports, all justified). Renaming would churn for no gain.
- **Require `index.ts` in EVERY folder (not just features).** Rejected — barrel files at every level add cognitive overhead and don't catch a real bug class. Feature barrels do, because they create the cross-feature seam.
- **Force a strict "no folders inside features beyond the documented 7."** Rejected — small features may not need every folder, and big features may need additional `state/`, `mocks/`, etc. The 7 are the _expected_ slots; deviation is allowed if cohesive.

## Decisions locked in

- **MessageBuilder home: `features/feedConnections/discordChannel/messageBuilder/`.** Originally proposed `features/messageBuilder/` (top-level). Updated because the MessageBuilder is 100% Discord-specific today (edits embeds, mentions, components-v2, buttons) — a neutral name would have been the "abstraction never realized" trap. The Discord channel connection is the cohesive feature; the message builder is its editor sub-feature.
- **Templates home: `features/feedConnections/discordChannel/templates/`.** Same reasoning. Templates today are Discord-specific message configurations; all 8 import sites are inside the Discord connection editor flow (verified by grep). Move alongside the MessageBuilder.
- **Barrels required for every feature.** Every `features/<name>/` (and every sub-feature like `features/feedConnections/discordChannel/`) MUST have an `index.ts` defining its public surface. Cross-feature and cross-sub-feature imports go through the barrel; internal imports use relative paths. Enforced by ADR-006 rule #2.
- **`shared/` folder: wait for first real case.** Don't introduce `src/shared/` speculatively. Today every cross-feature artifact is either generic UI (top-level base) or feature-coupled (inside a feature). If a real cross-feature non-UI concern appears later, an additive ADR introduces `shared/` then.
- **Structural-vs-runtime line clarified (with ADR-004).** A destination-named folder (`discordChannel/`, future `slackChannel/`) is permitted _structural anticipation_ — a factual grouping whose cost is one reversible path segment. The item ADR-004 defers is the _runtime_ destination abstraction (generic adapters, registries, `destinationConfig` props), not the folder seam. So the destination-named sub-feature blessed above and ADR-004's "don't build the abstraction" rule agree: keep the folder, defer the runtime abstraction.
