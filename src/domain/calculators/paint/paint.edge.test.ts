// QA edge tests (group U5) — ทาสี_Paint. Spec docs/excel-spec/04 §5.
// C5/C6 = plaster exterior/interior, C7/C8/C9 = ceiling paint groups, C10 = slat wall (typed), C11 = Σ girth × length,
// C12 = fascia length × height, C13 = C5 + C6. Each line is priced in §23, §25 and §31 (C13 only in §23).
// The sheet is area-only: litres, coats and waste are not modelled here (prices/waste live in the BOQ template).
import { describe, expect, it } from 'vitest';
import {
    paint, paintAreas, paintLinkedSources, paintSuggestions, pendingPaintSuggestions, applyPaintSuggestions,
    mouldingArea, PAINT_LINES, PAINT_EXCEL_FALLBACK, type PaintInput,
} from '.';
import type { CalcContext } from '../types';
import type { BrickWall } from '../brick';
import type { CeilingRow } from '../ceiling';
import { computeProject, createProject, type Project } from '../../project';

const none: CalcContext = { outputs: () => undefined };
const ctxOf = (outs: Record<string, Record<string, number>>): CalcContext => ({ outputs: id => outs[id] });
const input = (p: Partial<PaintInput> = {}): PaintInput => ({
    slatWallArea: 0, mouldings: [], fasciaLength: 0, fasciaHeight: 0.23, ...p,
});
/** A context where every source calculator exists and reports 0 (a blank project). */
const zeroSources = ctxOf({
    plaster: { exterior: 0, interior: 0 },
    ceiling: { 'paint.ภายนอก': 0, 'paint.ภายใน': 0, 'paint.ไม้ระแนง': 0 },
});

const boqQty = (p: Project, key: string): number | undefined => {
    for (const s of computeProject(p).boq.sections) {
        for (const x of s.rows) if (x.type === 'item' && x.key === key) return x.qty;
    }
    return undefined;
};
const blankProject = (): Project => createProject('blank');
const brickWall = (wallPart: string, length: number, height: number): BrickWall =>
    ({ wallPart, brickType: 'อิฐมอญ', thickness: 'ครึ่งแผ่น', length, height });
const crow = (code: CeilingRow['code'], w: number, l: number, group: CeilingRow['paint']): CeilingRow =>
    ({ code, width: w, length: l, location: '', paint: group });

describe('paint — blank()', () => {
    it('hand-typed numbers start at 0; fascia height and moulding girths keep the Excel values', () => {
        const b = paint.blank?.();
        expect(b).toEqual({
            slatWallArea: 0,
            mouldings: [{ size: '0.3', girth: 0.5, length: 0 }, { size: '0.1', girth: 0.3, length: 0 }],
            fasciaLength: 0,
            fasciaHeight: 0.23,
        });
    });
    it('with source calculators at 0, every output is finite and 0', () => {
        const o = paint.compute(paint.blank?.() ?? input(), zeroSources);
        for (const [k, v] of Object.entries(o)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        for (const l of paint.boqLinks) expect(o[l.output], l.line).toBe(0);
    });
    it('without source calculators the five linked lines fall back to the Excel numbers, the typed lines stay 0', () => {
        const a = paintAreas(paint.blank?.() ?? input(), none);
        expect(a.wallSlat).toBe(0);
        expect(a.moulding).toBe(0);
        expect(a.fascia).toBe(0);
        expect(a.wallExterior).toBe(PAINT_EXCEL_FALLBACK.wallExterior);
        expect(a.skim).toBeCloseTo(191.8225 + 314.7825, 9);
    });
    it('a blank project has every paint BOQ row at 0 (§23, §25, §31)', () => {
        const p = blankProject();
        for (const l of PAINT_LINES) for (const k of l.boq) expect(boqQty(p, k), k).toBe(0);
    });
});

describe('paint — line table', () => {
    it('9 fixed lines, C5…C13, in order', () => {
        expect(PAINT_LINES.map(l => l.cell)).toEqual(['C5', 'C6', 'C7', 'C8', 'C9', 'C10', 'C11', 'C12', 'C13']);
    });
    it('the first 8 lines go to three BOQ sections, skim only to §23', () => {
        for (const l of PAINT_LINES.slice(0, 8)) expect(l.boq, l.key).toHaveLength(3);
        expect(PAINT_LINES[8]?.boq).toEqual(['R231']);
    });
    it('BOQ rows are unique and 25 links exist, each mapped to its own output', () => {
        const rows = PAINT_LINES.flatMap(l => l.boq);
        expect(new Set(rows).size).toBe(rows.length);
        expect(paint.boqLinks).toHaveLength(25);
        expect(paint.boqLinks.every(l => l.field === 'qty' && l.output === l.line)).toBe(true);
    });
    it('all 3 sections get the same area per line', () => {
        const o = paint.compute(input({ slatWallArea: 7 }), zeroSources);
        expect([o.R228, o.R250, o.R305]).toEqual([7, 7, 7]);
    });
});

describe('paint — each typed input alone', () => {
    it('C10 slat wall area 5 → R228/R250/R305 = 5, nothing else', () => {
        const o = paint.compute(input({ slatWallArea: 5 }), zeroSources);
        expect([o.wallSlat, o.moulding, o.fascia, o.skim]).toEqual([5, 0, 0, 0]);
    });
    it('C11 moulding: girth 0.5 × length 4 = 2', () => {
        const o = paint.compute(input({ mouldings: [{ size: '0.3', girth: 0.5, length: 4 }] }), zeroSources);
        expect(o.moulding).toBe(2);
        expect(o.R229).toBe(2);
    });
    it('C11 moulding sums runs left to right: 0.5 × 13 + 0.3 × 11 = 9.8', () => {
        const a = paintAreas(input({ mouldings: [{ size: '0.3', girth: 0.5, length: 13 }, { size: '0.1', girth: 0.3, length: 11 }] }), zeroSources);
        expect(a.moulding).toBeCloseTo(9.8, 12);
    });
    it('C11 with no runs is 0; with 1 / 5 / 20 runs adds each', () => {
        expect(paintAreas(input({ mouldings: [] }), zeroSources).moulding).toBe(0);
        const run = (n: number) => Array.from({ length: n }, () => ({ size: '0.1', girth: 0.3, length: 10 }));
        expect(paintAreas(input({ mouldings: run(1) }), zeroSources).moulding).toBeCloseTo(3, 12);
        expect(paintAreas(input({ mouldings: run(5) }), zeroSources).moulding).toBeCloseTo(15, 12);
        expect(paintAreas(input({ mouldings: run(20) }), zeroSources).moulding).toBeCloseTo(60, 12);
    });
    it('mouldingArea of one run', () => {
        expect(mouldingArea({ size: '0.3', girth: 0.5, length: 6 })).toBe(3);
        expect(mouldingArea({ size: '', girth: 0.5, length: 0 })).toBe(0);
    });
    it('C12 fascia: 10 × 0.23 = 2.3', () => {
        const o = paint.compute(input({ fasciaLength: 10 }), zeroSources);
        expect(o.fascia).toBeCloseTo(2.3, 12);
        expect(o.R230).toBeCloseTo(2.3, 12);
        expect(o.R252).toBeCloseTo(2.3, 12);
        expect(o.R307).toBeCloseTo(2.3, 12);
    });
    it('C12 fascia with height 0 or length 0 is 0', () => {
        expect(paintAreas(input({ fasciaLength: 10, fasciaHeight: 0 }), zeroSources).fascia).toBe(0);
        expect(paintAreas(input({ fasciaLength: 0, fasciaHeight: 0.5 }), zeroSources).fascia).toBe(0);
    });
    it('Excel sample typed values: 8.1 / 9.8 / 14.536', () => {
        const a = paintAreas(paint.defaults(), zeroSources);
        expect(a.wallSlat).toBeCloseTo(8.1, 12);
        expect(a.moulding).toBeCloseTo(9.8, 12);
        expect(a.fascia).toBeCloseTo(14.536, 12);
    });
});

describe('paint — areas drawn from other sheets', () => {
    it('plaster exterior / interior set C5 / C6 and the skim C13 = C6 + C5', () => {
        const a = paintAreas(input(), ctxOf({ plaster: { exterior: 12, interior: 30 }, ceiling: {} }));
        expect([a.wallExterior, a.wallInterior, a.skim]).toEqual([12, 30, 42]);
    });
    it('ceiling groups set C7 / C8 / C9 but not the skim line', () => {
        const a = paintAreas(input(), ctxOf({
            plaster: { exterior: 0, interior: 0 },
            ceiling: { 'paint.ภายนอก': 5, 'paint.ภายใน': 6, 'paint.ไม้ระแนง': 7 },
        }));
        expect([a.ceilingExterior, a.ceilingInterior, a.ceilingSlat, a.skim]).toEqual([5, 6, 7, 0]);
    });
    it('a source that reports 0 is used (0), not replaced by the Excel fallback', () => {
        const a = paintAreas(input(), zeroSources);
        expect([a.wallExterior, a.wallInterior, a.ceilingExterior, a.ceilingInterior, a.ceilingSlat]).toEqual([0, 0, 0, 0, 0]);
    });
    it('one missing output falls back to Excel for that line only', () => {
        const a = paintAreas(input(), ctxOf({ plaster: { exterior: 10 } }));
        expect(a.wallExterior).toBe(10);
        expect(a.wallInterior).toBe(PAINT_EXCEL_FALLBACK.wallInterior);
        expect(a.ceilingInterior).toBe(PAINT_EXCEL_FALLBACK.ceilingInterior);
        expect(a.skim).toBeCloseTo(10 + 314.7825, 9);
    });
    it('a NaN / Infinity source value is ignored in favour of the fallback — no NaN leaks', () => {
        const a = paintAreas(input(), ctxOf({ plaster: { exterior: Number.NaN, interior: Number.POSITIVE_INFINITY } }));
        expect(a.wallExterior).toBe(PAINT_EXCEL_FALLBACK.wallExterior);
        expect(a.wallInterior).toBe(PAINT_EXCEL_FALLBACK.wallInterior);
        for (const v of Object.values(a)) expect(Number.isFinite(v)).toBe(true);
    });
    it('paintLinkedSources reports which lines come from a calculator', () => {
        expect(paintLinkedSources(none)).toEqual({ plaster: false, ceilingExterior: false, ceilingInterior: false, ceilingSlat: false });
        expect(paintLinkedSources(zeroSources)).toEqual({ plaster: true, ceilingExterior: true, ceilingInterior: true, ceilingSlat: true });
        expect(paintLinkedSources(ctxOf({ plaster: { interior: 1 } })).plaster).toBe(true);
    });
});

describe('paint — suggestions from the source sheets (D20: never applied automatically)', () => {
    const wf = ctxOf({ 'wall-finishing': { slatWallArea: 8.1, 'moulding.0.3': 13, 'moulding.0.1': 11 }, roofing: { fasciaLength: 62.3 } });
    it('reads slat area, moulding length per size and fascia length', () => {
        const s = paintSuggestions(wf);
        expect(s.slatWallArea).toBe(8.1);
        expect(s.mouldingLength('0.3')).toBe(13);
        expect(s.mouldingLength(' 0.1 ')).toBe(11);
        expect(s.mouldingLength('')).toBeUndefined();
        expect(s.mouldingLength('9.9')).toBeUndefined();
        expect(s.fasciaLength).toBe(62.3);
    });
    it('without sources there is nothing to suggest', () => {
        const s = paintSuggestions(none);
        expect(s.slatWallArea).toBeUndefined();
        expect(s.fasciaLength).toBeUndefined();
        expect(pendingPaintSuggestions(paint.defaults(), s)).toBe(0);
        expect(applyPaintSuggestions(paint.defaults(), s)).toEqual(paint.defaults());
    });
    it('blank input with all sources present: 4 pending (slat, two mouldings, fascia); applying fills them', () => {
        const b = paint.blank?.() ?? input();
        const s = paintSuggestions(wf);
        expect(pendingPaintSuggestions(b, s)).toBe(4);
        const applied = applyPaintSuggestions(b, s);
        expect(applied.slatWallArea).toBe(8.1);
        expect(applied.mouldings.map(m => m.length)).toEqual([13, 11]);
        expect(applied.fasciaLength).toBe(62.3);
        expect(applied.fasciaHeight).toBe(0.23);
        expect(pendingPaintSuggestions(applied, s)).toBe(0);
        const a = paintAreas(applied, zeroSources);
        expect(a.wallSlat).toBe(8.1);
        expect(a.moulding).toBeCloseTo(9.8, 12);
        expect(a.fascia).toBeCloseTo(62.3 * 0.23, 12);
    });
    it('a suggestion equal to the typed value is not pending', () => {
        const s = paintSuggestions(wf);
        expect(pendingPaintSuggestions(input({ slatWallArea: 8.1, fasciaLength: 62.3 }), s)).toBe(0);
        expect(pendingPaintSuggestions(input({ slatWallArea: 8.1, fasciaLength: 60 }), s)).toBe(1);
    });
});

describe('paint — boundaries', () => {
    it('NaN / Infinity typed values count as 0', () => {
        const a = paintAreas(input({
            slatWallArea: Number.NaN, fasciaLength: Number.POSITIVE_INFINITY, fasciaHeight: 1,
            mouldings: [{ size: '0.3', girth: Number.NaN, length: 4 }, { size: '0.1', girth: 0.3, length: Number.NEGATIVE_INFINITY }],
        }), zeroSources);
        expect([a.wallSlat, a.moulding, a.fascia]).toEqual([0, 0, 0]);
    });
    it('huge values stay finite', () => {
        const a = paintAreas(input({ slatWallArea: 1e15, fasciaLength: 1e9, fasciaHeight: 1e9 }), zeroSources);
        expect(a.wallSlat).toBe(1e15);
        expect(a.fascia).toBe(1e18);
    });
    it('decimals: 0.1 × 0.2 fascia = 0.02', () => {
        expect(paintAreas(input({ fasciaLength: 0.1, fasciaHeight: 0.2 }), zeroSources).fascia).toBeCloseTo(0.02, 12);
    });
    it('negative values pass through finite', () => {
        const a = paintAreas(input({ slatWallArea: -3 }), zeroSources);
        expect(a.wallSlat).toBe(-3);
    });
});

describe('paint — dependencies through computeProject', () => {
    it('brick → plaster → paint: a 10 × 3 wall plastered both sides gives C5 = C6 = 30 and skim 60', () => {
        const p = blankProject();
        p.calculators.brick = { walls: [brickWall('ผนังรอบบ้าน', 10, 3)] };
        for (const k of ['R223', 'R245', 'R300']) expect(boqQty(p, k), k).toBe(30);   // exterior
        for (const k of ['R224', 'R246', 'R301']) expect(boqQty(p, k), k).toBe(30);   // interior
        expect(boqQty(p, 'R231')).toBe(60);
    });
    it('plaster faces multiply the area: ผนังภายในบ้าน plastered on 2 sides interior → 2 × 20', () => {
        const p = blankProject();
        p.calculators.brick = { walls: [brickWall('ผนังภายในบ้าน', 10, 2)] };
        expect(boqQty(p, 'R224')).toBe(40);
        expect(boqQty(p, 'R223')).toBe(0);
        expect(boqQty(p, 'R231')).toBe(40);
    });
    it('more brick → more paint (monotone): 10×3 then 12×3', () => {
        const p = blankProject();
        p.calculators.brick = { walls: [brickWall('ผนังรอบบ้าน', 10, 3)] };
        const a = boqQty(p, 'R224') ?? 0;
        p.calculators.brick = { walls: [brickWall('ผนังรอบบ้าน', 12, 3)] };
        expect(boqQty(p, 'R224')).toBe(36);
        expect(a).toBe(30);
    });
    it('ceiling → paint: interior / exterior / slat lines in all three sections', () => {
        const p = blankProject();
        p.calculators.ceiling = { rows: [crow('C1', 2, 3, 'ภายใน'), crow('C3', 1, 5, 'ภายนอก'), crow('C4', 2, 2, 'ไม้ระแนง')] };
        expect([boqQty(p, 'R226'), boqQty(p, 'R248'), boqQty(p, 'R303')]).toEqual([6, 6, 6]);
        expect([boqQty(p, 'R225'), boqQty(p, 'R247'), boqQty(p, 'R302')]).toEqual([5, 5, 5]);
        expect([boqQty(p, 'R227'), boqQty(p, 'R249'), boqQty(p, 'R304')]).toEqual([4, 4, 4]);
        expect(boqQty(p, 'R231')).toBe(0);
    });
    it('a typed paint input reaches the BOQ in all three sections', () => {
        const p = blankProject();
        p.calculators.paint = input({ slatWallArea: 4, fasciaLength: 10, mouldings: [{ size: '0.3', girth: 0.5, length: 6 }] });
        expect([boqQty(p, 'R228'), boqQty(p, 'R250'), boqQty(p, 'R305')]).toEqual([4, 4, 4]);
        expect([boqQty(p, 'R229'), boqQty(p, 'R251'), boqQty(p, 'R306')]).toEqual([3, 3, 3]);
        expect(boqQty(p, 'R230')).toBeCloseTo(2.3, 12);
    });
    it('skipped plaster zeroes the wall paint lines (no Excel fallback sneaks back)', () => {
        const p = blankProject();
        p.calculators.brick = { walls: [brickWall('ผนังรอบบ้าน', 10, 3)] };
        p.journey = { plaster: 'skipped' };
        for (const k of ['R223', 'R224', 'R231']) expect(boqQty(p, k), k).toBe(0);
    });
    it('skipped ceiling zeroes the ceiling paint lines', () => {
        const p = blankProject();
        p.calculators.ceiling = { rows: [crow('C1', 2, 3, 'ภายใน')] };
        p.journey = { ceiling: 'skipped' };
        expect([boqQty(p, 'R226'), boqQty(p, 'R248'), boqQty(p, 'R303')]).toEqual([0, 0, 0]);
    });
    it('skipped paint level zeroes every paint line and overrides', () => {
        const p = createProject('sample');
        p.journey = { paint: 'skipped' };
        p.boqOverrides.R228 = { qty: 99 };
        const res = computeProject(p);
        for (const [k, v] of Object.entries(res.calcOutputs.paint ?? {})) expect(v, k).toBe(0);
        for (const l of PAINT_LINES) for (const k of l.boq) expect(boqQty(p, k), k).toBe(0);
    });
    it('sample project keeps Excel numbers: C13 = 506.605 (R231)', () => {
        expect(boqQty(createProject('sample'), 'R231')).toBeCloseTo(506.605, 6);
    });
});
