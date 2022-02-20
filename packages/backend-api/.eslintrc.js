module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', "unused-imports"],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    "unused-imports/no-unused-imports": "error",
    'react/jsx-filename-extension': 'off',
    "newline-before-return": "error",
    'curly': 'error',
    "eol-last": ["error"],
    "max-len": ["error", { "code": 100 }],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "padding-line-between-statements": [
      "error",
      {
        "blankLine": 'always',
        "prev": '*',
        "next": 'block-like'
      },
      {
        "blankLine": 'always',
        "prev": 'block-like',
        "next": '*'
      }
    ]
  },
};
