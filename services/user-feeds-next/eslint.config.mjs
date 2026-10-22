import tseslint from "typescript-eslint";
import importPlugin from "eslint-plugin-import";

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**"],
  },

  ...tseslint.configs.recommended,

  // ============================================================================
  // Architecture boundary and circular import rules (ADR-008)
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
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/articles",
              from: ["./src/delivery", "./src/pipeline", "./src/http"],
            },
            {
              target: "./src/formatting",
              from: [
                "./src/delivery",
                "./src/pipeline",
                "./src/http",
                "./src/stores",
              ],
            },
            {
              target: "./src/stores",
              from: ["./src/delivery", "./src/pipeline", "./src/http"],
            },
            {
              target: "./src/delivery",
              from: ["./src/pipeline"],
            },
            {
              target: "./src/pipeline",
              from: ["./src/http"],
            },
          ],
        },
      ],
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
      "max-lines": "off",
    },
  }
);
