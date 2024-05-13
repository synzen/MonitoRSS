const path = require('path')

module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: path.join(__dirname, 'tsconfig.json'),
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', "unused-imports", "prettier"],
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
    "prettier/prettier": "error",
    "unused-imports/no-unused-imports": "error",
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    'no-console': 'error',
    'prettier/prettier': [
      'error',
      {
        'endOfLine': 'auto',
        'semi': true
      }
    ],
    "semi": "error",
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
    "max-len": ["error", { "code": 100 }],
    "newline-before-return": "error",
    'curly': 'error'
  },
};
