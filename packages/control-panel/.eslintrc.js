module.exports = {
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": [
    "@typescript-eslint"
  ],
  "extends": [
    'airbnb',
    'airbnb-typescript',
    // "eslint:recommended",
    // "plugin:@typescript-eslint/recommended"
  ],
  "parserOptions": {
    project: "./tsconfig.eslint.json",
  },
  "rules": {
    "react/jsx-uses-react": "off",
    "react/react-in-jsx-scope": "off"
  }
}
