// End-to-end: the whole Nest app over HTTP and Socket.IO, with in-memory persistence (no database needed).
const base = require('../jest.config');

/** @type {import('jest').Config} */
module.exports = { ...base, rootDir: '..', testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'], testTimeout: 20000 };