// Integration tests: probes TEST_DATABASE_URL once, before any suite is collected, so `describeIfDatabase` can
// register its suites as skipped (reported by jest as skipped, not as passed) when PostgreSQL is not reachable.
const { Client } = require('pg');

const DEFAULT_URL = 'postgres://contrack:contrack@localhost:5432/contrack_test';

module.exports = async function intGlobalSetup() {
    const client = new Client({ connectionString: process.env.TEST_DATABASE_URL ?? DEFAULT_URL, connectionTimeoutMillis: 2000 });
    try {
        await client.connect();
        await client.end();
        process.env.CONTRACK_TEST_DATABASE = 'reachable';
    } catch {
        process.env.CONTRACK_TEST_DATABASE = 'unreachable';
        console.warn(`\n[integration] no PostgreSQL at ${process.env.TEST_DATABASE_URL ?? DEFAULT_URL}: every suite is skipped`
            + ' (start it with `docker compose up -d`).');
    }
};
