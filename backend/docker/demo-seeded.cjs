// Exit 0 when the demo owner account exists in DATABASE_URL (the demo data was seeded), 1 when it does not.
// Used by entrypoint.sh so the demo data goes into an empty database only. Any error (no users table yet, no database)
// counts as "not seeded"; the seed itself then reports the real problem.
const { Client } = require('pg');

const DEMO_OWNER = 'owner@contrack.test';

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    try {
        const r = await client.query('select 1 from users where email = $1 limit 1', [DEMO_OWNER]);
        return r.rowCount > 0;
    } finally {
        await client.end();
    }
}

main().then(seeded => process.exit(seeded ? 0 : 1), () => process.exit(1));
