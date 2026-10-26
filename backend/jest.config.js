// Unit tests: domain and use cases with in-memory adapters (no database, no network).
/** @type {import('jest').Config} */
module.exports = {
    rootDir: '.',
    testEnvironment: 'node',
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
    moduleNameMapper: {
        '^@contrack/domain/(.*)$': '<rootDir>/../src/domain/$1',
        '^@contrack/contract$': '<rootDir>/../src/shared/contract/index.ts',
        '^@contrack/contract/(.*)$': '<rootDir>/../src/shared/contract/$1',
        '^@app/(.*)$': '<rootDir>/src/$1',
    },
    // Shared code outside backend/ resolves its own imports (zod) from backend/node_modules.
    modulePaths: ['<rootDir>/node_modules'],
    collectCoverageFrom: ['src/**/*.ts', '!src/**/*.spec.ts', '!src/main.ts'],
};