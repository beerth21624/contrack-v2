// ─── Running document numbers (docs/erp/01-architecture.md §8.2): pure pattern formatting, no dependencies ───
// Tokens: {prefix}, {yyyy} (year in the series' year style), {yy}, {mm}, {seq:N} (zero-padded to N digits, N = 3–6).

export type NumberReset = 'yearly' | 'monthly' | 'never';
/** `ce` = Christian era (2026), `be` = Buddhist era (2569 = CE + 543). */
export type YearStyle = 'ce' | 'be';

export interface DocNumberParts {
    prefix: string;
    /** Business date `YYYY-MM-DD` (never the server time). */
    issueDate: string;
    yearStyle: YearStyle;
    seq: number;
}

export type PatternProblem =
    | 'seq_missing'
    | 'seq_repeated'
    | 'seq_width'
    | 'unknown_token'
    | 'month_required'
    | 'year_required'
    | 'too_long';

const TOKEN = /\{([^{}]*)\}/g;
const SEQ = /^seq:(\d+)$/;
const KNOWN = new Set(['prefix', 'yyyy', 'yy', 'mm']);
export const PATTERN_MAX_LENGTH = 64;

function parseDate(issueDate: string): { year: number; month: number } {
    const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(issueDate);
    if (m === null) throw new RangeError(`Not a business date: ${issueDate}`);
    return { year: Number(m[1]), month: Number(m[2]) };
}

/**
 * Problems of a pattern for a reset policy; empty = valid. Needs exactly one `{seq:N}` with N 3–6, no unknown token,
 * no stray brace; a monthly series needs `{mm}`; a yearly or monthly series needs a year (`{yyyy}` or `{yy}`) so
 * numbers of different periods never collide.
 */
export function validatePattern(pattern: string, reset: NumberReset): PatternProblem[] {
    const problems = new Set<PatternProblem>();
    if (pattern.length > PATTERN_MAX_LENGTH) problems.add('too_long');
    let seqCount = 0;
    const tokens = new Set<string>();
    for (const match of pattern.matchAll(TOKEN)) {
        const token = match[1] ?? '';
        const seq = SEQ.exec(token);
        if (seq !== null) {
            seqCount += 1;
            const width = Number(seq[1]);
            if (width < 3 || width > 6) problems.add('seq_width');
        } else if (KNOWN.has(token)) {
            tokens.add(token);
        } else {
            problems.add('unknown_token');
        }
    }
    // A brace outside a well-formed token (e.g. "{seq:4" or "a}b").
    if (/[{}]/.test(pattern.replace(TOKEN, ''))) problems.add('unknown_token');
    if (seqCount === 0) problems.add('seq_missing');
    if (seqCount > 1) problems.add('seq_repeated');
    if (reset === 'monthly' && !tokens.has('mm')) problems.add('month_required');
    if (reset !== 'never' && !tokens.has('yyyy') && !tokens.has('yy')) problems.add('year_required');
    return [...problems];
}

/** Counter period of a business date: `'2026'` (yearly), `'2026-10'` (monthly), `'all'` (never). Always CE. */
export function periodKeyOf(reset: NumberReset, issueDate: string): string {
    const { year, month } = parseDate(issueDate);
    if (reset === 'never') return 'all';
    if (reset === 'yearly') return String(year);
    return `${year}-${String(month).padStart(2, '0')}`;
}

/** `formatDocNumber('{prefix}{yyyy}-{seq:4}', { prefix: 'QT', issueDate: '2026-10-31', yearStyle: 'ce', seq: 1 })` → `QT2026-0001`. */
export function formatDocNumber(pattern: string, parts: DocNumberParts): string {
    const { year, month } = parseDate(parts.issueDate);
    const shownYear = parts.yearStyle === 'be' ? year + 543 : year;
    return pattern.replace(TOKEN, (whole, token: string) => {
        if (token === 'prefix') return parts.prefix;
        if (token === 'yyyy') return String(shownYear);
        if (token === 'yy') return String(shownYear % 100).padStart(2, '0');
        if (token === 'mm') return String(month).padStart(2, '0');
        const seq = SEQ.exec(token);
        if (seq !== null) return String(parts.seq).padStart(Number(seq[1]), '0');
        return whole;
    });
}
