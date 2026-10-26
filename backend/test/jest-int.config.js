// Integration: Drizzle adapters against a real PostgreSQL (TEST_DATABASE_URL). Every suite skips itself when
// no database is reachable, so this command never fails just because Docker is not running.
const base = require('../jest.config');

/** @type {import('jest').Config} */
module.exports = { ...base, rootDir: '..', testMatch: ['<rootDir>/test/integration/**/*.int-spec.ts'], testTimeout: 30000 };