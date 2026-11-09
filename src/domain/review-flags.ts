// ─── Review flags (dev mode, phase 3): a tester marks a BOQ cell or a step output as "wrong" with a comment ───
// Stored in the project (`Project.reviewFlags`), one sync document per flag (`flag:<id>`), so a guest project keeps
// them in this browser and a cloud project shares them with the team; two testers flagging at once never conflict.
// Flags never change any number: the engine does not read them.

/** BOQ cells a flag can point at (same names as the "explain this cell" panel). */
export const REVIEW_FLAG_BOQ_FIELDS = ['qty', 'waste', 'gross', 'matUnit', 'matTotal', 'labUnit', 'labTotal', 'total'] as const;
export type ReviewFlagBoqField = (typeof REVIEW_FLAG_BOQ_FIELDS)[number];

export type ReviewFlagTarget =
    /** A BOQ line (by line key; shown by item no + description), optionally one cell of it. */
    | { kind: 'boq'; line: string; field?: ReviewFlagBoqField }
    /** One output of a calculation step. */
    | { kind: 'output'; calc: string; output: string };

export type ReviewFlagStatus = 'open' | 'resolved';

export interface ReviewFlag {
    target: ReviewFlagTarget;
    comment: string;
    /** Who flagged it (display name). */
    by: string;
    /** When (ISO date-time). */
    at: string;
    status: ReviewFlagStatus;
}

export const REVIEW_FLAG_LIMITS = { comment: 2000, by: 120, id: 64, key: 128 } as const;
export const REVIEW_FLAG_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** A new flag id (time + random; unique enough for one project). */
export function newReviewFlagId(now: Date = new Date()): string {
    const rand = Math.random().toString(36).slice(2, 10);
    return `${now.getTime().toString(36)}-${rand}`;
}

/** Same target (a BOQ flag without a field matches any cell of its line when `anyField`). */
export function sameFlagTarget(a: ReviewFlagTarget, b: ReviewFlagTarget, anyField = false): boolean {
    if (a.kind === 'boq' && b.kind === 'boq') return a.line === b.line && (anyField || a.field === b.field);
    if (a.kind === 'output' && b.kind === 'output') return a.calc === b.calc && a.output === b.output;
    return false;
}

/** Flags of a project, newest first. */
export function listReviewFlags(flags: Record<string, ReviewFlag> | undefined): { id: string; flag: ReviewFlag }[] {
    return Object.entries(flags ?? {})
        .map(([id, flag]) => ({ id, flag }))
        .sort((x, y) => (x.flag.at < y.flag.at ? 1 : x.flag.at > y.flag.at ? -1 : 0));
}

const isText = (v: unknown, max: number, min = 0): v is string => typeof v === 'string' && v.length >= min && v.length <= max;
const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function checkTarget(t: unknown): string | undefined {
    if (!isPlainObject(t)) return 'target must be an object';
    if (t.kind === 'boq') {
        for (const k of Object.keys(t)) if (k !== 'kind' && k !== 'line' && k !== 'field') return `target has unknown field "${k}"`;
        if (!isText(t.line, REVIEW_FLAG_LIMITS.key, 1)) return 'target.line must be a BOQ line key';
        if (t.field !== undefined && !(REVIEW_FLAG_BOQ_FIELDS as readonly unknown[]).includes(t.field)) return 'target.field is not a BOQ cell';
        return undefined;
    }
    if (t.kind === 'output') {
        for (const k of Object.keys(t)) if (k !== 'kind' && k !== 'calc' && k !== 'output') return `target has unknown field "${k}"`;
        if (!isText(t.calc, 64, 1)) return 'target.calc must be a calculator id';
        if (!isText(t.output, REVIEW_FLAG_LIMITS.key, 1)) return 'target.output must be an output key';
        return undefined;
    }
    return 'target.kind must be "boq" or "output"';
}

/** Shape check of one flag document (undefined = valid). */
export function reviewFlagProblem(data: unknown): string | undefined {
    if (!isPlainObject(data)) return 'a review flag must be an object';
    for (const k of Object.keys(data)) {
        if (k !== 'target' && k !== 'comment' && k !== 'by' && k !== 'at' && k !== 'status') return `a review flag has unknown field "${k}"`;
    }
    const target = checkTarget(data.target);
    if (target !== undefined) return target;
    if (!isText(data.comment, REVIEW_FLAG_LIMITS.comment)) return `comment must be text up to ${String(REVIEW_FLAG_LIMITS.comment)} characters`;
    if (!isText(data.by, REVIEW_FLAG_LIMITS.by)) return `by must be text up to ${String(REVIEW_FLAG_LIMITS.by)} characters`;
    if (!isText(data.at, 40, 1) || Number.isNaN(Date.parse(data.at))) return 'at must be a date-time';
    if (data.status !== 'open' && data.status !== 'resolved') return 'status must be "open" or "resolved"';
    return undefined;
}
