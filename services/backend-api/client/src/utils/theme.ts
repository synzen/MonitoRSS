import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

/**
 * Central theme seam for the Chakra v3 migration — now a multi-SCHEME registry.
 *
 * GOAL: make the whole app re-skinnable from this one file. The migration converted hardcoded raw
 * palette refs (`bg="gray.800"`, `color="gray.400"`) into ~10 semantic roles so that changing a role
 * here re-skins every surface at once. See
 * `docs/adr/007-styling-roles-tiers-contrast.md` for the role system, the elevation ladder, the
 * contrast gate every surface must pass, and the constraints a compliant scheme must satisfy (the
 * color-theory / design-system rationale behind each scheme below).
 *
 * HOW TO SWAP SCHEMES
 * - Edit the single `ACTIVE_SCHEME` line below and reload (HMR doesn't re-run `createSystem`, so a
 *   full dev-server restart is needed to see a scheme change). No call-site edits, no UI, no env.
 *
 * HOW A SCHEME IS SHAPED (see the `Scheme` type)
 * - Each scheme is a FULL object: the neutral ladder (bg/fg/border/controlBorder), the accent ramp
 *   (`brand` + `text.link`), and the INFO status hue. It states its own `brand.contrast` (the text
 *   color that rides on a solid accent fill) explicitly — no derivation, because a mid-tone accent
 *   needs DARK contrast text while a darker accent needs WHITE, and getting that wrong fails AA.
 * - Status error/success/warning stay shared (the vivid `.300` shades) — distinct meanings, never
 *   collapsed into the accent (Material 3 / IBM Carbon / Apple HIG: status hue ≠ accent hue).
 *
 * THE ~10 ROLES THE APP COLLAPSES TO (cold defaultConfig values for reference):
 *   fg / fg.muted / fg.subtle      primary / secondary / subtle text
 *   bg / bg.subtle / bg.panel      page / outer-card / dialog-card surfaces
 *   bg.emphasized                  chip/tag/badge (NOT a container for transparent inputs)
 *   border / border.emphasized     quiet divider / edge that must read on a dark surface
 *   controlBorder                  control outline (≥3:1, WCAG 1.4.11) — applied via recipes, not props
 *   brand (+ text.link)            the accent, by ROLE not by hue
 *
 * Every value below is contrast-gated (text ≥4.5:1 AA, control/alert edges ≥3:1 per WCAG 2.1
 * §1.4.3 / §1.4.11) — gated with `node scripts/dump-theme-tokens.mjs` + a contrast check before
 * landing. The `newsprint` scheme is the previously-committed, live-verified theme extracted verbatim;
 * its resolved output is asserted byte-identical to HEAD (the registry is pure restructuring for it).
 */

// ── Scheme shape ──────────────────────────────────────────────────────────────────────────────────
// Only `_dark` is themed (the app is dark-mode-only via `forcedTheme="dark"`); `_light` keeps the
// defaultConfig gray so a future light pass starts from a known-good base.
interface InfoRamp {
  subtle: string;
  muted: string;
  emphasized: string;
  solid: string;
  fg: string;
  focusRing: string;
}
// `palette: "blue"` keeps v3's native blue-slot mechanic (no recipe override → byte-identical for a
// scheme that just retints blue). `palette: "teal"` registers a real teal ramp + re-points the alert
// info variant at it, and needs a `contrast` (the text on a solid teal info surface).
type SchemeInfo =
  | (InfoRamp & { palette: "blue" })
  | (InfoRamp & { palette: "teal"; contrast: string });

interface Scheme {
  // Neutral surface ladder: page → outer card → dialog/card → chip. bg.subtle === bg.panel by intent
  // (nested-card separation comes from `border`, not a bg delta — see the elevation ladder in
  // docs/adr/007-styling-roles-tiers-contrast.md).
  bg: string; // page / deepest
  bgSubtle: string; // outer card / raised section (=== bgPanel)
  bgPanel: string; // dialog / card default; the surface transparent inputs sit on
  bgEmphasized: string; // chip / tag / badge
  // Text ladder.
  fg: string; // primary text
  fgMuted: string; // secondary text (AA)
  fgSubtle: string; // subtle text (non-essential)
  // Edges.
  border: string; // quiet divider
  borderEmphasized: string; // edge that must read on a dark surface
  controlBorder: string; // control outline (≥3:1) — Tier-1 recipe role, never a per-call-site prop
  // Accent (the brand color, by ROLE). `solid` is the fill; `contrast` is the text ON the fill
  // (white OR dark per the accent's lightness — stated, not derived); `fg` is the lighter accent for
  // TEXT on dark surfaces (links / selected labels); subtle/muted are faint accent surfaces.
  brandSolid: string;
  brandContrast: string;
  brandFg: string;
  brandMuted: string;
  brandSubtle: string;
  brandFocusRing: string;
  // Accent TEXT role (links / accent-tinted text). Usually === brandFg.
  textLink: string;
  // INFO status hue. v3 hardwires `<Alert status="info">` to `colorPalette="blue"`; to keep INFO
  // visibly distinct from the accent (per the status≠accent rule), each scheme states its own info
  // ramp and the alert recipe is re-pointed at it (see `infoRecipeOverride` below). When a scheme
  // sets `info: "blue"`, it keeps v3's native blue-slot mechanic and adds NO recipe override (this is
  // what keeps `newsprint` byte-identical — it retints the `blue` slots directly).
  info: SchemeInfo;
}

// ── The scheme registry ───────────────────────────────────────────────────────────────────────────

const SCHEMES = {
  /**
   * NEWSPRINT — warm "aged paper" dark mode (the previously-committed, live-verified theme).
   * Warm charcoal-brown neutrals, cream paper text, amber/sepia ink accent. INFO is a muted
   * ink-blue retinted into the native `blue` slots (palette: "blue" → no recipe override), so this
   * scheme resolves byte-identical to the pre-registry commit. The amber accent is a MID-TONE, so it
   * carries DARK contrast text (`brand.contrast`), not white — white on it is only 2.27:1.
   * Refs: Refactoring UI (warm tinted dark neutrals); status hues kept distinct (Material 3 / Carbon).
   */
  newsprint: {
    bg: "#16130e",
    bgSubtle: "#1d1913",
    bgPanel: "#1d1913",
    bgEmphasized: "#3a3225",
    fg: "#f3ecdd", // 14.9:1 on panel
    fgMuted: "#b0a48c", // 7.1:1 (AA)
    fgSubtle: "#867c68", // 4.2:1 (non-essential)
    border: "#322b20",
    borderEmphasized: "#4a4030",
    controlBorder: "#8a7d63", // 4.33:1 on panel / 4.58:1 on page
    brandSolid: "#d6a35c", // amber ink; dark text rides on it
    brandContrast: "#1d1913", // 7.71:1
    brandFg: "#e0b878", // 9.41:1 on panel (links / selected labels)
    brandMuted: "#3a2f1d",
    brandSubtle: "#241d12",
    brandFocusRing: "#d6a35c",
    textLink: "#e0b878",
    info: {
      palette: "blue", // retints native blue slots → no recipe override → byte-identical
      subtle: "#202c3d",
      muted: "#2a3a52",
      emphasized: "#3f5a7d",
      solid: "#3f5a7d",
      fg: "#9db4d4", // 6.66:1 on alert bg / 8.26:1 on panel
      focusRing: "#7d9bc4",
    },
  },

  /**
   * BEIGE + INK-BLUE — warm dark-taupe "paper" + a muted editorial ink-blue accent.
   * The newspaper-masthead model: cream-on-paper neutral field, a single ink-blue accent for every
   * interactive surface. The accent (#4674bd) is darker-of-mid so WHITE labels clear AA (4.67:1);
   * `text.link` is a lighter tint (#8fb4e0, 7.8:1 on paper). INFO shifts to TEAL so an info Alert
   * stays a "cool note" but reads distinct from the blue accent (status ≠ accent).
   * Refs: warm/cool complementarity (warm paper × cool ink); WCAG 1.4.3 (white-on-solid 4.67:1);
   * Material 3 / Carbon (info hue ≠ accent hue).
   */
  beigeBlue: {
    // WARM/COOL split: the page + chips stay warm (the "paper"); cards/dialogs/menus are a COOL
    // neutral grey. The warm field × cool cards breaks the monochrome (a dense form was reading as one
    // continuous beige slab) and reads as a deliberate two-temperature system, not a single tint.
    bg: "#26211b", // WARM "lit paper" page — the warm field
    bgSubtle: "#2b2a2e", // COOL card surface (cards/dialogs sit on this, contrasting the warm page)
    bgPanel: "#2b2a2e",
    bgEmphasized: "#473f33", // chip — stays WARM (a warm pill on a cool card, extra variety)
    fg: "#efe9dd", // 11.8:1 on the cool card
    fgMuted: "#c2b6a0", // 7.1:1 (AA) on the cool card
    fgSubtle: "#978c76", // 4.3:1 (non-essential)
    border: "#504f57", // COOL card/divider edge (matches the cool card, not the warm page)
    borderEmphasized: "#615844",
    controlBorder: "#918f97", // COOL control edge — 4.5:1 on card / 5.0:1 on page (matches cool cards)
    brandSolid: "#4674bd", // ink-blue; WHITE labels 4.67:1
    brandContrast: "#ffffff",
    brandFg: "#8fb4e0", // 7.8:1 on paper (links / selected labels)
    brandMuted: "#1f2a3a", // faint accent surface (ghost/subtle hover)
    brandSubtle: "#181f29",
    brandFocusRing: "#4f7fc4", // lighter ring (no text rides on it)
    textLink: "#8fb4e0",
    info: {
      palette: "teal",
      subtle: "#12302d",
      muted: "#1c4641",
      emphasized: "#349088",
      // info-alert border (colorPalette.solid) must clear 3:1 on the COOL card — 3.73:1 here. Teal is
      // info-only (alert border + subtle bg, never a solid button), so the 3.82:1 white-on-solid is fine.
      solid: "#349088",
      fg: "#7fcfc8", // teal info text on dark
      focusRing: "#4aa6a0",
      contrast: "#ffffff",
    },
  },

  /**
   * BEIGE + TEAL — same warm taupe paper, muted teal accent (the mirror of beigeBlue, for comparison).
   * Teal sits between the warm paper and a cold blue — a cool-but-organic editorial accent. INFO
   * shifts to BLUE here (keeping info ≠ teal accent). Teal accent darkened so WHITE labels clear AA.
   * Refs: same as beigeBlue, accent/info hues swapped.
   */
  beigeTeal: {
    bg: "#26211b", // same LIGHTER "lit paper" ladder as beigeBlue (only the accent/info hues differ)
    bgSubtle: "#2f2a22",
    bgPanel: "#2f2a22",
    bgEmphasized: "#473f33",
    fg: "#efe9dd",
    fgMuted: "#c2b6a0",
    fgSubtle: "#978c76",
    border: "#3d382f",
    borderEmphasized: "#615844",
    controlBorder: "#9a8f78",
    brandSolid: "#2a7d75", // muted teal; WHITE labels 4.90:1 (AA), 3.65:1 on page
    brandContrast: "#ffffff",
    brandFg: "#74c9c0", // teal accent text on paper (8.6:1)
    brandMuted: "#163530",
    brandSubtle: "#122824",
    brandFocusRing: "#3aa69b",
    textLink: "#74c9c0",
    info: {
      palette: "blue",
      subtle: "#16263d",
      muted: "#1f3a5c",
      emphasized: "#456ea6",
      solid: "#456ea6", // info-blue; alert banner edge 3.43:1 on page, white 5.21:1
      fg: "#8fb4e0",
      focusRing: "#5a82c0",
    },
  },

  /**
   * COBALT — cold zinc neutrals + cobalt-blue accent: a clean COLD baseline to A/B against the warm
   * schemes. Lifted off stock defaultConfig near-black to a comfortable dark grey (page #18181b vs
   * stock #09090b) so it's not a pitch-black void; still firmly cold zinc, cobalt SaaS accent. INFO
   * stays native blue. Refs: cold zinc + Tailwind/Chakra cobalt; all surfaces contrast-gated on the
   * lifted ladder (controlBorder 3.7:1 page / 3.3:1 card, fg.muted 6.3:1, info edge 3.4:1).
   */
  cobalt: {
    bg: "#18181b", // lifted zinc page (was stock #09090b — comfortable dark grey, not near-black)
    bgSubtle: "#212124",
    bgPanel: "#212124",
    bgEmphasized: "#2e2e32",
    fg: "#fafafa",
    fgMuted: "#a1a1aa",
    fgSubtle: "#71717a",
    // Dividers retuned UP to follow the lifted ladder: stock zinc edges were tuned for a near-black
    // page, so on the lifted ladder `border` #2e2e32 collapsed to == bgEmphasized (1.19:1 on bg.panel —
    // a ghost line; it's load-bearing since bg.subtle === bg.panel). Now perceptible without becoming a
    // control edge (that's controlBorder's job, ≥3:1).
    border: "#3a3a40", // 1.42:1 on panel / 1.57:1 on page — quiet but visible divider
    borderEmphasized: "#48484f", // 1.77:1 on panel — readable emphasized edge (no longer a control edge)
    controlBorder: "#7a7a83", // 3.8:1 page / 3.4:1 card on the lifted ladder (zinc.500 too dim now)
    brandSolid: "#2563eb", // cobalt; white labels high contrast
    brandContrast: "#ffffff",
    brandFg: "#a3cfff",
    brandMuted: "#1a3478",
    brandSubtle: "#14204a",
    brandFocusRing: "#3b82f6",
    textLink: "#a3cfff",
    info: {
      palette: "blue",
      subtle: "#14204a",
      muted: "#1a3478",
      emphasized: "#2563eb",
      solid: "#2563eb",
      fg: "#a3cfff",
      focusRing: "#3b82f6",
    },
  },
} satisfies Record<string, Scheme>;

// ── Pick the active scheme — THE single swap point ──────────────────────────────────────────────────
const ACTIVE_SCHEME: keyof typeof SCHEMES = "cobalt";

// `S` = the ACTIVE scheme's raw values; every `S.*` in the token tree below resolves from the scheme
// picked above. Typed as the widened `Scheme` (not the narrowed literal of the chosen key) so the
// scheme-conditional branches below (`S.info.palette === "teal"`) stay legal whichever scheme is active.
const S: Scheme = SCHEMES[ACTIVE_SCHEME];

// ── Build the token tree from the active scheme ─────────────────────────────────────────────────────
// `blue.*` slots always carry the INFO hue (v3 wires info-Alerts to colorPalette="blue"). When the
// scheme's info palette is "teal", we ALSO register a `teal` ramp and re-point the alert recipe (below)
// at it; the `blue` slots then mirror the teal values so any stray blue ref still reads as the info hue.
const infoSlots = {
  subtle: { value: { _dark: S.info.subtle } },
  muted: { value: { _dark: S.info.muted } },
  emphasized: { value: { _dark: S.info.emphasized } },
  solid: { value: { _dark: S.info.solid } },
  fg: { value: { _dark: S.info.fg } },
  focusRing: { value: { _dark: S.info.focusRing } },
};

const defaultButtonRecipe = defaultConfig.theme!.recipes!.button;
const buttonRecipe = {
  ...defaultButtonRecipe,
  defaultVariants: { ...defaultButtonRecipe.defaultVariants, variant: "outline" },
  variants: {
    ...defaultButtonRecipe.variants,
    variant: {
      ...defaultButtonRecipe.variants?.variant,
      outline: {
        ...defaultButtonRecipe.variants?.variant?.outline,
        borderColor: "controlBorder",
      },
    },
  },
};

const config = defineConfig({
  theme: {
    semanticTokens: {
      colors: {
        // ── Neutral surface ladder (page → card → chip) ──────────────────────────────────────────
        bg: {
          DEFAULT: { value: { _dark: S.bg } },
          subtle: { value: { _dark: S.bgSubtle } },
          // `muted` intentionally shares `subtle`'s value (the ladder collapses them; v3 defaults
          // them apart). Don't "fix" the apparent duplication — separation comes from the border.
          muted: { value: { _dark: S.bgSubtle } },
          emphasized: { value: { _dark: S.bgEmphasized } },
          panel: { value: { _dark: S.bgPanel } },
        },
        // ── Text ladder ──────────────────────────────────────────────────────────────────────────
        fg: {
          DEFAULT: { value: { _dark: S.fg } },
          muted: { value: { _dark: S.fgMuted } },
          subtle: { value: { _dark: S.fgSubtle } },
        },
        // ── Edges: quiet divider vs emphasized edge ─────────────────────────────────────────────
        border: {
          DEFAULT: { value: { _dark: S.border } },
          emphasized: { value: { _dark: S.borderEmphasized } },
        },
        // Control / interactive-boundary role. Splits the job Chakra's default `border` overloads:
        // `border` stays whisper-quiet for DIVIDERS; `controlBorder` is bold enough for WCAG 1.4.11
        // (≥3:1) on the edges users must locate. Emits --chakra-colors-control-border; applied
        // app-wide via the recipe overrides below — do NOT pass it as a per-call-site borderColor.
        controlBorder: {
          value: { _light: "{colors.gray.500}", _dark: S.controlBorder },
        },
        // ── INFO status hue (the native `blue` slots) ───────────────────────────────────────────
        // See `infoSlots` comment. status="info" Alerts read these unless re-pointed to `teal` below.
        blue: infoSlots,
        // ── Accent (brand) ──────────────────────────────────────────────────────────────────────
        // Explicit-accent-TOKEN track. `brandSolid` is referenced as color="brandSolid" for any
        // explicit accent color (e.g. the Panel accent stripe). The `brand` PALETTE aliases the whole
        // interactive scale so a component says colorPalette="brand" (PrimaryActionButton uses it),
        // with the literal color living HERE — never at the call site. Status palettes stay explicit.
        brandSolid: {
          value: { _light: "{colors.blue.solid}", _dark: S.brandSolid },
        },
        brand: {
          solid: { value: S.brandSolid },
          contrast: { value: S.brandContrast },
          fg: { value: S.brandFg },
          muted: { value: S.brandMuted },
          subtle: { value: S.brandSubtle },
          emphasized: { value: S.brandFg },
          focusRing: { value: S.brandFocusRing },
        },
        // ── Semantic TEXT roles — the call-site layer for colored text ─────────────────────────────
        // Components reference the ROLE (color="text.link" / "text.error"), never a palette shade, so
        // the literal lives HERE. error/success/warning stay the vivid status .300 shades — distinct
        // meanings, never collapsed to one "status color". Mirrored into --app-* (index.css).
        //
        // Two hard-won v3 gotchas this encodes (verified live + via createSystem):
        //  1. NESTED keys (`text: { link }`) kebab-case to `--chakra-colors-text-link`. A DOTTED key
        //     (`"text.link"`) emits an escaped-dot var that silently fails to resolve. Always nest.
        //  2. A semanticToken must point at a concrete PRIMITIVE shade (`{colors.red.300}`), not at
        //     another semantic/alias token (`{colors.brand.fg}` resolves empty). The status roles
        //     target .300 shades — all WCAG-AA on dark surfaces.
        text: {
          link: { value: S.textLink },
          error: { value: "{colors.red.300}" },
          success: { value: "{colors.green.300}" },
          warning: { value: "{colors.orange.300}" },
        },
        // ── INFO as `teal` palette (only when the active scheme uses it) ───────────────────────────
        // Registered so the alert recipe override below can re-point status="info" at a real palette
        // (cleaner than overloading the `blue` name). Empty object when the scheme keeps native blue.
        ...(S.info.palette === "teal"
          ? {
              teal: {
                subtle: { value: { _dark: S.info.subtle } },
                muted: { value: { _dark: S.info.muted } },
                emphasized: { value: { _dark: S.info.emphasized } },
                solid: { value: { _dark: S.info.solid } },
                fg: { value: { _dark: S.info.fg } },
                contrast: { value: { _dark: S.info.contrast } },
                focusRing: { value: { _dark: S.info.focusRing } },
              },
            }
          : {}),
      },
      radii: {},
    },
    recipes: {
      // Tier 1: point every recipe-driven control's outline at controlBorder ONCE here, so no
      // input/select/textarea/outline-button carries a borderColor prop. The default recipes set
      // borderColor in the `outline` VARIANT (not base), so the override must target the same place.
      input: { variants: { variant: { outline: { borderColor: "controlBorder" } } } },
      textarea: { variants: { variant: { outline: { borderColor: "controlBorder" } } } },
      // A bare <Button> (no variant) defaults to v3's `solid` `gray`, which inverts to a WHITE pill in
      // dark mode. 77 such buttons exist across 54 files, so the default belongs HERE. `buttonRecipe`
      // spreads the FULL default recipe and flips its default variant to `outline` + points that
      // variant's edge at controlBorder. Solid-fill buttons set variant="solid" (PrimaryActionButton +
      // status CTAs). Flips the default VARIANT, not the default colorPalette (the anti-pattern).
      button: buttonRecipe,
    },
    slotRecipes: {
      // v3's default dialog backdrop is `blackAlpha.500` — actually only rgba(0,0,0,0.36), too faint
      // to push the page back, so content behind a modal stays legible and competes with the dialog's
      // own text (worst on the pricing dialog, whose content floats with no panel of its own, so the
      // scrim IS its text background and must clear WCAG 1.4.3 against whatever shows through). Deepen
      // to 64% black + a 12px blur: above the industry median (~0.5) because dark mode needs more dim
      // to separate, but short of a near-opaque 0.8 wash that would kill the depth cue and waste the
      // blur. The blur does the real work — it smears competing detail so the dim needn't go heavier.
      dialog: {
        slots: ["backdrop"],
        base: { backdrop: { bg: "blackAlpha.700", backdropFilter: "blur(12px)" } },
      },
      nativeSelect: {
        slots: ["root", "field", "indicator"],
        variants: { variant: { outline: { field: { borderColor: "controlBorder" } } } },
      },
      // Checkbox / radio are CONTROLS, fixed in TWO ways here:
      //  1. UNCHECKED outline → `controlBorder` (≥3:1, WCAG 1.4.11). The stock recipes wire it to the
      //     quiet `border.emphasized` (1.54:1 on bg.panel — measured invisible). Same Tier-1 move as the
      //     input/textarea/nativeSelect overrides above; both default to the `solid` variant.
      //  2. CHECKED fill → the `brand` accent. The recipes paint the checked state with
      //     `colorPalette.solid`, and these controls set no palette, so they inherited the global gray
      //     default → a WHITE checked box/dot on dark (#fff fill, measured). Defaulting the recipe's
      //     `colorPalette` to `brand` makes a checked control the accent (#2563eb, 3.11:1 boundary /
      //     5.17:1 glyph) — the accent-by-role rule, set once here, not `colorPalette="brand"` per call
      //     site. A call site can still override (e.g. a red destructive checkbox) by passing its own.
      checkbox: {
        slots: ["root", "label", "control", "indicator", "group"],
        base: { root: { colorPalette: "brand" } },
        variants: { variant: { solid: { control: { borderColor: "controlBorder" } } } },
      },
      radioGroup: {
        slots: [
          "root",
          "label",
          "item",
          "itemText",
          "itemControl",
          "indicator",
          "itemAddon",
          "itemIndicator",
        ],
        base: { root: { colorPalette: "brand" } },
        variants: { variant: { solid: { itemControl: { borderColor: "controlBorder" } } } },
      },
      // Two alert overrides + a scheme-conditional info re-point:
      //  1. Bump title to "semibold" (the v3 default "medium" is indistinguishable from the body).
      //  2. The default `subtle` variant paints only a fill with NO border; on warm dark pages those
      //     status fills collapse to ~1.04:1 vs the page. Add a 1px `colorPalette.solid` border so
      //     every alert reads as a distinct banner (tracks each status's own hue automatically).
      //  3. INFO re-point: when the active scheme's info palette is "teal", point status="info" at the
      //     real `teal` ramp (instead of v3's hardwired blue). Schemes with info: "blue" add NO such
      //     override — which is what keeps `newsprint` byte-identical to its pre-registry commit.
      alert: {
        slots: ["root", "title", "description", "indicator", "content"],
        base: { title: { fontWeight: "semibold" } },
        variants: {
          variant: {
            subtle: { root: { borderWidth: "1px", borderColor: "colorPalette.solid" } },
          },
          ...(S.info.palette === "teal"
            ? { status: { info: { root: { colorPalette: "teal" } } } }
            : {}),
        },
      },
    },
  },
  // v3's preflight dims every placeholder to `fg.muted/80` — visibly fainter than the `fg.muted` used
  // for all other secondary text, so placeholders read as half-disabled. Drop the alpha so a
  // placeholder matches the muted-text role it already is. App-wide input legibility lives here.
  globalCss: {
    "*::placeholder, *[data-placeholder]": { color: "fg.muted" },
  },
});

export const system = createSystem(defaultConfig, config);

export default system;
