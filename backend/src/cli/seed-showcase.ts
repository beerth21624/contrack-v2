// ─── The showcase project for customer demos: `npm run db:seed:showcase` ───
// Builds the house of src/domain/showcase/showcase-project.ts and puts it into the company workspace of the demo
// accounts (`npm run db:seed` first), through the same HTTP API the web app uses: the owner, estimator and admin
// each save their own steps (so the activity reads like a team), levels are assigned, Rev 00 and Rev 01 issued.
// Idempotent: a project with the showcase name is updated in place (its documents replaced, missing revisions and
// assignments added). With the `workforce` module on, crews, people, crew assignments and the site supervisor are added
// too (./seed-workforce.ts), matched by name, so a re-run creates no duplicates. Nothing else in the database is touched.
//   --api <url>      a running backend (default: $CONTRACK_API_URL or http://localhost:4000)
//   --in-process     start the API in this process on $DATABASE_URL instead (like db:seed)
//   --recreate       delete the showcase project first and build it again (fresh revisions and activity)
//   --today <date>   plan relative to this day (YYYY-MM-DD; default: today)
import { stableStringify, projectToDocs, type DocEntry } from '@contrack/domain/sync';
import type { Project } from '@contrack/domain/project';
import {
    buildShowcaseProject, SHOWCASE_ASSIGNMENTS, SHOWCASE_PROJECT_NAME, SHOWCASE_REVISIONS,
} from '@contrack/domain/showcase/showcase-project';
import { createApp } from '../bootstrap';
import { loadEnv } from '../shared/infrastructure/config/env';
import { ACCOUNTS, DEMO_PASSWORD } from './seed-demo';
import { seedWorkforce } from './seed-workforce';

const COMPANY = 'บริษัท ตัวอย่างก่อสร้าง จำกัด';
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://contrack:contrack@localhost:5432/contrack';

type Who = 'owner' | 'estimator' | 'admin';

let base = '';

async function call<T = unknown>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const res = await fetch(base + path, {
        method,
        headers: { 'content-type': 'application/json', ...(token === undefined ? {} : { authorization: `Bearer ${token}` }) },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${String(res.status)} ${text}`);
    return (text === '' ? null : JSON.parse(text)) as T;
}

interface Auth { accessToken: string; user: { id: string } }
interface Workspace { id: string; name: string; kind: string }
interface Member { userId: string; email: string }
interface ProjectRow { id: string; name: string; archived?: boolean; summary: { constructionTotal: number; levelsDone: number; levelsTotal: number } }
interface Detail { project: ProjectRow; docs: { docKey: string; data: unknown; version: number }[] }
interface Revision { label: string }

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i < 0 ? undefined : process.argv[i + 1];
}

/** Today in local time, as YYYY-MM-DD. */
function localToday(): string {
    const d = new Date();
    return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Who on the team saves each document (the step they work on). */
function author(docKey: string): Who {
    if (docKey.startsWith('planning:')) return 'admin';
    const calc = docKey.startsWith('calc:') ? docKey.slice(5) : '';
    const admin = ['roofing', 'roof-structure', 'ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing', 'paint', 'misc'];
    const owner = ['land-inspection', 'demolition', 'fill', 'temp-utilities', 'site-camp', 'layout', 'piles'];
    if (calc === '' || owner.includes(calc)) return 'owner';
    return admin.includes(calc) ? 'admin' : 'estimator';
}

/**
 * Makes the project's documents equal to `target`: changed documents are PUT by their author, documents the
 * target does not have are reset (null). The journey goes last, as a team marks steps once they are filled.
 */
async function applyProject(projectId: string, target: Project, tokens: Record<Who, string>): Promise<number> {
    const detail = await call<Detail>('GET', `/projects/${projectId}`, undefined, tokens.owner);
    const current = new Map(detail.docs.map(d => [d.docKey, d]));
    const wanted = projectToDocs(target);
    const keys = new Set(wanted.map(d => d.docKey as string));
    const resets: DocEntry[] = detail.docs
        .filter(d => d.data !== null && !keys.has(d.docKey))
        .map(d => ({ docKey: d.docKey as DocEntry['docKey'], data: null }));
    const ordered = [...wanted.filter(d => d.docKey !== 'journey'), ...resets, ...wanted.filter(d => d.docKey === 'journey')];
    let changed = 0;
    for (const d of ordered) {
        const now = current.get(d.docKey);
        if (now !== undefined && stableStringify(now.data) === stableStringify(d.data)) continue;
        if (now === undefined && d.data === null) continue;
        await call('PUT', `/projects/${projectId}/docs/${encodeURIComponent(d.docKey)}`,
            { data: d.data, baseVersion: now?.version ?? 0 }, tokens[author(d.docKey)]);
        changed++;
    }
    return changed;
}

async function startInProcess(): Promise<() => Promise<void>> {
    const env = loadEnv({
        ...process.env,
        NODE_ENV: 'test',
        PERSISTENCE: 'postgres',
        DATABASE_URL,
        REALTIME_BUS: 'memory',
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'seed-script-secret-not-used-for-anything-else',
        MODULES_ENABLED: process.env.MODULES_ENABLED ?? 'workforce',
    });
    const app = await createApp({ env });
    await app.listen(0);
    const address = (app.getHttpServer() as { address(): { port: number } }).address();
    base = `http://127.0.0.1:${String(address.port)}`;
    return () => app.close();
}

async function main(): Promise<void> {
    const today = arg('--today') ?? localToday();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new Error(`--today must be YYYY-MM-DD, got "${today}"`);
    let stop: () => Promise<void> = () => Promise.resolve();
    if (process.argv.includes('--in-process')) {
        stop = await startInProcess();
    } else {
        base = (arg('--api') ?? process.env.CONTRACK_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
    }

    try {
        const login = async (who: Who): Promise<Auth> => {
            try {
                return await call<Auth>('POST', '/auth/login', { email: ACCOUNTS[who].email, password: DEMO_PASSWORD });
            } catch (e) {
                throw new Error(`cannot sign in as ${ACCOUNTS[who].email} — run \`npm run db:seed\` first (${e instanceof Error ? e.message : String(e)})`);
            }
        };
        const auth: Record<Who, Auth> = { owner: await login('owner'), estimator: await login('estimator'), admin: await login('admin') };
        const tokens: Record<Who, string> = { owner: auth.owner.accessToken, estimator: auth.estimator.accessToken, admin: auth.admin.accessToken };

        const me = await call<{ workspaces: Workspace[] }>('GET', '/me', undefined, tokens.owner);
        const company = me.workspaces.find(w => w.kind === 'company' && w.name === COMPANY);
        if (company === undefined) throw new Error(`the owner has no workspace "${COMPANY}" — run \`npm run db:seed\` first`);
        const members = await call<Member[]>('GET', `/workspaces/${company.id}/members`, undefined, tokens.owner);
        for (const who of ['estimator', 'admin'] as const) {
            if (!members.some(m => m.userId === auth[who].user.id)) throw new Error(`${ACCOUNTS[who].email} is not a member of "${COMPANY}"`);
        }

        // Find the project (active or archived) by name.
        const rows = [
            ...await call<ProjectRow[]>('GET', `/workspaces/${company.id}/projects?archived=false`, undefined, tokens.owner),
            ...(await call<ProjectRow[]>('GET', `/workspaces/${company.id}/projects?archived=true`, undefined, tokens.owner))
                .map(r => ({ ...r, archived: true })),
        ];
        const matches = rows.filter(r => r.name === SHOWCASE_PROJECT_NAME);
        if (matches.length > 1) console.warn(`found ${String(matches.length)} projects named "${SHOWCASE_PROJECT_NAME}"; updating the first`);
        let found = matches[0];
        if (found !== undefined && process.argv.includes('--recreate')) {
            await call('DELETE', `/projects/${found.id}`, undefined, tokens.owner);
            console.log('deleted the old showcase project (--recreate)');
            found = undefined;
        }
        let projectId: string;
        if (found === undefined) {
            const created = await call<Detail>('POST', `/workspaces/${company.id}/projects`, { name: SHOWCASE_PROJECT_NAME, start: 'sample' }, tokens.owner);
            projectId = created.project.id;
            console.log('created the showcase project');
        } else {
            projectId = found.id;
            if (found.archived === true) await call('PATCH', `/projects/${projectId}`, { archived: false }, tokens.owner);
            console.log('updating the existing showcase project');
        }

        // Revisions: each one is issued from its own version of the project, in order; existing labels are kept.
        const issued = new Set((await call<Revision[]>('GET', `/projects/${projectId}/revisions`, undefined, tokens.owner)).map(r => r.label));
        const assign = async () => {
            for (const a of SHOWCASE_ASSIGNMENTS) {
                await call('PUT', `/projects/${projectId}/assignments/${a.levelId}`, { userId: auth[a.who].user.id }, tokens.owner);
            }
        };
        let assigned = false;
        for (const rev of SHOWCASE_REVISIONS) {
            if (issued.has(rev.label)) continue;
            const n = await applyProject(projectId, rev.build(today), tokens);
            if (!assigned) {
                await assign();
                assigned = true;
            }
            await call('POST', `/projects/${projectId}/revisions`, { label: rev.label, note: rev.note }, tokens.estimator);
            console.log(`${rev.label}: ${String(n)} documents saved, revision issued`);
        }
        // The project as it is today (also when every revision already existed).
        const current = buildShowcaseProject(today);
        const n = await applyProject(projectId, current, tokens);
        if (!assigned) await assign();
        if (n > 0) console.log(`current: ${String(n)} documents updated`);

        // Crews and people (module `workforce`; skipped when the server does not offer it).
        await seedWorkforce({ call, tokens, workspaceId: company.id, projectId, project: current, today });

        const detail = await call<Detail>('GET', `/projects/${projectId}`, undefined, tokens.owner);
        const s = detail.project.summary;
        console.log(`\n${SHOWCASE_PROJECT_NAME}\n  project id ${projectId}\n  construction total ${Math.round(s.constructionTotal).toLocaleString('en-US')} บาท`
            + `\n  steps passed ${String(s.levelsDone)} / ${String(s.levelsTotal)}\n  planned relative to ${today}`);
    } finally {
        await stop();
    }
}

main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
