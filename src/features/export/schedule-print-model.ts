// ─── S-Curve schedule → printable document models (pure) ─────────────────────
// Two documents, both landscape A4 (see SchedulePrintDocument.tsx):
//   Gantt + S-Curve — a header block, the cumulative plan / actual S-curve, and the task table with a timeline
//                     column: every bar is placed in proportion to its dates over the axis the page shows, so any
//                     number of weeks fits the page width.
//   ปฏิทินงาน       — one page per chosen month: the Monday-first month grid of the on-screen calendar
//                     (computeCrewCalendar), each day's tasks and crew. A day with more tasks than fit shows
//                     "+N งาน"; those tasks are listed under the grid on the same page.
// Every number comes from the computed schedule / Man-Day; nothing is recalculated here. The page-fitting
// estimates below (millimetres) only decide how many task chips a day cell shows and the type scale.

import {
    INSTALLMENTS, bucketIndexOf, computeCrewCalendar, isoToSerial,
    type CrewCalendarDay, type CrewCalendarResult, type CrewCalendarTask, type ManDayResult, type ScheduleResult,
} from '@/domain/planning';
import { formatDate, usedBucketCount } from '@/features/planning/shared/planning-format';
import {
    crewText, keyToIso, monthCells, monthKey, monthTitle, parts,
} from '@/features/planning/schedule/calendar-grid';
import { fmtMoney } from './boq-print-model';

export const SCHEDULE_PRINT_TEXT = {
    ganttTitle: 'แผนงานก่อสร้างและ S-Curve',
    calendarTitle: 'ปฏิทินงาน',
    projectName: 'ชื่อโครงการ',
    start: 'วันเริ่มโครงการ',
    finish: 'วันเสร็จโครงการ',
    duration: 'ระยะเวลา',
    budget: 'งบประมาณโครงการ',
    printedOn: 'วันที่พิมพ์',
    days: 'วัน',
    baht: 'บาท',
    scurve: 'S-Curve แผนงานเทียบผลงาน (สะสม)',
    planCum: 'แผนงาน (สะสม)',
    actualCum: 'ผลงานจริง (สะสม)',
    plan: 'แผน',
    actual: 'ผลงานจริง',
    colNo: 'ลำดับ',
    colTask: 'งาน',
    colInstallment: 'งวด',
    colDuration: 'ระยะเวลา',
    colStart: 'เริ่ม',
    colFinish: 'เสร็จ',
    colBudget: 'งบ',
    colWeight: '% น้ำหนัก',
    colTimeline: 'ช่วงเวลาตามแผน',
    unitDays: '(วัน)',
    unitBaht: '(บาท)',
    total: 'รวมทั้งโครงการ',
    finishOn: 'เสร็จ',
    noTasks: 'ยังไม่มีงานที่กำหนดวันเริ่ม',
    ganttNote: 'วันเสร็จ = วันเริ่ม + ระยะเวลา − 1 (นับวันปฏิทิน ไม่เว้นวันหยุด) · แถบตามสัดส่วนวันที่ของแต่ละงาน',
    calendarNote: 'นับทุกวันปฏิทิน (ไม่เว้นวันหยุด) · จำนวนช่างและคนงานมาจากหน้า Man-Day',
    planSpan: 'แผนงาน',
    tasksInMonth: 'งานในเดือนนี้',
    tasksUnit: 'งาน',
    peak: 'ใช้คนมากที่สุด',
    people: 'คน',
    onDay: 'วันที่',
    andMore: 'และอีก',
    noCrew: 'ไม่มีข้อมูลจำนวนคน',
    noWork: 'ไม่มีงานตามแผนในเดือนนี้',
    overflowTitle: 'งานที่ไม่พอแสดงในช่องวัน',
    colRange: 'ช่วงวันที่',
    colSkilled: 'ช่าง',
    colLabourers: 'คนงาน',
    more: 'งาน',
} as const;

const T = SCHEDULE_PRINT_TEXT;

// ─── Gantt + S-Curve ──────────────────────────────────────────────────────────

export interface PrintField { label: string; value: string }

/** A bar in the timeline column, as fractions (0–1) of its width. */
export interface TimelineBar { left: number; width: number }

export interface GanttPrintTask {
    id: string;
    installment: number;
    name: string;
    duration: string;
    start: string;
    finish: string;
    budget: string;
    weight: string;
    plan: TimelineBar | null;
    actual: TimelineBar | null;
}

export interface GanttPrintInstallment {
    no: number;
    label: string;
    finish: string;
    budget: string;
    weight: string;
    tasks: GanttPrintTask[];
}

export interface TimelineMonth {
    label: string;
    left: number;
    width: number;
    /** false when months are too narrow for every label (only every n-th month is labelled). */
    showLabel: boolean;
    /** Width the label may take: its own month, or the run of unlabelled months after it. */
    labelWidth: number;
}

export interface SCurvePrintModel {
    /** Week buckets drawn ("W1".."W4") with their month label on the first week. */
    buckets: { weekLabel: string; monthLabel: string; week: number }[];
    plan: number[];
    /** Cumulative actual up to the bucket of the last update (empty when none). */
    actual: number[];
}

export interface GanttPrintModel {
    projectName: string;
    title: string;
    fields: PrintField[];
    scurve: SCurvePrintModel;
    timeline: { from: string; to: string; months: TimelineMonth[] };
    installments: GanttPrintInstallment[];
    totalBudget: string;
    totalWeight: string;
    hasTasks: boolean;
}

/** Most month labels the timeline column (about 94 mm) prints side by side: "ม.ค.-26" needs about 9 mm. */
export const TIMELINE_MAX_LABELS = 9;

const pct = (v: number) => `${(v * 100).toFixed(2)}%`;
const durationText = (d: number) => (Number.isFinite(d) ? d.toLocaleString('th-TH', {
    minimumFractionDigits: Number.isInteger(d) ? 0 : 2, maximumFractionDigits: Number.isInteger(d) ? 0 : 2,
}) : '');

/** A dated span as a bar over [from, to] (serials, inclusive); null when it is undated or outside. */
export function timelineBar(start: string | null, finish: string | null, from: number, to: number): TimelineBar | null {
    const s = isoToSerial(start);
    const f0 = isoToSerial(finish);
    if (s === null || to < from) return null;
    const f = Math.max(s, f0 ?? s);
    const a = Math.max(s, from);
    const b = Math.min(f, to);
    if (b < a) return null;
    const days = to - from + 1;
    return { left: (a - from) / days, width: (b - a + 1) / days };
}

/** The printed Gantt + S-Curve. `printedOn` is the print date (ISO). */
export function buildGanttPrintModel(schedule: ScheduleResult, printedOn: string, fallbackName = ''): GanttPrintModel {
    const s = schedule;
    const count = usedBucketCount(s.buckets, s.planWeekly, s.actualWeekly);
    const buckets = s.buckets.slice(0, count);
    const lastSerial = isoToSerial(s.status.lastUpdate);
    const lastBucket = lastSerial === null ? -1 : bucketIndexOf(s.buckets, lastSerial);
    const actualUntil = Math.min(lastBucket, count - 1);

    const from = buckets[0]?.startSerial ?? 0;
    const to = buckets[buckets.length - 1]?.endSerial ?? -1;
    const days = to - from + 1;
    const months = s.months.filter(m => m.firstBucket < count);
    const every = Math.max(1, Math.ceil(months.length / TIMELINE_MAX_LABELS));
    const spans = months.map(m => {
        const a = Math.max(from, isoToSerial(m.start) ?? from);
        const b = Math.min(to, isoToSerial(m.end) ?? to);
        return { label: m.label, left: (a - from) / days, width: Math.max(0, b - a + 1) / days };
    });
    const timelineMonths: TimelineMonth[] = spans.map((m, i) => ({
        ...m,
        showLabel: i % every === 0,
        labelWidth: spans.slice(i, i + every).reduce((w, x) => w + x.width, 0),
    }));

    const byId = new Map(s.tasks.map(t => [t.id, t]));
    const installments: GanttPrintInstallment[] = s.installments.map(inst => ({
        no: inst.no,
        label: inst.label,
        finish: formatDate(inst.finish),
        budget: fmtMoney(inst.budget),
        weight: pct(inst.weight),
        tasks: inst.taskIds.flatMap(id => {
            const t = byId.get(id);
            if (!t) return [];
            return [{
                id: t.id,
                installment: t.installment,
                name: t.name,
                duration: durationText(t.duration),
                start: formatDate(t.start),
                finish: formatDate(t.finish),
                budget: fmtMoney(t.budget),
                weight: pct(t.weight),
                plan: timelineBar(t.start, t.finish, from, to),
                actual: timelineBar(t.actual.start, t.actual.finish, from, to),
            }];
        }),
    }));

    const projectName = s.projectName.trim() || fallbackName.trim();
    return {
        projectName,
        title: T.ganttTitle,
        fields: [
            // three per row: name, start, finish / budget, duration, print date
            { label: T.projectName, value: projectName },
            { label: T.start, value: formatDate(s.start) },
            { label: T.finish, value: formatDate(s.finish) },
            { label: T.budget, value: `${fmtMoney(s.budget)} ${T.baht}` },
            { label: T.duration, value: s.start && s.finish ? `${s.durationDays.toLocaleString('th-TH')} ${T.days}` : '' },
            { label: T.printedOn, value: formatDate(printedOn) },
        ],
        scurve: {
            buckets: buckets.map(b => ({ weekLabel: b.weekLabel, monthLabel: b.monthLabel, week: b.week })),
            plan: s.planCumulative.slice(0, count),
            actual: actualUntil >= 0 ? s.actualCumulative.slice(0, actualUntil + 1) : [],
        },
        timeline: { from: buckets[0]?.start ?? '', to: buckets[buckets.length - 1]?.end ?? '', months: timelineMonths },
        installments,
        totalBudget: fmtMoney(s.budget),
        totalWeight: pct(s.tasks.reduce((sum, t) => sum + t.weight, 0)),
        hasTasks: s.start !== null,
    };
}

// ─── ปฏิทินงาน ──────────────────────────────────────────────────────────────

/** A month the calendar can print: 'YYYY-MM' and "มกราคม 2026". */
export interface CalendarMonthOption { value: string; label: string }

export interface CalendarPrintCell {
    iso: string;
    day: number;
    inMonth: boolean;
    /** Inside the plan span (first start … last finish); other days print grey. */
    inPlan: boolean;
    /** Tasks printed as chips (at most the month's `chipLimit`). */
    tasks: CrewCalendarTask[];
    /** Tasks that did not fit ("+N งาน"). */
    hidden: number;
    skilled: number;
    labourers: number;
    total: number;
}

export interface CalendarPeak {
    date: string;
    total: number;
    skilled: number;
    labourers: number;
    /** Other days of the month with the same total. */
    moreDays: number;
}

/** Type scale of a month page: 1 = normal; smaller when the page is crowded. */
export type CalendarScale = 1 | 0.9 | 0.8;

export interface CalendarPrintMonth {
    value: string;
    title: string;
    weeks: CalendarPrintCell[][];
    chipLimit: number;
    scale: CalendarScale;
    /** Distinct tasks running on any day of the month. */
    taskCount: number;
    peak: CalendarPeak | null;
    /** Tasks hidden behind "+N งาน" on at least one day, in plan order. */
    overflow: CrewCalendarTask[];
    /** Columns the overflow table is printed in (side by side). */
    overflowColumns: number;
}

export interface CalendarPrintModel {
    projectName: string;
    start: string | null;
    finish: string | null;
    months: CalendarPrintMonth[];
    legend: { no: number; label: string }[];
}

const monthValue = (key: number) => keyToIso(key).slice(0, 7);
const valueToKey = (v: string): number | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? Number(m[1]) * 12 + mo - 1 : null;
};

/** Every month from the plan's first start to its last finish (none when nothing is dated). */
export function calendarMonthOptions(cal: CrewCalendarResult): CalendarMonthOption[] {
    if (cal.start === null || cal.finish === null) return [];
    const out: CalendarMonthOption[] = [];
    for (let k = monthKey(cal.start); k <= monthKey(cal.finish); k++) out.push({ value: monthValue(k), label: monthTitle(k) });
    return out;
}

// Page fitting, in millimetres of the landscape page area (SchedulePrintDocument: 297 × 210 mm less the margins).
export const CAL_LAYOUT = {
    pageHeight: 180,
    header: 19,
    weekdayRow: 5.5,
    gaps: 4,
    /** Cell padding + day number + crew line. */
    cellFixed: 10.5,
    chip: 4.4,
    overflowHead: 11,
    overflowRow: 4.6,
    maxChips: 6,
} as const;

const SCALES: CalendarScale[] = [1, 0.9, 0.8];

/** Columns of the overflow table for `n` tasks. */
export const overflowColumnsFor = (n: number) => (n <= 3 ? 1 : n <= 20 ? 2 : 3);

function overflowHeight(n: number, scale: number): number {
    if (n === 0) return 0;
    const rows = Math.ceil(n / overflowColumnsFor(n));
    return (CAL_LAYOUT.overflowHead + rows * CAL_LAYOUT.overflowRow) * scale;
}

/** Chips a cell can hold when the grid has `weeks` rows and the overflow table lists `hidden` tasks. */
export function chipCapacity(weeks: number, hidden: number, scale: number): number {
    const L = CAL_LAYOUT;
    const free = L.pageHeight - (L.header + L.weekdayRow + L.gaps) * scale - overflowHeight(hidden, scale);
    const row = free / Math.max(1, weeks);
    return Math.max(0, Math.floor((row - L.cellFixed * scale) / (L.chip * scale)));
}

/** Tasks hidden on at least one in-month day when a cell shows `limit` chips, in plan order. */
function hiddenTasks(days: (CrewCalendarDay | undefined)[], limit: number, order: Map<string, number>): CrewCalendarTask[] {
    const out = new Map<string, CrewCalendarTask>();
    for (const d of days) for (const t of d?.tasks.slice(limit) ?? []) out.set(t.id, t);
    return [...out.values()].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/**
 * Chips per cell and type scale for a month: the most chips (up to CAL_LAYOUT.maxChips) such that the grid and the
 * overflow table of the tasks that still do not fit share one page; the type shrinks only when even one chip
 * per cell does not fit at the normal size.
 */
export function fitMonth(weeks: number, days: (CrewCalendarDay | undefined)[], order: Map<string, number>):
    { chipLimit: number; scale: CalendarScale; overflow: CrewCalendarTask[] } {
    const most = Math.max(0, ...days.map(d => d?.tasks.length ?? 0));
    for (const scale of SCALES) {
        for (let limit = Math.min(most, CAL_LAYOUT.maxChips); limit >= 1; limit--) {
            const overflow = hiddenTasks(days, limit, order);
            if (chipCapacity(weeks, overflow.length, scale) >= limit) return { chipLimit: limit, scale, overflow };
        }
        if (most === 0) return { chipLimit: 0, scale, overflow: [] };
    }
    const scale = SCALES[SCALES.length - 1] ?? 0.8;
    return { chipLimit: 1, scale, overflow: hiddenTasks(days, 1, order) };
}

/**
 * The printed calendar for the chosen months ('YYYY-MM'; default: every month of the plan). Months outside the
 * plan span are ignored; the pages come in date order, each month once.
 */
export function buildCalendarPrintModel(
    schedule: ScheduleResult, manday: ManDayResult, months?: readonly string[], fallbackName = '',
): CalendarPrintModel {
    const cal = computeCrewCalendar(schedule, manday);
    const projectName = schedule.projectName.trim() || fallbackName.trim();
    const legend = INSTALLMENTS.map(i => ({ no: i.no, label: i.label }));
    if (cal.start === null || cal.finish === null) return { projectName, start: null, finish: null, months: [], legend };
    const { start, finish } = cal;

    const firstKey = monthKey(start);
    const lastKey = monthKey(finish);
    const wanted = months === undefined
        ? Array.from({ length: lastKey - firstKey + 1 }, (_, i) => firstKey + i)
        : [...new Set(months.map(valueToKey).filter((k): k is number => k !== null && k >= firstKey && k <= lastKey))]
            .sort((a, b) => a - b);

    const byDate = new Map(cal.days.map(d => [d.date, d]));
    const order = new Map(schedule.tasks.map((t, i) => [t.id, i]));

    const pages = wanted.map((key): CalendarPrintMonth => {
        const cells = monthCells(key);
        const weekCount = cells.length / 7;
        const inMonthDays = cells.filter(c => c.inMonth).map(c => byDate.get(c.iso));
        const fit = fitMonth(weekCount, inMonthDays, order);

        const toCell = (c: { iso: string; inMonth: boolean }): CalendarPrintCell => {
            const d = c.inMonth ? byDate.get(c.iso) : undefined;
            const tasks = d?.tasks ?? [];
            return {
                iso: c.iso,
                day: parts(c.iso).d,
                inMonth: c.inMonth,
                inPlan: c.inMonth && c.iso >= start && c.iso <= finish,
                tasks: tasks.slice(0, fit.chipLimit),
                hidden: Math.max(0, tasks.length - fit.chipLimit),
                skilled: d?.skilled ?? 0,
                labourers: d?.labourers ?? 0,
                total: d?.total ?? 0,
            };
        };
        const weeks = Array.from({ length: weekCount }, (_, w) => cells.slice(w * 7, w * 7 + 7).map(toCell));

        const present = inMonthDays.filter((d): d is CrewCalendarDay => d !== undefined);
        const taskIds = new Set(present.flatMap(d => d.tasks.map(t => t.id)));
        const top = present.reduce((m, d) => Math.max(m, d.total), 0);
        const peakDays = top > 0 ? present.filter(d => d.total === top) : [];
        const first = peakDays[0];
        return {
            value: monthValue(key),
            title: monthTitle(key),
            weeks,
            chipLimit: fit.chipLimit,
            scale: fit.scale,
            taskCount: taskIds.size,
            peak: first === undefined ? null : {
                date: first.date, total: first.total, skilled: first.skilled, labourers: first.labourers,
                moreDays: peakDays.length - 1,
            },
            overflow: fit.overflow,
            overflowColumns: overflowColumnsFor(fit.overflow.length),
        };
    });

    return { projectName, start, finish, months: pages, legend };
}

/** "งานในเดือนนี้ 12 งาน · ใช้คนมากที่สุด 21 คน (ช่าง 8 · คนงาน 13) วันที่ 21/05/2026 และอีก 2 วัน". */
export function monthSummaryText(m: CalendarPrintMonth): string {
    if (m.taskCount === 0) return T.noWork;
    const tasks = `${T.tasksInMonth} ${m.taskCount} ${T.tasksUnit}`;
    if (m.peak === null) return `${tasks} · ${T.noCrew}`;
    const more = m.peak.moreDays > 0 ? ` ${T.andMore} ${m.peak.moreDays} ${T.days}` : '';
    return `${tasks} · ${T.peak} ${m.peak.total} ${T.people} (${crewText(m.peak.skilled, m.peak.labourers)}) `
        + `${T.onDay} ${formatDate(m.peak.date)}${more}`;
}

/** Default PDF file name: "แผนงาน_บ้านคุณสมชาย" / "ปฏิทินงาน_บ้านคุณสมชาย". */
export function scheduleFileBaseName(kind: 'gantt' | 'calendar', projectName: string): string {
    const name = projectName.replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    return [kind === 'gantt' ? 'แผนงาน' : T.calendarTitle, name].filter(p => p !== '').join('_');
}
