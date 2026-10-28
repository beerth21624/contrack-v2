// ─── Crew calendar (ปฏิทินงาน) ────────────────────────────────────────────────
// A day-by-day VIEW of results that already exist: which planned tasks run on each calendar day
// (S-Curve E..F, inclusive) and how many people that takes (Man-Day O ช่าง / P คนงาน of the task's
// block). Nothing here feeds back into the S-Curve, Man-Day or CashFlow numbers.
// Same date rule as the Gantt table: F = E + D − 1, calendar days, no holidays skipped.
import { isoToSerial, serialToIso } from './calendar';
import type { ManDayResult } from './manday';
import type { ScheduleResult } from './schedule';

/** One task on one day of the calendar. */
export interface CrewCalendarTask {
    id: string;
    installment: number;
    name: string;
    /** Plan start / finish of the task (S-Curve E / F). */
    start: string;
    finish: string;
    /** Man-Day O ช่าง. */
    skilled: number;
    /** Man-Day P คนงาน. */
    labourers: number;
}

export interface CrewCalendarDay {
    date: string;
    serial: number;
    /** Tasks active that day, in plan order (1.1 … 8.6). */
    tasks: CrewCalendarTask[];
    skilled: number;
    labourers: number;
    /** ช่าง + คนงาน. */
    total: number;
}

export interface CrewCalendarResult {
    /** First and last day with a planned task; null when no task has a start date. */
    start: string | null;
    finish: string | null;
    /** Every calendar day from `start` to `finish`, including days with no task. */
    days: CrewCalendarDay[];
    /** Highest day total (0 when there is no day or no crew). */
    peakTotal: number;
    /** Day(s) reaching `peakTotal`, in date order; empty when `peakTotal` is 0. */
    peakDays: string[];
}

/** Longest stretch the calendar lists day by day (about 20 years). */
export const MAX_CALENDAR_DAYS = 7_320;

const finite = (x: number | undefined): number => (x !== undefined && Number.isFinite(x) ? x : 0);

/**
 * Builds the crew calendar. A task counts when it has a plan start and a duration > 0; it is active
 * from its start to its finish inclusive (at least its start day, if a fractional duration rounds
 * the finish before the start). Crew sizes come from the Man-Day block with the task's id.
 */
export function computeCrewCalendar(schedule: ScheduleResult, manday: ManDayResult): CrewCalendarResult {
    const blocks = new Map(manday.blocks.map(b => [b.id, b]));

    const spans = schedule.tasks.flatMap(t => {
        const start = isoToSerial(t.start);
        const finish = isoToSerial(t.finish);
        if (start === null || finish === null || !(t.duration > 0)) return [];
        const block = blocks.get(t.id);
        const task: CrewCalendarTask = {
            id: t.id,
            installment: t.installment,
            name: t.name,
            start: serialToIso(start),
            finish: serialToIso(Math.max(start, finish)),
            skilled: finite(block?.skilled),
            labourers: finite(block?.labourers),
        };
        return [{ task, start, finish: Math.max(start, finish) }];
    });

    if (spans.length === 0) return { start: null, finish: null, days: [], peakTotal: 0, peakDays: [] };

    const first = Math.min(...spans.map(s => s.start));
    // One entry per day: a plan stretched over centuries by a mistyped duration shows its first MAX_CALENDAR_DAYS.
    const last = Math.min(Math.max(...spans.map(s => s.finish)), first + MAX_CALENDAR_DAYS - 1);
    const days: CrewCalendarDay[] = [];
    for (let serial = first; serial <= last; serial++) {
        const tasks = spans.filter(s => s.start <= serial && serial <= s.finish).map(s => s.task);
        const skilled = tasks.reduce((sum, t) => sum + t.skilled, 0);
        const labourers = tasks.reduce((sum, t) => sum + t.labourers, 0);
        days.push({ date: serialToIso(serial), serial, tasks, skilled, labourers, total: skilled + labourers });
    }

    const peakTotal = days.reduce((m, d) => Math.max(m, d.total), 0);
    const peakDays = peakTotal > 0 ? days.filter(d => d.total === peakTotal).map(d => d.date) : [];
    return { start: serialToIso(first), finish: serialToIso(last), days, peakTotal, peakDays };
}
