/** @type {import('jest').Config} */
export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: { "^(\\.{1,2}/.*)\\.js$": "$1" },
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        useESM: true,
        isolatedModules: true,
        tsconfig: { module: "NodeNext", moduleResolution: "NodeNext", strict: false },
      },
    ],
  },
  testMatch: ["**/tests/**/*.test.ts"],
  testTimeout: 30000,
};
