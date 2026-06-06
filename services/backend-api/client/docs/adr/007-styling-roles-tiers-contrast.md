# ADR-007 — Styling: a semantic role system, encoding mechanisms, and a contrast gate

**Status:** Accepted
**Date:** 2026-06-05
**Scope:** `services/backend-api/client/`.

> This ADR is the **canonical, self-contained guide** to how the frontend is styled. It is the
> durable successor to the `chakra-v3-visual-audit/` working folder (a migration scaffold that has
> since been deleted). If you are about to change a color, a border, a surface, or a control's
> appearance, read this first. Everything load-bearing from the migration lives here; the per-surface
> audit reports and the multi-scheme experiment were scratch and are gone.

## Context

The v6→v3 Chakra migration preserved behavior and a11y but left the app **fighting v3's design
system**: ~700 raw palette refs (`bg="gray.800"`, `color="gray.400"`, `borderColor="gray.600"`,
`colorPalette="blue"`) hardcoded across ~110 files instead of using v3's cohesive semantic tokens.
Raw refs don't agree with each other or with the v3 primitives (inputs, radios, checkboxes) that
*do* use semantic tokens, so surfaces looked subtly incoherent — and, worse, several hardcoded
combinations produced **invisible controls** and **failing contrast** that looked fine in a
screenshot.

A multi-surface audit and a multi-scheme `theme.ts` experiment converged on a small **semantic role
system** plus a one-file reskin mechanism. The experiment is over: a single dark scheme (`cobalt`) is
the committed default. This ADR records the role system, the mechanisms that apply it, the contrast
gate that every change must pass, and the fitness function that keeps call sites role-pure.

The driving characteristics (ADR-001) this serves: **accessibility/usability** (the contrast gate),
**maintainability** (reskin from one file; no decision duplicated across call sites), and
**extensibility** (a future light mode or rebrand is a `theme.ts` edit, not a sweep).

## Decision

### 1. Call sites name a ROLE, never a HUE (role-not-hue)

The non-negotiable rule, and it is grounded in standard design-token practice (name a token for its
*role*, not its current *value*; `--color-primary-blue` breaks the day the primary becomes green):

**A call site names what a color MEANS (a semantic role), never which color it IS (a primitive).**
The theme maps role → color in exactly one place.

| The value means… | Use (call site) | NOT |
|---|---|---|
| link / accent-tinted text or icon | `color="text.link"` | `blue.fg`, `blue.300` |
| error / success / warning text or icon | `color="text.error"` / `text.success"` / `text.warning"` | `red.fg`, `red.500`, `green.400`, `orange.500` |
| the app accent on a control | `colorPalette="brand"` / `<PrimaryActionButton>` | `colorPalette="blue"` |
| an explicit accent color (stripe, accent border) | `color="brandSolid"` / `var(--app-accent-solid)` | `blue.solid`, `blue.500` |
| secondary / subtle / primary neutral text | `fg.muted` / `fg.subtle` / `fg` | `gray.400`, `whiteAlpha.700` |
| a card / dialog / raised surface | `<Panel>` / `bg.panel` / `bg.subtle` | `gray.800`, `gray.700` |
| a chip / badge / small solid pill | `bg.emphasized` | `gray.700` |
| a divider / quiet edge | `border` / `border.emphasized` | `gray.600` |
| a control's outline (input/select/textarea/button) | nothing — the recipe handles it | a `borderColor` prop |

**`*.fg` / `*.solid` / `*.focusRing` (e.g. `blue.fg`, `red.fg`) are NOT the target — they are a
primitive leak.** They are semantic *within Chakra* (the foreground shade *of the blue palette*) but
still hardcode **which hue is the accent/status** at the call site. By the design-token tier model
below they sit at **tier 1 (primitive)**, exactly like `blue.300` — a call-site use is a tier
violation, just the subtle kind. A rebrand must hunt down every one. Existing `*.fg` call sites are
debt: convert when touched, never introduce new ones. (`blue.fg` is already at zero app-wide.)

### 2. Decide by MEANING, with the paired-surface test

The rule above is about *meaning*, so it is **not a find-replace**. A blind `orange.fg → text.warning`
sweep is wrong because two cases look identical in source but differ in meaning:

- **Standalone colored text or icon** (a bare `<Icon color="red.fg">`, a `<Text color="blue.300">`,
  no paired background) → THIS is the `text.*` family. → `text.link` / `text.error` / `text.success`
  / `text.warning`.
- **A paired status fill** — a pill/badge carrying **both** a status `bg` and a status `color`
  (`bg: "orange.subtle"`, `color: "orange.fg"`) → **keep the explicit palette.** The bg and fg are
  one status unit; swapping only the fg to `text.warning` splits the pair across two token families
  and is *less* coherent. The reference is `UnsavedChangesBadge` (left explicit on purpose).

**Status hue ≠ accent hue** (Material 3 / IBM Carbon / Apple HIG all keep them distinct). So:

- **Accent** (primary CTA, selected state, links) → promote to the `brand` **role**, because the
  accent rebrands. `colorPalette="brand"` / `<PrimaryActionButton>` / `text.link`.
- **Per-instance status** (a red delete button, a green success badge) → **keep explicit**
  `colorPalette="red"`/`"green"`/`"orange"`, because danger/success/warning carry fixed meaning that
  does **not** rebrand. Promoting them to a role would be over-abstraction. The *shade* still comes
  from a per-palette semantic slot (`red.subtle`, `green.solid`), never a raw `red.500`.

> **Why the global default is NOT flipped to `brand`.** Reaching zero `colorPalette` props by setting
> the global default to blue/brand is tempting and wrong: the global default is `gray`, and many
> controls (ghost buttons, focus rings, subtle badges) rely on that neutral default. Flipping it
> cascades the accent onto every one of them app-wide. Promote to a role (`brand` palette +
> `PrimaryActionButton`); never flip a global default other things silently depend on.

### 3. Two orthogonal axes: token TIERS (naming) vs ENCODING (mechanism)

These are different things that both get called "three tiers" in the wild. This ADR keeps them
separate on purpose:

**Token tiers — how a token is NAMED** (the design-token literature: primitive → semantic →
component):

| Tier | Example | Where it may appear |
|---|---|---|
| 1 — primitive | `blue.300`, `blue.fg`, `gray.800` | **theme-internal only** (a semantic token resolves to one) |
| 2 — semantic | `text.link`, `bg.panel`, `border`, `brand.solid` | **call sites name this layer** |
| 3 — component | per-component token | mostly skipped here |

**Encoding — WHERE a styling decision is recorded** (this codebase's mechanism):

| Encoding | Lives in | Owns |
|---|---|---|
| Recipe override | `theme.ts` (`recipes` / `slotRecipes`) | every recipe-driven **control** (input, textarea, nativeSelect, button, checkbox, radio, alert) — the edge/fill set once, **no per-call-site prop** |
| `Panel` component | `components/Panel` | **container** surfaces (card / dialog body / section): surface + 1px border + radius in one place. `accent` takes a semantic intent (`brand`/`info`/`error`), never a color. `TabContentContainer` is a thin alias — don't fork it |
| Token prop (escape hatch) | the JSX | genuine **one-offs** that fit neither: `bg="bg.panel"`, `color="fg.muted"`. Legal but the exception, capped by the fitness function below |

**The cross-cut (state it so nobody conflates the axes): a semantic (tier-2) role is *applied via* an
encoding choice.** A control's edge is the `controlBorder` *role* applied via a *recipe*; a card is
`bg.panel` applied via the `Panel` *component*; a one-off label is `fg.muted` applied via a *prop*.
Reach for the highest-leverage encoding that fits (recipe > Panel > prop), and a role/recipe/component
is worth creating the first time you'd otherwise hardcode the **second** instance.

### 4. Theming mechanism: `theme.ts` is the single reskin seam

`src/utils/theme.ts` collapses the whole app to **~10 neutral roles + an accent**:

```
fg / fg.muted / fg.subtle      primary / secondary / subtle text
bg / bg.subtle / bg.panel      page / outer-card / dialog-card surfaces
bg.emphasized                  chip / tag / badge  (NOT a container for transparent inputs)
border / border.emphasized     quiet divider / edge that must read on a dark surface
controlBorder                  control outline (≥3:1, WCAG 1.4.11) — applied via recipes, not props
brand (+ text.link)            the accent, by ROLE not by hue
```

It is a **scheme registry**: a `SCHEMES` map of fully-specified `Scheme` objects and a one-line
`ACTIVE_SCHEME` swap point (a full dev-server restart is needed — HMR does not re-run `createSystem`).
This is the realized "reskin the whole app from one file" end state.

- **`cobalt` is the committed default** and stays so for the foreseeable future.
- The other schemes (`newsprint`, `beigeBlue`, `beigeTeal`) are **retained reference examples**, not
  maintained as alternates. They double as the spec for what a valid scheme must satisfy. Do not prune
  them, and do not enshrine any one as "the brand."

**What a compliant scheme MUST satisfy** (the `Scheme` shape is the contract):

- Every value is **contrast-gated before landing** (see §5).
- `brand.contrast` (the text color riding on a solid accent fill) is **stated, not derived** — a
  mid-tone accent needs DARK contrast text, a darker accent needs WHITE; guessing fails WCAG 1.4.3.
- **Status (error/success/warning) stays distinct from the accent** and shared across schemes (the
  vivid `.300` shades).
- `controlBorder` is retuned to the scheme's neutral ladder so control edges stay ≥3:1.

**Encoding-recipe coverage as built** (do not re-add per-call-site props these already handle):
`input`, `textarea`, `nativeSelect` outlines → `controlBorder`; **`button`** default *variant* flipped
to `outline` with a `controlBorder` edge (77 bare buttons would otherwise render as white solid pills
in dark mode); **`checkbox` / `radioGroup`** unchecked outline → `controlBorder` and checked fill →
`brand`; **`alert`** title weight bumped, a 1px `colorPalette.solid` border added, and (scheme-
conditional) `status="info"` re-pointed to a real `teal` ramp so INFO ≠ accent; a `globalCss`
placeholder fix so placeholders read at the `fg.muted` role.

### 5. The contrast gate (acceptance criterion for every styling change)

A screenshot is **not** acceptance. Dark-on-dark text and 1.0:1 borders read as "fine" at a glance
and fail in fact. **Verify by MEASURING the rendered computed styles in the running app**, and require:

- **Text / icons: ≥ 4.5:1** (WCAG 1.4.3 AA). Button labels, chip text, helper text, status icons.
- **Control / alert boundaries (input/select/checkbox/radio border, focus ring, alert edge): ≥ 3:1**
  (WCAG 1.4.11).

**Same-token traps to check for explicitly** (these are why measuring beats eyeballing):

- `bg.subtle` and `bg.panel` are the **same** value in this theme — a nested card separates from its
  parent by its **`border`**, not a bg delta. Don't rely on a bg difference that isn't there.
- A **transparent input is only as visible as its border against the surface behind it.** Native v3
  inputs are transparent outline controls. Their only boundary is the 1px control edge, so a
  transparent input on `bg.emphasized` collapses to ~1.0:1 — invisible. **A transparent input must sit
  on `bg` / `bg.panel` / `bg.subtle`, never on `bg.emphasized`.** If a design needs an input inside an
  emphasized card, **flatten the card to `bg.panel`** — do not re-add a fill.
- **`solid` recipes (Tag/Badge/Button) compute a *contrasting* foreground for their fill.** Override
  the fill to a dark token and the recipe still emits a *dark* fg → dark-on-dark. Use `variant="subtle"`
  or set `color="fg"` explicitly; don't trust the recipe after a fill override.

## Consequences

**Easier**

- A reskin (or a future light mode) is editing `theme.ts` — not 700 call sites.
- Role purity is enforced by a tool, not reviewer memory (§ fitness function), consistent with ADR-006.
- New surfaces inherit correct control edges, button defaults, and checked-state accent automatically
  from the recipes — zero styling props for the common case.

**Harder**

- Agents must internalize the **paired-surface nuance** (§2): the rule is meaning-based, so a naive
  find-replace can corrupt a status badge. The badge case is the canonical reminder.
- New raw refs fail CI. Never add a file to the rule's `excludedFiles` to escape an error — that list
  is permanent exceptions only (theme.ts, Discord-emulation, tests). Fix the ref to a role instead.

**Lost**

- The convenience of dropping a raw `gray.800`/`blue.300` at a call site. By design.

## Fitness function (extends ADR-006)

ADR-006 established that, for a solo + LLM-augmented maintainer, **prose decays and decisions must be
enforced**. Role-not-hue (§1) is the styling analogue of ADR-006's import rules, so it gets the same
treatment: a **fourth fitness function** — an ESLint rule banning raw palette refs in JSX color props.

- **Rule (LIVE in `.eslintrc.js`):** a `no-restricted-syntax` AST selector flags a JSX color prop
  (`color` / `bg` / `background` / `borderColor` / `fill` / `stroke` / …) whose value is a raw palette
  ref — `gray.800`, `blue.300`, **and the primitive-leak forms** `red.fg`, `blue.solid`, etc. The
  selector keys on a **raw-hue prefix** (`gray|blue|red|green|orange|yellow|purple|pink|cyan|teal`),
  so the semantic roles pass automatically — `fg.muted`, `bg.panel`, `border.emphasized`, `brand.solid`,
  `text.error` all have a *role* prefix, not a hue. `blackAlpha`/`whiteAlpha` overlay scrims are also
  allowed (sanctioned overlay dimming, not brand-tracking).
- **Near-global ratchet, no debt exclusions** (not the "grow a tiny glob" this ADR first envisioned —
  see the correction below). Applied to **all** `src/**/*.tsx` *except* three permanent, justified
  exceptions: `theme.ts` (primitives legitimately live there), the Discord-emulation surfaces
  (`DiscordMessageDisplay`, `DiscordView` — must mimic Discord, never our brand), and test files.
  There is **no per-file debt list** — the few real violators were fixed when the rule landed. ~345
  files are locked; the rule is proven to fire (injecting `color="gray.800"` into a locked file errors)
  and the tree is clean of it. If a future raw ref is ever sanctioned (it shouldn't be), prefer an
  inline `// eslint-disable-next-line no-restricted-syntax` with a reason over re-adding a file to the
  exclusion list.

> **Correction to this ADR's own premise.** The body above speaks of "~700 raw refs across ~110
> files" — that was the migration's *starting* state. By the time the ratchet was wired, the migration
> was effectively complete: under the real ESLint config only **2 files** carried a genuine raw color-prop
> ref (`Navbar`'s react-icon `gray.500`, `ErrorAlert`'s `red.solid`) — both fixed in the same change —
> plus the Discord-emulation surfaces (sanctioned). The per-surface audit's "🔍 audited (static)" labels
> badly over-stated the remaining work; the *code* was already role-pure. (An early count of "~32 files"
> was an artifact of running the selector with `--no-eslintrc`, which mis-parses files carrying inline
> disables for airbnb rules and emits false positives — always measure the ratchet under the real config.)
> So the ratchet ships near-global with zero debt exclusions, not as a slowly-growing allowlist.

**Known coverage gap (do not mistake a green lint for full role purity):** a syntactic rule catches
**direct** JSX string-literal props only. It does **not** catch indirect leaks —
`getChakraColor("blue.300")`, react-icon `color={someStringVar}`, template literals, or a value passed
through a variable. Those are covered by the `--app-*` boundary (below) and code review, not the
linter. ADR-006's barrel rule has the same class of blind spot (it can't see relative cross-feature
imports); same caution applies.

## The `--app-*` boundary (non-Chakra surfaces)

Chakra recipes/components/props only style **Chakra-rendered** elements. JS-styled and third-party
surfaces — react-select, raw `border={`solid 1px ${...}`}` template strings, anything feeding a color
to a non-Chakra library — consume **app-level CSS vars** from `src/index.css` (`var(--app-fg)`,
`var(--app-fg-muted)`, `var(--app-border)`, `var(--app-bg-panel)`, `var(--app-accent-solid)`,
`var(--app-control-border)`, …). That `:root` block is the **only** place that references Chakra's
internal `--chakra-colors-*` namespace, so a Chakra version bump that renames its vars (as v3 did) is
a one-file edit there instead of an audit across every call site. `reactSelectStyles.ts` is the
reference — it imports nothing from Chakra.

> **Keep the layers in lockstep: a new role that styles a CONTROL must be mirrored into `--app-*` in
> the same change, or you split the control family.** Adding `controlBorder` to the Chakra input/select
> recipes silently left react-select on the old quiet edge (a visible parity break) until
> `--app-control-border` was added and `reactSelectStyles.ts` re-pointed. Checklist when you add a
> control/accent role: does react-select (or any JS-styled control) render that same element? If so,
> add/point the matching `--app-*` var, and verify a native input and a react-select control measure
> the same border on the same surface.

The legacy `getChakraColor` helper is **avoided in new code** (it only replaces the first dot, takes an
untyped string, and silently produces broken vars for two-dot tokens or a bare unwrapped token name).
Migrate remaining call sites to `--app-*` (template strings) or a real Chakra `<Icon color="…">`
(react-icon colors) rather than extending it.

## The ONE exception that stays raw: Discord-emulation surfaces

`DiscordMessageDisplay`, the embed/thumbnail components, and `discord.css` mimic Discord's own UI and
must **not** track our brand. Leave their hex/hsl values raw, and comment them so a future sweep doesn't
"fix" them.

## Appendix — hard-won Chakra v3 gotchas (verified live during the migration)

Theme / token registration:

- **No `zinc` scale exists.** v3's default neutral scale is `gray` (and `gray.500` already *is* the
  zinc value `#71717a`). `{colors.zinc.500}` emits an unresolved literal. Reference `gray.*`.
- **Semantic-token keys must be NESTED, not dotted.** `text: { link }` kebab-cases to
  `--chakra-colors-text-link`. A dotted key (`"text.link"`) emits an escaped-dot var that silently
  fails to resolve.
- **A semantic token must point at a concrete PRIMITIVE shade** (`{colors.red.300}`), not at another
  semantic/alias token (`{colors.brand.fg}` resolves empty).
- **CSS vars are kebab-cased:** `controlBorder` → `--chakra-colors-control-border`. Probing the camel
  form reads empty and *looks* like a registration failure when the token is fine. Read the rendered
  element's resolved value, not a guessed var name. (`--app-*` consumers must use the kebab form too —
  a camelCase `--chakra-colors-blue-focusRing` reference rendered focus rings WHITE app-wide.)
- **Recipes set `borderColor` in the `outline` VARIANT, not `base`.** A `base.borderColor` override is
  lower-specificity and the variant wins. Override at `variants.variant.outline.borderColor`.
- **The whole `whiteAlpha.*` scale resolves to empty string** in this app's v3 system — every
  `whiteAlpha` ref is a silent invisible (a `whiteAlpha` fill is a dead hover/surface).

Layout defects the screenshot hides (catch them while probing, even if the fix is a separate change):

- **Non-stretching flex rows:** an input/select narrower than the field above it usually means a
  missing `w="full"` on the wrapping `HStack`/`Stack` (use `alignSelf="stretch"`, not `width="100%"`,
  inside a v3 `Field.Root` — it is `align-items: flex-start`).
- **Leftover v2 margins stacking on flex `gap`:** v3 `HStack`/`Stack` and the `DialogFooter`/`Header`
  recipes already apply a flex `gap`; a stray `mr={3}`/`ml={2}` is now *additive*, double-spacing the
  row. Removing it is style-only. (The v2 `spacing` prop is also a silent no-op in v3 — it's `gap`.)
- **Squished icon+label** inside one `display:block` span instead of being laid out by the Button's
  flex/gap.

Probe hygiene (so you measure the right element):

- **Scope selectors to the open dialog** (`dialog.querySelector(...)`), not `document` — a page often
  has another instance of the same role behind the modal; if a probe's colors contradict the
  screenshot, suspect this first.
- **A "card" is usually nested boxes; the styled one isn't the outer wrapper** — a `Box as="label"`
  wrapper is transparent and the bg/border live on its child `<div>`.
