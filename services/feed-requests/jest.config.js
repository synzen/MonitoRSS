/**
 * ts-jest must use this service's TypeScript (6.x): the workspace root is
 * hoisted to another member's 5.x copy. Tests need Node 24.9+ with
 * --experimental-vm-modules so jest can require the ESM-only MikroORM v7
 * packages natively (e.g. NODE_OPTIONS=--experimental-vm-modules npm test).
 */
const tsCompilerPath = require.resolve('typescript');

module.exports = {
  moduleFileExtensions: ['json', 'ts', 'js'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { compiler: tsCompilerPath }],
  },
  collectCoverageFrom: ['**/*.ts'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
