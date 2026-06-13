module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unused-imports"],
  extends: ["airbnb", "airbnb-typescript", "plugin:prettier/recommended"],
  parserOptions: {
    project: "./tsconfig.eslint.json",
  },
  rules: {
    "no-empty": 0,
    "no-continue": 0,
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
        printWidth: 100,
      },
    ],
    "linebreak-style": 0,
    "no-restricted-syntax": 0,
    /** Generic rules */
    "padding-line-between-statements": [
      "error",
      {
        blankLine: "always",
        prev: "*",
        next: "block-like",
      },
      {
        blankLine: "always",
        prev: "block-like",
        next: "*",
      },
    ],
    "newline-before-return": "error",
    curly: "error",
    "eol-last": ["error"],
    // "max-len": ["error", { "code": 100 }],
    /** React rules */
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off",
    "react/function-component-definition": [2, { namedComponents: "arrow-function" }],
    "react/require-default-props": "off",
    "react/jsx-newline": [1, { prevent: true }],
    "react/jsx-props-no-multi-spaces": 1,
    "react/prop-types": "off",
    "@typescript-eslint/no-use-before-define": "off",
    /** Allows us to remove unused imports on auto-fix */
    "@typescript-eslint/no-unused-vars": "off",
    "unused-imports/no-unused-imports": "error",
    "unused-imports/no-unused-vars": [
      "warn",
      {
        vars: "all",
        varsIgnorePattern: "^_",
        args: "after-used",
        argsIgnorePattern: "^_",
      },
    ],
    "import/prefer-default-export": "off",
    "import/extensions": [
      "error",
      {
        js: "never",
        jsx: "never",
        ts: "never",
        tsx: "never",
        json: "always",
      },
    ],
    "react/jsx-props-no-spreading": "off",
  },
  overrides: [
    /** ADR-006 rule #1: shared base may not import from features.
     * Enforces ADR-002 folder model. */
    {
      files: [
        "src/components/**/*.{ts,tsx}",
        "src/contexts/**/*.{ts,tsx}",
        "src/hooks/**/*.{ts,tsx}",
        "src/constants/**/*.{ts,tsx}",
        "src/types/**/*.{ts,tsx}",
        "src/utils/**/*.{ts,tsx}",
      ],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["**/features/*", "@/features/*"],
                message:
                  "Shared base modules (components/contexts/hooks/utils/constants/types) may not import from features/. " +
                  "Either move this code into the feature that depends on it, or invert the dependency. See client/docs/adr/002-folder-model.md.",
              },
            ],
          },
        ],
      },
    },
    /** ADR-006 rule #2: cross-feature imports must go through the sibling feature's barrel.
     * Within a feature, files use relative paths freely.
     * The glob blocks `@/features/<name>/<anything>` (deep imports), allowing only `@/features/<name>` itself. */
    {
      files: ["src/features/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                group: ["@/features/*/*", "@/features/*/*/**"],
                message:
                  "Cross-feature imports should go through the sibling feature's index.ts barrel. " +
                  "Use `import { ... } from '@/features/<name>'` instead of a deep path. " +
                  "Within the SAME feature, prefer relative imports. " +
                  "See client/docs/adr/002-folder-model.md.",
              },
            ],
          },
        ],
      },
    },
    /** ADR-006 rule #3: max-lines warn at 600 / error at 1000.
     * Exempts: test files (many test cases), mocks (fixtures), large data files. */
    {
      files: ["src/**/*.{ts,tsx}"],
      excludedFiles: ["src/mocks/**", "src/constants/emojis.ts", "**/*.test.{ts,tsx}"],
      rules: {
        "max-lines": ["warn", { max: 600, skipBlankLines: true, skipComments: true }],
      },
    },
    {
      files: ["src/**/*.{ts,tsx}"],
      excludedFiles: ["src/mocks/**", "src/constants/emojis.ts", "**/*.test.{ts,tsx}"],
      rules: {
        "max-lines": ["error", { max: 1000, skipBlankLines: true, skipComments: true }],
      },
    },
    /** ADR-007 rule #4: role-not-hue. A JSX color prop must name a semantic ROLE
     * (fg, bg, border, text.link/error/..., brand, or an explicit status colorPalette),
     * never a raw palette hue. Bans `color="gray.800"`, `bg="blue.300"`, `color="red.fg"`,
     * etc. — both the numbered-shade and the `.fg`/`.solid` primitive-leak forms. Allowed:
     * the semantic tokens (their prefix is a role — bg/fg/border/brand/text — not a hue) and
     * the blackAlpha/whiteAlpha overlay scrims (sanctioned, not brand-tracking).
     *
     * Near-global ratchet: applied to all src JSX EXCEPT theme.ts (primitives legitimately
     * live there), the Discord-emulation surfaces (must mimic Discord, never our brand —
     * ADR-007), and a SHRINKING list of files that still carry pre-existing debt. Remove a
     * file from `excludedFiles` as part of cleaning it. See
     * client/docs/adr/007-styling-roles-tiers-contrast.md. */
    {
      files: ["src/**/*.tsx"],
      excludedFiles: [
        "**/*.test.tsx",
        // theme.ts is where primitives legitimately live (semantic tokens resolve to them).
        "src/utils/theme.ts",
        // Discord-emulation: these mimic Discord's own UI and must NOT track our brand, so their
        // raw hex/palette refs are sanctioned, not debt (ADR-007 § "the ONE exception that stays raw").
        "**/DiscordMessageDisplay/**",
        "**/DiscordView/**",
        // Vendored Chakra snippet: LightMode/DarkMode spans use colorPalette="gray" as a
        // palette reset for a forced-theme subtree (upstream snippet semantics, not debt).
        "src/components/ui/color-mode.tsx",
      ],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector:
              "JSXAttribute[name.name=/^(color|bg|background|backgroundColor|borderColor|borderTopColor|borderBottomColor|borderLeftColor|borderRightColor|fill|stroke|outlineColor)$/] > Literal[value=/^(gray|blue|red|green|orange|yellow|purple|pink|cyan|teal)\\.(50|[0-9]{3}|fg|solid|muted|subtle|emphasized|focusRing|contrast)$/]",
            message:
              "Raw palette ref in a color prop. Name a semantic ROLE (fg/bg/border/text.* for text, brand/PrimaryActionButton for accent, explicit colorPalette for status), not a hue. See client/docs/adr/007-styling-roles-tiers-contrast.md.",
          },
          /* ADR-007 corollary: colorPalette="gray" at a call site is a hue spelling the neutral
           * DEFAULT. The button recipe pins the neutral palette in theme.ts, so the prop is
           * always redundant on buttons, and the global gray default covers everything else.
           * Status palettes (red/green/orange) and brand stay explicit and allowed. color-mode.tsx
           * (vendored Chakra snippet; its LightMode/DarkMode spans use gray as a palette reset)
           * is exempted via excludedFiles above. */
          {
            selector: 'JSXAttribute[name.name="colorPalette"] > Literal[value="gray"]',
            message:
              'colorPalette="gray" is redundant: gray is the pinned neutral default (button recipe in theme.ts, global default elsewhere). Remove it, or name a meaningful palette (brand or an explicit status hue). See client/docs/adr/007-styling-roles-tiers-contrast.md.',
          },
          /* ADR-007 corollary: a status-colored OUTLINE button renders broken. The button recipe
           * (theme.ts) pins every outline border to the neutral `controlBorder`, so a
           * `<Button variant="outline" colorPalette="red">` shows a red LABEL inside a grey BOX —
           * the label and the border disagree. Use <DestructiveActionButton> (which overrides the
           * border to match the label) for delete/discard/cancel. A bare <Button colorPalette="red">
           * hits the same bug because the default variant IS outline. The loud final confirm inside a
           * dialog stays an explicit `variant="solid"` (allowed below). Two selectors: explicit
           * outline, and the bare (default-variant) case. */
          {
            selector:
              'JSXElement[openingElement.name.name="Button"]:has(JSXAttribute[name.name="variant"] > Literal[value="outline"]):has(JSXAttribute[name.name="colorPalette"] > Literal[value=/^(red|green|orange)$/])',
            message:
              'A status-colored outline button renders a colored label in a grey box (the outline border is pinned to the neutral controlBorder in theme.ts). Use <DestructiveActionButton> for destructive actions, or variant="solid" for a loud confirm. See client/docs/adr/007-styling-roles-tiers-contrast.md.',
          },
          {
            selector:
              'JSXElement[openingElement.name.name="Button"]:not(:has(JSXAttribute[name.name="variant"])):has(JSXAttribute[name.name="colorPalette"] > Literal[value=/^(red|green|orange)$/])',
            message:
              'A status-colored button with no variant defaults to outline, rendering a colored label in a grey box (the outline border is pinned to controlBorder in theme.ts). Use <DestructiveActionButton> for destructive actions, or variant="solid" for a loud confirm. See client/docs/adr/007-styling-roles-tiers-contrast.md.',
          },
        ],
      },
    },
  ],
};
