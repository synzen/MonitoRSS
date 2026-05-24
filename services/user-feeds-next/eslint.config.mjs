import tseslint from "typescript-eslint";
import boundaries from "eslint-plugin-boundaries";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  ...tseslint.configs.recommended,

  // ============================================================================
  // Architecture boundary rules (ADR-008)
  // ============================================================================
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/scripts/**"],
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "articles", pattern: ["src/articles/**"], mode: "full" },
        { type: "formatting", pattern: ["src/formatting/**"], mode: "full" },
        {
          type: "delivery-discord",
          pattern: ["src/delivery/discord/**"],
          mode: "full",
        },
        {
          type: "delivery",
          pattern: ["src/delivery/*"],
          mode: "full",
        },
        { type: "pipeline", pattern: ["src/pipeline/**"], mode: "full" },
        { type: "stores", pattern: ["src/stores/**"], mode: "full" },
        { type: "http", pattern: ["src/http/**"], mode: "full" },
        { type: "shared", pattern: ["src/shared/**"], mode: "full" },
        {
          type: "feed-fetcher",
          pattern: ["src/feed-fetcher/**"],
          mode: "full",
        },
      ],
    },
    rules: {
      "boundaries/dependencies": [
        "error",
        {
          default: "allow",
          rules: [
            {
              from: "articles",
              disallow: ["delivery", "delivery-discord", "pipeline", "http"],
            },
            {
              from: "formatting",
              disallow: ["delivery", "delivery-discord", "pipeline", "http", "stores"],
            },
            {
              from: "stores",
              disallow: ["pipeline", "delivery", "delivery-discord", "http"],
            },
            {
              from: "delivery",
              disallow: ["pipeline"],
            },
            {
              from: "delivery-discord",
              disallow: ["pipeline"],
            },
            {
              from: "pipeline",
              disallow: ["http"],
            },
          ],
        },
      ],
    },
  },

  // ============================================================================
  // Circular import detection
  // ============================================================================
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts", "src/scripts/**"],
    plugins: { import: importPlugin },
    settings: {
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "import/no-cycle": ["error", { maxDepth: 5 }],
    },
  },

  // ============================================================================
  // File size limit (400 lines, baseline exemptions)
  // ============================================================================
  {
    files: ["src/**/*.ts"],
    ignores: [
      "src/**/*.test.ts",
      "src/**/index.ts",
      "src/**/*types*.ts",
      "src/scripts/**",
    ],
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: [
      "src/articles/comparison/article-comparison.ts",
      "src/articles/filters/article-filters.ts",
      "src/delivery/discord/delivery-routing.ts",
      "src/delivery/discord/discord-payload-builder.ts",
      "src/delivery/discord/discord-test-delivery.ts",
      "src/delivery-preview/generate-delivery-preview.ts",
      "src/http/handlers/test.ts",
      "src/pipeline/feed-event-handler.ts",
      "src/stores/postgres/migrations.ts",
      "src/stores/postgres/postgres-delivery-record-store.ts",
    ],
    rules: {
      "max-lines": "off",
    },
  },

  // ============================================================================
  // Relax typescript-eslint rules (tsc handles type checking)
  // ============================================================================
  {
    files: ["src/**/*.ts", "test/**/*.ts", "index.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "prefer-const": "off",
    },
  },

  // ============================================================================
  // Test files: exempt from architecture rules
  // ============================================================================
  {
    files: ["src/**/*.test.ts", "test/**/*.ts"],
    rules: {
      "boundaries/dependencies": "off",
      "max-lines": "off",
    },
  }
);
