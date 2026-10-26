// ─── Demo data for trying ConTrack: `npm run db:seed` (add `-- --reset` to wipe and seed again) ───
// Compiled with the app: tsc keeps the decorator metadata Nest DI needs (tsx/esbuild does not).
// Goes through the real HTTP API of an in-process app (PERSISTENCE=postgres), so every row passes the same business
// rules as a user's would. Accounts and password: SEED.md.
import { sql } from 'drizzle-orm';
import { CALCULATORS } from '@contrack/domain/calculators/registry';
import { createApp } from '../bootstrap';
import { loadEnv } from '../shared/infrastructure/config/env';
import { createDatabase, createPool } from '../shared/infrastructure/database/database';

/** Demo-only password (local test data). Also written in SEED.md. */
export const DEMO_PASSWORD = 'ContrackDemo#2026';

const ACCOUNTS = {
    owner: { email: 'owner@contrack.test', displayName: 'สมชาย ใจดี (เจ้าของบริษัท)' },
    admin: { email: 'admin@contrack.test', displayName: 'วิภา ผู้จัดการ' },
    estimator: { email: 'estimator@contrack.test', displayName: 'ช่างประเสริฐ (ถอดแบบ)' },
    viewer: { email: 'viewer@contrack.test', displayName: 'บัญชี ดูอย่างเดียว' },
    solo: { email: 'solo@contrack.test', displayName: 'ผู้รับเหมาอิสระ' },
} as const;
type AccountKey = keyof typeof ACCOUNTS;

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://contrack:contrack@localhost:5432/contrack';

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
interface Workspace { id: string; name: string }
interface Project { project: { id: string }; docs: { docKey: string; version: number }[] }
interface ProjectRow { name: string; summary: { constructionTotal: number; levelsDone: number } }

async function wipe(): Promise<void> {
    const pool = createPool(DATABASE_URL);
    try {
        await createDatabase(pool).execute(sql`truncate table activity_log, level_assignments, project_revisions, project_docs,
            projects, invitations, memberships, workspaces, refresh_tokens, users restart identity cascade`);
    } finally {
        await pool.end();
    }
}

async function alreadySeeded(): Promise<boolean> {
    const pool = createPool(DATABASE_URL);
    try {
        const r = await pool.query<{ n: string }>('select count(*) as n from users where email = $1', [ACCOUNTS.owner.email]);
        return Number(r.rows[0]?.n ?? 0) > 0;
    } finally {
        await pool.end();
    }
}

/** PUT a document, starting from the version the server has. */
async function putDoc(token: string, projectId: string, docKey: string, data: unknown): Promise<void> {
    const detail = await call<Project>('GET', `/projects/${projectId}`, undefined, token);
    const current = detail.docs.find(d => d.docKey === docKey);
    await call('PUT', `/projects/${projectId}/docs/${encodeURIComponent(docKey)}`, { data, baseVersion: current?.version ?? 0 }, token);
}

async function main(): Promise<void> {
    const reset = process.argv.includes('--reset');
    if (reset) {
        await wipe();
        console.log('wiped all tables');
    } else if (await alreadySeeded()) {
        console.log('demo data already present (run `npm run db:seed -- --reset` to start over)');
        return;
    }

    const env = loadEnv({
        ...process.env,
        NODE_ENV: 'test',
        PERSISTENCE: 'postgres',
        DATABASE_URL,
        REALTIME_BUS: 'memory',
        JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? 'seed-script-secret-not-used-for-anything-else',
    });
    const app = await createApp({ env });
    await app.listen(0);
    const address = (app.getHttpServer() as { address(): { port: number } }).address();
    base = `http://127.0.0.1:${String(address.port)}`;

    try {
        const auth = {} as Record<AccountKey, Auth>;
        for (const key of Object.keys(ACCOUNTS) as AccountKey[]) {
            auth[key] = await call<Auth>('POST', '/auth/register', { ...ACCOUNTS[key], password: DEMO_PASSWORD });
        }
        const t = (k: AccountKey): string => auth[k].accessToken;

        // Company workspace with a team
        const company = await call<Workspace>('POST', '/workspaces', { name: 'บริษัท ตัวอย่างก่อสร้าง จำกัด' }, t('owner'));
        for (const [key, role] of [['admin', 'admin'], ['estimator', 'estimator'], ['viewer', 'viewer']] as const) {
            const inv = await call<{ token: string }>('POST', `/workspaces/${company.id}/invitations`, { email: ACCOUNTS[key].email, role }, t('owner'));
            await call('POST', '/invitations/accept', { token: inv.token }, t(key));
        }

        // 1) The Excel sample house, part-way through the journey, with a revision and assignments
        const sample = await call<Project>('POST', `/workspaces/${company.id}/projects`, { name: 'บ้านตัวอย่าง Excel v5 (ทีม)', start: 'sample' }, t('owner'));
        const sid = sample.project.id;
        await putDoc(t('owner'), sid, 'meta', {
            projectName: 'บ้านพักอาศัย คสล. 1 ชั้น (ตัวอย่าง)', siteAddress: 'ต.คลองหนึ่ง อ.คลองหลวง จ.ปทุมธานี',
            ownerName: 'คุณมานะ ตั้งใจ', revision: '00', documentDate: '26/10/2026', preparedBy: 'บริษัท ตัวอย่างก่อสร้าง จำกัด',
        });
        await putDoc(t('owner'), sid, 'journey', {
            'project-info': 'done', 'land-inspection': 'done', demolition: 'skipped', fill: 'done',
            'temp-utilities': 'done', 'site-camp': 'done', layout: 'done', piles: 'done', footing: 'done',
        });
        await call('POST', `/projects/${sid}/revisions`, { label: 'Rev 00', note: 'ส่งให้เจ้าของบ้านดูรอบแรก' }, t('owner'));
        for (const [level, who] of [['electrical-pipe', 'estimator'], ['electrical-cable', 'estimator'], ['roofing', 'admin'], ['roof-structure', 'admin']] as const) {
            await call('PUT', `/projects/${sid}/assignments/${level}`, { userId: auth[who].user.id }, t('owner'));
        }

        // 2) A real-looking project started from a plan (blank), first levels filled
        const blank = await call<Project>('POST', `/workspaces/${company.id}/projects`, { name: 'บ้านคุณสมศรี (เริ่มจากแบบ)', start: 'blank' }, t('estimator'));
        const bid = blank.project.id;
        await putDoc(t('estimator'), bid, 'meta', {
            projectName: 'บ้านคุณสมศรี', siteAddress: 'ต.บางพูด อ.ปากเกร็ด จ.นนทบุรี', ownerName: 'คุณสมศรี มีสุข',
            revision: '00', documentDate: '26/10/2026', preparedBy: 'ช่างประเสริฐ',
        });
        const fill = CALCULATORS.find(c => c.id === 'fill');
        if (fill?.blank === undefined) throw new Error('fill calculator has no blank()');
        await putDoc(t('estimator'), bid, 'calc:fill', { ...(fill.blank() as object), width: 16, length: 20, height: 0.5, material: 'ดินถมทั่วไป' });
        await putDoc(t('estimator'), bid, 'journey', { 'project-info': 'done', 'land-inspection': 'done', demolition: 'skipped', fill: 'done' });

        // 3) An archived project
        const old = await call<Project>('POST', `/workspaces/${company.id}/projects`, { name: 'โครงการเก่า ปี 2568 (เก็บถาวร)', start: 'sample' }, t('admin'));
        await call('PATCH', `/projects/${old.project.id}`, { archived: true }, t('admin'));

        // 4) The solo contractor: personal workspace only
        const me = await call<{ workspaces: Workspace[] }>('GET', '/me', undefined, t('solo'));
        const personal = me.workspaces[0];
        if (personal === undefined) throw new Error('solo has no personal workspace');
        await call('POST', `/workspaces/${personal.id}/projects`, { name: 'บ้านลูกค้ารายแรก', start: 'blank' }, t('solo'));

        const list = await call<ProjectRow[]>('GET', `/workspaces/${company.id}/projects?archived=false`, undefined, t('owner'));
        console.log('\nseeded. Accounts (password in SEED.md):');
        console.table([
            { email: ACCOUNTS.owner.email, role: 'owner (company) + personal' },
            { email: ACCOUNTS.admin.email, role: 'admin' },
            { email: ACCOUNTS.estimator.email, role: 'estimator' },
            { email: ACCOUNTS.viewer.email, role: 'viewer (read-only)' },
            { email: ACCOUNTS.solo.email, role: 'personal only' },
        ]);
        console.table(list.map(p => ({ project: p.name, total: Math.round(p.summary.constructionTotal), levelsDone: p.summary.levelsDone })));
    } finally {
        await app.close();
    }
}

main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
});
