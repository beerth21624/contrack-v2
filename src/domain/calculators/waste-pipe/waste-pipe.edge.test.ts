import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import {
    wastePipe, WASTE_PIPE_BOQ_LINES, WASTE_PIPE_ITEMS, WASTE_PIPE_SIZES, WASTE_PIPE_PLAIN, runLength, pipeRunTargets, normalizeSize, unlinkedRuns,
    sizeMismatches, sizeFromLabel, plainLabel, blankRuns, type PipeRun,
} from '.';

// QA edge tests for "waste-pipe" (pipe-run sheet → BOQ section 9 rows 84–87).
// Expected values are hand-computed from the Excel BOQ template: E = Σ(D+E of the runs), H = E × 1.15,
// J = I × H, L = K × H, consumables row = 50 % × Σ(J + L) (spec 05 §0.1, §1/§2).

const ID = 'waste-pipe';
const ctx = { outputs: () => undefined };
const LINES = WASTE_PIPE_BOQ_LINES;
/** What a run of exactly 10 m puts in each BOQ line: [line, size, J, L, consumable-row share]. */
const AT10: [string, string, number, number, number][] = [
    ['R84', 'PVC 4"', 2300, 1150, 1725],
    ['R85', 'PVC 2"', 690, 575, 632.5],
    ['R86', 'PVC 1"', 230, 575, 402.5],
];
const CONSUMABLE = 'R87';
const run = (size: string, horizontal: number, vertical = 0, label = ''): PipeRun => ({ label, size, horizontal, vertical });
const sizeOf = (i: number): string => LINES[i]?.size ?? '';
const lineOf = (i: number): string => LINES[i]?.line ?? '';
const compute = (runs: PipeRun[]) => wastePipe.compute({ runs }, ctx);
const idx = LINES.map((_, i) => i);
const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];

function project(runs: PipeRun[] | undefined, mutate?: (p: ReturnType<typeof createProject>) => void) {
    const p = createProject('blank');
    if (runs) p.calculators[ID] = { runs };
    mutate?.(p);
    const res = computeProject(p);
    const row = (key: string) => res.boq.sections.flatMap(s => s.rows).find((r): r is BoqItemRow => r.type === 'item' && r.key === key);
    return { res, row };
}

/** One run of `len` m on each fixed row (positional rows keep their own size). */
const fixed = (len: number): PipeRun[] => LINES.map((l, i) => run(l.size, len, 0, WASTE_PIPE_ITEMS[i] ?? ''));

describe('waste-pipe edge — blank and links', () => {
    it('blank(): fixed rows keep item + size, no length; finite zero outputs', () => {
        const b = wastePipe.blank?.();
        expect(b?.runs).toHaveLength(LINES.length);
        b?.runs.forEach((r, i) => {
            expect(r.horizontal).toBe(0);
            expect(r.vertical).toBe(0);
            expect(r.size).toBe(sizeOf(i));
            expect(r.label).toBe(WASTE_PIPE_ITEMS[i]);
        });
        const out = wastePipe.compute(b ?? { runs: [] }, ctx);
        expect(Object.values(out).every(v => v === 0)).toBe(true);
        expect(Object.keys(out).sort()).toEqual([...LINES.map(l => l.line), 'total', 'unlinked'].sort());
    });

    it('blank project: every fixed BOQ line and the consumables row total 0', () => {
        const { row } = project(undefined);
        for (const l of LINES) expect(row(l.line)?.total, l.line).toBe(0);
        expect(row(CONSUMABLE)?.total).toBe(0);
    });

    it('blank project still names the BOQ lines after the fixed items', () => {
        const { row } = project(undefined);
        LINES.forEach((l, i) => expect(row(l.line)?.desc).toBe(WASTE_PIPE_ITEMS[i]));
    });

    it('boqLinks: one qty link per line, output key = line key', () => {
        expect(wastePipe.boqLinks).toEqual(LINES.map(l => ({ line: l.line, field: 'qty', output: l.line })));
        expect(wastePipe.sections).toEqual([9]);
        expect(wastePipe.deps).toEqual([]);
    });

    it('blankRuns zeroes lengths but is a pure copy (does not mutate the source)', () => {
        const src = { runs: [run('PVC 1"', 3, 4, 'x')] };
        const out = blankRuns(src);
        expect(out.runs[0]).toEqual({ label: 'x', size: 'PVC 1"', horizontal: 0, vertical: 0 });
        expect(src.runs[0]?.horizontal).toBe(3);
    });

    it('no runs at all (all rows deleted): zeros, nothing NaN', () => {
        const out = compute([]);
        expect(Object.values(out).every(v => v === 0)).toBe(true);
        expect(unlinkedRuns({ runs: [] }, LINES)).toEqual([]);
        expect(sizeMismatches({ runs: [] }, LINES)).toEqual([]);
    });
});

describe('waste-pipe edge — each BOQ line alone (10 m on one fixed row)', () => {
    it.each(idx)('row %i only: its line = 10, the others 0, total 10', i => {
        const runs = LINES.map((l, j) => run(l.size, j === i ? 10 : 0));
        const out = compute(runs);
        LINES.forEach((l, j) => expect(out[l.line], l.line).toBe(j === i ? 10 : 0));
        expect(out.total).toBe(10);
        expect(out.unlinked).toBe(0);
    });

    it.each(idx)('row %i only: BOQ E = 10, H = 11.5, J = I×H, L = K×H, M = J+L', i => {
        const [line, , J, L] = AT10[i] ?? ['', '', NaN, NaN, NaN];
        const runs = LINES.map((l, j) => run(l.size, j === i ? 10 : 0));
        const { row } = project(runs);
        const r = row(line);
        expect(r?.qty).toBe(10);
        expect(r?.grossQty).toBeCloseTo(11.5, 12);
        expect(r?.matTotal).toBeCloseTo(J, 9);
        expect(r?.labTotal).toBeCloseTo(L, 9);
        expect(r?.total).toBeCloseTo(J + L, 9);
    });

    it('consumables row = 50 % of Σ(J + L) of its lines (all three fixed rows at 10 m)', () => {
        const { row } = project(fixed(10));
        const expected = AT10.reduce((s, [, , , , c]) => s + c, 0);
        expect(row(CONSUMABLE)?.total).toBeCloseTo(expected, 9);
        expect(row(CONSUMABLE)?.matTotal).toBeCloseTo(expected, 9);
        expect(row(CONSUMABLE)?.labTotal).toBe(0);
    });

    it('consumables of one line alone = 50 % of that line', () => {
        AT10.forEach(([line, , J, L, c], i) => {
            const { row } = project(LINES.map((l, j) => run(l.size, j === i ? 10 : 0)));
            expect(row(CONSUMABLE)?.total, line).toBeCloseTo(c, 9);
            expect(c).toBeCloseTo(0.5 * (J + L), 9);
        });
    });
});

describe('waste-pipe edge — F = D + E (horizontal + vertical)', () => {
    it('horizontal only, vertical only, both', () => {
        expect(runLength(run('x', 7, 0))).toBe(7);
        expect(runLength(run('x', 0, 5))).toBe(5);
        expect(runLength(run('x', 7, 5))).toBe(12);
    });

    it('decimals add exactly enough (0.1 + 0.2 ≈ 0.3; 14.5 + 1.1 = 15.6)', () => {
        expect(runLength(run('x', 0.1, 0.2))).toBeCloseTo(0.3, 12);
        expect(runLength(run('x', 14.5, 1.1))).toBeCloseTo(15.6, 12);
    });

    it('zero and blank cells: 0 + 0 = 0, undefined cell counts 0', () => {
        expect(runLength(run('x', 0, 0))).toBe(0);
        expect(runLength({ label: '', size: '' } as unknown as PipeRun)).toBe(0);
        expect(runLength({ label: '', size: '', horizontal: 4 } as unknown as PipeRun)).toBe(4);
    });

    it.each(bad)('a %s cell counts as 0 (never NaN/Infinity)', v => {
        expect(runLength(run('x', v, 3))).toBe(3);
        expect(runLength(run('x', 3, v))).toBe(3);
        const out = compute(fixed(1).map((r, i) => (i === 0 ? { ...r, horizontal: v } : r)));
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
    });

    it('negative lengths flow through unchanged (finite; a deduction)', () => {
        expect(runLength(run('x', -2, 5))).toBe(3);
        const out = compute([run(sizeOf(0), -4)]);
        expect(out[lineOf(0)]).toBe(-4);
        expect(out.total).toBe(-4);
    });

    it('huge length (1e12 m) stays finite and exact in the BOQ row', () => {
        const out = compute([run(sizeOf(0), 1e12, 1e12)]);
        expect(out[lineOf(0)]).toBe(2e12);
        const { row } = project([run(sizeOf(0), 1e12, 1e12)]);
        expect(Number.isFinite(row(lineOf(0))?.total)).toBe(true);
        expect(row(lineOf(0))?.qty).toBe(2e12);
    });

    it('tiny length (0.001 m)', () => {
        expect(compute([run(sizeOf(0), 0.001)])[lineOf(0)]).toBeCloseTo(0.001, 15);
    });
});

describe('waste-pipe edge — table size, positions, sizes', () => {
    it('one row only: only the first line gets it, the others are 0', () => {
        const out = compute([run(sizeOf(0), 9)]);
        expect(out[lineOf(0)]).toBe(9);
        for (let i = 1; i < LINES.length; i++) expect(out[lineOf(i)]).toBe(0);
    });

    it('Excel row count: the fixed rows feed their lines by position, whatever the size picked', () => {
        const runs = LINES.map((_, i) => run('ไม่ตรง', i + 1));
        expect(pipeRunTargets(runs, LINES)).toEqual(LINES.map((_, i) => i));
        const out = compute(runs);
        LINES.forEach((l, i) => expect(out[l.line]).toBe(i + 1));
    });

    it.each(idx)('extra row (index ≥ lines) of size #%i adds to that size\'s line', i => {
        const base = fixed(1);
        const out = compute([...base, run(sizeOf(i), 5, 2)]);
        LINES.forEach((l, j) => expect(out[l.line], l.line).toBe(1 + (j === i ? 7 : 0)));
        expect(out.total).toBe(LINES.length + 7);
        expect(out.unlinked).toBe(0);
    });

    it.each(idx)('extra row of size #%i written with stray spaces still finds its line', i => {
        const spaced = ' ' + sizeOf(i).replace(' ', '   ') + '  ';
        expect(normalizeSize(spaced)).toBe(normalizeSize(sizeOf(i)));
        const out = compute([...fixed(0), run(spaced, 4)]);
        expect(out[lineOf(i)]).toBe(4);
    });

    it('extra rows of an unknown or empty size reach no line: reported as unlinked, not added', () => {
        const runs = [...fixed(1), run('PVC 99"', 3, 1), run('', 2), run('   ', 6), run('', 0, 0)];
        const out = compute(runs);
        LINES.forEach(l => expect(out[l.line]).toBe(1));
        expect(out.unlinked).toBe(12);
        expect(out.total).toBe(LINES.length + 12);
        expect(unlinkedRuns({ runs }, LINES)).toEqual([
            { index: LINES.length, size: 'PVC 99"', length: 4 },
            { index: LINES.length + 1, size: '', length: 2 },
            { index: LINES.length + 2, size: '', length: 6 },
        ]);
    });

    it('20 extra rows (more than Excel) are all summed into their lines', () => {
        const extra = Array.from({ length: 20 }, (_, k) => run(sizeOf(k % LINES.length), 1, 0.5));
        const out = compute([...fixed(0), ...extra]);
        const per = LINES.map((_, i) => extra.filter((__, k) => k % LINES.length === i).length * 1.5);
        LINES.forEach((l, i) => expect(out[l.line]).toBeCloseTo(per[i] ?? NaN, 9));
        expect(out.total).toBeCloseTo(30, 9);
    });

    it('duplicate sizes in extra rows add up (no merge, no loss)', () => {
        const out = compute([...fixed(0), run(sizeOf(0), 2), run(sizeOf(0), 3), run(sizeOf(0), 4)]);
        expect(out[lineOf(0)]).toBe(9);
    });

    it('deleting a fixed row moves later rows up one position (Excel positional rule)', () => {
        const runs = LINES.map((l, i) => run(l.size, (i + 1) * 10));
        const out = compute(runs.slice(1));
        expect(out[lineOf(0)]).toBe(20);
        if (LINES.length > 2) expect(out[lineOf(1)]).toBe(30);
        expect(out[lineOf(LINES.length - 1)]).toBe(0);
        expect(sizeMismatches({ runs: runs.slice(1) }, LINES).map(m => m.index)).toEqual(LINES.slice(0, LINES.length - 1).map((_, i) => i));
    });

    it('sizeMismatches: none when sizes match; one entry per positional row whose size differs', () => {
        expect(sizeMismatches({ runs: fixed(1) }, LINES)).toEqual([]);
        const runs = fixed(1);
        runs[0] = run('PVC 99"', 1);
        expect(sizeMismatches({ runs }, LINES)).toEqual([{ index: 0, size: 'PVC 99"', line: LINES[0] }]);
        runs[0] = run('', 1);
        expect(sizeMismatches({ runs }, LINES)).toEqual([]);   // no size picked = nothing to warn about
    });

    it('every size option: sizeFromLabel reads it from the end of its item name', () => {
        for (const item of WASTE_PIPE_ITEMS) expect((WASTE_PIPE_SIZES as readonly string[]).includes(sizeFromLabel(item, WASTE_PIPE_SIZES)), item).toBe(true);
        expect(sizeFromLabel('', WASTE_PIPE_SIZES)).toBe('');
        expect(sizeFromLabel('  ', WASTE_PIPE_SIZES)).toBe('');
    });

    it('every item option has a plain name and hint; free text has none', () => {
        for (const item of WASTE_PIPE_ITEMS) {
            const p = plainLabel(item, WASTE_PIPE_PLAIN);
            expect(p?.name, item).toBeTruthy();
            expect(p?.hint, item).toBeTruthy();
            expect(plainLabel(' ' + item + '  ', WASTE_PIPE_PLAIN)).toEqual(p);
        }
        expect(plainLabel('อย่างอื่น', WASTE_PIPE_PLAIN)).toBeUndefined();
    });

    it('size options map to BOQ lines exactly as the template prices them', () => {
        for (const s of WASTE_PIPE_SIZES) {
            const target = pipeRunTargets([...fixed(0), run(s, 1)], LINES)[LINES.length];
            const expectedLine = LINES.findIndex(l => normalizeSize(l.size) === normalizeSize(s));
            expect(target ?? -1, s).toBe(expectedLine);
        }
    });
});

describe('waste-pipe edge — BOQ text (D cells)', () => {
    it('D = the item picked on rows 5, 6, … (trimmed); blank label keeps the template text', () => {
        const runs = LINES.map((l, i) => run(l.size, 1, 0, i === 0 ? '  ชื่อใหม่  ' : i === 1 ? '' : `อื่น ${i}`));
        const text = wastePipe.boqText?.({ runs }, ctx) ?? {};
        expect(text[lineOf(0)]).toEqual({ desc: 'ชื่อใหม่' });
        expect(text[lineOf(1)]).toBeUndefined();
        if (LINES.length > 2) expect(text[lineOf(2)]).toEqual({ desc: 'อื่น 2' });
    });

    it('rows beyond the fixed lines do not rename any BOQ line', () => {
        const text = wastePipe.boqText?.({ runs: [...fixed(1), run(sizeOf(0), 1, 0, 'ท่อพิเศษ')] }, ctx) ?? {};
        expect(Object.keys(text)).toHaveLength(LINES.length);
    });

    it('the renamed item reaches the BOQ row description', () => {
        const { row } = project(LINES.map((l, i) => run(l.size, 1, 0, i === 0 ? 'ท่อตั้งชื่อเอง' : '')));
        expect(row(lineOf(0))?.desc).toBe('ท่อตั้งชื่อเอง');
    });
});

describe('waste-pipe edge — level skipped (ไม่มีในโครงการนี้)', () => {
    it('skipped: every output 0 and every BOQ line (and consumables) 0', () => {
        const { res, row } = project(fixed(10), p => { p.journey = { [ID]: 'skipped' }; });
        expect(Object.values(res.calcOutputs[ID] ?? {}).every(v => v === 0)).toBe(true);
        for (const l of LINES) { expect(row(l.line)?.qty, l.line).toBe(0); expect(row(l.line)?.total).toBe(0); }
        expect(row(CONSUMABLE)?.total).toBe(0);
    });

    it('skipped: a quantity typed on the BOQ page cannot bring the line back', () => {
        const { row } = project(fixed(10), p => {
            p.journey = { [ID]: 'skipped' };
            p.boqOverrides[lineOf(0)] = { qty: 99 };
        });
        expect(row(lineOf(0))?.qty).toBe(0);
        expect(row(lineOf(0))?.total).toBe(0);
    });

    it('un-skipping restores the stored lengths', () => {
        const p = createProject('blank');
        p.calculators[ID] = { runs: fixed(10) };
        p.journey = { [ID]: 'skipped' };
        computeProject(p);
        p.journey = {};
        const row = computeProject(p).boq.sections.flatMap(s => s.rows).find(r => r.key === lineOf(0));
        expect(row?.type === 'item' ? row.qty : NaN).toBe(10);
    });

    it('skipping another level leaves this one alone', () => {
        const { row } = project(fixed(10), p => { p.journey = { 'sanitary-ware': 'skipped' }; });
        expect(row(lineOf(0))?.qty).toBe(10);
    });
});
