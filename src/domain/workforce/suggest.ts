// ─── Move suggestions for the crew board (ผู้ช่วยแนะนำการย้ายทีม, W3) (pure) ───
// docs/workforce/00-crew-management-design.md §4 step 2: one suggestion at a time, each a set of moves with the
// before/after numbers (scenario.ts) and the reasons as plain Thai sentences; the user accepts or dismisses it.
// Nothing here saves anything: the board saves `whatIf.result.changed` when a suggestion is accepted.
//
// Plain rules make candidates, each is run through the what-if (applyMoves + the board numbers over the window), and
// only the ones that improve something without making anything worse are kept:
//   resolve-conflict — a cross-project conflict reaching today or later: (a) another crew of the task's trade that is
//                      free for the whole assignment takes it (no delay), or (b) one of the two waits until its crew is
//                      free (its project may finish later). Kept when the conflicts go down.
//   help             — a crew free ≥ 2 days from today joins a task of its trade that another crew works on with ≥ 4
//                      days left: the remaining days are split in two (both crews assumed equally fast) and later tasks
//                      are brought earlier. Kept when some project finishes earlier and none later.
//   fill-gap         — a task that could start earlier than planned (its tasks before it and their waits are done)
//                      moves to the first day its own crew, or another free crew of its trade, is free for its whole
//                      length; later tasks are brought earlier. Kept when some project finishes earlier and none later.
// Every candidate: no move starts before `today`; the conflicts never go up (in the window, nor over all assignments
// from today on); an assignment already started (start < today) keeps its start and its crew — it may only be
// shortened (help), never handed to another crew nor made to wait (the crew is on site), and a candidate whose
// knock-ons would move a started one is dropped. The new start of a fill-gap and the free stretch of a help lie in the
// window: the suggestions are about what the board shows.
//
// Score (ordering only): conflicts resolved × 1000 + days saved × 10 − days lost × 10 − |labour cost change| ÷ 1000
// − tasks pushed later as a knock-on; ties by id. Diversity: at most one suggestion per moved assignment and per crew.
import { isoToSerial, serialToIso } from '../planning/calendar';
import type { TaskLag } from '../../shared/contract/workforce';
import { buildCrewBoard, thaiDay, thaiDayRange, type BoardAssignment, type BoardWindow } from './board';
import { crewBusy } from './assignments';
import { suggestWords } from './suggest-words';
import {
    applyMoves, compareScenarios, readyDay, scenarioMetrics,
    type ChangedAssignment, type Move, type ProjectDelta, type ScenarioCrew, type WhatIf,
} from './scenario';
import { lagAfter, presentPredecessors } from './task-order';
import { taskTrade } from './task-trades';

/**
 * resolve-conflict — a crew booked on two projects at once: another free crew of the trade takes one, or one waits;
 * help          — a free crew of the same trade joins a task so it ends sooner (the project finishes earlier);
 * fill-gap      — a crew free for a stretch takes a task elsewhere that is ready to start earlier.
 */
export type SuggestionKind = 'resolve-conflict' | 'help' | 'fill-gap';

export interface SuggestCrew extends ScenarioCrew {
    name: string;
    trade: string;
}

export interface SuggestInput<A extends BoardAssignment = BoardAssignment> {
    crews: readonly SuggestCrew[];
    /** Every assignment around the window (as the board loads them). */
    assignments: readonly A[];
    lagsByProject: ReadonlyMap<string, readonly TaskLag[]>;
    window: BoardWindow;
    today: string;
    projectName: (projectId: string) => string;
    taskName: (taskId: string) => string;
    /** Builds a new assignment for an add (the board makes the id, e.g. "new-1", and fills the DTO fields). */
    makeAssignment: (a: BoardAssignment) => A;
    /** Suggestion ids the user dismissed: not offered again. */
    dismissed?: ReadonlySet<string>;
    /** Most suggestions returned (default 3). */
    limit?: number;
    /** The language of the lines written (default 'th'); the names given in `projectName` / `taskName` must match it. */
    locale?: string;
}

export interface Suggestion<A extends BoardAssignment = BoardAssignment> {
    /** Stable for the same situation (kind + assignments + crews), so a dismissal sticks across reloads. */
    id: string;
    kind: SuggestionKind;
    /** The crew that moves or helps, and the project it goes to. */
    crewId: string;
    projectId: string;
    /** One line, e.g. "ย้ายทีมก่อฉาบช่างแดง ไปบ้านคุณสมศรี 9 วัน". */
    title: string;
    /** What gets better (and any cost of it), as short sentences, e.g. "บ้านคุณสมศรีเสร็จเร็วขึ้น 6 วัน". */
    reasons: string[];
    moves: Move[];
    adds: A[];
    /** Whether later tasks were brought earlier (passed to applyMoves when the board re-checks it). */
    pullSuccessors: boolean;
    whatIf: WhatIf<A>;
    /** Higher is better (for ordering only). */
    score: number;
    /** Labour cost after − before over the changed assignments (฿); null when a crew on them has no known cost. */
    labourCostChange?: number | null;
}

/** Default number of suggestions shown. */
export const SUGGESTION_LIMIT = 3;
/** Days a task must still have (from the first day help could start) before a second crew is offered. */
export const HELP_MIN_REMAINING_DAYS = 4;
/** Shortest free stretch of a crew (from today on) that is offered as help. */
export const HELP_MIN_FREE_DAYS = 2;
/** How far ahead a waiting assignment looks for a free run of its crew. */
const WAIT_SEARCH_STEPS = 366;

/** The names a Thai line about a change needs. */
export interface ChangeNames {
    crewName(id: string): string;
    projectName(id: string): string;
    taskName(id: string): string;
}

// ─── Wording (suggest-words.ts: Thai by default, English on request) ───

/** "฿1,200" (of the absolute value). */
function baht(n: number): string {
    return `฿${Math.round(Math.abs(n)).toLocaleString('en-US')}`;
}

/** "12 → 6 ธ.ค." · "30 พ.ย. → 6 ธ.ค." · "30 ธ.ค. 26 → 2 ม.ค. 27". */
function dayChange(from: string, to: string, locale: string): string {
    if (from.slice(0, 4) !== to.slice(0, 4)) return `${thaiDay(from, true, locale)} → ${thaiDay(to, true, locale)}`;
    if (from.slice(0, 7) !== to.slice(0, 7)) return `${thaiDay(from, false, locale)} → ${thaiDay(to, false, locale)}`;
    return `${String(Number(from.slice(8, 10)))} → ${thaiDay(to, false, locale)}`;
}

/** "บ้านคุณสมศรีเสร็จเร็วขึ้น 6 วัน (12 → 6 ธ.ค.)"; null when the finish did not move. */
function finishReason(p: ProjectDelta, projectName: (id: string) => string, locale: string): string | null {
    if (p.days === 0 || p.finishBefore === null || p.finishAfter === null) return null;
    return suggestWords(locale).finishMoved(
        projectName(p.projectId), p.days < 0, Math.abs(p.days), dayChange(p.finishBefore, p.finishAfter, locale),
    );
}

/**
 * One line per change for the "สิ่งที่จะเปลี่ยน" list: "งานฉาบปูน บ้านคุณวิชัย: ทีมก่อฉาบช่างแดง → ทีมก่อฉาบช่างดำ",
 * "งานทาสีรองพื้น บ้านคุณวิชัย: เลื่อนไป 3 วัน (5–12 พ.ย.)", "งานก่ออิฐ บ้านคุณสมศรี: เหลือ 20–31 ต.ค. (เดิมถึง 3 พ.ย.)",
 * "เพิ่ม ทีมก่อฉาบช่างดำ ช่วยงานก่ออิฐ บ้านคุณสมศรี 28–31 ต.ค." (Thai unless `locale` is 'en').
 */
export function describeChange<A extends BoardAssignment>(change: ChangedAssignment<A>, names: ChangeNames, locale = 'th'): string {
    const w = suggestWords(locale);
    const a = change.after;
    const what = w.what(names.taskName(a.taskId), names.projectName(a.projectId));
    const range = thaiDayRange(a.start, a.end, locale);
    const b = change.before;
    if (b === null) return w.addChange(w.team(names.crewName(a.crewId)), what, range);

    const parts: string[] = [];
    if (b.crewId !== a.crewId) parts.push(`${w.team(names.crewName(b.crewId))} → ${w.team(names.crewName(a.crewId))}`);
    const bs = isoToSerial(b.start);
    const as = isoToSerial(a.start);
    const be = isoToSerial(b.end);
    const ae = isoToSerial(a.end);
    const shift = bs === null || as === null ? change.shiftDays : as - bs;
    if (shift > 0) parts.push(w.pushed(shift, range));
    else if (shift < 0) parts.push(w.earlier(-shift, range));
    else if (be !== null && ae !== null && ae < be) parts.push(w.shortened(range, thaiDay(b.end, false, locale)));
    else if (be !== null && ae !== null && ae > be) parts.push(w.extended(range, thaiDay(b.end, false, locale)));
    if (parts.length === 0) parts.push(w.unchanged(range));
    return `${what}: ${parts.join(', ')}`;
}

// ─── Helpers ───

function days(a: BoardAssignment): number {
    const s = isoToSerial(a.start);
    const e = isoToSerial(a.end);
    return s === null || e === null || e < s ? 0 : e - s + 1;
}

/** Conflicts whose shared days reach `today` or later, over all the assignments (all, and between two projects). */
function liveConflicts(list: readonly BoardAssignment[], today: number): { all: number; cross: number } {
    const byCrew = new Map<string, { a: BoardAssignment; s: number; e: number }[]>();
    for (const a of list) {
        const s = isoToSerial(a.start);
        const e = isoToSerial(a.end);
        if (s === null || e === null || e < s || e < today) continue;
        const l = byCrew.get(a.crewId);
        if (l === undefined) byCrew.set(a.crewId, [{ a, s, e }]);
        else l.push({ a, s, e });
    }
    let all = 0;
    let cross = 0;
    for (const l of byCrew.values()) {
        for (let i = 0; i < l.length; i++) {
            const x = l[i];
            if (x === undefined) continue;
            for (let j = i + 1; j < l.length; j++) {
                const y = l[j];
                if (y === undefined) continue;
                const to = Math.min(x.e, y.e);
                if (Math.max(x.s, y.s) > to || to < today) continue;
                all++;
                if (x.a.projectId !== y.a.projectId) cross++;
            }
        }
    }
    return { all, cross };
}

/** Days in a row the crew is free around [from, to] (itself free), within [lo, hi]. */
function freeRun(list: readonly BoardAssignment[], crewId: string, from: number, to: number, lo: number, hi: number): number {
    const spans = list.flatMap(a => {
        if (a.crewId !== crewId) return [];
        const s = isoToSerial(a.start);
        const e = isoToSerial(a.end);
        return s === null || e === null || e < s ? [] : [{ s, e }];
    });
    const busy = (d: number) => spans.some(r => r.s <= d && d <= r.e);
    let left = from;
    while (left - 1 >= lo && !busy(left - 1)) left--;
    let right = to;
    while (right + 1 <= hi && !busy(right + 1)) right++;
    return right - left + 1;
}

/** `crewId` has no work on [start, end] other than `excludeId`. */
function crewFree(list: readonly BoardAssignment[], crewId: string, start: number, end: number, excludeId?: string): boolean {
    return crewBusy(list, crewId, serialToIso(start), serialToIso(end), excludeId).length === 0;
}

/** Σ days × ฿/day over the changes, after − before; null when a crew on them has no known cost. */
function costChange(changed: readonly ChangedAssignment[], cost: ReadonlyMap<string, number | null>): number | null {
    const of = (a: BoardAssignment): number | null => {
        const c = cost.get(a.crewId);
        return c === undefined || c === null ? null : days(a) * c;
    };
    let total = 0;
    for (const ch of changed) {
        const after = of(ch.after);
        const before = ch.before === null ? 0 : of(ch.before);
        if (after === null || before === null) return null;
        total += after - before;
    }
    return total;
}

const byId = (x: { id: string }, y: { id: string }) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

interface Candidate<A extends BoardAssignment> {
    id: string;
    kind: SuggestionKind;
    crewId: string;
    projectId: string;
    title: string;
    /** Reasons shown first (may read the what-if), and last. */
    lead: (w: WhatIf<A>) => string[];
    tail: string[];
    moves: Move[];
    adds: A[];
    pullSuccessors: boolean;
    /** The assignment the suggestion moves (diversity). */
    about: string;
}

/** The best suggestions first (at most `limit`), none of them dismissed. */
export function suggestMoves<A extends BoardAssignment>(input: SuggestInput<A>): Suggestion<A>[] {
    const { crews, assignments, lagsByProject, window, today, projectName, taskName } = input;
    const limit = input.limit ?? SUGGESTION_LIMIT;
    const locale = input.locale ?? 'th';
    const sw = suggestWords(locale);
    const day = (iso: string) => thaiDay(iso, false, locale);
    const dismissed = input.dismissed ?? new Set<string>();
    const t = isoToSerial(today);
    const ws = isoToSerial(window.from);
    const we = isoToSerial(window.to);
    if (t === null || ws === null || we === null || we < ws || limit <= 0) return [];

    const crewById = new Map(crews.map(c => [c.id, c]));
    const cost = new Map(crews.map(c => [c.id, c.dailyCost]));
    const crewLabel = (id: string) => sw.team(crewById.get(id)?.name ?? id);
    const what = (a: BoardAssignment) => sw.what(taskName(a.taskId), projectName(a.projectId));
    /** The trade a task needs: its plan trade, else the trade of the crew on it. */
    const tradeOf = (a: BoardAssignment): string | undefined => taskTrade(a.taskId) ?? crewById.get(a.crewId)?.trade;
    /** The other crews of `trade`, by name. */
    const sameTrade = (trade: string | undefined, not: string) => (trade === undefined ? [] : crews
        .filter(c => c.id !== not && c.trade === trade)
        .sort((x, y) => x.name.localeCompare(y.name, 'th') || byId(x, y)));
    const startOf = (a: BoardAssignment) => isoToSerial(a.start);
    const board = buildCrewBoard(crews, assignments, lagsByProject, window, today);
    const candidates: Candidate<A>[] = [];

    // ─── resolve-conflict ───
    for (const c of board.conflicts) {
        if (c.sameProject || c.to < today) continue;
        for (const [x, other] of [[c.a, c.b], [c.b, c.a]] as const) {
            const xs = startOf(x);
            const xe = isoToSerial(x.end);
            const oe = isoToSerial(other.end);
            if (xs === null || xe === null || oe === null || xs < t) continue; // started: stays with its crew
            const conflictReason = sw.noLongerClashes(projectName(other.projectId));
            // (a) another crew of the trade, free for the whole assignment.
            for (const k of sameTrade(tradeOf(x), x.crewId)) {
                if (!crewFree(assignments, k.id, xs, xe)) continue;
                const run = freeRun(assignments, k.id, xs, xe, t, Math.max(we, xe));
                candidates.push({
                    id: `resolve-conflict:${x.id}:${k.id}`, kind: 'resolve-conflict', crewId: k.id, projectId: x.projectId,
                    title: sw.resolveMoveTitle(what(x), sw.team(k.name)),
                    lead: () => [conflictReason],
                    tail: [sw.crewFreeThen(sw.team(k.name), run)],
                    moves: [{ assignmentId: x.id, crewId: k.id }], adds: [], pullSuccessors: false, about: x.id,
                });
            }
            // (b) x waits: the first day after `other` ends on which its crew is free for its whole length.
            const len = xe - xs + 1;
            let d = Math.max(oe + 1, t);
            let found: number | null = null;
            for (let step = 0; step < WAIT_SEARCH_STEPS && found === null; step++) {
                const busy = crewBusy(assignments, x.crewId, serialToIso(d), serialToIso(d + len - 1), x.id);
                if (busy.length === 0) found = d;
                else d = Math.max(...busy.map(b => isoToSerial(b.assignment.end) ?? d)) + 1;
            }
            if (found === null) continue;
            const start = serialToIso(found);
            candidates.push({
                id: `resolve-conflict:${x.id}:${x.crewId}`, kind: 'resolve-conflict', crewId: x.crewId, projectId: x.projectId,
                title: sw.resolveDelayTitle(what(x), day(start)),
                lead: w => {
                    const p = w.delta.projects.find(q => q.projectId === x.projectId);
                    const same = p === undefined || p.days === 0;
                    return [conflictReason, ...(same ? [sw.finishUnchanged(projectName(x.projectId))] : [])];
                },
                tail: [sw.crewFreeFrom(crewLabel(x.crewId), day(start))],
                moves: [{ assignmentId: x.id, start }], adds: [], pullSuccessors: false, about: x.id,
            });
        }
    }

    // ─── help ───
    let addSeq = 0;
    for (const row of board.rows) {
        const f = crewById.get(row.crew.id);
        if (f === undefined) continue;
        for (const g of row.gaps) {
            const gs = Math.max(isoToSerial(g.from) ?? t, t);
            const ge = isoToSerial(g.to) ?? t;
            if (ge - gs + 1 < HELP_MIN_FREE_DAYS) continue;
            for (const x of assignments) {
                if (x.crewId === f.id || !crewById.has(x.crewId) || tradeOf(x) !== f.trade) continue;
                const xs = startOf(x);
                const xe = isoToSerial(x.end);
                if (xs === null || xe === null || xe < xs || xe < t || xs > ge || xe < gs) continue;
                const h = Math.max(xs, gs, t);
                const r = xe - h + 1;
                if (r < HELP_MIN_REMAINING_DAYS) continue;
                const e2 = h + Math.ceil(r / 2) - 1;
                if (!crewFree(assignments, f.id, h, e2)) continue;
                addSeq++;
                const add = input.makeAssignment({
                    id: `new-${String(addSeq)}`, crewId: f.id, projectId: x.projectId, taskId: x.taskId,
                    start: serialToIso(h), end: serialToIso(e2),
                });
                candidates.push({
                    id: `help:${x.id}:${f.id}`, kind: 'help', crewId: f.id, projectId: x.projectId,
                    title: sw.helpTitle(sw.team(f.name), what(x), e2 - h + 1),
                    lead: () => [],
                    tail: [sw.crewFreeThen(sw.team(f.name), ge - h + 1), sw.similarPace],
                    moves: [{ assignmentId: x.id, end: serialToIso(e2) }], adds: [add], pullSuccessors: true, about: x.id,
                });
            }
        }
    }

    // ─── fill-gap ───
    for (const x of assignments) {
        const xs = startOf(x);
        const len = days(x);
        if (xs === null || xs <= t || len === 0 || !crewById.has(x.crewId)) continue;
        const own = assignments.filter(a => a.projectId === x.projectId);
        const lags = lagsByProject.get(x.projectId) ?? [];
        const rdIso = readyDay(own, x.taskId, lags);
        const rd = rdIso === null ? null : isoToSerial(rdIso);
        if (rd === null || rd >= xs) continue;
        const tryCrews = [x.crewId, ...sameTrade(tradeOf(x), x.crewId).map(c => c.id)];
        let hit: { day: number; crewId: string } | null = null;
        for (let d = Math.max(rd, t); d < xs && d <= we && hit === null; d++) {
            const k = tryCrews.find(id => crewFree(assignments, id, d, d + len - 1, x.id));
            if (k !== undefined) hit = { day: d, crewId: k };
        }
        if (hit === null) continue;
        const start = serialToIso(hit.day);
        const other = hit.crewId !== x.crewId;
        // Did a wait set the ready day (the task before that ends last + its wait)?
        const present = new Set(own.map(a => a.taskId));
        const waited = presentPredecessors(x.taskId, present).some(p => {
            const lag = lagAfter(p, lags);
            const end = Math.max(...own.filter(a => a.taskId === p).map(a => isoToSerial(a.end) ?? -Infinity));
            return lag > 0 && end + lag + 1 === rd;
        });
        const readyText = sw.readyFrom(waited, day(serialToIso(rd)));
        const earlier = xs - hit.day;
        const tail = [readyText];
        if (other) {
            const run = freeRun(assignments, hit.crewId, hit.day, hit.day + len - 1, t, Math.max(we, hit.day + len - 1));
            tail.push(sw.crewFreeThen(crewLabel(hit.crewId), run));
        }
        candidates.push({
            id: `fill-gap:${x.id}:${hit.crewId}`, kind: 'fill-gap', crewId: hit.crewId, projectId: x.projectId,
            title: other ? sw.fillOtherTitle(crewLabel(hit.crewId), what(x), earlier) : sw.fillSameTitle(what(x), earlier),
            lead: () => [],
            tail,
            moves: [other ? { assignmentId: x.id, start, crewId: hit.crewId } : { assignmentId: x.id, start }],
            adds: [], pullSuccessors: true, about: x.id,
        });
    }

    // ─── Evaluate (the what-if over the window), keep, score ───
    const before = scenarioMetrics(crews, assignments, lagsByProject, window, today);
    const liveBefore = liveConflicts(assignments, t);
    const seen = new Set<string>();
    const kept: { s: Suggestion<A>; about: string }[] = [];
    for (const c of candidates) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const result = applyMoves(assignments, c.moves, lagsByProject, { adds: c.adds, pullSuccessors: c.pullSuccessors });
        if (result.changed.length === 0) continue;
        const touchesPast = result.changed.some(ch => {
            const as = startOf(ch.after) ?? t;
            if (ch.before === null) return as < t;
            return ch.after.start !== ch.before.start && ((startOf(ch.before) ?? t) < t || as < t);
        });
        if (touchesPast) continue;
        const after = scenarioMetrics(crews, result.assignments, lagsByProject, window, today);
        const delta = compareScenarios(before, after);
        const liveAfter = liveConflicts(result.assignments, t);
        if (delta.crossProjectConflicts > 0 || delta.conflicts > 0) continue;
        if (liveAfter.cross > liveBefore.cross || liveAfter.all > liveBefore.all) continue;
        if (c.kind === 'resolve-conflict') {
            if (delta.crossProjectConflicts >= 0 || liveAfter.cross >= liveBefore.cross) continue;
        } else if (delta.daysSaved <= 0 || delta.daysLost !== 0) continue;

        const w: WhatIf<A> = { result, before, after, delta };
        const labour = costChange(result.changed, cost);
        const knockOns = result.changed.filter(ch => ch.cause === 'knock-on').length;
        const pulls = result.changed.filter(ch => ch.cause === 'pull').length;
        const finish = [...delta.projects]
            .sort((x, y) => Number(y.projectId === c.projectId) - Number(x.projectId === c.projectId))
            .map(p => finishReason(p, projectName, locale))
            .filter((s): s is string => s !== null);
        const reasons = [
            ...c.lead(w),
            ...finish,
            ...(knockOns > 0 ? [sw.knockOns(knockOns)] : []),
            ...(pulls > 0 ? [sw.pulls(pulls)] : []),
            ...c.tail,
            ...(labour !== null && labour !== 0 ? [sw.labour(labour > 0, baht(labour))] : []),
        ];
        const resolved = Math.max(0, -delta.conflicts);
        const score = resolved * 1000 + delta.daysSaved * 10 - delta.daysLost * 10 - Math.abs(labour ?? 0) / 1000 - knockOns;
        kept.push({
            about: c.about,
            s: {
                id: c.id, kind: c.kind, crewId: c.crewId, projectId: c.projectId, title: c.title, reasons,
                moves: c.moves, adds: c.adds, pullSuccessors: c.pullSuccessors, whatIf: w, score, labourCostChange: labour,
            },
        });
    }

    kept.sort((x, y) => y.s.score - x.s.score || byId(x.s, y.s));
    const usedAssignments = new Set<string>();
    const usedCrews = new Set<string>();
    const out: Suggestion<A>[] = [];
    for (const { s, about } of kept) {
        if (out.length >= limit) break;
        if (dismissed.has(s.id) || usedCrews.has(s.crewId) || usedAssignments.has(about)) continue;
        usedCrews.add(s.crewId);
        usedAssignments.add(about);
        out.push(s);
    }
    return out;
}
