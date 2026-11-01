// ─── S-Curve schedule → printable document models (pure) ─────────────────────
// Two documents, both landscape A4 (see SchedulePrintDocument.tsx):
//   Gantt + S-Curve — a header block, the cumulative plan / actual S-curve, and the task table with a timeline
//                     column: every bar is placed in proportion to its dates over the axis the page shows, so any
//                     number of weeks fits the page width.
//   ปฏิทินงาน       — one page per chosen month: the Monday-first month grid of the on-screen calendar
//                     (computeCrewCalendar), each day's tasks and crew. A day with more tasks than fit shows
//                     "+N งาน"; those tasks are listed under the grid on the same page. With crews assigned (workforce
//                     module, หน้า ทีมงาน) each chip names the crews on that task that day and the overflow table
//                     names them under the task; without crews the pages are exactly as before.
// Every number comes from the computed schedule / Man-Day; nothing is recalculated here. The page-fitting
// estimates below (millimetres) only decide how many task chips a day cell shows and the type scale.

import {
    INSTALLMENTS, bucketIndexOf, computeCrewCalendar, installmentLabelIn, isoToSerial, monthLabelIn, sampleTextIn, taskNameIn,
    type CrewCalendarDay, type CrewCalendarResult, type CrewCalendarTask, type ManDayResult, type ScheduleResult,
} from '@/domain/planning';
import { crewNamesInRange, crewNamesOnDay, crewNamesText, type TaskCrewMap } from '@/domain/workforce';
import { formatDate, usedBucketCount } from '@/features/planning/shared/planning-format';
import {
    crewText, keyToIso, monthCells, monthKey, monthTitle, parts,
} from '@/features/planning/schedule/calendar-grid';
import type { Locale } from '@/i18n/config';
import { fmtMoney } from './boq-print-model';
import { exportMessages, groupedNumber } from './text';

/** Schedule print texts in Thai (release 1 wording); other languages: `exportMessages(locale).schedule`. */
export const SCHEDULE_PRINT_TEXT = exportMessages('th').schedule;

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
    /** Language of the document's own texts (the UI language when it was printed). */
    locale: Locale;
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
const durationText = (d: number, locale: Locale) => (Number.isFinite(d)
    ? groupedNumber(d, locale, Number.isInteger(d) ? 0 : 2) : '');

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
export function buildGanttPrintModel(
    schedule: ScheduleResult, printedOn: string, fallbackName = '', locale: Locale = 'th',
): GanttPrintModel {
    const T = exportMessages(locale).schedule;
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
        return { label: monthLabelIn(m.label, locale), left: (a - from) / days, width: Math.max(0, b - a + 1) / days };
    });
    const timelineMonths: TimelineMonth[] = spans.map((m, i) => ({
        ...m,
        showLabel: i % every === 0,
        labelWidth: spans.slice(i, i + every).reduce((w, x) => w + x.width, 0),
    }));

    const byId = new Map(s.tasks.map(t => [t.id, t]));
    const installments: GanttPrintInstallment[] = s.installments.map(inst => ({
        no: inst.no,
        label: installmentLabelIn(inst.label, locale),
        finish: formatDate(inst.finish),
        budget: fmtMoney(inst.budget, locale),
        weight: pct(inst.weight),
        tasks: inst.taskIds.flatMap(id => {
            const t = byId.get(id);
            if (!t) return [];
            return [{
                id: t.id,
                installment: t.installment,
                name: taskNameIn(t.id, t.name, locale),
                duration: durationText(t.duration, locale),
                start: formatDate(t.start),
                finish: formatDate(t.finish),
                budget: fmtMoney(t.budget, locale),
                weight: pct(t.weight),
                plan: timelineBar(t.start, t.finish, from, to),
                actual: timelineBar(t.actual.start, t.actual.finish, from, to),
            }];
        }),
    }));

    const projectName = sampleTextIn(s.projectName.trim(), locale) || fallbackName.trim();
    return {
        locale,
        projectName,
        title: T.ganttTitle,
        fields: [
            // three per row: name, start, finish / budget, duration, print date
            { label: T.projectName, value: projectName },
            { label: T.start, value: formatDate(s.start) },
            { label: T.finish, value: formatDate(s.finish) },
            { label: T.budget, value: `${fmtMoney(s.budget, locale)} ${T.baht}` },
            { label: T.duration, value: s.start && s.finish ? `${groupedNumber(s.durationDays, locale, 0)} ${T.days}` : '' },
            { label: T.printedOn, value: formatDate(printedOn) },
        ],
        scurve: {
            buckets: buckets.map(b => ({ weekLabel: b.weekLabel, monthLabel: monthLabelIn(b.monthLabel, locale), week: b.week })),
            plan: s.planCumulative.slice(0, count),
            actual: actualUntil >= 0 ? s.actualCumulative.slice(0, actualUntil + 1) : [],
        },
        timeline: { from: buckets[0]?.start ?? '', to: buckets[buckets.length - 1]?.end ?? '', months: timelineMonths },
        installments,
        totalBudget: fmtMoney(s.budget, locale),
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
    /** Chip task id → the crews on it that day ("ทีมช่างสมชาย, ทีมไฟฟ้าพงษ์"); only tasks with a crew. */
    crews: Readonly<Record<string, string>>;
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
    /** Overflow task id → the crews on it during the month; only tasks with a crew. */
    overflowCrews: Readonly<Record<string, string>>;
    /** Columns the overflow table is printed in (side by side). */
    overflowColumns: number;
}

export interface CalendarPrintModel {
    locale: Locale;
    projectName: string;
    start: string | null;
    finish: string | null;
    months: CalendarPrintMonth[];
    legend: { no: number; label: string }[];
    /** Some task has a crew (the crew names are printed). */
    hasCrews: boolean;
}

const monthValue = (key: number) => keyToIso(key).slice(0, 7);
const valueToKey = (v: string): number | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(v.trim());
    if (!m) return null;
    const mo = Number(m[2]);
    return mo >= 1 && mo <= 12 ? Number(m[1]) * 12 + mo - 1 : null;
};

/** Every month from the plan's first start to its last finish (none when nothing is dated). */
export function calendarMonthOptions(cal: CrewCalendarResult, locale: Locale = 'th'): CalendarMonthOption[] {
    if (cal.start === null || cal.finish === null) return [];
    const out: CalendarMonthOption[] = [];
    for (let k = monthKey(cal.start); k <= monthKey(cal.finish); k++) out.push({ value: monthValue(k), label: monthTitle(k, locale) });
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
    /** The crew line under a task of the overflow table (rows grow by this when a hidden task has a crew). */
    overflowCrewLine: 3.4,
    maxChips: 6,
} as const;

const SCALES: CalendarScale[] = [1, 0.9, 0.8];

/** Columns of the overflow table for `n` tasks. */
export const overflowColumnsFor = (n: number) => (n <= 3 ? 1 : n <= 20 ? 2 : 3);

function overflowHeight(n: number, scale: number, crewLine: boolean): number {
    if (n === 0) return 0;
    const rows = Math.ceil(n / overflowColumnsFor(n));
    const row = CAL_LAYOUT.overflowRow + (crewLine ? CAL_LAYOUT.overflowCrewLine : 0);
    return (CAL_LAYOUT.overflowHead + rows * row) * scale;
}

/**
 * Chips a cell can hold when the grid has `weeks` rows and the overflow table lists `hidden` tasks (`crewLine`: its
 * rows carry a crew line, counted on every row since any row may have one).
 */
export function chipCapacity(weeks: number, hidden: number, scale: number, crewLine = false): number {
    const L = CAL_LAYOUT;
    const free = L.pageHeight - (L.header + L.weekdayRow + L.gaps) * scale - overflowHeight(hidden, scale, crewLine);
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
 * per cell does not fit at the normal size. `hasCrew(taskId)`: the task prints a crew line in the overflow table.
 */
export function fitMonth(
    weeks: number, days: (CrewCalendarDay | undefined)[], order: Map<string, number>,
    hasCrew: (taskId: string) => boolean = () => false,
): { chipLimit: number; scale: CalendarScale; overflow: CrewCalendarTask[] } {
    const most = Math.max(0, ...days.map(d => d?.tasks.length ?? 0));
    for (const scale of SCALES) {
        for (let limit = Math.min(most, CAL_LAYOUT.maxChips); limit >= 1; limit--) {
            const overflow = hiddenTasks(days, limit, order);
            if (chipCapacity(weeks, overflow.length, scale, overflow.some(t => hasCrew(t.id))) >= limit) {
                return { chipLimit: limit, scale, overflow };
            }
        }
        if (most === 0) return { chipLimit: 0, scale, overflow: [] };
    }
    const scale = SCALES[SCALES.length - 1] ?? 0.8;
    return { chipLimit: 1, scale, overflow: hiddenTasks(days, 1, order) };
}

/** Task id → crew names text, for the tasks that have a crew. */
function crewRecord(ids: readonly string[], names: (taskId: string) => string[]): Record<string, string> {
    return Object.fromEntries(ids.flatMap(id => {
        const text = crewNamesText(names(id));
        return text === '' ? [] : [[id, text]];
    }));
}

/**
 * The printed calendar for the chosen months ('YYYY-MM'; default: every month of the plan). Months outside the
 * plan span are ignored; the pages come in date order, each month once. `crews` (the project's crews per task, from
 * the workforce module) adds the crew names; without it the model is exactly the plain calendar.
 */
export function buildCalendarPrintModel(
    schedule: ScheduleResult, manday: ManDayResult, months?: readonly string[], fallbackName = '', crews?: TaskCrewMap,
    locale: Locale = 'th',
): CalendarPrintModel {
    const cal = computeCrewCalendar(schedule, manday);
    const projectName = sampleTextIn(schedule.projectName.trim(), locale) || fallbackName.trim();
    const legend = INSTALLMENTS.map(i => ({ no: i.no, label: installmentLabelIn(i.label, locale) }));
    const localTask = (t: CrewCalendarTask): CrewCalendarTask => (locale === 'th' ? t : { ...t, name: taskNameIn(t.id, t.name, locale) });
    const hasCrews = crews !== undefined && [...crews.values()].some(list => list.length > 0);
    if (cal.start === null || cal.finish === null) return { locale, projectName, start: null, finish: null, months: [], legend, hasCrews };
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
        const monthFirst = keyToIso(key);
        const monthLast = cells.filter(c => c.inMonth).at(-1)?.iso ?? monthFirst;
        const monthCrews = (taskId: string) => (crews === undefined ? [] : crewNamesInRange(crews, taskId, monthFirst, monthLast));
        const fit = fitMonth(weekCount, inMonthDays, order, id => monthCrews(id).length > 0);

        const toCell = (c: { iso: string; inMonth: boolean }): CalendarPrintCell => {
            const d = c.inMonth ? byDate.get(c.iso) : undefined;
            const tasks = d?.tasks ?? [];
            const chips = tasks.slice(0, fit.chipLimit).map(localTask);
            return {
                iso: c.iso,
                day: parts(c.iso).d,
                inMonth: c.inMonth,
                inPlan: c.inMonth && c.iso >= start && c.iso <= finish,
                tasks: chips,
                crews: crews === undefined ? {} : crewRecord(chips.map(t => t.id), id => crewNamesOnDay(crews, id, c.iso)),
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
            title: monthTitle(key, locale),
            weeks,
            chipLimit: fit.chipLimit,
            scale: fit.scale,
            taskCount: taskIds.size,
            peak: first === undefined ? null : {
                date: first.date, total: first.total, skilled: first.skilled, labourers: first.labourers,
                moreDays: peakDays.length - 1,
            },
            overflow: fit.overflow.map(localTask),
            overflowCrews: crewRecord(fit.overflow.map(t => t.id), monthCrews),
            overflowColumns: overflowColumnsFor(fit.overflow.length),
        };
    });

    return { locale, projectName, start, finish, months: pages, legend, hasCrews };
}

/** "งานในเดือนนี้ 12 งาน · ใช้คนมากที่สุด 21 คน (ช่าง 8 · คนงาน 13) วันที่ 21/05/2026 และอีก 2 วัน". */
export function monthSummaryText(m: CalendarPrintMonth, locale: Locale = 'th'): string {
    const T = exportMessages(locale).schedule;
    if (m.taskCount === 0) return T.noWork;
    const tasks = `${T.tasksInMonth} ${m.taskCount} ${T.tasksUnit}`;
    if (m.peak === null) return `${tasks} · ${T.noCrew}`;
    const more = m.peak.moreDays > 0 ? ` ${T.andMore} ${m.peak.moreDays} ${T.days}` : '';
    return `${tasks} · ${T.peak} ${m.peak.total} ${T.people} (${crewText(m.peak.skilled, m.peak.labourers, locale)}) `
        + `${T.onDay} ${formatDate(m.peak.date)}${more}`;
}

/** Default PDF file name: "แผนงาน_บ้านคุณสมชาย" / "ปฏิทินงาน_บ้านคุณสมชาย". */
export function scheduleFileBaseName(kind: 'gantt' | 'calendar', projectName: string, locale: Locale = 'th'): string {
    const T = exportMessages(locale).schedule;
    const name = projectName.replace(/[\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
    return [kind === 'gantt' ? T.ganttFile : T.calendarTitle, name].filter(p => p !== '').join('_');
}
