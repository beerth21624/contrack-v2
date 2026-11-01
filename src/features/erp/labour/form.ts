// ─── Pure helpers of the labour screens: week dates, grid cells and their conversion to the PUT body ───
import type { PutTimesheetDayRequest, TimesheetDayDto, TimesheetEntryInput, TimesheetSuggestionDto } from '@/shared/contract';

import { addDays } from '../site-diary/form';

export { addDays, bangkokToday, isBusinessDate } from '../site-diary/form';

/** The cell of one person on one day (a draft entry being edited). */
export interface GridRow {
    personId: string;
    days: 0.5 | 1;
    otHours: number;
    crewId: string | null;
    costCodeId: string | null;
    source: 'manual' | 'site_diary';
    note: string;
    /** ฿/day typed for a person without a wage in workforce (sent only for a person's new entry). */
    dailyWage?: number;
}

/** 0 = Sunday … 6 = Saturday of a `YYYY-MM-DD`. */
export function weekdayOf(date: string): number {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay();
}

/** The Monday on or before `date`. */
export function mondayOf(date: string): string {
    const wd = weekdayOf(date);
    return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export const nextDays = (d: number): 0.5 | 1 | 0 => (d === 0 ? 1 : d === 1 ? 0.5 : 0);

/** The editable (draft) rows of a day from the server. */
export function rowsFromDay(day: TimesheetDayDto): GridRow[] {
    return day.entries
        .filter(e => e.status === 'draft')
        .map(e => ({
            personId: e.personId,
            days: e.days === 0.5 ? 0.5 : 1,
            otHours: e.otHours,
            crewId: e.crewId,
            costCodeId: e.costCodeId,
            source: e.source,
            note: e.note,
        }));
}

export function rowFromSuggestion(s: TimesheetSuggestionDto): GridRow {
    return {
        personId: s.personId,
        days: s.days === 0.5 ? 0.5 : 1,
        otHours: s.otHours,
        crewId: s.crewId,
        costCodeId: s.costCodeId,
        source: 'site_diary',
        note: '',
    };
}

/** A canonical string of a day's rows, to tell whether they changed. */
export function rowsSignature(rows: readonly GridRow[]): string {
    return JSON.stringify([...rows].sort((a, b) => (a.personId < b.personId ? -1 : 1)).map(r => [r.personId, r.days, r.otHours, r.crewId, r.costCodeId, r.source, r.note, r.dailyWage ?? null]));
}

/**
 * The PUT body of a day. `hasWage`: persons with a wage in workforce; `existing`: persons that already have an entry
 * on the day (their snapshot stays; the typed wage only goes with a new entry of a person without a workforce wage).
 */
export function putBodyFromRows(rows: readonly GridRow[], existing: ReadonlySet<string>, hasWage: ReadonlySet<string>): PutTimesheetDayRequest {
    const entries: TimesheetEntryInput[] = rows.map(r => {
        const e: TimesheetEntryInput = { personId: r.personId, days: r.days, otHours: r.otHours, source: r.source, note: r.note };
        if (r.crewId !== null) e.crewId = r.crewId;
        if (r.costCodeId !== null) e.costCodeId = r.costCodeId;
        if (r.dailyWage !== undefined && !hasWage.has(r.personId) && !existing.has(r.personId)) e.dailyWage = r.dailyWage;
        return e;
    });
    return { entries };
}

export const payPeriodHref = (periodKey: string): string => `/workspace/pay-periods/${encodeURIComponent(periodKey)}`;
export const payPeriodPrintHref = (periodId: string): string => `/print/pay-period/${encodeURIComponent(periodId)}`;

/** The year of a period key (`2026-10-A` → 2026). */
export const yearOfPeriodKey = (key: string): number => Number(key.slice(0, 4));
