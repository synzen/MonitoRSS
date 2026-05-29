# ADR-006 — Frontend fitness functions: ESLint architecture rules + file-size caps

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/`.

## Context

*Fundamentals of Software Architecture* (Richards & Ford) defines a **fitness function** as an objective, automated test of an architectural characteristic. Without fitness functions, architectural decisions decay — they're enforced by reviewer memory, which is unreliable at scale and effectively absent for a solo maintainer.

The codebase has prose conventions (`client/CLAUDE.md`, backend `CLAUDE.md`, repo `docs/adr/`). They cover real ground but are read inconsistently and aren't enforced. The structural review that produced these ADRs found violations of conventions that *would have been caught* by a tool:

- 13 of 47 top-level `components/` imported from `features/` (violates the rule that the shared base shouldn't depend on features).
- `jest.config.js` was orphaned while `vitest` was the actual runner — no check caught "two test runners present."
- Files grew past 1000 lines (`ComponentPropertiesPanel.tsx`, `MessageBuilder.tsx`, `DiscordTextChannelConnectionDialogContent.tsx`) with no signal.

The user asked for a recommendation on governance level ("recommend what's appropriate" — neither "max enforcement everywhere" nor "documentation only"). The solo-maintainer context biases toward **few, high-signal, low-noise** automated checks. Every false positive is a cost the maintainer pays alone.

## Decision

### Adopt three fitness functions

Listed in priority order. Each is justified by an architecture characteristic from ADR-001 and (where applicable) an ADR it enforces.

#### 1. ESLint `no-restricted-imports`: shared base must not import from features

Enforces ADR-002.

```jsonc
// .eslintrc.js (excerpt) — applied to:
//   src/components/**, src/contexts/**, src/hooks/**,
//   src/constants/**, src/types/**, src/utils/**
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/features/*", "@/features/*"],
        "message": "Shared base modules may not import from features/. Move this code into the feature it depends on, or restructure to invert the dependency."
      }]
    }]
  }
}
```

**Why:** The 13 pre-existing violations happened because there was no rule. They accreted gradually, one at a time, each "obvious" in isolation. This rule prevents the 14th.

**Cost:** Near zero — the pre-existing violations were migrated into their owning features; the rule now passes silently. No false positives expected because the rule is structural, not heuristic.

#### 2. ESLint `no-restricted-imports`: features must use barrel exports of siblings

Enforces ADR-002.

```jsonc
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/features/*/!(index)*", "@/features/*/!(index)*"],
        "message": "Cross-feature imports must go through the sibling feature's index.ts barrel. Deep imports break the feature's public seam."
      }]
    }]
  }
}
```

Within a feature, files import from their own siblings via relative paths (`./components/X`, `../hooks/Y`) — those aren't matched.

**Why:** Only 3 cross-feature imports exist today (and all are barrel imports). The rule preserves the discipline.

**Cost:** Requires every feature to have a `features/<name>/index.ts` with the public exports. They now do.

#### 3. ESLint `max-lines` with warn → error tiers

Enforces ADR-002 (thin pages, no god-files).

```jsonc
{
  "rules": {
    "max-lines": ["warn", { "max": 600, "skipBlankLines": true, "skipComments": true }]
  },
  "overrides": [
    { "files": ["src/**/*.{ts,tsx}"], "rules": {
      "max-lines": ["error", { "max": 1000, "skipBlankLines": true, "skipComments": true }]
    } },
    { "files": ["src/mocks/**", "src/constants/emojis.ts"], "rules": {
      "max-lines": "off"
    } }
  ]
}
```

- Warn at 600 lines (signals "consider splitting").
- Error at 1000 lines (blocks new growth).
- `mocks/` and `emojis.ts` exempt (data files; splitting hurts).

Any file that legitimately needs to exceed 1000 lines carries an inline `// eslint-disable-next-line max-lines` annotation with a comment explaining why and what would decompose it.

**Why:** The largest files were also the ones flagged as friction. Catching the next one before it's painful is cheap.

**Cost:** A handful of disables, each documented.

### What we are NOT adopting

- **Bundle-size budget (bundlewatch or equivalent).** Considered. Skipped because performance isn't a top-3 characteristic and Vite + route-level code splitting is already in place. A budget you don't actively defend produces intermittent failures from legitimate growth without preventing real regressions. Revisit if a perf incident happens or user-reported slowness becomes a signal — at which point an additive ADR can adopt it with concrete numbers measured against the incident.
- **Dependency-cruiser.** Overlapping with ESLint `no-restricted-imports` for the rules that matter. Adds another config surface. Reconsider only if `no-restricted-imports` patterns become hard to express.
- **Cyclomatic complexity / cognitive complexity ESLint rules.** Noisy in React code (especially in `useReducer` action handlers and Yup validation schemas). Cost > signal.
- **Architecture-as-code DSLs** (Structurizr, NX boundaries, etc.). Solo maintainer; cost > signal.
- **Storybook / visual regression tests.** Out of scope for this ADR — those serve a11y/UX testing, which is its own decision (and worth a separate proposal).
- **A11y lint plugins (`eslint-plugin-jsx-a11y`).** Already in deps. Worth a separate audit to confirm rules-enabled list is non-trivial — but its existence is good and stays.
- **TypeScript strict-mode escalation** as part of this ADR. Type strictness changes ripple too widely to be a fitness function; treat as its own targeted decision.

### Rollout

The structural migration that these rules enforce was done first, then the rules were turned on — so the build does not depend on a backlog of pending moves. Where a genuine, documented exception remains, it carries an inline `// eslint-disable` annotation explaining why.

Per-rule status:

- **Rule #1 (shared base ⊄ features):** enforced as **error**. The pre-existing ~13 violations were migrated into their owning features. A small number of cross-cutting exceptions (e.g. app-chrome components that legitimately compose feature pieces) carry documented inline disables.
- **Rule #2 (cross-feature via barrel only):** every feature now has an `index.ts`. The rule currently runs as a **warning** while the remaining intra-feature deep imports introduced during the migration are converted to relative paths; flip it to **error** once that conversion is complete.
- **Rule #3 (max-lines):** enforced as **error** at 1000 / **warning** at 600. No file exceeds the hard cap; any that would carries a documented disable.

## Consequences

**Easier:**

- Decisions in ADR-002 (folder model) and the architecture's overall shape are enforced by tools rather than by reviewer memory. The maintainer doesn't have to remember to push back.
- LLM-generated PRs that violate the folder model fail CI rather than landing.
- File-size tripwires catch the *next* god-file before it gets to 1000 lines.

**Harder:**

- Some PRs that "just need to add one component to `components/`" will be rejected if the component is feature-coupled. Author has to put it in the right place.
- The first time a contributor wants to do a legitimate cross-feature import, they have to add the export to the sibling barrel. Small friction; right incentive.

**Lost:**

- The "escape hatch" of dropping a file in the wrong place for expediency. By design.

**Maintenance cost:**

- One ESLint config update (additive).
- If a rule produces false positives, loosen with `// eslint-disable-next-line ...` comments and document why. The rules are not sacred — they enforce *current* ADRs, which can change.

## Alternatives considered

- **No lint rules; rely on `CLAUDE.md` + reviewer discipline.** Rejected. The maintainer is solo + LLM-augmented; reviewer discipline is the bottleneck and the failure mode.
- **Maximum enforcement (every architectural rule lint-checked, including stylistic ones).** Rejected. Solo maintainer's tolerance for false-positive churn is low. Stick to the rules with high ROI.
- **Pre-commit hooks instead of CI.** Pre-commit is fine for fast checks but CI catches everything that's missed (e.g., a commit that bypassed hooks). Use both for the cheap ones; CI alone for the slower ones.
- **CI check that `jest.config.js` doesn't reappear after deletion.** Rejected as overkill — once jest is removed, it isn't going to silently come back. The deletion is a one-time cleanup, not an ongoing concern.
- **Custom AST-based rule for "no Discord-named exports outside features/feedConnections/."** Tempting but over-specific; the existing `no-restricted-imports` + folder rules catch ~80% of the same issue with much less custom code.

## Deferred

- **Flip rule #2 to error.** Once the intra-feature deep imports left over from the migration are converted to relative paths, change rule #2 from warning to error.
- **Strictness of `max-lines` thresholds.** 600 / 1000 are starting points; they could ratchet to 400 / 800 once the largest files are decomposed.
