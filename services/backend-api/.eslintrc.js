const path = require('path')

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.join(__dirname, 'tsconfig.json'),
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
    "prettier/prettier": [
      "error",
      {
        "endOfLine": "auto"
      },
    ],
    "unused-imports/no-unused-imports": "error",
    'react/jsx-filename-extension': 'off',
    "newline-before-return": "error",
    'curly': 'error',
    "eol-last": ["error"],
    "@typescript-eslint/explicit-module-boundary-types": "off",
    'no-console': 'error',
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
    ],
    "@typescript-eslint/ban-ts-comment": "off"
  },
};
