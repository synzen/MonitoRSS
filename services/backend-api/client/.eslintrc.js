module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "unused-imports"],
  extends: [
    "airbnb",
    "airbnb-typescript",
    "plugin:prettier/recommended",
    // "eslint:recommended",
    // "plugin:@typescript-eslint/recommended"
  ],
  parserOptions: {
    project: "./tsconfig.eslint.json",
  },
  rules: {
    "no-empty": 0,
    "prettier/prettier": [
      "error",
      {
        endOfLine: "auto",
      },
    ],
    "linebreak-style": 0,
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
      },
    ],
    "react/jsx-props-no-spreading": "off",
    "react-hooks/exhaustive-deps": "warn",
  },
};
