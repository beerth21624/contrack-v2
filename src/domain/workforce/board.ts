// ─── Company crew board (กระดานจัดคน, W2): every crew across every project, day by day (pure) ───
// docs/workforce/00-crew-management-design.md §3.3, §4 (detection only) and §5. Rows are crews; each row is an ordered
// list of segments inside the shown window:
//   work — an assignment (crew × project × task × days); several may overlap (a conflict, ชนกัน);
//   wait — the waiting window after a task (concrete curing, plaster drying …), on the days the crew has no work.
//          The crew is free then: it counts as free time the crew could spend on another project ("รอ");
//   idle — no work and no wait ("ว่าง").
// Days are calendar days, both ends included ('YYYY-MM-DD'), the same day rule as the S-Curve and the assignments.
// Nothing here changes a BOQ, Man-Day or S-Curve number.
import { isoToSerial, serialToIso } from '../planning/calendar';
import type { TaskLag } from '../../shared/contract/workforce';
import { effectiveTaskLag } from './task-lags';

/** What the board reads of an assignment (CrewAssignmentDto has these fields). */
export interface BoardAssignment {
    id: string;
    crewId: string;
    projectId: string;
    taskId: string;
    start: string;
    end: string;
}

/** What the board reads of a crew (CrewDto has these fields). */
export interface BoardCrew {
    id: string;
}

/** The shown days, both included. */
export interface BoardWindow {
    from: string;
    to: string;
}

/** Where a segment sits in the window: first/last shown day, 0-based day offset from `window.from`, shown days. */
export interface WindowPlace {
    from: string;
    to: string;
    offset: number;
    days: number;
}

export interface WorkSegment<A extends BoardAssignment = BoardAssignment> extends WindowPlace {
    kind: 'work';
    assignment: A;
    projectId: string;
    taskId: string;
    /** The whole assignment (may reach outside the window). */
    start: string;
    end: string;
    /** 0-based lane in the row: overlapping work of the same crew stacks in separate lanes. */
    lane: number;
    /** Ids of the crew's other assignments that share at least one day with this one. */
    conflictWith: string[];
}

export interface WaitSegment extends WindowPlace {
    kind: 'wait';
    /** The assignment whose task the project waits after. */
    assignmentId: string;
    projectId: string;
    taskId: string;
    /** Why (Thai), and the full wait in days (the shown piece may be shorter). */
    reason: string;
    lagDays: number;
    /** The project changed the default wait. */
    overridden: boolean;
    /** The whole waiting window (end + 1 … end + lagDays). */
    waitStart: string;
    waitEnd: string;
}

export interface IdleSegment extends WindowPlace {
    kind: 'idle';
}

export type BoardSegment<A extends BoardAssignment = BoardAssignment> = WorkSegment<A> | WaitSegment | IdleSegment;

/** Two assignments of the same crew that share days. `a` starts first (then by end, then id). */
export interface BoardConflict<A extends BoardAssignment = BoardAssignment> {
    crewId: string;
    a: A;
    b: A;
    /** The shared days (whole overlap, may reach outside the window). */
    from: string;
    to: string;
    days: number;
    /** Both on the same project (a crew split between two tasks of one site). */
    sameProject: boolean;
}

/** A free stretch (no work) of at least MIN_GAP_DAYS days inside the window, for later suggestions (W3). */
export interface IdleGap {
    crewId: string;
    from: string;
    to: string;
    days: number;
    /** Days of the stretch inside a wait ("รอ") and outside any wait ("ว่าง"). */
    waitDays: number;
    idleDays: number;
    /** 'wait' when any of it is a waiting window (label "รอ"), else 'idle' ("ว่าง"). */
    kind: 'wait' | 'idle';
    /** The waits in the stretch, in date order (one per assignment). */
    waits: { assignmentId: string; projectId: string; taskId: string; reason: string }[];
    /** The stretch runs on past the window's last day (the crew may be free longer). */
    open: boolean;
}

export interface CrewMetrics {
    /** Days in the window with at least one assignment. */
    busyDays: number;
    /** Days in the window with no assignment (waits included: the crew is free then). */
    idleDays: number;
    /** The part of `idleDays` inside a waiting window. */
    waitDays: number;
    /** Days in the window with two or more assignments. */
    conflictDays: number;
    /** busyDays ÷ window days, 0 … 1. */
    utilisation: number;
    /** First day from `today` on with no assignment ('YYYY-MM-DD'). */
    nextFreeDay: string;
    /** No assignment on `today`. */
    freeToday: boolean;
}

export interface CrewBoardRow<C extends BoardCrew = BoardCrew, A extends BoardAssignment = BoardAssignment> {
    crew: C;
    /** By shown first day; at the same day work before wait/idle, then by lane. */
    segments: BoardSegment<A>[];
    /** Lanes the row needs (1 when nothing overlaps). */
    lanes: number;
    conflicts: BoardConflict<A>[];
    gaps: IdleGap[];
    metrics: CrewMetrics;
}

export interface BoardTotals {
    crews: number;
    conflicts: number;
    /** Σ idleDays over the crews (crew-days, waits included). */
    idleCrewDays: number;
    /** Σ waitDays over the crews. */
    waitCrewDays: number;
    /** Mean of the crews' utilisation, 0 … 1 (0 with no crews). */
    averageUtilisation: number;
    crewsIdleToday: number;
}

export interface CrewBoard<C extends BoardCrew = BoardCrew, A extends BoardAssignment = BoardAssignment> {
    window: BoardWindow;
    /** Days in the window (0 when it runs backwards or a date is invalid). */
    days: number;
    rows: CrewBoardRow<C, A>[];
    /** Every conflict that shares a day with the window, by start day. */
    conflicts: BoardConflict<A>[];
    gaps: IdleGap[];
    totals: BoardTotals;
}

/** Shortest free stretch listed as a gap. */
export const MIN_GAP_DAYS = 2;
/** A pure idle stretch (no wait) this long, from today on, counts as a problem worth a look. */
export const LONG_IDLE_DAYS = 7;

// ─── Day arithmetic ───

/** `iso` + `n` days ('YYYY-MM-DD'); the input as is when it is not a day. */
export function addDays(iso: string, n: number): string {
    const s = isoToSerial(iso);
    return s === null ? iso : serialToIso(s + n);
}

/** Days from `from` to `to`, both included (0 when it runs backwards or a date is invalid). */
export function windowDays(w: BoardWindow): number {
    const s = isoToSerial(w.from);
    const e = isoToSerial(w.to);
    return s === null || e === null || e < s ? 0 : e - s + 1;
}

/** 0 = Sunday … 6 = Saturday (serial 0 = 1899-12-30, a Saturday). */
export function dayOfWeek(iso: string): number {
    const s = isoToSerial(iso);
    return s === null ? 0 : (((s + 6) % 7) + 7) % 7;
}

// ─── The board ───

interface Span { s: number; e: number }

function spanOf(start: string, end: string): Span | null {
    const s = isoToSerial(start);
    const e = isoToSerial(end);
    return s === null || e === null || e < s ? null : { s, e };
}

function place(s: number, e: number, w: Span): WindowPlace | null {
    const from = Math.max(s, w.s);
    const to = Math.min(e, w.e);
    if (to < from) return null;
    return { from: serialToIso(from), to: serialToIso(to), offset: from - w.s, days: to - from + 1 };
}

function byDates(a: BoardAssignment, b: BoardAssignment): number {
    if (a.start !== b.start) return a.start < b.start ? -1 : 1;
    if (a.end !== b.end) return a.end < b.end ? -1 : 1;
    if (a.id !== b.id) return a.id < b.id ? -1 : 1;
    return 0;
}

interface Wait {
    assignmentId: string;
    projectId: string;
    taskId: string;
    reason: string;
    lagDays: number;
    overridden: boolean;
    span: Span;
}

/**
 * The waits of one crew's assignments: after the last day of each (project, task) the crew works on, the project's
 * effective wait for that task (override, else default) starts the next day. A task split into several assignments
 * waits once, after its last piece.
 */
function crewWaits(own: readonly { a: BoardAssignment; span: Span }[], lags: ReadonlyMap<string, readonly TaskLag[]>): Wait[] {
    const last = new Map<string, { a: BoardAssignment; span: Span }>();
    for (const x of own) {
        const key = `${x.a.projectId}\u0000${x.a.taskId}`;
        const prev = last.get(key);
        if (prev === undefined || x.span.e > prev.span.e || (x.span.e === prev.span.e && x.a.id > prev.a.id)) last.set(key, x);
    }
    const out: Wait[] = [];
    for (const { a, span } of last.values()) {
        const lag = effectiveTaskLag(a.taskId, lags.get(a.projectId) ?? []);
        if (lag.days <= 0) continue;
        out.push({
            assignmentId: a.id, projectId: a.projectId, taskId: a.taskId, reason: lag.reason, lagDays: lag.days,
            overridden: lag.overridden, span: { s: span.e + 1, e: span.e + lag.days },
        });
    }
    // Earlier waits first; on a day two waits share, the earlier one is shown.
    return out.sort((x, y) => x.span.s - y.span.s || (x.assignmentId < y.assignmentId ? -1 : x.assignmentId > y.assignmentId ? 1 : 0));
}

/** The first day ≥ `from` covered by none of the spans. */
function firstFree(spans: readonly Span[], from: number): number {
    const sorted = [...spans].sort((x, y) => x.s - y.s);
    let day = from;
    let moved = true;
    while (moved) {
        moved = false;
        for (const r of sorted) {
            if (r.s <= day && day <= r.e) { day = r.e + 1; moved = true; }
        }
    }
    return day;
}

/**
 * The crew board of `crews` over `window`: segments, lanes, conflicts, free stretches and metrics per crew, and
 * totals. Assignments of crews not listed, and assignments or windows with invalid dates, are left out. `lagsByProject`
 * holds each project's wait overrides (a project not in it uses the defaults). Pass the assignments that overlap the
 * window, plus those ending up to MAX_TASK_LAG_DAYS before it (their waits may reach in) and those around `today`
 * (for the next free day).
 */
export function buildCrewBoard<C extends BoardCrew, A extends BoardAssignment>(
    crews: readonly C[],
    assignments: readonly A[],
    lagsByProject: ReadonlyMap<string, readonly TaskLag[]>,
    window: BoardWindow,
    today: string,
): CrewBoard<C, A> {
    const days = windowDays(window);
    const ws = isoToSerial(window.from);
    const w: Span | null = ws === null || days === 0 ? null : { s: ws, e: ws + days - 1 };
    const todaySerial = isoToSerial(today);

    const byCrew = new Map<string, { a: A; span: Span }[]>();
    for (const a of [...assignments].sort(byDates)) {
        const span = spanOf(a.start, a.end);
        if (span === null) continue;
        const list = byCrew.get(a.crewId);
        if (list === undefined) byCrew.set(a.crewId, [{ a, span }]);
        else list.push({ a, span });
    }

    const rows = crews.map((crew): CrewBoardRow<C, A> => {
        const own = byCrew.get(crew.id) ?? [];

        // Conflicts: every pair sharing a day (own is in date order, so `a` starts first).
        const conflicts: BoardConflict<A>[] = [];
        const conflictWith = new Map<string, string[]>();
        for (let i = 0; i < own.length; i++) {
            const x = own[i];
            if (x === undefined) continue;
            for (let j = i + 1; j < own.length; j++) {
                const y = own[j];
                if (y === undefined) continue;
                if (y.span.s > x.span.e) break;
                const from = Math.max(x.span.s, y.span.s);
                const to = Math.min(x.span.e, y.span.e);
                if (to < from) continue;
                conflictWith.set(x.a.id, [...(conflictWith.get(x.a.id) ?? []), y.a.id]);
                conflictWith.set(y.a.id, [...(conflictWith.get(y.a.id) ?? []), x.a.id]);
                if (w === null || to < w.s || from > w.e) continue;
                conflicts.push({
                    crewId: crew.id, a: x.a, b: y.a, from: serialToIso(from), to: serialToIso(to), days: to - from + 1,
                    sameProject: x.a.projectId === y.a.projectId,
                });
            }
        }

        const nextFree = todaySerial === null ? null : firstFree(own.map(x => x.span), todaySerial);
        const freeToday = todaySerial !== null && nextFree === todaySerial;

        if (w === null) {
            return {
                crew, segments: [], lanes: 1, conflicts, gaps: [],
                metrics: {
                    busyDays: 0, idleDays: 0, waitDays: 0, conflictDays: 0, utilisation: 0,
                    nextFreeDay: nextFree === null ? today : serialToIso(nextFree), freeToday,
                },
            };
        }

        // Work in the window, each in the first lane free since its start.
        const work: WorkSegment<A>[] = [];
        const laneEnds: number[] = [];
        for (const { a, span } of own) {
            const p = place(span.s, span.e, w);
            if (p === null) continue;
            let lane = laneEnds.findIndex(end => end < span.s);
            if (lane === -1) { lane = laneEnds.length; laneEnds.push(span.e); } else laneEnds[lane] = span.e;
            work.push({
                kind: 'work', assignment: a, projectId: a.projectId, taskId: a.taskId, start: a.start, end: a.end,
                lane, conflictWith: conflictWith.get(a.id) ?? [], ...p,
            });
        }

        // Day by day: how many assignments cover it, and which wait (if any) when none do.
        const load = new Array<number>(days).fill(0);
        for (const { span } of own) {
            const from = Math.max(span.s, w.s);
            const to = Math.min(span.e, w.e);
            for (let d = from; d <= to; d++) load[d - w.s] = (load[d - w.s] ?? 0) + 1;
        }
        const waits = crewWaits(own, lagsByProject);
        const waitOn = new Array<Wait | undefined>(days).fill(undefined);
        for (const wt of waits) {
            const from = Math.max(wt.span.s, w.s);
            const to = Math.min(wt.span.e, w.e);
            for (let d = from; d <= to; d++) {
                const i = d - w.s;
                if ((load[i] ?? 0) === 0 && waitOn[i] === undefined) waitOn[i] = wt;
            }
        }

        // Free days → runs of the same wait (or of no wait).
        const free: (WaitSegment | IdleSegment)[] = [];
        let i = 0;
        while (i < days) {
            if ((load[i] ?? 0) > 0) { i++; continue; }
            const wt = waitOn[i];
            let j = i;
            while (j + 1 < days && (load[j + 1] ?? 0) === 0 && waitOn[j + 1] === wt) j++;
            const p: WindowPlace = { from: serialToIso(w.s + i), to: serialToIso(w.s + j), offset: i, days: j - i + 1 };
            free.push(wt === undefined
                ? { kind: 'idle', ...p }
                : {
                    kind: 'wait', assignmentId: wt.assignmentId, projectId: wt.projectId, taskId: wt.taskId, reason: wt.reason,
                    lagDays: wt.lagDays, overridden: wt.overridden, waitStart: serialToIso(wt.span.s), waitEnd: serialToIso(wt.span.e), ...p,
                });
            i = j + 1;
        }

        // Free stretches (maximal runs without work) of MIN_GAP_DAYS or more.
        const gaps: IdleGap[] = [];
        i = 0;
        while (i < days) {
            if ((load[i] ?? 0) > 0) { i++; continue; }
            let j = i;
            while (j + 1 < days && (load[j + 1] ?? 0) === 0) j++;
            const len = j - i + 1;
            if (len >= MIN_GAP_DAYS) {
                const inWait = free.filter((f): f is WaitSegment => f.kind === 'wait' && f.offset >= i && f.offset <= j);
                const waitDays = inWait.reduce((n, f) => n + f.days, 0);
                const waitsIn = new Map<string, IdleGap['waits'][number]>();
                for (const f of inWait) {
                    if (!waitsIn.has(f.assignmentId)) {
                        waitsIn.set(f.assignmentId, { assignmentId: f.assignmentId, projectId: f.projectId, taskId: f.taskId, reason: f.reason });
                    }
                }
                gaps.push({
                    crewId: crew.id, from: serialToIso(w.s + i), to: serialToIso(w.s + j), days: len,
                    waitDays, idleDays: len - waitDays, kind: waitDays > 0 ? 'wait' : 'idle',
                    waits: [...waitsIn.values()],
                    open: j === days - 1 && !own.some(x => x.span.s === w.e + 1),
                });
            }
            i = j + 1;
        }

        const busyDays = load.filter(n => n > 0).length;
        const waitDays = free.reduce((n, f) => (f.kind === 'wait' ? n + f.days : n), 0);
        const rank = (s: BoardSegment<A>) => (s.kind === 'work' ? 0 : 1);
        const segments: BoardSegment<A>[] = [...work, ...free].sort((x, y) =>
            x.offset - y.offset || rank(x) - rank(y) || (x.kind === 'work' && y.kind === 'work' ? x.lane - y.lane : 0));

        return {
            crew, segments, lanes: Math.max(1, laneEnds.length), conflicts, gaps,
            metrics: {
                busyDays,
                idleDays: days - busyDays,
                waitDays,
                conflictDays: load.filter(n => n > 1).length,
                utilisation: busyDays / days,
                nextFreeDay: nextFree === null ? today : serialToIso(nextFree),
                freeToday,
            },
        };
    });

    const conflicts = rows.flatMap(r => r.conflicts).sort((x, y) =>
        (x.from < y.from ? -1 : x.from > y.from ? 1 : 0) || byDates(x.a, y.a) || byDates(x.b, y.b));
    return { window, days, rows, conflicts, gaps: rows.flatMap(r => r.gaps), totals: boardTotals(rows) };
}

/** Totals of some rows (the board's, or the rows a filter keeps). */
export function boardTotals(rows: readonly CrewBoardRow[]): BoardTotals {
    const n = rows.length;
    return {
        crews: n,
        conflicts: rows.reduce((s, r) => s + r.conflicts.length, 0),
        idleCrewDays: rows.reduce((s, r) => s + r.metrics.idleDays, 0),
        waitCrewDays: rows.reduce((s, r) => s + r.metrics.waitDays, 0),
        averageUtilisation: n === 0 ? 0 : rows.reduce((s, r) => s + r.metrics.utilisation, 0) / n,
        crewsIdleToday: rows.filter(r => r.metrics.freeToday).length,
    };
}

/**
 * Worth a look ("มีปัญหา"): a conflict in the window, or LONG_IDLE_DAYS or more days in a row with neither work nor a
 * wait that end on or after `today` (idle days already past cannot be used any more).
 */
export function crewHasProblem(row: Pick<CrewBoardRow, 'conflicts' | 'segments'>, today: string): boolean {
    if (row.conflicts.length > 0) return true;
    return row.segments.some(s => s.kind === 'idle' && s.days >= LONG_IDLE_DAYS && s.to >= today);
}

// ─── Windows: presets, stepping ───

export type BoardPreset = '2w' | '1m' | '3m';

export const BOARD_PRESET_LABEL: Record<BoardPreset, string> = { '2w': '2 สัปดาห์', '1m': '1 เดือน', '3m': '3 เดือน' };

function parts(iso: string): { y: number; m: number; d: number } | null {
    const r = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (r === null || isoToSerial(iso) === null) return null;
    return { y: Number(r[1]), m: Number(r[2]) - 1, d: Number(r[3]) };
}

function monthStart(y: number, m: number): string {
    const yy = y + Math.floor(m / 12);
    const mm = ((m % 12) + 12) % 12;
    return `${String(yy).padStart(4, '0')}-${String(mm + 1).padStart(2, '0')}-01`;
}

/**
 * The window of `preset` that holds `anchor`: 2 weeks from the Monday of its week (Sunday is the last column),
 * its calendar month, or its month and the next two. An invalid anchor gives an empty window at the anchor.
 */
export function presetWindow(preset: BoardPreset, anchor: string): BoardWindow {
    const p = parts(anchor);
    if (p === null) return { from: anchor, to: addDays(anchor, -1) };
    if (preset === '2w') {
        const from = addDays(anchor, -((dayOfWeek(anchor) + 6) % 7));
        return { from, to: addDays(from, 13) };
    }
    const months = preset === '1m' ? 1 : 3;
    return { from: monthStart(p.y, p.m), to: addDays(monthStart(p.y, p.m + months), -1) };
}

/** The window one step before (-1) or after (+1): 2 weeks, 1 month or 3 months. */
export function stepWindow(preset: BoardPreset, w: BoardWindow, dir: -1 | 1): BoardWindow {
    if (preset === '2w') return presetWindow('2w', addDays(w.from, 14 * dir));
    const p = parts(w.from);
    if (p === null) return w;
    return presetWindow(preset, monthStart(p.y, p.m + (preset === '1m' ? 1 : 3) * dir));
}

/** The query range that feeds the board: the window, widened to `today` and back by `lookBack` days for waits. */
export function boardQueryRange(w: BoardWindow, today: string, lookBack: number): BoardWindow {
    const from = w.from < today ? w.from : today;
    const to = w.to > today ? w.to : today;
    return { from: addDays(from, -lookBack), to };
}

// ─── Day labels (Thai by default, English on request) ───

export const THAI_MONTH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'] as const;
export const THAI_MONTH_LONG = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;
/** By dayOfWeek (0 = Sunday). */
export const THAI_WEEKDAY_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'] as const;

const EN_MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const EN_MONTH_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
] as const;
const EN_WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const isEn = (locale: string): boolean => locale === 'en';
const monthShort = (m: number, locale: string): string => (isEn(locale) ? EN_MONTH_SHORT : THAI_MONTH_SHORT)[m] ?? '';

/** Weekday abbreviation by dayOfWeek (0 = Sunday). */
export const weekdayShort = (dow: number, locale = 'th'): string => (isEn(locale) ? EN_WEEKDAY_SHORT : THAI_WEEKDAY_SHORT)[dow] ?? '';

/** Year, 2 digits ("26" for 2026): the app shows the Christian-era year everywhere (calendar, S-Curve, dates). */
const yy2 = (y: number) => String(y % 100).padStart(2, '0');

/** "28 ต.ค." / "28 Oct" (with " 26" when `withYear`). */
export function thaiDay(iso: string, withYear = false, locale = 'th'): string {
    const p = parts(iso);
    if (p === null) return iso;
    return `${String(p.d)} ${monthShort(p.m, locale)}${withYear ? ` ${yy2(p.y)}` : ''}`;
}

/** "28–30 ต.ค." · "30 ต.ค.–2 พ.ย." · "30 ธ.ค. 69–2 ม.ค. 70" · "28 ต.ค." for one day (English: "28–30 Oct" …). */
export function thaiDayRange(from: string, to: string, locale = 'th'): string {
    const a = parts(from);
    const b = parts(to);
    if (a === null || b === null) return `${from}–${to}`;
    if (from === to) return thaiDay(from, false, locale);
    if (a.y !== b.y) return `${thaiDay(from, true, locale)}–${thaiDay(to, true, locale)}`;
    if (a.m !== b.m) return `${thaiDay(from, false, locale)}–${thaiDay(to, false, locale)}`;
    return `${String(a.d)}–${String(b.d)} ${monthShort(a.m, locale)}`;
}

export interface BoardDay {
    iso: string;
    /** Day of the month. */
    day: number;
    /** 0 = Sunday. */
    dow: number;
    month: number;
    year: number;
}

export interface BoardSpanHeader {
    label: string;
    offset: number;
    days: number;
}

/** The shown days, in order. */
export function boardDays(w: BoardWindow): BoardDay[] {
    const n = windowDays(w);
    const out: BoardDay[] = [];
    for (let i = 0; i < n; i++) {
        const iso = addDays(w.from, i);
        const p = parts(iso);
        if (p === null) continue;
        out.push({ iso, day: p.d, dow: dayOfWeek(iso), month: p.m, year: p.y });
    }
    return out;
}

/** Month headers over the window: "ตุลาคม 2026". */
export function monthHeaders(w: BoardWindow, locale = 'th'): BoardSpanHeader[] {
    const out: BoardSpanHeader[] = [];
    boardDays(w).forEach((d, i) => {
        const last = out[out.length - 1];
        const label = `${(isEn(locale) ? EN_MONTH_LONG : THAI_MONTH_LONG)[d.month] ?? ''} ${String(d.year)}`;
        if (last?.label === label) last.days++;
        else out.push({ label, offset: i, days: 1 });
    });
    return out;
}

/** Week headers (Monday to Sunday, cut at the window's ends): "26 ต.ค.–1 พ.ย.". */
export function weekHeaders(w: BoardWindow, locale = 'th'): BoardSpanHeader[] {
    const days = boardDays(w);
    const out: BoardSpanHeader[] = [];
    let start = 0;
    days.forEach((d, i) => {
        const next = days[i + 1];
        if (next === undefined || next.dow === 1) {
            const first = days[start];
            if (first !== undefined) out.push({ label: thaiDayRange(first.iso, d.iso, locale), offset: start, days: i - start + 1 });
            start = i + 1;
        }
    });
    return out;
}
