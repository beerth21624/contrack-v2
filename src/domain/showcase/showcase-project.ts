// ─── The showcase project: one house filled from start to finish, for showing ConTrack to customers ───
// A 1-storey house built on the Excel v5 sample take-off (realistic quantities), personalised as a real job:
// header, land inspection, every journey step passed, and a live plan about 3½ months in (≈ 60 % done, a few days
// late, the roof frame slightly over budget). Pure: everything is derived from `today`, so the seed script
// (backend/src/cli/seed-showcase.ts) can rebuild it on any day. Only inputs are set: nothing is computed differently.
import { CALCULATORS } from '../calculators/registry';
import type { FillInput } from '../calculators/fill';
import type { LandInspectionInput } from '../calculators/land-inspection';
import type { PilesInput } from '../calculators/piles';
import type { SiteCampInput } from '../calculators/site-camp';
import { JOURNEY_LEVELS } from '../journey/levels';
import type { JourneyProgress } from '../journey/progress';
import {
    bucketIndexOf, defaultPlanningInput, isoToSerial, PLAN_TASKS, serialToIso,
    type CashInstallmentInput, type ManDayBlockInput, type PlanningInput, type ScheduleTaskInput,
} from '../planning';
import { calculatorInput, computeProject, createProject, type Project, type ProjectMeta } from '../project';

/** Project name in the list and on the BOQ header (the seed script finds the project by it). */
export const SHOWCASE_PROJECT_NAME = 'บ้านพักอาศัย 1 ชั้น คุณวิชัย รุ่งเรืองศรี – หมู่บ้านร่มรื่นวิลล์ ศาลายา';

const SITE_ADDRESS = 'แปลง B-12 หมู่บ้านร่มรื่นวิลล์ ถ.ศาลายา-บางภาษี ต.ศาลายา อ.พุทธมณฑล จ.นครปฐม 73170';
const OWNER = 'คุณวิชัย รุ่งเรืองศรี';
const ESTIMATOR = 'ประเสริฐ ช่างแก้ว (ผู้ประมาณราคา) – บริษัท ตัวอย่างก่อสร้าง จำกัด';

/** Days from the plan start to `today`: the job started about 3½ months ago. */
export const SHOWCASE_DAYS_IN = 105;

/**
 * Plan of each task: start (days after the project start) and estimated days (Man-Day T, which the S-Curve
 * uses as the duration), with the crew where it differs from the Excel sample. Curing time is left between the
 * concrete stages, so a 1-storey house takes about 5½ months.
 */
const PLAN: Record<string, { at: number; days: number; skilled?: number; labourers?: number }> = {
    '1.1': { at: 0, days: 2 },
    '1.2': { at: 0, days: 4, skilled: 1, labourers: 3 },
    '1.3': { at: 4, days: 2 },
    '1.4': { at: 6, days: 3 },
    '1.5': { at: 11, days: 12 },
    '1.6': { at: 20, days: 4, skilled: 1, labourers: 2 },
    '1.7': { at: 24, days: 12 },
    '2.1': { at: 36, days: 6 },
    '2.2': { at: 40, days: 4, skilled: 1, labourers: 4 },
    '2.3': { at: 44, days: 7, skilled: 1, labourers: 3 },
    '2.4': { at: 51, days: 10, skilled: 1, labourers: 4 },
    '2.5': { at: 58, days: 3 },
    '3.1': { at: 61, days: 2 },
    '3.2': { at: 63, days: 8, skilled: 3, labourers: 2 },
    '3.3': { at: 71, days: 7, skilled: 3, labourers: 2 },
    '4.1': { at: 72, days: 18, skilled: 4, labourers: 2 },
    '4.2': { at: 84, days: 5, skilled: 2, labourers: 1 },
    '5.1': { at: 90, days: 20, skilled: 4, labourers: 2 },
    '5.2': { at: 106, days: 5, skilled: 2, labourers: 1 },
    '6.1': { at: 110, days: 10, skilled: 2, labourers: 1 },
    '6.2': { at: 118, days: 14 },
    '6.3': { at: 126, days: 6 },
    '6.4': { at: 132, days: 4 },
    '6.5': { at: 136, days: 8, skilled: 3, labourers: 2 },
    '7.1': { at: 140, days: 7 },
    '7.2': { at: 147, days: 5, skilled: 3, labourers: 2 },
    '8.1': { at: 152, days: 5 },
    '8.2': { at: 150, days: 5 },
    '8.3': { at: 155, days: 3 },
    '8.4': { at: 155, days: 3 },
    '8.5': { at: 152, days: 4 },
    '8.6': { at: 158, days: 5, skilled: 3, labourers: 2 },
};

/**
 * What happened on site (S-Curve ACTUAL rows): days late against the plan start, days worked and the cost
 * spent as a share of the task budget. Rain held the footings back 2 days and the delay carried on; the roof
 * frame went 6.5 % over budget (steel price). Plastering (5.1) is under way.
 */
const ACTUALS: Record<string, { late: number; days: number; cost: number }> = {
    '1.1': { late: 0, days: 2, cost: 0.97 },
    '1.2': { late: 0, days: 4, cost: 1.0 },
    '1.3': { late: 0, days: 2, cost: 0.96 },
    '1.4': { late: 0, days: 3, cost: 1.0 },
    '1.5': { late: 2, days: 12, cost: 0.99 },
    '1.6': { late: 2, days: 4, cost: 1.01 },
    '1.7': { late: 2, days: 13, cost: 1.02 },
    '2.1': { late: 3, days: 6, cost: 0.98 },
    '2.2': { late: 3, days: 4, cost: 1.0 },
    '2.3': { late: 3, days: 7, cost: 0.99 },
    '2.4': { late: 3, days: 10, cost: 1.03 },
    '2.5': { late: 2, days: 3, cost: 0.97 },
    '3.1': { late: 3, days: 2, cost: 1.0 },
    '3.2': { late: 3, days: 9, cost: 1.065 },
    '3.3': { late: 4, days: 7, cost: 1.01 },
    '4.1': { late: 3, days: 19, cost: 1.02 },
    '4.2': { late: 2, days: 5, cost: 0.98 },
};

/** The task in progress today: started late, half done. */
const IN_PROGRESS = { id: '5.1', late: 5, progress: 0.5 } as const;

/** Steps that do not exist on this job (marked "ไม่มีในโครงการนี้"): an empty plot, nothing to demolish. */
export const SHOWCASE_SKIPPED_LEVELS: readonly string[] = ['demolition'];

/** Who on the team works on which step (PUT /projects/:id/assignments/:levelId). */
export const SHOWCASE_ASSIGNMENTS: readonly { levelId: string; who: 'estimator' | 'admin' }[] = [
    { levelId: 'footing', who: 'estimator' },
    { levelId: 'ground-beam', who: 'estimator' },
    { levelId: 'door-window', who: 'estimator' },
    { levelId: 'brick', who: 'estimator' },
    { levelId: 'electrical-pipe', who: 'estimator' },
    { levelId: 'electrical-cable', who: 'estimator' },
    { levelId: 'load-center', who: 'estimator' },
    { levelId: 'electrical-equipment', who: 'estimator' },
    { levelId: 'roofing', who: 'admin' },
    { levelId: 'roof-structure', who: 'admin' },
    { levelId: 'ceiling', who: 'admin' },
    { levelId: 'floor-tile', who: 'admin' },
    { levelId: 'toilet-tile', who: 'admin' },
    { levelId: 'paint', who: 'admin' },
];

const round = (x: number, step: number) => Math.round(x / step) * step;

function addDays(iso: string, days: number): string {
    const s = isoToSerial(iso);
    if (s === null) throw new Error(`invalid date "${iso}"`);
    return serialToIso(s + days);
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' (the BOQ header and survey date format). */
function thaiDate(iso: string): string {
    const [y = '', m = '', d = ''] = iso.split('-');
    return `${d}/${m}/${y}`;
}

/** Every calculator's input written out in full (the Excel sample values, with this job's changes on top). */
function allCalculatorInputs(base: Project, changes: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const def of CALCULATORS) {
        const input = calculatorInput(base, def);
        const change = changes[def.id];
        out[def.id] = change === undefined ? input : { ...(input as object), ...(change as object) };
    }
    return out;
}

interface Variant {
    revision: '00' | '01';
    /** Days before the plan start when the BOQ was issued. */
    issuedBefore: number;
    fillHeight: number;
    pricePerPile: number;
    workerRooms: number;
    /** Rev 00 was priced before work started: no actuals, no progress. */
    tracking: boolean;
}

const REV_00: Variant = { revision: '00', issuedBefore: 35, fillHeight: 0.4, pricePerPile: 2600, workerRooms: 4, tracking: false };
const REV_01: Variant = { revision: '01', issuedBefore: 21, fillHeight: 0.5, pricePerPile: 2800, workerRooms: 3, tracking: true };

function build(today: string, v: Variant): Project {
    if (isoToSerial(today) === null) throw new Error(`today must be YYYY-MM-DD, got "${today}"`);
    const start = addDays(today, -SHOWCASE_DAYS_IN);
    const issued = addDays(start, -v.issuedBefore);
    const survey = addDays(start, -50);

    const meta: ProjectMeta = {
        projectName: SHOWCASE_PROJECT_NAME,
        siteAddress: SITE_ADDRESS,
        ownerName: OWNER,
        revision: v.revision,
        documentDate: thaiDate(issued),
        preparedBy: ESTIMATOR,
    };

    const landInspection: Partial<LandInspectionInput> = {
        projectName: SHOWCASE_PROJECT_NAME,
        province: 'นครปฐม',
        surveyDate: thaiDate(survey),
        inspector: 'ประเสริฐ ช่างแก้ว',
        items: [
            { label: 'ค่าแรงตรวจสอบที่ดิน', qty: 2, unit: 'วัน', unitPrice: 1500, note: 'ช่างสำรวจ 1 คน + ผู้ช่วย 1 คน' },
            { label: 'ค่าเดินทาง (สำนักงาน – ศาลายา)', qty: 2, unit: 'เที่ยว', unitPrice: 800 },
            { label: 'ค่าส่องกล้องวัดระดับดินเดิม', qty: 1, unit: 'งาน', unitPrice: 1500, note: 'อ้างอิงระดับถนนหน้าแปลง' },
            { label: 'ค่าอุปกรณ์สำรวจ / เอกสาร', qty: 1, unit: 'งาน', unitPrice: 800, note: 'คัดสำเนาโฉนด ถ่ายรูปหน้างาน' },
        ],
        checklist: [
            { done: true, note: 'โฉนดเลขที่ 48213 แปลง B-12 หมู่บ้านร่มรื่นวิลล์ ต.ศาลายา อ.พุทธมณฑล จ.นครปฐม เนื้อที่ 80 ตร.ว. (16 × 20 ม.)' },
            { done: true, answer: 'yes', note: 'ถนนในหมู่บ้านกว้าง 8 ม. รถบรรทุก 6 ล้อและรถโม่ปูนเข้าถึงหน้าแปลง' },
            { done: true, answer: 'yes', note: 'แนวรั้วข้างเคียงตรงตามโฉนด ไม่มีการรุกล้ำ' },
            { done: true, answer: 'yes', note: 'หมุดเขตครบ 4 มุม ใช้ฝาท่อระบายน้ำหน้าแปลงเป็นหมุดระดับอ้างอิง (±0.00)' },
            {
                done: true, answer: 'no',
                note: 'ดินเดิมต่ำกว่าถนนหน้าบ้านประมาณ 40–50 ซม. น้ำฝนขังท้ายแปลง ท่อระบายน้ำของหมู่บ้านอยู่สูงกว่าระดับดิน'
                    + ' — ต้องถมดินและทำรางระบายน้ำรอบบ้านก่อนวางผัง (แจ้งเจ้าของบ้านแล้ว)',
            },
        ],
    };
    const fill: Partial<FillInput> = {
        width: 16, length: 20, height: v.fillHeight, settlementPct: 30,
        material: 'ดินถมคัดเกรด บดอัดทีละชั้น (เจ้าของบ้านจัดหาเอง)',
    };
    const piles: Partial<PilesInput> = {
        pileType: 'เสาเข็มตอก', section: 'I - 22 x 22', length: 6, count: 21, pricePerPile: v.pricePerPile,
        extraSpec: 'ตอกด้วยปั้นจั่นขนาดเล็ก รวมค่าขนส่งเข็มถึงหน้างาน',
    };
    const siteCamp: Partial<SiteCampInput> = { workerRooms: v.workerRooms, toilets: 1, showers: 1, stores: 1 };

    const journey: JourneyProgress = Object.fromEntries(JOURNEY_LEVELS.map(l => [
        l.id, SHOWCASE_SKIPPED_LEVELS.includes(l.id) ? 'skipped' : 'done',
    ]));

    const base = createProject('sample');
    const project: Project = {
        ...base,
        meta,
        journey,
        calculators: allCalculatorInputs(base, {
            'land-inspection': landInspection, fill, piles, 'site-camp': siteCamp,
        }),
    };
    project.planning = planning(project, start, today, v.tracking);
    return project;
}

function planning(project: Project, start: string, today: string, tracking: boolean): PlanningInput {
    const sample = defaultPlanningInput();
    const plannedStart = (id: string) => addDays(start, PLAN[id]?.at ?? 0);

    const blocks: Record<string, ManDayBlockInput> = {};
    const tasks: Record<string, ScheduleTaskInput> = {};
    for (const t of PLAN_TASKS) {
        const p = PLAN[t.id];
        const s = sample.manday.blocks[t.id];
        if (p === undefined || s === undefined) throw new Error(`no plan for task ${t.id}`);
        blocks[t.id] = { ...s, days: p.days, skilled: p.skilled ?? s.skilled, labourers: p.labourers ?? s.labourers };
        // Every duration comes from Man-Day (the sample's typed 4 days on task 4.2 is cleared); no actual yet.
        tasks[t.id] = { start: plannedStart(t.id), duration: null, progress: 0, actual: {} };
    }

    const plan: PlanningInput = {
        manday: { ...sample.manday, blocks },
        schedule: { projectName: SHOWCASE_PROJECT_NAME, minMonths: 6, tasks },
        cashflow: {
            ...sample.cashflow,
            minMonths: 6,
            installments: sample.cashflow.installments.map(i => ({ ...i })),
            progress: Object.fromEntries(PLAN_TASKS.map(t => [t.id, 0])),
            actualCost: 0,
        },
    };

    // Budgets of the tasks (from the BOQ) price the actuals.
    const budgets = new Map(computeProject({ ...project, planning: plan }).planning.schedule.tasks.map(t => [t.id, t.budget]));
    const budget = (id: string) => budgets.get(id) ?? 0;

    let spent = 0;
    if (tracking) {
        for (const [id, a] of Object.entries(ACTUALS)) {
            const task = tasks[id];
            if (task === undefined) continue;
            const cost = round(budget(id) * a.cost, 100);
            spent += cost;
            task.actual = { start: addDays(task.start, a.late), days: a.days, cost };
            task.progress = 1;
            plan.cashflow.progress[id] = 1;
        }
        const now = tasks[IN_PROGRESS.id];
        if (now !== undefined) {
            now.actual = { start: addDays(now.start, IN_PROGRESS.late) };
            now.progress = IN_PROGRESS.progress;
            plan.cashflow.progress[IN_PROGRESS.id] = IN_PROGRESS.progress;
            spent += round(budget(IN_PROGRESS.id) * IN_PROGRESS.progress, 100);
        }
        // AC as the contractor books it: work spent plus the site's operating cost (the same rate the BAC uses).
        plan.cashflow.actualCost = round(spent * (1 + plan.cashflow.operatingCostRate), 100);
    }

    // Installments billed about a week after each งวด's work is finished (actual finish when it is done).
    const schedule = computeProject({ ...project, planning: plan }).planning.schedule;
    const buckets = schedule.buckets;
    const installments: CashInstallmentInput[] = plan.cashflow.installments.map((inst, i) => {
        if (i === 0) return { ...inst, label: 'มัดจำทำสัญญา', bucket: 0 };
        const ends = schedule.tasks.filter(t => t.installment === i).flatMap(t => {
            const f = t.actual.finish ?? t.finish;
            return f === null ? [] : [isoToSerial(f) ?? 0];
        });
        const billed = ends.length === 0 ? -1 : bucketIndexOf(buckets, Math.max(...ends) + 7);
        return { ...inst, bucket: billed < 0 ? null : billed };
    });
    plan.cashflow.installments = installments;
    // PV up to the week of `today`.
    const todaySerial = isoToSerial(today) ?? 0;
    plan.cashflow.pvBuckets = Math.max(1, bucketIndexOf(buckets, todaySerial) + 1);
    return plan;
}

/** The project as it is today (Rev 01): every step passed, the plan tracked up to `today` ('YYYY-MM-DD'). */
export function buildShowcaseProject(today: string): Project {
    return build(today, REV_01);
}

/**
 * The first quotation (Rev 00), issued two weeks earlier: fill height estimated at 40 cm before the levels were
 * shot, 4 worker rooms, piles at 2,600 บาท; priced before work started, so no actuals.
 */
export function buildShowcaseRev00(today: string): Project {
    return build(today, REV_00);
}

/** Revisions in the order they were issued, with the note shown in the revision list. */
export const SHOWCASE_REVISIONS: readonly { label: string; note: string; build: (today: string) => Project }[] = [
    { label: 'Rev 00', note: 'ใบเสนอราคารอบแรก ส่งคุณวิชัยพิจารณา (ระดับถมดินประมาณการ 40 ซม.)', build: buildShowcaseRev00 },
    { label: 'Rev 01', note: 'ปรับตามผลส่องระดับดิน: ถมดินสูง 50 ซม. ลดห้องพักคนงานเหลือ 3 ห้อง ราคาเสาเข็มปี 2569 — ฉบับเซ็นสัญญา', build: buildShowcaseProject },
];
