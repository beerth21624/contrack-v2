// QA edge tests (group U5) — ปูกระเบื้องห้องน้ำ_Toilet. Spec docs/excel-spec/04 §3.
// I = IF(COUNTA(E:G)=0, "", PRODUCT(IF(x=" ",1,x) …) − H) — Google-Sheets semantics (ORACLE_TESTS.md): blank
// dimensions are skipped by PRODUCT (desktop Excel would give 0). BOQ E210 = SUMIF(B,"F3",I), E211 = SUMIF(B,"P3",I).
import { describe, expect, it } from 'vitest';
import {
    toiletTile, toiletTileArea, toiletTileTotal, toiletRowKind, newToiletRow, newBathroomRows, bathroomGroups,
    roomPerimeter, bathroomPerimeter, nextBathroomName, setBathroomFloorSize, renameBathroom,
    TOILET_TILE_CODES, TOILET_TILE_ITEMS, TOILET_TILE_SURFACES, SAMPLE_OPENINGS, type ToiletTileRow,
} from '.';
import { computeProject, createProject, type Project } from '../../project';

const ctx = { outputs: () => undefined };
const row = (p: Partial<ToiletTileRow> & { code: string }): ToiletTileRow => ({ surface: '', item: '', location: '', ...p });
const out = (rows: ToiletTileRow[]) => toiletTile.compute({ rows }, ctx);

const projectWith = (rows: ToiletTileRow[]): Project => {
    const p = createProject('blank');
    p.calculators['toilet-tile'] = { rows };
    return p;
};
const boqQty = (p: Project, key: string): number | undefined => {
    for (const s of computeProject(p).boq.sections) {
        for (const x of s.rows) if (x.type === 'item' && x.key === key) return x.qty;
    }
    return undefined;
};

describe('toilet-tile — blank()', () => {
    it('is an empty table; outputs finite and 0', () => {
        expect(toiletTile.blank?.()).toEqual({ rows: [] });
        const o = out([]);
        for (const [k, v] of Object.entries(o)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
        for (const l of toiletTile.boqLinks) expect(o[l.output], l.line).toBe(0);
    });
    it('BOQ R210 / R211 are 0 in a blank project', () => {
        const p = createProject('blank');
        expect([boqQty(p, 'R210'), boqQty(p, 'R211')]).toEqual([0, 0]);
    });
});

describe('toilet-tile — floor (F3) alone', () => {
    it('width × length: 2 × 3 = 6', () => {
        const o = out([row({ code: 'F3', width: 2, length: 3 })]);
        expect([o.floorArea, o.wallArea, o.R210, o.R211]).toEqual([6, 0, 6, 0]);
    });
    it('decimals: 1.8 × 2.15 = 3.87', () => {
        expect(out([row({ code: 'F3', width: 1.8, length: 2.15 })]).R210).toBeCloseTo(3.87, 12);
    });
    it('several bathrooms add', () => {
        const o = out([row({ code: 'F3', width: 2, length: 3 }), row({ code: 'F3', width: 1, length: 1.5 })]);
        expect(o.R210).toBe(7.5);
    });
});

describe('toilet-tile — wall (P3): perimeter × height − openings', () => {
    it('perimeter 10 × height 2.4 − openings 2.3 = 21.7', () => {
        const o = out([row({ code: 'P3', length: 10, height: 2.4, openings: 2.3 })]);
        expect(o.R211).toBeCloseTo(21.7, 12);
        expect(o.R210).toBe(0);
    });
    it('no openings: 10 × 2.4 = 24', () => {
        expect(out([row({ code: 'P3', length: 10, height: 2.4 })]).R211).toBeCloseTo(24, 12);
    });
    it('openings 0 explicit equals blank', () => {
        expect(out([row({ code: 'P3', length: 10, height: 2.4, openings: 0 })]).R211)
            .toBe(out([row({ code: 'P3', length: 10, height: 2.4 })]).R211);
    });
    it('sample openings 0.7×2 + 0.5×1.8 = 2.3', () => {
        expect(SAMPLE_OPENINGS).toBeCloseTo(2.3, 12);
    });
    it('Excel sample wall 1: 2 × (2.3 + 3) = 10.6; 10.6 × 2.4 − 2.3 = 23.14', () => {
        const o = out([row({ code: 'P3', length: 2 * (2.3 + 3), height: 2.4, openings: SAMPLE_OPENINGS })]);
        expect(o.R211).toBeCloseTo(23.14, 12);
    });
    it('three dimensions multiply: 2 × 3 × 2.5 − 1 = 14', () => {
        expect(toiletTileArea(row({ code: 'P3', width: 2, length: 3, height: 2.5, openings: 1 }))).toBe(14);
    });
    it('openings larger than the wall give a finite (negative) area — never NaN', () => {
        const a = toiletTileArea(row({ code: 'P3', length: 1, height: 1, openings: 5 }));
        expect(a).toBe(-4);
    });
});

describe('toilet-tile — Google-Sheets PRODUCT semantics for blank cells (I5:I8)', () => {
    it('all of W, L, H blank → "" (null), counts 0 in the SUMIF', () => {
        expect(toiletTileArea(row({ code: 'F3' }))).toBeNull();
        expect(out([row({ code: 'F3' })]).R210).toBe(0);
    });
    it('openings alone does not make a row (COUNTA(E:G)=0)', () => {
        expect(toiletTileArea(row({ code: 'P3', openings: 2 }))).toBeNull();
        expect(out([row({ code: 'P3', openings: 2 })]).R211).toBe(0);
    });
    it('only length filled: product = length', () => {
        expect(toiletTileArea(row({ code: 'F3', length: 4 }))).toBe(4);
    });
    it('only width filled: product = width', () => {
        expect(toiletTileArea(row({ code: 'F3', width: 4 }))).toBe(4);
    });
    it('only height filled: product = height', () => {
        expect(toiletTileArea(row({ code: 'P3', height: 2.4 }))).toBe(2.4);
    });
    it('width + height filled, length blank: product of the two', () => {
        expect(toiletTileArea(row({ code: 'P3', width: 2, height: 3 }))).toBe(6);
    });
    it('explicit 0 is a filled value: product 0 (not skipped)', () => {
        expect(toiletTileArea(row({ code: 'F3', width: 0, length: 5 }))).toBe(0);
        expect(toiletTileArea(row({ code: 'F3', width: 0 }))).toBe(0);
    });
    it('NaN / Infinity dimensions are treated as blank (skipped), never propagate', () => {
        expect(toiletTileArea(row({ code: 'F3', width: Number.NaN, length: 3 }))).toBe(3);
        expect(toiletTileArea(row({ code: 'F3', width: Number.POSITIVE_INFINITY, length: Number.NaN }))).toBeNull();
        expect(toiletTileArea(row({ code: 'P3', length: 5, height: 2, openings: Number.NaN }))).toBe(10);
    });
});

describe('toilet-tile — code matching (SUMIF)', () => {
    it('code is compared trimmed and case-insensitively', () => {
        expect(toiletTileTotal({ rows: [row({ code: ' f3 ', width: 2, length: 2 })] }, 'F3')).toBe(4);
        expect(toiletTileTotal({ rows: [row({ code: 'p3', length: 2, height: 2 })] }, 'P3')).toBe(4);
    });
    it('unknown or empty code feeds neither BOQ line', () => {
        const o = out([row({ code: '', width: 5, length: 5 }), row({ code: 'F1', width: 5, length: 5 })]);
        expect([o.R210, o.R211]).toEqual([0, 0]);
    });
    it('every dropdown option is accepted: codes, surfaces and items', () => {
        expect(TOILET_TILE_CODES).toEqual(['F3', 'P3']);
        expect(TOILET_TILE_SURFACES).toEqual(['พื้น', 'ผนัง']);
        expect(TOILET_TILE_ITEMS).toHaveLength(2);
        for (const code of TOILET_TILE_CODES) {
            for (const surface of TOILET_TILE_SURFACES) {
                for (const item of TOILET_TILE_ITEMS) {
                    // surface and item are informational: the area follows the code only
                    const o = out([row({ code, surface, item, width: 2, length: 3 })]);
                    expect(code === 'F3' ? o.R210 : o.R211, `${code}/${surface}/${item}`).toBe(6);
                    expect(code === 'F3' ? o.R211 : o.R210).toBe(0);
                }
            }
        }
    });
});

describe('toilet-tile — boundaries', () => {
    it('zero everywhere → 0', () => {
        expect(out([row({ code: 'F3', width: 0, length: 0 }), row({ code: 'P3', length: 0, height: 0 })]).R210).toBe(0);
    });
    it('huge sizes stay finite', () => {
        const o = out([row({ code: 'P3', length: 1e8, height: 1e8 })]);
        expect(o.R211).toBe(1e16);
    });
    it('negative size is passed through (finite)', () => {
        expect(Number.isFinite(out([row({ code: 'F3', width: -2, length: 3 })]).R210)).toBe(true);
    });
});

describe('toilet-tile — table sizes', () => {
    it('empty / 1 / Excel 11 / more than Excel 40 / delete', () => {
        expect(out([]).R210).toBe(0);
        expect(out([row({ code: 'F3', width: 1, length: 1 })]).R210).toBe(1);
        const make = (n: number) => Array.from({ length: n }, (_, i) =>
            (i % 2 === 0 ? row({ code: 'F3', width: 1, length: 2 }) : row({ code: 'P3', length: 4, height: 2 })));
        expect(out(make(11)).R210).toBe(12);
        expect(out(make(11)).R211).toBe(40);
        const o = out(make(40));
        expect([o.R210, o.R211]).toEqual([40, 160]);
        const rows = make(40).filter((_, i) => i >= 2);
        expect(out(rows).R210).toBe(38);
    });
    it('sample regression: floor 10.5, wall 39.98', () => {
        const o = toiletTile.compute(toiletTile.defaults(), ctx);
        expect(o.R210).toBeCloseTo(10.5, 9);
        // (10.6 + 7.6) × 2.4 − 2 × 2.3 = 43.68 − 4.6
        expect(o.R211).toBeCloseTo(39.08, 9);
    });
});

describe('toilet-tile — bathroom helpers', () => {
    it('newToiletRow / newBathroomRows give blank F3 + P3 rows with no area', () => {
        const rows = newBathroomRows('ห้องน้ำ 1');
        expect(rows.map(toiletRowKind)).toEqual(['floor', 'wall']);
        expect(rows.every(x => toiletTileArea(x) === null)).toBe(true);
        expect(newToiletRow('floor', 'x').item).toBe(TOILET_TILE_ITEMS[0]);
        expect(newToiletRow('wall', 'x').item).toBe(TOILET_TILE_ITEMS[1]);
        expect(out(rows)).toEqual({ floorArea: 0, wallArea: 0, R210: 0, R211: 0 });
    });
    it('toiletRowKind: F3 floor, P3 wall, else other (trim + case-insensitive)', () => {
        expect(toiletRowKind(row({ code: ' f3' }))).toBe('floor');
        expect(toiletRowKind(row({ code: 'p3 ' }))).toBe('wall');
        expect(toiletRowKind(row({ code: 'X' }))).toBe('other');
        expect(toiletRowKind(row({ code: '' }))).toBe('other');
    });
    it('roomPerimeter: 2 × (W + L); undefined until both filled', () => {
        expect(roomPerimeter({ width: 2, length: 3 })).toBe(10);
        expect(roomPerimeter({ width: 2 })).toBeUndefined();
        expect(roomPerimeter({ length: 3 })).toBeUndefined();
        expect(roomPerimeter({ width: Number.NaN, length: 3 })).toBeUndefined();
        expect(roomPerimeter({ width: 0, length: 0 })).toBe(0);
    });
    it('bathroomPerimeter needs exactly one floor row', () => {
        const f = (w: number, l: number) => row({ code: 'F3', width: w, length: l, location: 'A' });
        expect(bathroomPerimeter({ rows: [f(2, 3)] }, 'A')).toBe(10);
        expect(bathroomPerimeter({ rows: [f(2, 3), f(1, 1)] }, 'A')).toBeUndefined();
        expect(bathroomPerimeter({ rows: [] }, 'A')).toBeUndefined();
    });
    it('bathroomGroups groups by trimmed location in order of first appearance', () => {
        const rows = [row({ code: 'F3', location: ' A ' }), row({ code: 'F3', location: 'B' }), row({ code: 'P3', location: 'A' }), row({ code: 'P3', location: '' })];
        expect(bathroomGroups({ rows })).toEqual([
            { name: 'A', rows: [0, 2] }, { name: 'B', rows: [1] }, { name: '', rows: [3] },
        ]);
        expect(bathroomGroups({ rows: [] })).toEqual([]);
    });
    it('nextBathroomName skips used names', () => {
        expect(nextBathroomName({ rows: [] })).toBe('ห้องน้ำ 1');
        expect(nextBathroomName({ rows: [row({ code: 'F3', location: 'ห้องน้ำ 2' })] })).toBe('ห้องน้ำ 3');
    });
    it('setBathroomFloorSize with an out-of-range index changes nothing', () => {
        const input = { rows: newBathroomRows('A') };
        expect(setBathroomFloorSize(input, 9, { width: 3 })).toBe(input);
    });
    it('setBathroomFloorSize: wall length follows only while blank or still 2(W+L)', () => {
        let input = { rows: newBathroomRows('A') };
        input = setBathroomFloorSize(input, 0, { width: 2, length: 3 });
        expect(input.rows[1]?.length).toBe(10);
        input = setBathroomFloorSize(input, 0, { width: 3 });
        expect(input.rows[1]?.length).toBe(12);
        input = { rows: input.rows.map((x, i) => (i === 1 ? { ...x, length: 5 } : x)) };
        input = setBathroomFloorSize(input, 0, { width: 4 });
        expect(input.rows[1]?.length).toBe(5);
    });
    it('renameBathroom to an empty name leaves the rows in the "" group', () => {
        const input = renameBathroom({ rows: newBathroomRows('A') }, 'A', '');
        expect(bathroomGroups(input)).toEqual([{ name: '', rows: [0, 1] }]);
    });
});

describe('toilet-tile — through computeProject', () => {
    it('floor and wall rows reach BOQ R210 / R211', () => {
        const p = projectWith([row({ code: 'F3', width: 2, length: 3 }), row({ code: 'P3', length: 10, height: 2.4, openings: 2.4 })]);
        expect(boqQty(p, 'R210')).toBe(6);
        expect(boqQty(p, 'R211')).toBeCloseTo(21.6, 12);
    });
    it('skipped level zeroes outputs and BOQ lines (even a typed override)', () => {
        const p = projectWith([row({ code: 'F3', width: 2, length: 3 })]);
        p.journey = { 'toilet-tile': 'skipped' };
        p.boqOverrides.R210 = { qty: 7 };
        const res = computeProject(p);
        for (const [k, v] of Object.entries(res.calcOutputs['toilet-tile'] ?? {})) expect(v, k).toBe(0);
        expect([boqQty(p, 'R210'), boqQty(p, 'R211')]).toEqual([0, 0]);
    });
    it('sample project equals the sample outputs', () => {
        const p = createProject('sample');
        expect(boqQty(p, 'R210')).toBeCloseTo(10.5, 9);
    });
});
