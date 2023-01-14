/** @type {import('ts-jest/dist/types').InitialOptionsTsJest} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["@testing-library/jest-dom/extend-expect"],
  /** Don't let jest import actual css or media files */
  moduleNameMapper: {
    "\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$":
      "<rootDir>/src/test/__mocks__/styleMock.ts",
    "\\.(css|less)$": "<rootDir>/src/test/__mocks__/styleMock.ts",
    // Module aliases defined in vite.config
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
