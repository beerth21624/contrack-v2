// QA edge tests (group U5) — ปูกระเบื้องพื้น_Floor Tile. Spec docs/excel-spec/04 §2:
// F = D*E; BOQ E205/E206/E207 = SUMIF(B, "F1"/"F3"/"F4", F). The sheet has no waste/box constants of its own
// (prices and waste sit in the BOQ template), so only areas are tested here.
import { describe, expect, it } from 'vitest';
import {
    floorTile, floorTileAreaByCode, floorTileRowArea, STAIR_RUN,
    FLOOR_TILE_CODES, FLOOR_TILE_DESCRIPTIONS, FLOOR_TILE_DESCRIPTION_ORDER, type FloorTileRow,
} from '.';
import { ceiling, type CeilingRow } from '../ceiling';
import { roomsFromCeiling } from '@/features/calculators/floor-tile/fromCeiling';
import { computeProject, createProject, type Project } from '../../project';

const ctx = { outputs: () => undefined };
const r = (code: FloorTileRow['code'], width: number, length: number, location = ''): FloorTileRow =>
    ({ code, width, length, location });
const out = (rows: FloorTileRow[]) => floorTile.compute({ rows }, ctx);

const projectWith = (rows: FloorTileRow[]): Project => {
    const p = createProject('blank');
    p.calculators['floor-tile'] = { rows };
    return p;
};
const boqQty = (p: Project, key: string): number | undefined => {
    for (const s of computeProject(p).boq.sections) {
        for (const row of s.rows) if (row.type === 'item' && row.key === key) return row.qty;
    }
    return undefined;
};

describe('floor-tile — blank()', () => {
    it('is an empty table', () => {
        expect(floorTile.blank?.()).toEqual({ rows: [] });
    });
    it('all outputs finite and 0; BOQ-linked outputs 0', () => {
        const o = floorTile.compute(floorTile.blank?.() ?? { rows: [] }, ctx);
        for (const [k, v] of Object.entries(o)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        for (const l of floorTile.boqLinks) expect(o[l.output], l.line).toBe(0);
    });
    it('BOQ lines R205–R207 are 0 in a blank project', () => {
        const p = createProject('blank');
        for (const k of ['R205', 'R206', 'R207']) expect(boqQty(p, k), k).toBe(0);
    });
});

describe('floor-tile — each code alone', () => {
    it('F1 only: 3 × 4 = 12', () => {
        const o = out([r('F1', 3, 4)]);
        expect([o.R205, o.R206, o.R207]).toEqual([12, 0, 0]);
        expect(o.total).toBe(12);
    });
    it('F3 only (non-slip): 1.5 × 2 = 3', () => {
        const o = out([r('F3', 1.5, 2)]);
        expect([o.R205, o.R206, o.R207]).toEqual([0, 3, 0]);
    });
    it('F4 only (levelling / waterproofing): 5 × 5 = 25', () => {
        const o = out([r('F4', 5, 5)]);
        expect([o.R205, o.R206, o.R207]).toEqual([0, 0, 25]);
    });
    it('every dropdown code has its own output, description; there is no F2 (Excel has none)', () => {
        expect(FLOOR_TILE_CODES).toEqual(['F1', 'F3', 'F4']);
        for (const c of FLOOR_TILE_CODES) {
            expect(out([r(c, 2, 2)])[c], c).toBe(4);
            expect(FLOOR_TILE_DESCRIPTIONS[c].length).toBeGreaterThan(5);
        }
        expect([...FLOOR_TILE_DESCRIPTION_ORDER].sort()).toEqual([...FLOOR_TILE_CODES].sort());
        expect(floorTileAreaByCode({ rows: [r('F1', 2, 2)] }, 'F2' as 'F1')).toBe(0);
    });
    it('rows of one code add, other codes untouched', () => {
        const o = out([r('F1', 1, 1), r('F1', 2, 2), r('F3', 3, 1), r('F4', 1, 6)]);
        expect([o.F1, o.F3, o.F4]).toEqual([5, 3, 6]);
        expect(o.total).toBe(14);
    });
    it('a row without a code is in total only, never in a BOQ line', () => {
        const o = out([r('', 2, 5)]);
        expect([o.R205, o.R206, o.R207]).toEqual([0, 0, 0]);
        expect(o.total).toBe(10);
    });
    it('boq links', () => {
        expect(floorTile.boqLinks.map(l => [l.line, l.field, l.output])).toEqual([
            ['R205', 'qty', 'R205'], ['R206', 'qty', 'R206'], ['R207', 'qty', 'R207'],
        ]);
    });
});

describe('floor-tile — boundaries', () => {
    it('zero width or length → 0', () => {
        expect(floorTileRowArea(r('F1', 0, 4))).toBe(0);
        expect(floorTileRowArea(r('F1', 4, 0))).toBe(0);
    });
    it('decimals: 0.45 × 0.9 = 0.405; stair run 0.9 + 0.45 = 1.35', () => {
        expect(floorTileRowArea(r('F1', 0.45, 0.9))).toBeCloseTo(0.405, 12);
        expect(STAIR_RUN).toBeCloseTo(1.35, 12);
        expect(floorTileRowArea(r('F3', 3.3, STAIR_RUN))).toBeCloseTo(4.455, 12);
    });
    it('huge sizes stay finite', () => {
        const o = out([r('F1', 1e7, 1e7)]);
        expect(o.R205).toBe(1e14);
        expect(Number.isFinite(o.total)).toBe(true);
    });
    it('NaN / ±Infinity count as 0 — no NaN reaches the BOQ', () => {
        const o = out([r('F1', Number.NaN, 3), r('F3', Number.POSITIVE_INFINITY, 2), r('F4', 2, Number.NEGATIVE_INFINITY)]);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        expect([o.R205, o.R206, o.R207]).toEqual([0, 0, 0]);
    });
    it('negative size stays finite (Excel D*E would be negative)', () => {
        const o = out([r('F1', -2, 3)]);
        expect(Number.isFinite(o.R205)).toBe(true);
        expect(o.R205).toBe(-6);
    });
    it('a typed length like =0.9+0.45 is stored as a value and used as is', () => {
        expect(floorTileRowArea(r('F3', 2, 0.9 + 0.45))).toBeCloseTo(2.7, 12);
    });
});

describe('floor-tile — table sizes', () => {
    const make = (n: number) => Array.from({ length: n }, (_, i) => r(FLOOR_TILE_CODES[i % 3] ?? 'F1', 1, 2));
    it('empty / 1 / Excel 30 / more than Excel 90', () => {
        expect(out([]).total).toBe(0);
        expect(out([r('F1', 1, 1)]).total).toBe(1);
        expect(out(make(30)).total).toBe(60);
        const o = out(make(90));
        expect([o.F1, o.F3, o.F4]).toEqual([60, 60, 60]);
    });
    it('deleting rows lowers only their code', () => {
        const rows = make(9);
        const o = out(rows.filter((_, i) => i % 3 !== 0));   // drop all F1
        expect([o.F1, o.F3, o.F4]).toEqual([0, 6, 6]);
        expect(out([]).R205).toBe(0);
    });
    it('Excel sample regression: F1 = 72.25', () => {
        expect(floorTile.compute(floorTile.defaults(), ctx).R205).toBeCloseTo(72.25, 9);
    });
});

describe('floor-tile — through computeProject', () => {
    it('rows reach BOQ R205–R207 qty', () => {
        const p = projectWith([r('F1', 3, 4), r('F3', 2, 2), r('F4', 1, 5)]);
        expect([boqQty(p, 'R205'), boqQty(p, 'R206'), boqQty(p, 'R207')]).toEqual([12, 4, 5]);
    });
    it('skipped level zeroes outputs and BOQ lines, even with a typed qty override', () => {
        const p = projectWith([r('F1', 3, 4), r('F3', 2, 2)]);
        p.journey = { 'floor-tile': 'skipped' };
        p.boqOverrides.R205 = { qty: 50 };
        const res = computeProject(p);
        for (const [k, v] of Object.entries(res.calcOutputs['floor-tile'] ?? {})) expect(v, k).toBe(0);
        for (const k of ['R205', 'R206', 'R207']) expect(boqQty(p, k), k).toBe(0);
    });
    it('is independent of the ceiling calculator inside computeProject (the link is a copy action)', () => {
        const p = projectWith([r('F1', 3, 4)]);
        const rows: CeilingRow[] = [{ code: 'C1', width: 9, length: 9, location: 'x', paint: 'ภายใน' }];
        p.calculators.ceiling = { rows };
        expect(boqQty(p, 'R205')).toBe(12);
    });
});

describe('floor-tile — ceiling → floor link (roomsFromCeiling)', () => {
    const crow = (code: CeilingRow['code'], w: number, l: number, location: string, slope?: number): CeilingRow =>
        (slope === undefined ? { code, width: w, length: l, location, paint: '' } : { code, width: w, length: l, location, paint: '', slope });
    it('copies plan size (no slope factor) with the usual floor code per ceiling type', () => {
        const res = roomsFromCeiling([
            crow('C1', 3, 4, 'ห้อง A'), crow('C2', 1, 3.5, 'เฉลียง', 40), crow('C4', 2, 2, 'ระแนง'), crow('', 1, 1, 'ไม่ระบุ'),
        ], []);
        expect(res.rows.map(x => x.code)).toEqual(['F1', 'F3', 'F3', 'F1']);
        const o = out(res.rows);
        expect(o.F1).toBe(12 + 1);
        expect(o.F3).toBe(3.5 + 4);
    });
    it('eaves (C3) and bathrooms are not copied; they are counted', () => {
        const res = roomsFromCeiling([crow('C3', 0.6, 62.3, 'ชายคา'), crow('C2', 2, 2, 'ห้องน้ำ 1'), crow('C1', 2, 2, 'WC'), crow('C1', 2, 2, 'ส้วม')], []);
        expect(res.rows).toEqual([]);
        expect(res.skippedEaves).toBe(1);
        expect(res.skippedBathrooms).toBe(3);
    });
    it('names already on the floor list are skipped (trim-insensitive); unnamed empty rows are dropped', () => {
        const res = roomsFromCeiling(
            [crow('C1', 2, 2, ' ครัว '), crow('C1', 0, 0, ''), crow('C1', 2, 3, '')],
            [r('F1', 2, 2, 'ครัว')],
        );
        expect(res.skippedExisting).toBe(1);
        expect(res.rows).toEqual([{ code: 'F1', width: 2, length: 3, location: '' }]);
    });
    it('copying the sample ceiling gives the sample F1 area (72.25), eaves excluded', () => {
        const res = roomsFromCeiling(ceiling.defaults().rows, []);
        expect(out(res.rows).F1).toBeCloseTo(72.25, 9);
    });
    it('empty ceiling → no rows', () => {
        expect(roomsFromCeiling([], []).rows).toEqual([]);
    });
});
