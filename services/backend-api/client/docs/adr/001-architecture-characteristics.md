# ADR-001 — Driving architecture characteristics: a11y, maintainability, extensibility

**Status:** Accepted
**Date:** 2026-05-28
**Scope:** `services/backend-api/client/` only.
**Numbering note:** This ADR folder uses its own sequence, starting at 001. Cross-references to repo-root or backend ADRs are explicit (e.g. "root ADR-003", "backend ADR-001").

## Context

*Fundamentals of Software Architecture* (Richards & Ford) insists that you pick the *top ~3* architecture characteristics ("-ilities") that drive a system, and explicitly trade away the rest. Without a named ranking, every decision devolves into "it depends," and the system optimizes for nothing in particular.

The React app has accumulated structure organically over years. Some choices are clearly intentional (route-level code splitting, MSW mocks with flag-driven loading/error overrides, prescriptive a11y conventions in `client/CLAUDE.md`). Others have drifted (top-level `components/` and `contexts/` accreted feature-local code; `pages/` is now a hidden feature layer; the `FeedConnectionType` enum was meant as a destination abstraction but never had a second value added). To evaluate any of this — and to set rules for new code — we need to name what the structure is supposed to be good *for*.

## Decision

The three driving characteristics for the React app, in priority order:

1. **Accessibility / usability.** Keyboard navigation, screen reader support, WCAG-equivalent semantics. This is already a first-class concern in `client/CLAUDE.md` (live regions, `aria-busy`, indeterminate progress bars, "announce start and finish" patterns, the `DiscordMessageDisplay isLoading` indicator). Any architectural change MUST preserve these guarantees and SHOULD make them easier to apply consistently.
2. **Maintainability / evolvability.** The app has a solo maintainer. Structural rules exist so the maintainer (and future contributors, including LLM coding agents) can answer "where does this new thing go" without needing to recall historical context. The repo prefers a small number of clear rules over a large number of subtle ones.
3. **Extensibility.** Two future capabilities — destinations beyond Discord, and a team/org container for shared feed management — are committed in principle but not yet driving timelines. The structure should leave honest seams for both without paying meaningful abstraction cost up front.

The remaining characteristics (raw performance, cross-app reusability, deployment flexibility, internationalization beyond what's already wired) are explicitly **not** in the top 3. They aren't ignored, but they don't override the three above when they conflict.

## Consequences

**What becomes easier:**

- Every other ADR in this folder cites a characteristic from this list as justification. The decisions chain.
- Code review has a concrete frame: "this change improves perf but hurts maintainability" is a sentence with a known winner.
- Trade-offs that look obvious aren't. *Premature memoization across feature boundaries* would help perf, hurt maintainability — we will say no by default.
- Adding a planned capability (destinations, teams) doesn't require re-arguing why "extensibility" matters.

**What becomes harder:**

- Pull requests that improve a non-top-3 characteristic at the cost of a top-3 one have to make an explicit case. *We will reject more "polishes" than before.*
- Some genuinely good ideas (e.g., aggressive bundle splitting, a custom render-skipping framework) become harder to justify if their cost is structural complexity.

**What we lose:**

- Bandwidth to argue for "pure cleanliness" or "elegance" without a characteristic to point at. These are now insufficient justifications.

**What this enables in later ADRs:**

- ADR-002 (folder model) is justified by *maintainability* — make the home for new code obvious.
- ADR-003 (state ownership) is justified by *maintainability* + *a11y* (URL state survives reloads, supports deep linking and sharing).
- ADR-004 (destination extensibility) is justified by *extensibility* with an explicit "don't pay cost now" trade-off.
- ADR-005 (team scoping) is justified by *extensibility* with the same trade-off.
- ADR-006 (fitness functions) is justified by *maintainability* — automated enforcement of decisions that would otherwise rot under a solo maintainer.

## Alternatives considered

- **Top-3 as: performance, maintainability, a11y.** Rejected because the user's roadmap (destinations + teams) makes extensibility a near-term consideration, while performance is "good enough" via the existing Vite + React Query setup.
- **Top-3 as: testability, maintainability, a11y.** Testability was strong (MSW + dev-mockapi flags, vitest, react-testing-library) but is well-served as a *consequence* of maintainability, not a peer. The consistent form/mutation/invalidation pattern makes testing structurally easy.
- **More than 3 characteristics.** Explicitly rejected by Richards/Ford and by the maintainer. Picking more is picking none.
