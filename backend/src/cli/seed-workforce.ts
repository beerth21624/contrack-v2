// ─── Crews and people for the showcase (part of `npm run db:seed:showcase`; business module `workforce`) ───
// Puts realistic Thai crews and people into the company workspace, assigns them to the showcase project's planned tasks
// on its schedule dates, names its site supervisor, and gives "บ้านคุณสมศรี (เริ่มจากแบบ)" crews too: the masonry crew
// works both houses on overlapping days, so W2's conflict detection has data. The showcase also gets two waiting-window
// overrides (ช่วงรอ, W2) for a rainy season. Goes through the HTTP API.
// Idempotent: rate cards, people and crews are matched by name, assignments by (project, task, crew) and moved to the
// wanted days, the waits by task (merged into the project's other overrides); nothing is duplicated and nothing else is
// touched. Skipped when the server does not offer `workforce`.
import type {
    CrewAssignmentDto, CrewDto, PersonDto, PersonRole, EmploymentType, ProjectTaskLagsDto, RateCardDto, TaskLag,
    WorkforceTradeId,
} from '@contrack/contract';
import type { Project } from '@contrack/domain/project';
import { computeProject } from '@contrack/domain/project';
import { isoToSerial, serialToIso } from '@contrack/domain/planning';

export type Call = <T = unknown>(method: string, path: string, body?: unknown, token?: string) => Promise<T>;

export const SECOND_PROJECT_NAME = 'บ้านคุณสมศรี (เริ่มจากแบบ)';

const CARDS = [
    { key: 'A', name: 'ชุด A งานทั่วไป', skilledRate: 800, labourerRate: 500, note: 'ค่าตั้งต้นจาก Excel (งานทั่วไป)' },
    { key: 'B', name: 'ชุด B หลังคา ไฟฟ้า ฝ้า สี', skilledRate: 1000, labourerRate: 600, note: 'ค่าตั้งต้นจาก Excel (งานฝีมือ)' },
    { key: 'pong', name: 'ทีมไฟฟ้า ช่างพงษ์', skilledRate: 1200, labourerRate: 650, note: 'อัตราตกลงกับทีมช่างพงษ์ ปี 2569' },
] as const;
type CardKey = (typeof CARDS)[number]['key'];

interface PersonSeed {
    key: string;
    name: string;
    nickname?: string;
    phone?: string;
    role: PersonRole;
    employment: EmploymentType;
    trades: WorkforceTradeId[];
    dailyWage?: number;
    note?: string;
}

const PEOPLE: PersonSeed[] = [
    { key: 'prasert', name: 'คุณประเสริฐ ช่างแก้ว', nickname: 'เสริฐ', phone: '081-234-5601', role: 'supervisor', employment: 'permanent', trades: ['structure', 'masonry'], dailyWage: 1500, note: 'ผู้คุมงานประจำบริษัท ดูแลไซต์ศาลายา' },
    { key: 'somchai', name: 'สมชาย บุญมา', nickname: 'ช่างชาย', phone: '089-411-2201', role: 'foreman', employment: 'permanent', trades: ['structure'], dailyWage: 1100 },
    { key: 'boonmee', name: 'บุญมี ทองดี', role: 'skilled', employment: 'daily', trades: ['structure'], dailyWage: 800 },
    { key: 'sompong', name: 'สมปอง แก้วใส', role: 'labourer', employment: 'daily', trades: ['structure', 'site-prep'], dailyWage: 500 },
    { key: 'daeng', name: 'แดง ศรีสุข', nickname: 'ช่างแดง', phone: '086-553-1902', role: 'foreman', employment: 'permanent', trades: ['masonry', 'tiling'], dailyWage: 1000 },
    { key: 'noi', name: 'หน่อย จันทร์หอม', role: 'skilled', employment: 'daily', trades: ['masonry'], dailyWage: 800 },
    { key: 'malee', name: 'มาลี สายทอง', role: 'labourer', employment: 'daily', trades: ['masonry'], dailyWage: 500 },
    { key: 'pong', name: 'พงษ์ศักดิ์ ไฟฟ้าดี', nickname: 'ช่างพงษ์', phone: '081-772-3403', role: 'foreman', employment: 'subcontractor', trades: ['electrical'], dailyWage: 1200, note: 'ผู้รับเหมาช่วงงานไฟฟ้า มีใบอนุญาตช่างไฟฟ้า' },
    { key: 'ton', name: 'ต้น ใจเย็น', role: 'skilled', employment: 'daily', trades: ['electrical'], dailyWage: 900 },
    { key: 'wit', name: 'วิทยา ประปาไทย', nickname: 'ช่างวิทย์', phone: '085-120-4404', role: 'foreman', employment: 'subcontractor', trades: ['plumbing'], dailyWage: 1100 },
    { key: 'ek', name: 'เอกชัย สีสวย', nickname: 'ช่างเอก', phone: '084-660-5505', role: 'foreman', employment: 'daily', trades: ['painting'], dailyWage: 1000 },
    { key: 'moo', name: 'ประยูร หลังคาทอง', nickname: 'ช่างหมู', phone: '087-310-6606', role: 'foreman', employment: 'daily', trades: ['roof-structure', 'roofing'], dailyWage: 1000 },
];

interface CrewSeed {
    name: string;
    trade: WorkforceTradeId;
    leader: string;
    members: string[];
    /** Its headcount is the Man-Day crew (ช่าง / คนงาน) of this task of the showcase plan. */
    headcountOf: string;
    card?: CardKey;
    dailyCostOverride?: number;
    /** Showcase tasks the crew is assigned to (on the plan's days). */
    tasks: string[];
    note?: string;
}

const CREWS: CrewSeed[] = [
    { name: 'ทีมโครงสร้างช่างสมชาย', trade: 'structure', leader: 'somchai', members: ['boonmee', 'sompong'], headcountOf: '1.5', card: 'A', tasks: ['1.2', '1.3', '1.5', '1.6', '1.7', '2.1', '2.2', '2.3', '2.4', '2.5'] },
    { name: 'ทีมหลังคาช่างหมู', trade: 'roof-structure', leader: 'moo', members: [], headcountOf: '3.2', card: 'B', tasks: ['3.1', '3.2', '3.3'] },
    { name: 'ทีมก่อฉาบช่างแดง', trade: 'masonry', leader: 'daeng', members: ['noi', 'malee'], headcountOf: '4.1', card: 'A', tasks: ['4.1', '5.1'] },
    { name: 'ทีมไฟฟ้าช่างพงษ์', trade: 'electrical', leader: 'pong', members: ['ton'], headcountOf: '4.2', card: 'pong', tasks: ['4.2', '5.2', '8.1'] },
    { name: 'ทีมประปาช่างวิทย์', trade: 'plumbing', leader: 'wit', members: [], headcountOf: '8.2', dailyCostOverride: 2500, tasks: ['8.2', '8.4'], note: 'เหมาวันละ 2,500 บาท รวมเครื่องมือ' },
    { name: 'ทีมทาสีช่างเอก', trade: 'painting', leader: 'ek', members: [], headcountOf: '6.5', card: 'B', tasks: ['6.5', '7.2', '8.6'] },
];

/** "บ้านคุณสมศรี": the structure crew finished its footings; the masonry crew starts there before plastering at คุณวิชัย ends. */
/** Days relative to today. */
/**
 * Waits of the showcase that differ from the defaults (src/domain/workforce/task-lags.ts: 1.5 → 7 days, 5.1 → 14): the
 * job runs through the rainy season, so concrete cures and plaster dries more slowly.
 */
export const SHOWCASE_TASK_LAGS: readonly TaskLag[] = [
    { taskId: '1.5', days: 10, note: 'ฝนตกระหว่างบ่ม' },
    { taskId: '5.1', days: 21, note: 'ช่วงฝนตก ปูนแห้งช้า' },
];

const SECOND_PROJECT_PLAN: readonly { crew: string; taskId: string; from: number; to: number; note: string }[] = [
    { crew: 'ทีมโครงสร้างช่างสมชาย', taskId: '1.5', from: -30, to: -19, note: 'ฐานราก' },
    { crew: 'ทีมโครงสร้างช่างสมชาย', taskId: '1.7', from: -14, to: -3, note: 'คานคอดิน' },
    { crew: 'ทีมก่อฉาบช่างแดง', taskId: '4.1', from: 2, to: 16, note: 'ก่ออิฐชั้นล่าง (ทีมยังฉาบบ้านคุณวิชัยไม่เสร็จ)' },
];

function addDays(iso: string, days: number): string {
    const s = isoToSerial(iso);
    if (s === null) throw new Error(`invalid date "${iso}"`);
    return serialToIso(s + days);
}

interface Tokens { owner: string; estimator: string }

export interface SeedWorkforceInput {
    call: Call;
    tokens: Tokens;
    workspaceId: string;
    projectId: string;
    project: Project;
    today: string;
}

export async function seedWorkforce({ call, tokens, workspaceId, projectId, project, today }: SeedWorkforceInput): Promise<void> {
    const offered = await call<{ modules: string[] }>('GET', '/platform/modules');
    if (!offered.modules.includes('workforce')) {
        console.log('workforce: skipped (the server does not offer the module; start it with MODULES_ENABLED=workforce)');
        return;
    }
    const ws = `/workspaces/${workspaceId}`;
    // The platform offers it; the company switches it on (owner/admin, like the โมดูลเสริม page).
    await call('PUT', `${ws}/modules/workforce`, { enabled: true }, tokens.owner);
    const counts = { cards: 0, people: 0, crews: 0, assigned: 0, moved: 0 };

    // Rate cards (by name).
    const cards = await call<RateCardDto[]>('GET', `${ws}/rate-cards`, undefined, tokens.owner);
    const cardIds = new Map<CardKey, string>();
    for (const c of CARDS) {
        let card = cards.find(x => x.name.toLowerCase() === c.name.toLowerCase());
        if (card === undefined) {
            card = await call<RateCardDto>('POST', `${ws}/rate-cards`,
                { name: c.name, skilledRate: c.skilledRate, labourerRate: c.labourerRate, note: c.note }, tokens.owner);
            counts.cards++;
        }
        cardIds.set(c.key, card.id);
    }

    // People (by name; the first one of that name).
    const people = await call<PersonDto[]>('GET', `${ws}/people`, undefined, tokens.owner);
    const personIds = new Map<string, string>();
    for (const p of PEOPLE) {
        let found = people.find(x => x.name === p.name);
        if (found === undefined) {
            const { key: _key, ...body } = p;
            found = await call<PersonDto>('POST', `${ws}/people`, body, tokens.owner);
            counts.people++;
        }
        personIds.set(p.key, found.id);
    }
    const idOf = (key: string): string => {
        const id = personIds.get(key);
        if (id === undefined) throw new Error(`no person "${key}"`);
        return id;
    };

    // Crews (by name), headcounts from the showcase's Man-Day.
    const computed = computeProject(project).planning;
    const blocks = new Map(computed.manday.blocks.map(b => [b.id, b]));
    const crews = await call<CrewDto[]>('GET', `${ws}/crews`, undefined, tokens.owner);
    const crewIds = new Map<string, string>();
    for (const c of CREWS) {
        const block = blocks.get(c.headcountOf);
        const body = {
            name: c.name,
            trade: c.trade,
            leaderId: idOf(c.leader),
            memberIds: c.members.map(idOf),
            skilledCount: block?.skilled ?? 1,
            labourerCount: block?.labourers ?? 1,
            rateCardId: c.card === undefined ? null : cardIds.get(c.card) ?? null,
            dailyCostOverride: c.dailyCostOverride ?? null,
            note: c.note ?? null,
        };
        const found = crews.find(x => x.name.toLowerCase() === c.name.toLowerCase());
        if (found === undefined) {
            crewIds.set(c.name, (await call<CrewDto>('POST', `${ws}/crews`, body, tokens.owner)).id);
            counts.crews++;
        } else {
            // Keep the seeded shape (a re-run after the plan changed updates the headcount); an unchanged PATCH is a no-op.
            await call('PATCH', `${ws}/crews/${found.id}`, body, tokens.owner);
            crewIds.set(c.name, found.id);
        }
    }
    const crewId = (name: string): string => {
        const id = crewIds.get(name);
        if (id === undefined) throw new Error(`no crew "${name}"`);
        return id;
    };

    // Assignments: one per (project, task, crew), on the wanted days.
    const ensure = async (pid: string, taskId: string, crew: string, start: string, end: string, note: string | null): Promise<void> => {
        const existing = await call<CrewAssignmentDto[]>('GET', `${ws}/crew-assignments?projectId=${pid}&crewId=${crewId(crew)}`, undefined, tokens.owner);
        const found = existing.find(a => a.taskId === taskId);
        if (found === undefined) {
            await call('POST', `${ws}/crew-assignments`, { projectId: pid, taskId, crewId: crewId(crew), start, end, note }, tokens.estimator);
            counts.assigned++;
        } else if (found.start !== start || found.end !== end || found.note !== note) {
            await call('PATCH', `${ws}/crew-assignments/${found.id}`, { start, end, note }, tokens.estimator);
            counts.moved++;
        }
    };
    const schedule = new Map(computed.schedule.tasks.map(t => [t.id, t]));
    for (const c of CREWS) {
        for (const taskId of c.tasks) {
            const task = schedule.get(taskId);
            if (task === undefined || task.start === null || task.finish === null) continue;
            await ensure(projectId, taskId, c.name, task.start, task.finish, null);
        }
    }

    // Site supervisor of the showcase.
    await call('PUT', `/projects/${projectId}/supervisors`, { personIds: [idOf('prasert')] }, tokens.estimator);

    // Waits (ช่วงรอ) of the showcase: the seed's tasks get the seed's values, every other override is kept; PUT only
    // when something differs (PUT replaces the whole list).
    const lagsPath = `/projects/${projectId}/task-lags`;
    const current = (await call<ProjectTaskLagsDto>('GET', lagsPath, undefined, tokens.estimator)).lags;
    const seeded = new Set(SHOWCASE_TASK_LAGS.map(l => l.taskId));
    const wanted = [...current.filter(l => !seeded.has(l.taskId)), ...SHOWCASE_TASK_LAGS];
    const same = (a: TaskLag, b: TaskLag | undefined): boolean =>
        b?.days === a.days && (a.note ?? null) === (b.note ?? null);
    const lagsChanged = SHOWCASE_TASK_LAGS.some(l => !same(l, current.find(c => c.taskId === l.taskId)));
    if (lagsChanged) await call('PUT', lagsPath, { lags: wanted }, tokens.estimator);

    // The second house, sharing the masonry crew on overlapping days.
    const rows = await call<{ id: string; name: string }[]>('GET', `${ws}/projects?archived=false`, undefined, tokens.owner);
    let second = rows.find(r => r.name === SECOND_PROJECT_NAME);
    if (second === undefined) {
        const created = await call<{ project: { id: string; name: string } }>('POST', `${ws}/projects`,
            { name: SECOND_PROJECT_NAME, start: 'blank' }, tokens.owner);
        second = created.project;
        console.log(`created "${SECOND_PROJECT_NAME}"`);
    }
    for (const a of SECOND_PROJECT_PLAN) {
        await ensure(second.id, a.taskId, a.crew, addDays(today, a.from), addDays(today, a.to), a.note);
    }
    await call('PUT', `/projects/${second.id}/supervisors`, { personIds: [idOf('prasert')] }, tokens.estimator);

    console.log(`workforce: ${String(PEOPLE.length)} people, ${String(CREWS.length)} crews, ${String(CARDS.length)} rate cards`
        + ` (new: ${String(counts.people)} people, ${String(counts.crews)} crews, ${String(counts.cards)} cards;`
        + ` assignments added ${String(counts.assigned)}, moved ${String(counts.moved)};`
        + ` waits ${lagsChanged ? 'set' : 'unchanged'}: ${SHOWCASE_TASK_LAGS.map(l => `${l.taskId} ${String(l.days)} วัน`).join(', ')})`);
}
