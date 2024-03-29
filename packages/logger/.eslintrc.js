const path = require('path')

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [path.join(__dirname, 'tsconfig.json')],
  },
  ignorePatterns: [
    '.eslintrc.js',
    "jest.config.js",
    "build/**/*"
  ],
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'airbnb-typescript',
    'plugin:import/recommended',
    'plugin:import/typescript',
  ],
  rules: {
    'react/jsx-filename-extension': 'off',
    'curly': 'error',
    "newline-before-return": "error",
    "eol-last": ["error"],
    "max-len": ["error", { "code": 100 }],
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
