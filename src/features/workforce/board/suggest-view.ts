// ─── Pure helpers of the board's move suggestions and live before/after (W3): Thai lines, payloads, dismissals ───
// docs/workforce/00-crew-management-design.md §4. No React, no API: unit tested in ./__tests__/suggest-view.test.ts.
// The comparison itself is src/domain/workforce/scenario.ts (whatIf), the suggestions src/domain/workforce/suggest.ts.
import type {
    CreateCrewAssignmentRequest, CrewAssignmentDto, UpdateCrewAssignmentRequest,
} from '@/shared/contract';
import { thaiDay, type BoardAssignment } from '@/domain/workforce/board';
import type { ChangedAssignment, ScenarioMetrics, WhatIf } from '@/domain/workforce/scenario';
import { describeChange, type ChangeNames, type Suggestion, type SuggestionKind } from '@/domain/workforce/suggest';
import { PLAN_TASKS } from '@/domain/planning/tasks';
import { taskNameIn } from '@/domain/planning/labels.en';
import { workforceLocale, workforceText } from '../text';
import type { BoardNames } from './view';

// ─── Money and day wording ───

const BAHT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "฿12,500" (whole baht). */
export const money = (n: number): string => `\u0E3F${BAHT.format(Math.round(n))}`;

/** "+฿3,200" · "−฿3,200" · "฿0". */
export const signedMoney = (n: number): string =>
    (Math.round(n) > 0 ? `+${money(n)}` : Math.round(n) < 0 ? `−${money(-n)}` : money(0));

/** A finish moved by `days`: "เร็วขึ้น 6 วัน" (negative = earlier) · "ช้าลง 2 วัน" · "เท่าเดิม". */
export function finishShift(days: number): string {
    const t = workforceText();
    if (days < 0) return t('board.impact.earlier', { days: -days });
    if (days > 0) return t('board.impact.later', { days });
    return t('board.impact.same');
}

/** "28 ต.ค." — with the 2-digit year when it is not the year of `today`. */
const day = (iso: string, today: string): string => thaiDay(iso, iso.slice(0, 4) !== today.slice(0, 4), workforceLocale());

/** The name of a suggestion kind ("แก้จุดชน" …). */
export const suggestionKindLabel = (kind: SuggestionKind): string => workforceText()(`board.suggest.kind.${kind}`);

// ─── Before → after lines ───

export type ImpactTone = 'good' | 'bad' | 'neutral';

export interface ImpactLine {
    key: string;
    label: string;
    before: string;
    after: string;
    /** "เร็วขึ้น 6 วัน", "ลดลง 2 จุด" … */
    change: string;
    tone: ImpactTone;
}

export interface ImpactOptions {
    projectName: (projectId: string) => string;
    /** Some crew's ฿/day is visible to this viewer: only then money lines are written. */
    moneyVisible: boolean;
    today: string;
}

const toneOf = (delta: number, lowerIsBetter = true): ImpactTone =>
    (delta === 0 ? 'neutral' : (delta < 0) === lowerIsBetter ? 'good' : 'bad');

function countChange(delta: number, kind: 'clashes' | 'idle'): string {
    const t = workforceText();
    if (delta < 0) return kind === 'clashes' ? t('board.impact.clashesDown', { count: -delta }) : t('board.impact.idleDown', { count: -delta });
    if (delta > 0) return kind === 'clashes' ? t('board.impact.clashesUp', { count: delta }) : t('board.impact.idleUp', { count: delta });
    return t('board.impact.same');
}

/** Projects a change touches (before and after side), in first-seen order, plus any whose finish or cost moved. */
export function touchedProjects(w: Pick<WhatIf, 'result' | 'delta'>): string[] {
    const out = new Set<string>();
    for (const c of w.result.changed) {
        if (c.before !== null) out.add(c.before.projectId);
        out.add(c.after.projectId);
    }
    for (const p of w.delta.projects) out.add(p.projectId);
    return [...out];
}

/**
 * The numbers that matter for one what-if, as before → after lines: the finish of each touched project, then
 * conflicts (when there are any before or after), idle crew-days (when they change), and with visible wages the idle
 * value and the labour cost of the touched projects (when they change and are known). Money is never written as
 * ฿0 for an unknown cost: unknown means no line.
 */
export function impactLines(w: Pick<WhatIf, 'result' | 'before' | 'after' | 'delta'>, o: ImpactOptions): ImpactLine[] {
    const t = workforceText();
    const lines: ImpactLine[] = [];
    const before = new Map(w.before.projects.map(p => [p.projectId, p]));
    const after = new Map(w.after.projects.map(p => [p.projectId, p]));
    const touched = touchedProjects(w);

    for (const id of touched) {
        const fb = before.get(id)?.finish ?? null;
        const fa = after.get(id)?.finish ?? null;
        const days = w.delta.projects.find(p => p.projectId === id)?.days ?? 0;
        lines.push({
            key: `project:${id}`,
            label: t('board.impact.finishes', { project: o.projectName(id) }),
            before: fb === null ? '—' : day(fb, o.today),
            after: fa === null ? '—' : day(fa, o.today),
            change: fb === null || fa === null ? (fb === fa ? t('board.impact.same') : '') : finishShift(days),
            tone: toneOf(days),
        });
    }

    const dc = w.after.conflicts - w.before.conflicts;
    if (w.before.conflicts > 0 || w.after.conflicts > 0) {
        lines.push({
            key: 'conflicts', label: t('board.impact.clashes'), before: String(w.before.conflicts), after: String(w.after.conflicts),
            change: countChange(dc, 'clashes'), tone: toneOf(dc),
        });
    }

    const di = w.after.idleCrewDays - w.before.idleCrewDays;
    if (di !== 0) {
        lines.push({
            key: 'idle', label: t('board.impact.idle'),
            before: t('board.impact.idleValue', { count: w.before.idleCrewDays }), after: t('board.impact.idleValue', { count: w.after.idleCrewDays }),
            change: countChange(di, 'idle'), tone: toneOf(di),
        });
    }

    if (o.moneyVisible) {
        const dv = w.after.idleValue - w.before.idleValue;
        if (Math.round(dv) !== 0) {
            lines.push({
                key: 'idleValue', label: t('board.impact.idleMoney'), before: money(w.before.idleValue), after: money(w.after.idleValue),
                change: signedMoney(dv), tone: toneOf(dv),
            });
        }
        let cb: number | null = 0;
        let ca: number | null = 0;
        for (const id of touched) {
            const x = before.get(id)?.labourCost;
            const y = after.get(id)?.labourCost;
            cb = cb === null || x === undefined || x === null ? null : cb + x;
            ca = ca === null || y === undefined || y === null ? null : ca + y;
        }
        if (cb !== null && ca !== null && Math.round(ca - cb) !== 0) {
            lines.push({
                key: 'labour', label: t('board.impact.labour'), before: money(cb), after: money(ca),
                change: signedMoney(ca - cb), tone: toneOf(ca - cb),
            });
        }
    }
    return lines;
}

// ─── One line per changed assignment (the domain's describeChange, with the board's names) ───

/** The board's names as describeChange names (task: the plan name, "งานฉาบปูน"). */
export const changeNamesOf = (names: BoardNames): ChangeNames =>
    ({ crewName: names.crew, projectName: names.project, taskName: planTaskName });

const PLAN_TASK_NAME = new Map(PLAN_TASKS.map(t => [t.id, t.name]));
/** The plan's task name ("งานฉาบปูน"), "งาน 9.9" for an unknown id (what the suggester writes into titles), in the UI language. */
export function planTaskName(taskId: string): string {
    const name = PLAN_TASK_NAME.get(taskId);
    return name === undefined ? workforceText()('shared.taskFallback', { id: taskId }) : taskNameIn(taskId, name, workforceLocale());
}

/**
 * One changed assignment in Thai for the "สิ่งที่จะเปลี่ยน" lists, e.g. "งานก่ออิฐ บ้านคุณสมศรี: ทีมก่อฉาบช่างแดง →
 * ทีมก่อฉาบช่างดำ" (src/domain/workforce/suggest.ts describeChange).
 */
export function changeLine<A extends BoardAssignment>(c: ChangedAssignment<A>, n: ChangeNames): string {
    return describeChange(c, n, workforceLocale());
}

/** The changes not asked for: later tasks pushed (or brought) along. */
export const followOns = <A extends BoardAssignment>(changed: readonly ChangedAssignment<A>[]): ChangedAssignment<A>[] =>
    changed.filter(c => c.cause === 'knock-on' || c.cause === 'pull');

// ─── Saving: one request per change, in order ───

/** Note on an assignment created by accepting a suggestion (in the UI language of whoever accepts it). */
export const suggestionNote = (): string => workforceText()('board.suggest.note');

export type SaveStep =
    | { kind: 'create'; change: ChangedAssignment<CrewAssignmentDto>; body: CreateCrewAssignmentRequest }
    | { kind: 'update'; change: ChangedAssignment<CrewAssignmentDto>; assignmentId: string; body: UpdateCrewAssignmentRequest };

const CAUSE_RANK: Record<ChangedAssignment['cause'], number> = { move: 0, add: 1, 'knock-on': 2, pull: 2 };

/**
 * The requests that save `changed`: an add is created (with SUGGESTION_NOTE), anything else is updated with only the
 * fields that differ; nothing-changed entries are skipped. Order: the asked moves, then the adds, then the follow-ons
 * (stable within each, which keeps the task order of the follow-ons).
 */
export function saveSteps(changed: readonly ChangedAssignment<CrewAssignmentDto>[], note: string = suggestionNote()): SaveStep[] {
    const ordered = changed.map((c, i) => ({ c, i }))
        .sort((x, y) => CAUSE_RANK[x.c.cause] - CAUSE_RANK[y.c.cause] || x.i - y.i)
        .map(x => x.c);
    const out: SaveStep[] = [];
    for (const c of ordered) {
        const a = c.after;
        const b = c.before;
        if (b === null) {
            out.push({ kind: 'create', change: c, body: { projectId: a.projectId, taskId: a.taskId, crewId: a.crewId, start: a.start, end: a.end, note } });
            continue;
        }
        const body: UpdateCrewAssignmentRequest = {
            ...(a.crewId !== b.crewId ? { crewId: a.crewId } : {}),
            ...(a.start !== b.start ? { start: a.start } : {}),
            ...(a.end !== b.end ? { end: a.end } : {}),
        };
        if (Object.keys(body).length === 0) continue;
        out.push({ kind: 'update', change: c, assignmentId: b.id, body });
    }
    return out;
}

export interface SaveRun {
    /** How many steps were saved (from the first). */
    saved: number;
    /** The first step that failed (nothing after it was tried). */
    failed?: { index: number; step: SaveStep; error: unknown };
}

/** Runs `steps` one after another and stops at the first error. */
export async function runSaveSteps(steps: readonly SaveStep[], exec: (step: SaveStep) => Promise<unknown>): Promise<SaveRun> {
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        if (step === undefined) continue;
        try {
            await exec(step);
        } catch (error) {
            return { saved: i, failed: { index: i, step, error } };
        }
    }
    return { saved: steps.length };
}

/** "บันทึกรายการที่ 2 จาก 3 ไม่สำเร็จ" + what was saved before it. */
export function saveFailureLines(run: SaveRun, total: number): { title: string; saved: string } {
    const t = workforceText();
    const index = run.failed?.index ?? 0;
    return {
        title: t('board.suggest.failTitle', { index: String(index + 1), total: String(total) }),
        saved: run.saved > 0 ? t('board.suggest.failSaved', { count: run.saved }) : t('board.suggest.failNone'),
    };
}

// ─── Suggestions shown ───

/**
 * At most `limit` suggestions, leaving out any that would put work on a crew not in `crews` or archived (the board
 * keeps archived crews that still have work, the suggester may not know they are archived).
 */
export function pickSuggestions<A extends BoardAssignment>(
    list: readonly Suggestion<A>[], crews: readonly { id: string; archivedAt: string | null }[], limit: number,
): Suggestion<A>[] {
    const active = new Set(crews.filter(c => c.archivedAt === null).map(c => c.id));
    return list.filter(s => s.whatIf.result.changed.every(c =>
        (c.before !== null && c.before.crewId === c.after.crewId) || active.has(c.after.crewId))).slice(0, limit);
}

/**
 * The suggester's `makeAssignment`: a CrewAssignmentDto for a crew sent to help, id "new-<n>" (n from 1 per factory,
 * so one suggestion run gives the same ids every time) unless the suggester already gave a "new-…" id.
 */
export function assignmentFactory(workspaceId: string): (a: BoardAssignment) => CrewAssignmentDto {
    let n = 0;
    return a => {
        n += 1;
        return {
            id: a.id.startsWith('new-') ? a.id : `new-${String(n)}`,
            workspaceId, projectId: a.projectId, taskId: a.taskId, crewId: a.crewId, start: a.start, end: a.end,
            note: suggestionNote(), createdBy: '', createdAt: '', updatedAt: '',
        };
    };
}

// ─── Dismissed suggestions (this browser only) ───

export const DISMISSED_KEY = 'contrack-board-dismissed';
/** Oldest ids are dropped past this many. */
export const DISMISSED_MAX = 100;

/** The stored list: a JSON array of strings; anything else reads as empty. */
export function parseDismissed(raw: string | null | undefined): string[] {
    if (raw === null || raw === undefined || raw === '') return [];
    try {
        const v: unknown = JSON.parse(raw);
        if (!Array.isArray(v)) return [];
        return [...new Set(v.filter((x): x is string => typeof x === 'string' && x !== ''))].slice(-DISMISSED_MAX);
    } catch {
        return [];
    }
}

/** `list` with `id` last (newest), deduplicated, at most DISMISSED_MAX. */
export const withDismissed = (list: readonly string[], id: string): string[] =>
    [...list.filter(x => x !== id), id].slice(-DISMISSED_MAX);

/** `list` without `ids`. */
export const withoutDismissed = (list: readonly string[], ids: Iterable<string>): string[] => {
    const drop = new Set(ids);
    return list.filter(x => !drop.has(x));
};

type ReadStore = Pick<Storage, 'getItem'>;
type WriteStore = Pick<Storage, 'setItem'>;
const browserStore = (): Storage | undefined => (typeof localStorage === 'undefined' ? undefined : localStorage);

/** The dismissed ids of this browser; empty when storage is missing or blocked. */
export function loadDismissed(store: ReadStore | undefined = browserStore()): string[] {
    try {
        return parseDismissed(store?.getItem(DISMISSED_KEY));
    } catch {
        return [];
    }
}

/** Keeps the dismissed ids; a blocked or full storage is ignored (the dismissal lasts for this visit only). */
export function saveDismissed(list: readonly string[], store: WriteStore | undefined = browserStore()): void {
    try {
        store?.setItem(DISMISSED_KEY, JSON.stringify(list));
    } catch {
        // Private window or blocked site data: keep it in memory only.
    }
}

// ─── Summary: มูลค่าวันว่าง ───

/**
 * The idle-value cell of the summary: null when no crew's ฿/day is visible (say nothing rather than ฿0), else the
 * amount and whether some crews with idle days have no known cost.
 */
export function idleValueCell(
    m: Pick<ScenarioMetrics, 'idleValue' | 'idleValuePartial'>, crews: readonly { dailyCost: number | null }[],
): { value: string; partial: boolean } | null {
    if (!crews.some(c => c.dailyCost !== null)) return null;
    return { value: money(m.idleValue), partial: m.idleValuePartial };
}
