// Local PostgreSQL 16 without Docker (and without admin rights): `npm run db:local`.
// Same port, user and databases as docker-compose.yml, so DATABASE_URL / TEST_DATABASE_URL work unchanged.
// Data lives in backend/.local-pg (git-ignored). Stop with Ctrl+C.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '..', '.local-pg');
const port = Number(process.env.PGPORT ?? 5432);

const pg = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'contrack',
    password: 'contrack',
    port,
    persistent: true,
    // UTF-8 regardless of the Windows locale (Thai text); same as the postgres Docker image.
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {},
});

const fs = await import('node:fs');
if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log(`initialising a new database cluster in ${dataDir}`);
    await pg.initialise();
}
await pg.start();
for (const db of ['contrack', 'contrack_test']) {
    try {
        await pg.createDatabase(db);
        console.log(`created database ${db}`);
    } catch {
        // already exists
    }
}
console.log(`PostgreSQL ready on localhost:${port} (user contrack / contrack; databases contrack, contrack_test)`);

const stop = async () => {
    await pg.stop();
    process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
