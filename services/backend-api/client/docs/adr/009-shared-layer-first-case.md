# ADR-009 — Introduce `src/shared/` for the first cross-feature non-UI domain concern

**Status:** Accepted
**Date:** 2026-06-20
**Scope:** `services/backend-api/client/src/` only.
**Amends:** ADR-002 (activates the deferred "Optional Layer 2.5 — `shared/`").

## Context

ADR-002 defined a three-layer model (thin pages, fat features, narrow shared base) and explicitly **deferred** a fourth, optional layer:

> **Optional Layer 2.5 — `shared/` (introduce when needed):** If a piece of code is cross-feature but _not_ generic UI (e.g., a domain type that several features consume but that has no place in a single feature), introduce a `src/shared/` folder for it. Do NOT add it now speculatively — wait for the first real case.

and locked in:

> **`shared/` folder: wait for first real case.** … If a real cross-feature non-UI concern appears later, an additive ADR introduces `shared/` then.

This is that additive ADR. The first real case has appeared.

### The concern

The **workspace capacity-slider model** is a small set of pure, domain-specific values and one hook:

- `WORKSPACE_DETENTS` — the coarse capacity stops `[70, 100, 140, 200, 300, 500]`.
- `WORKSPACE_BASE_FEEDS` / `feedCountToAddonQuantity` — the rule mapping a feed count to the base-tier-plus-add-on purchase basket.
- `useWorkspaceSliderPrice` — the live recurring price for a chosen capacity, from Paddle's preview.

It is consumed by **two unrelated features**:

- `subscriptionProducts` — the **buy** moment (the pricing dialog's `WorkspacePanel`).
- `workspaces` — the **manage** moment (the billing page's capacity slider and change-capacity dialog).

The whole point of the model is that buy and manage produce the **identical** basket, so a workspace is billed the same however its capacity was chosen. Duplicating it across the two features would let the two copies drift — defeating the reason it exists.

### Why it can't live where the existing layers allow

- **Not the top-level shared base.** ADR-002 rule: shared-base files must have **no domain-specific names** and import nothing from features. These have domain names (`WORKSPACE_*`, Paddle `PRICE_IDS`/`ProductKey`). They fail the "truly generic" test.
- **Not inside `subscriptionProducts`.** It currently lives in `subscriptionProducts/components/PricingDialog/`. Reaching it from `workspaces` forces either (a) a cross-feature **deep import** (forbidden by ADR-006 rule #2), or (b) a re-export through the `subscriptionProducts` barrel — which pulls in `PricingDialog`, which imports `workspaces`, which imports the billing page, which imports the model: a **module cycle** that resolves to `undefined` under test mocking. Owning it in one feature is the wrong seam.
- **Not inside `workspaces`.** Symmetric problem in the other direction.

It is genuinely cross-feature, genuinely domain-specific, and genuinely not UI. That is exactly the Layer 2.5 case ADR-002 described.

## Decision

### Activate `src/shared/`

Introduce `src/shared/` as Layer 2.5 from ADR-002, for **cross-feature, domain-specific, non-(generic-)UI** code.

A module belongs in `src/shared/` if **and only if**:

- It is consumed by **≥2 unrelated features**, AND
- It does **not** import from `features/` (so it can sit beneath both consumers without a cycle), AND
- It is **not** eligible for the top-level shared base (it carries domain names, so it fails ADR-002's "truly generic" test).

If a candidate imports a feature, it is not shared — it belongs in that feature. If it has no domain names and no feature imports, it belongs in the top-level base, not here. `src/shared/` is the narrow middle: domain-aware, feature-free, multi-feature.

### Shape

`src/shared/` partitions by **concern**, each concern a folder with a barrel, mirroring the feature shape at smaller scale:

```
src/shared/
└── workspaceCapacity/
    ├── detents.ts
    ├── detents.test.ts
    ├── useWorkspaceSliderPrice.ts
    ├── useWorkspaceSliderPrice.test.tsx
    └── index.ts          — public surface
```

Consumers import through the barrel: `import { WORKSPACE_DETENTS, useWorkspaceSliderPrice } from "@/shared/workspaceCapacity"`. Deep imports into a shared concern are forbidden, same as features.

### Fitness function (extends ADR-006)

ADR-006 rule #1 keeps the shared **base** from importing features. `src/shared/` carries the same invariant — it must not import from `features/`, or the cycle it exists to prevent reappears. Add `src/shared/**` to the scope of ADR-006 rule #1's `no-restricted-imports` (no `@/features/*` / `**/features/*`). This is the mechanical guarantee that a shared module stays beneath its consumers.

## Consequences

**Easier:**

- The capacity model has one home, beneath both features, imported through one barrel. Buy and manage cannot drift.
- The `PricingDialog ↔ workspaces` module cycle is gone structurally, not patched: the shared module depends on neither feature.
- The "where does this go?" lookup gains a precise fourth answer for the domain-aware-but-multi-feature case, instead of forcing it into a feature it doesn't belong to.

**Harder / cost:**

- A fourth layer to understand. Mitigated by the strict three-part membership test: most code still lands in a feature or the base; `shared/` is deliberately the rare middle.
- The bar for adding to `shared/` is "≥2 unrelated features already consume it" — promotion is reactive, not speculative, exactly as ADR-002 intended. A single-consumer module stays in its feature.

**For existing code:**

- `WORKSPACE_DETENTS`, `WORKSPACE_BASE_FEEDS`, `feedCountToAddonQuantity`, and `useWorkspaceSliderPrice` move from `subscriptionProducts/components/PricingDialog/` to `src/shared/workspaceCapacity/`. The five consumers (PricingDialog's `WorkspacePanel` + 2 tests, the billing page's `CapacitySlider` + `index`) switch to the `@/shared/workspaceCapacity` barrel.

## Alternatives considered

- **Re-export the model through the `subscriptionProducts` barrel.** Rejected: keeps ownership in the wrong feature and creates the import cycle described above.
- **Deep-import from `workspaces` into `subscriptionProducts/.../PricingDialog/`.** Rejected: violates ADR-006 rule #2 (cross-feature deep import); a shortcut, not a seam.
- **Duplicate the detents + basket math in both features.** Rejected: the model exists precisely to keep buy and manage identical; two copies invite drift on real money.
- **Promote to the top-level shared base.** Rejected: it carries domain names and Paddle product keys, failing ADR-002's "truly generic" membership rule for the base.
