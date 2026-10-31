// QA edge tests (group U5) — ตกแต่งผนัง_Wall Finishing. Spec docs/excel-spec/04 §4 + oddity O-2 (decision D1:
// R218 = บัว 0.3 length, R219 = บัว 0.1 length). Moulding length F = D + E; slat area G = D × E;
// moulding paint area = length × (face + 2 × 0.1): 0.3 → ×0.5, 0.1 → ×0.3.
import { describe, expect, it } from 'vitest';
import {
    wallFinishing, wallFinishingLength, wallFinishingArea, wallFinishingKind, mouldingLength, slatArea,
    newMouldingRow, newSlatRow, setMouldingLength, replaceRowsOfKind,
    MOULDING_0_1, MOULDING_0_3, SLAT_WALL, WALL_FINISHING_ITEMS, WALL_FINISHING_CODES, MOULDINGS,
    type WallFinishingRow,
} from '.';
import { computeProject, createProject, type Project } from '../../project';

const ctx = { outputs: () => undefined };
const row = (item: string, width: number, length: number, code = 'P2'): WallFinishingRow =>
    ({ code, item, width, length, location: '' });
const out = (rows: WallFinishingRow[]) => wallFinishing.compute({ rows }, ctx);

const projectWith = (rows: WallFinishingRow[]): Project => {
    const p = createProject('blank');
    p.calculators['wall-finishing'] = { rows };
    return p;
};
const boqQty = (p: Project, key: string): number | undefined => {
    for (const s of computeProject(p).boq.sections) {
        for (const x of s.rows) if (x.type === 'item' && x.key === key) return x.qty;
    }
    return undefined;
};

describe('wall-finishing — blank()', () => {
    it('is an empty table; outputs finite and 0; BOQ-linked outputs 0', () => {
        expect(wallFinishing.blank?.()).toEqual({ rows: [] });
        const o = out([]);
        for (const [k, v] of Object.entries(o)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        for (const l of wallFinishing.boqLinks) expect(o[l.output], l.line).toBe(0);
        expect(o.mouldingPaintArea).toBe(0);
        expect(o.slatWallArea).toBe(0);
    });
    it('BOQ R218–R220 are 0 in a blank project', () => {
        const p = createProject('blank');
        expect([boqQty(p, 'R218'), boqQty(p, 'R219'), boqQty(p, 'R220')]).toEqual([0, 0, 0]);
    });
});

describe('wall-finishing — each item alone', () => {
    it('moulding 0.3 typed in E: 13 m → R218 = 13, R219 = 0', () => {
        const o = out([row(MOULDING_0_3, 0, 13)]);
        expect([o.R218, o.R219, o.R220]).toEqual([13, 0, 0]);
        expect(o['moulding.0.3']).toBe(13);
        expect(o[`moulding.${MOULDING_0_3}`]).toBe(13);
    });
    it('moulding 0.1: 11 m → R219 = 11, R218 = 0 (D1: not swapped like Excel)', () => {
        const o = out([row(MOULDING_0_1, 0, 11)]);
        expect([o.R218, o.R219, o.R220]).toEqual([0, 11, 0]);
        expect(o['moulding.0.1']).toBe(11);
    });
    it('slat wall 1.65 × 2 = 3.3 → R220', () => {
        const o = out([row(SLAT_WALL, 1.65, 2, 'P4')]);
        expect([o.R218, o.R219, o.R220]).toEqual([0, 0, 3.3]);
        expect(o.slatWallArea).toBeCloseTo(3.3, 12);
    });
    it('moulding length = D + E (Excel F = D+E), e.g. 5 + 2.5 = 7.5', () => {
        expect(wallFinishingLength(row(MOULDING_0_3, 5, 2.5))).toBe(7.5);
        expect(out([row(MOULDING_0_3, 5, 2.5)]).R218).toBe(7.5);
    });
    it('slat area ignores a moulding row and moulding length ignores a slat row', () => {
        expect(wallFinishingArea(row(MOULDING_0_3, 2, 3))).toBeNull();
        expect(wallFinishingLength(row(SLAT_WALL, 2, 3))).toBeNull();
        const o = out([row(MOULDING_0_3, 2, 3), row(SLAT_WALL, 2, 3, 'P4')]);
        expect([o.R218, o.R220]).toEqual([5, 6]);
    });
    it('an unknown / empty item feeds nothing and has no length or area', () => {
        const x = row('อื่นๆ', 3, 3);
        expect(wallFinishingLength(x)).toBeNull();
        expect(wallFinishingArea(x)).toBeNull();
        expect(wallFinishingKind(x)).toBe('other');
        expect(wallFinishingKind(row('', 3, 3))).toBe('other');
        const o = out([x, row('', 1, 1)]);
        expect([o.R218, o.R219, o.R220]).toEqual([0, 0, 0]);
    });
    it('item text is compared trimmed (Excel dropdown values carry trailing spaces)', () => {
        const o = out([row(`${MOULDING_0_3} `, 0, 4), row(` ${SLAT_WALL}`, 1, 2, 'P4')]);
        expect([o.R218, o.R220]).toEqual([4, 2]);
    });
    it('every dropdown option and code is accepted; code is informational', () => {
        expect(WALL_FINISHING_ITEMS).toEqual([MOULDING_0_1, MOULDING_0_3, SLAT_WALL]);
        expect(WALL_FINISHING_CODES).toEqual(['P1', 'P2', 'P3', 'P4']);
        for (const code of WALL_FINISHING_CODES) {
            const a = out([row(MOULDING_0_3, 0, 2, code), row(SLAT_WALL, 1, 2, code)]);
            expect([a.R218, a.R220], code).toEqual([2, 2]);
        }
        expect(MOULDINGS.map(m => m.key)).toEqual(['0.3', '0.1']);
    });
    it('boq links', () => {
        expect(wallFinishing.boqLinks.map(l => [l.line, l.field, l.output])).toEqual([
            ['R218', 'qty', 'R218'], ['R219', 'qty', 'R219'], ['R220', 'qty', 'R220'],
        ]);
    });
});

describe('wall-finishing — paint area of mouldings (paint sheet C11)', () => {
    it('0.3 moulding: length × (0.3 + 0.2) = 13 × 0.5 = 6.5', () => {
        expect(out([row(MOULDING_0_3, 0, 13)]).mouldingPaintArea).toBeCloseTo(6.5, 12);
    });
    it('0.1 moulding: length × (0.1 + 0.2) = 11 × 0.3 = 3.3', () => {
        expect(out([row(MOULDING_0_1, 0, 11)]).mouldingPaintArea).toBeCloseTo(3.3, 12);
    });
    it('both: (0.5 × 13) + (0.3 × 11) = 9.8 (Excel C11)', () => {
        expect(out([row(MOULDING_0_3, 0, 13), row(MOULDING_0_1, 0, 11)]).mouldingPaintArea).toBeCloseTo(9.8, 12);
    });
    it('slat rows add nothing to the moulding paint area', () => {
        expect(out([row(SLAT_WALL, 5, 5, 'P4')]).mouldingPaintArea).toBe(0);
    });
});

describe('wall-finishing — boundaries', () => {
    it('zeros', () => {
        const o = out([row(MOULDING_0_3, 0, 0), row(SLAT_WALL, 0, 5, 'P4'), row(SLAT_WALL, 5, 0, 'P4')]);
        expect([o.R218, o.R219, o.R220]).toEqual([0, 0, 0]);
    });
    it('decimals: slat 0.35 × 2.2 = 0.77; moulding 0.1 + 0.2 = 0.3', () => {
        expect(out([row(SLAT_WALL, 0.35, 2.2, 'P4')]).R220).toBeCloseTo(0.77, 12);
        expect(out([row(MOULDING_0_1, 0.1, 0.2)]).R219).toBeCloseTo(0.3, 12);
    });
    it('huge values finite', () => {
        const o = out([row(SLAT_WALL, 1e8, 1e8, 'P4'), row(MOULDING_0_3, 0, 1e15)]);
        expect(o.R220).toBe(1e16);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });
    it('NaN / ±Infinity count as 0', () => {
        const o = out([
            row(MOULDING_0_3, Number.NaN, 4), row(MOULDING_0_1, 0, Number.POSITIVE_INFINITY),
            row(SLAT_WALL, Number.NEGATIVE_INFINITY, 2, 'P4'),
        ]);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        expect([o.R218, o.R219, o.R220]).toEqual([4, 0, 0]);
    });
    it('negative values pass through, finite', () => {
        expect(Number.isFinite(out([row(SLAT_WALL, -2, 3, 'P4')]).R220)).toBe(true);
    });
});

describe('wall-finishing — table sizes', () => {
    it('empty / 1 / Excel 11 / more than Excel 50 / delete', () => {
        expect(out([]).R218).toBe(0);
        expect(out([row(MOULDING_0_3, 0, 1)]).R218).toBe(1);
        const make = (n: number) => Array.from({ length: n }, (_, i) => {
            const k = i % 3;
            return k === 0 ? row(MOULDING_0_3, 0, 1) : k === 1 ? row(MOULDING_0_1, 0, 2) : row(SLAT_WALL, 1, 3, 'P4');
        });
        const o11 = out(make(11));      // 4 × 0.3-moulding, 4 × 0.1-moulding, 3 × slat
        expect([o11.R218, o11.R219, o11.R220]).toEqual([4, 8, 9]);
        const o51 = out(make(51));
        expect([o51.R218, o51.R219, o51.R220]).toEqual([17, 34, 51]);
        const left = make(51).filter((_, i) => i % 3 !== 2);
        expect(out(left).R220).toBe(0);
        expect(out(left).R218).toBe(17);
    });
    it('Excel sample regression: 13 / 11 / 3.3 + 4.8', () => {
        const o = wallFinishing.compute(wallFinishing.defaults(), ctx);
        expect([o.R218, o.R219]).toEqual([13, 11]);
        expect(o.R220).toBeCloseTo(8.1, 12);
    });
});

describe('wall-finishing — helpers', () => {
    it('mouldingLength / slatArea totals', () => {
        const input = { rows: [row(MOULDING_0_3, 0, 2), row(MOULDING_0_3, 1, 1), row(SLAT_WALL, 2, 2, 'P4')] };
        expect(mouldingLength(input, MOULDING_0_3)).toBe(4);
        expect(mouldingLength(input, MOULDING_0_1)).toBe(0);
        expect(slatArea(input)).toBe(4);
    });
    it('newMouldingRow / newSlatRow are blank (area 0) with the sample codes', () => {
        expect(newMouldingRow()).toMatchObject({ code: 'P2', item: MOULDING_0_3, width: 0, length: 0 });
        expect(newMouldingRow(MOULDING_0_1).item).toBe(MOULDING_0_1);
        expect(newSlatRow()).toMatchObject({ code: 'P4', item: SLAT_WALL, width: 0, length: 0 });
        expect(out([newMouldingRow(), newSlatRow()]).R220).toBe(0);
    });
    it('setMouldingLength clears the width so F equals what was typed', () => {
        const x = setMouldingLength(row(MOULDING_0_3, 9, 9), 6);
        expect(wallFinishingLength(x)).toBe(6);
    });
    it('replaceRowsOfKind keeps other kinds in place; extra rows go last; missing rows drop', () => {
        const a = row(MOULDING_0_3, 0, 1);
        const b = row(SLAT_WALL, 1, 1, 'P4');
        const c = row(MOULDING_0_1, 0, 3);
        const input = { rows: [a, b, c] };
        const edited = replaceRowsOfKind(input, 'moulding', [row(MOULDING_0_3, 0, 10)]);
        expect(edited.rows).toEqual([row(MOULDING_0_3, 0, 10), b]);
        const grown = replaceRowsOfKind(input, 'moulding', [a, c, row(MOULDING_0_3, 0, 5)]);
        expect(grown.rows).toEqual([a, b, c, row(MOULDING_0_3, 0, 5)]);
        expect(replaceRowsOfKind(input, 'slat', []).rows).toEqual([a, c]);
    });
});

describe('wall-finishing — through computeProject', () => {
    it('rows reach BOQ R218 / R219 / R220', () => {
        const p = projectWith([row(MOULDING_0_3, 0, 7), row(MOULDING_0_1, 0, 3), row(SLAT_WALL, 2, 2.5, 'P4')]);
        expect([boqQty(p, 'R218'), boqQty(p, 'R219'), boqQty(p, 'R220')]).toEqual([7, 3, 5]);
    });
    it('skipped level zeroes outputs (incl. slat / moulding paint feeds) and the BOQ lines', () => {
        const p = projectWith([row(MOULDING_0_3, 0, 7), row(SLAT_WALL, 2, 2.5, 'P4')]);
        p.journey = { 'wall-finishing': 'skipped' };
        p.boqOverrides.R220 = { qty: 12 };
        const res = computeProject(p);
        for (const [k, v] of Object.entries(res.calcOutputs['wall-finishing'] ?? {})) expect(v, k).toBe(0);
        expect([boqQty(p, 'R218'), boqQty(p, 'R219'), boqQty(p, 'R220')]).toEqual([0, 0, 0]);
    });
    it('does not auto-change paint (D20 not approved): paint lines C10/C11 stay as typed', () => {
        const base = boqQty(projectWith([]), 'R228');
        const p = projectWith([row(SLAT_WALL, 2, 2.5, 'P4')]);
        expect(boqQty(p, 'R228')).toBe(base);
    });
    it('sample project: Excel quantities 13 / 11 / 8.1', () => {
        const p = createProject('sample');
        expect([boqQty(p, 'R218'), boqQty(p, 'R219')]).toEqual([13, 11]);
        expect(boqQty(p, 'R220')).toBeCloseTo(8.1, 12);
    });
});
