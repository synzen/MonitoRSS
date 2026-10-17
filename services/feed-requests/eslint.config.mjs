import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  {
    ignores: ["dist/**", "coverage/**"],
  },

  ...tsPlugin.configs["flat/recommended"],

  prettierRecommended,

  {
    plugins: {
      "unused-imports": unusedImports,
    },
    rules: {
      "prettier/prettier": ["error", { endOfLine: "auto", semi: true }],
      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "error",
      "semi": "error",
      "curly": "error",
      "max-len": ["error", { code: 100 }],
      "newline-before-return": "error",
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
    },
  },
];
