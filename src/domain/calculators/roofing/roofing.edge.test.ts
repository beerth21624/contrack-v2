// QA edge tests (group U3) for the roofing calculator: blank, one input at a time, rounding boundaries,
// decision table of take-off kinds and units, tables (0 / 1 / Excel 13 / more / delete) and BOQ + journey skip.
// Every expected value is computed by hand from docs/excel-spec/03-roof-brick-plaster-doors.md section 3, never by the code under test.
import { describe, expect, it } from 'vitest';
import {
    ROOFING_BOQ_ROWS, ROOFING_FACTOR_UNITS, ROOFING_ITEMS, ROOFING_TAKEOFF_UNITS, roofing, roofingOp, roofingQty,
    roofingTakeoffs, slopeArea, withRoofSlope, type RoofingInput, type RoofingRow, type RoofingTakeoff,
} from '.';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const blank = (): RoofingInput => roofing.blank?.() ?? roofing.defaults();
const LINES = Array.from({ length: 15 }, (_, i) => `R${162 + i}`);

/** Replaces the take-off of row `key`. */
function setTakeoff(input: RoofingInput, key: string, takeoff: RoofingTakeoff): RoofingInput {
    return { ...input, rows: input.rows.map(r => (r.key === key ? { ...r, takeoff } : r)) };
}
const setLengths = (input: RoofingInput, key: string, lengths: number[]) => setTakeoff(input, key, { kind: 'lengths', lengths });
const idx = (input: RoofingInput, key: string) => input.rows.findIndex(r => r.key === key);

const mkRow = (p: Partial<RoofingRow> = {}): RoofingRow => ({
    key: 'x', item: '', factor: 1, factorUnit: 'แผ่น', takeoff: { kind: 'lengths', lengths: [] }, takeoffUnit: 'ม.', unit: 'แผ่น', ...p,
});

function runProject(input: RoofingInput | undefined, opts: { blankProject?: boolean; skipped?: boolean; qtyOverride?: Record<string, number> } = {}) {
    const p = createProject(opts.blankProject === false ? 'sample' : 'blank');
    if (input) p.calculators.roofing = input;
    if (opts.skipped) p.journey = { roofing: 'skipped' };
    for (const [k, v] of Object.entries(opts.qtyOverride ?? {})) p.boqOverrides[k] = { qty: v };
    const res = computeProject(p);
    const sec = res.boq.sections.find(s => s.no === 16);
    const row = (key: string): BoqItemRow => {
        const r = sec?.rows.find(x => x.key === key);
        if (r?.type !== 'item') throw new Error(`no BOQ row ${key}`);
        return r;
    };
    return { res, sec, row };
}

describe('roofing edge: blank()', () => {
    it('blank has 13 rows, zero plan area and pitch', () => {
        const b = blank();
        expect(b.planArea).toBe(0);
        expect(b.slopeDeg).toBe(0);
        expect(b.rows).toHaveLength(ROOFING_BOQ_ROWS);
    });
    it('every output is finite and every BOQ-linked output is 0', () => {
        const out = roofing.compute(blank(), ctx);
        for (const [k, v] of Object.entries(out)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of roofing.boqLinks) expect(out[l.output], l.line).toBe(0);
        expect(out.slopeArea).toBe(0);
        expect(out.fasciaLength).toBe(0);
    });
    it('blank project: section 16 has no money at all (all rows qty 0, section total 0)', () => {
        const { sec, row } = runProject(undefined);
        for (const l of LINES) { expect(row(l).qty, l).toBe(0); expect(row(l).total, l).toBe(0); }
        expect(sec?.matTotal).toBe(0);
        expect(sec?.labTotal).toBe(0);
        expect(sec?.total).toBe(0);
    });
});

describe('roofing edge: plan area and slope (K7 = K5 / cos K6)', () => {
    it.each([
        // planArea, slope deg, K7 by hand
        [100, 0, 100],
        [100, 30, 115.47005383792515],   // 100 / 0.8660254
        [100, 45, 141.4213562373095],    // 100 * sqrt(2)
        [50, 60, 100],                   // cos 60 = 0.5
        [113, 40, 147.5110237],          // Excel sample
        [0, 40, 0],
        [100.5, 20, 106.94987],          // 100.5 / 0.9396926
    ])('area %f, slope %f deg -> K7 %f', (area, deg, k7) => {
        expect(slopeArea({ planArea: area, slopeDeg: deg })).toBeCloseTo(k7, 4);
        const out = roofing.compute({ ...blank(), planArea: area, slopeDeg: deg }, ctx);
        expect(out.slopeArea).toBeCloseTo(k7, 4);
        expect(out.R175).toBeCloseTo(k7, 4);   // roofing labour = K7
    });
    it('area 100, slope 0: tiles 11/m2 = 1100, foil 100/75 -> 2 rolls', () => {
        const out = roofing.compute({ ...blank(), planArea: 100 }, ctx);
        expect(out.R162).toBe(1100);
        expect(out.R174).toBe(2);
    });
    it('slope 30: tiles ROUNDUP(115.47005 x 11) = 1271, foil ROUNDUP(115.47/75) = 2', () => {
        const out = roofing.compute({ ...blank(), planArea: 100, slopeDeg: 30 }, ctx);
        expect(out.R162).toBe(1271);
        expect(out.R174).toBe(2);
    });
    it('a negative slope behaves like the positive one (cosine is even)', () => {
        expect(slopeArea({ planArea: 100, slopeDeg: -30 })).toBeCloseTo(115.47005383792515, 9);
    });
    it('slope 90 and beyond never gives NaN / Infinity', () => {
        for (const deg of [90, 89.999, 180, 270, 360, 1e6]) {
            const out = roofing.compute({ ...blank(), planArea: 100, slopeDeg: deg }, ctx);
            for (const [k, v] of Object.entries(out)) expect(Number.isFinite(v), `${deg} deg ${k}`).toBe(true);
        }
    });
    it('a pitch of 90 deg or more is not a roof: no slope area instead of ~1e16 times the plan (or a negative one)', () => {
        for (const deg of [90, 120, 180, 270, -90]) expect(slopeArea({ planArea: 100, slopeDeg: deg }), `${deg} deg`).toBe(0);
        expect(slopeArea({ planArea: 100, slopeDeg: 89.9 })).toBeCloseTo(100 / Math.cos((89.9 * Math.PI) / 180), 6);
        expect(slopeArea({ planArea: 100, slopeDeg: 360 })).toBeCloseTo(100, 9);
    });
    it('non-finite typed numbers count as 0 (NaN, Infinity)', () => {
        for (const bad of [Number.NaN, Infinity, -Infinity]) {
            const out = roofing.compute({ ...blank(), planArea: bad, slopeDeg: bad }, ctx);
            expect(out.slopeArea).toBe(0);
            for (const v of Object.values(out)) expect(Number.isFinite(v)).toBe(true);
        }
    });
    it('negative and decimal plan areas stay finite; a huge roof stays finite', () => {
        expect(roofing.compute({ ...blank(), planArea: -10 }, ctx).slopeArea).toBe(-10);
        expect(roofing.compute({ ...blank(), planArea: 0.001 }, ctx).R162).toBe(1);   // 0.011 -> ROUNDUP 1
        const huge = roofing.compute({ ...blank(), planArea: 1e12, slopeDeg: 40 }, ctx);
        for (const v of Object.values(huge)) expect(Number.isFinite(v)).toBe(true);
        expect(huge.slopeArea).toBeCloseTo(1.3054e12, -9);   // 1e12 / 0.7660444
    });
    it('withRoofSlope(blank, 35) leaves lengths empty and sets K6', () => {
        const w = withRoofSlope(blank(), 35);
        expect(w.slopeDeg).toBe(35);
        expect(roofing.compute(w, ctx).R164).toBe(0);
    });
});

describe('roofing edge: ridge / gable / eave lengths and pieces', () => {
    it('ridge lengths sum then x 3.3 pieces/m: [2.4, 9.2, 6.6, 0.9] = 19.1 -> 63.03 -> 64', () => {
        const out = roofing.compute(setLengths(blank(), 'ridge', [2.4, 9.2, 6.6, 0.9]), ctx);
        expect(out['takeoff.1']).toBeCloseTo(19.1, 9);
        expect(out.R163).toBe(64);
    });
    it('ridge boundary: 10 m x 3.3 = 33 (IEEE gives 33.000000000000004, tolerance keeps 33); 10.01 m -> 34', () => {
        expect(roofing.compute(setLengths(blank(), 'ridge', [10]), ctx).R163).toBe(33);
        expect(roofing.compute(setLengths(blank(), 'ridge', [10.01]), ctx).R163).toBe(34);
    });
    it('ridge: a single 0 length or an empty list gives 0 pieces', () => {
        expect(roofing.compute(setLengths(blank(), 'ridge', [0]), ctx).R163).toBe(0);
        expect(roofing.compute(setLengths(blank(), 'ridge', []), ctx).R163).toBe(0);
    });
    it('ridge: ROUNDUP of a tiny positive length is 1 piece (0.01 x 3.3 = 0.033)', () => {
        expect(roofing.compute(setLengths(blank(), 'ridge', [0.01]), ctx).R163).toBe(1);
    });
    it('gable rake: [5] at 0 deg = 5 -> x 3 = 15', () => {
        const out = roofing.compute(setTakeoff(blank(), 'rake', { kind: 'rake', lengths: [5], deg: 0 }), ctx);
        expect(out['takeoff.2']).toBe(5);
        expect(out.R164).toBe(15);
    });
    it('gable rake: [5] at 40 deg = 6.52704 -> x 3 = 19.58 -> 20', () => {
        const out = roofing.compute(setTakeoff(blank(), 'rake', { kind: 'rake', lengths: [5], deg: 40 }), ctx);
        expect(out['takeoff.2']).toBeCloseTo(6.527036, 5);
        expect(out.R164).toBe(20);
    });
    it('gable rake boundary: [5] at 60 deg = 10 m exactly -> 30 (cos 60 = 0.5000000000000001 must not push it to 31)', () => {
        const out = roofing.compute(setTakeoff(blank(), 'rake', { kind: 'rake', lengths: [5], deg: 60 }), ctx);
        expect(out.R164).toBe(30);
    });
    it('rake uses its own pitch, not the roof pitch K6 (Excel hard-codes 40 deg, oddity 14)', () => {
        const input = { ...setTakeoff(blank(), 'rake', { kind: 'rake', lengths: [5], deg: 40 }), slopeDeg: 20 };
        expect(roofing.compute(input, ctx).R164).toBe(20);
    });
    it('rake: lengths sum before dividing by cosine (3 segments of 2 m at 0 deg = 6 -> 18)', () => {
        const out = roofing.compute(setTakeoff(blank(), 'rake', { kind: 'rake', lengths: [2, 2, 2], deg: 0 }), ctx);
        expect(out.R164).toBe(18);
    });
    it('eave end cap (1 piece per point): [8] -> 8, [3, 4.5] = 7.5 -> 8 (ROUNDUP)', () => {
        expect(roofing.compute(setLengths(blank(), 'eave-end', [8]), ctx).R166).toBe(8);
        expect(roofing.compute(setLengths(blank(), 'eave-end', [3, 4.5]), ctx).R166).toBe(8);
    });
    it('gable end cap and 2-way hip each 1 piece per point', () => {
        const input = setLengths(setLengths(blank(), 'gable-end', [5]), 'two-way', [1]);
        const out = roofing.compute(input, ctx);
        expect(out.R167).toBe(5);
        expect(out.R168).toBe(1);
    });
    it('wall cover 3 pieces/m: [7.2] = 21.6 -> 22', () => {
        expect(roofing.compute(setLengths(blank(), 'wall', [7.2]), ctx).R165).toBe(22);
    });
    it('valley [5.09, 5.09] / 2 m per piece = 5.09 -> 6; bird stop 0.5 m per piece: 22.6 / 0.5 = 45.2 -> 46', () => {
        const input = setLengths(setLengths(blank(), 'valley', [5.09, 5.09]), 'bird-stop', [12.5, 3, 2.6, 3, 1.5]);
        const out = roofing.compute(input, ctx);
        expect(out.R171).toBe(6);
        expect(out.R172).toBe(46);
    });
    it('fascia 62.3 m / 4 m per board = 15.575 -> 16, and labour length R176 = 62.3', () => {
        const out = roofing.compute(setLengths(blank(), 'fascia', [62.3]), ctx);
        expect(out.R173).toBe(16);
        expect(out.R176).toBe(62.3);
        expect(out.fasciaLength).toBe(62.3);
    });
    it('divide by exact multiple: fascia 8 m / 4 = 2 (not 3)', () => {
        expect(roofing.compute(setLengths(blank(), 'fascia', [8]), ctx).R173).toBe(2);
    });
    it('linked rows: DRYTECH follows the ridge length / 3, wall set follows wall / 4.8', () => {
        const input = setLengths(setLengths(blank(), 'ridge', [9]), 'wall', [9.6]);
        const out = roofing.compute(input, ctx);
        expect(out.R169).toBe(3);   // 9 / 3
        expect(out.R170).toBe(2);   // 9.6 / 4.8
        const more = setLengths(setLengths(blank(), 'ridge', [9.1]), 'wall', [9.7]);
        expect(roofing.compute(more, ctx).R169).toBe(4);   // 3.03
        expect(roofing.compute(more, ctx).R170).toBe(3);   // 2.02
    });
});

describe('roofing edge: decision table of the multiply / divide rule and factor units', () => {
    it.each([
        ['ตร.ม./ม้วน', 'div'], ['แผ่น/ตร.ม.', 'mul'], ['แผ่น/ม.', 'mul'], ['ม./แผ่น', 'div'], ['แผ่น', 'mul'],
        ['', 'mul'], [' ม./แผ่น ', 'div'], ['xyz', 'mul'],
    ])('roofingOp(%j) = %s', (unit, op) => {
        expect(roofingOp(unit)).toBe(op);
    });
    it('every factor unit option is covered by the decision table', () => {
        expect(ROOFING_FACTOR_UNITS.map(roofingOp)).toEqual(['div', 'mul', 'mul', 'div', 'mul']);
    });
    it.each([
        // factor unit, take-off 10, factor 4: mul = 40, div = ROUNDUP(2.5) = 3
        ['ตร.ม./ม้วน', 3], ['แผ่น/ตร.ม.', 40], ['แผ่น/ม.', 40], ['ม./แผ่น', 3], ['แผ่น', 40],
    ])('unit %s with take-off 10 and factor 4 -> %d', (u, q) => {
        expect(roofingQty(mkRow({ factor: 4, factorUnit: u }), 10)).toBe(q);
    });
    it('factor 0: multiply gives 0, divide gives 0 (no #DIV/0!)', () => {
        expect(roofingQty(mkRow({ factor: 0, factorUnit: 'แผ่น/ม.' }), 10)).toBe(0);
        expect(roofingQty(mkRow({ factor: 0, factorUnit: 'ม./แผ่น' }), 10)).toBe(0);
    });
    it('negative and NaN factor: finite', () => {
        expect(Number.isFinite(roofingQty(mkRow({ factor: -3, factorUnit: 'ม./แผ่น' }), 10))).toBe(true);
        expect(roofingQty(mkRow({ factor: Number.NaN, factorUnit: 'แผ่น/ม.' }), 10)).toBe(0);
        expect(roofingQty(mkRow({ factor: Number.NaN, factorUnit: 'ม./แผ่น' }), 10)).toBe(0);
    });
    it('rounding edge: 6.6 / 3.3 is 2 in decimal arithmetic -> 2 pieces, 6.61 / 3.3 -> 3', () => {
        expect(roofingQty(mkRow({ factor: 3.3, factorUnit: 'ม./แผ่น' }), 6.6)).toBe(2);
        expect(roofingQty(mkRow({ factor: 3.3, factorUnit: 'ม./แผ่น' }), 6.61)).toBe(3);
    });
    it('every take-off unit can be chosen without changing the number', () => {
        for (const tu of ROOFING_TAKEOFF_UNITS) {
            expect(roofingQty(mkRow({ factor: 2, factorUnit: 'แผ่น/ม.', takeoffUnit: tu }), 5)).toBe(10);
        }
        expect([...ROOFING_TAKEOFF_UNITS]).toEqual(['ตร.ม.', 'ม.', 'จุด']);
    });
});

describe('roofing edge: take-off kinds (slope / lengths / rake / row)', () => {
    const rows = (...r: RoofingRow[]): RoofingInput => ({ planArea: 100, slopeDeg: 0, rows: r });
    it('slope kind equals K7', () => {
        expect(roofingTakeoffs(rows(mkRow({ takeoff: { kind: 'slope' } })))).toEqual([100]);
    });
    it('row reference chain a -> b -> c with c = [6] gives 6 everywhere', () => {
        const input = rows(
            mkRow({ key: 'a', takeoff: { kind: 'row', ref: 'b' } }),
            mkRow({ key: 'b', takeoff: { kind: 'row', ref: 'c' } }),
            mkRow({ key: 'c', takeoff: { kind: 'lengths', lengths: [6] } }),
        );
        expect(roofingTakeoffs(input)).toEqual([6, 6, 6]);
    });
    it('missing reference, self reference and a 2-cycle count as 0 (no crash, no NaN)', () => {
        expect(roofingTakeoffs(rows(mkRow({ key: 'a', takeoff: { kind: 'row', ref: 'zzz' } })))).toEqual([0]);
        expect(roofingTakeoffs(rows(mkRow({ key: 'a', takeoff: { kind: 'row', ref: 'a' } })))).toEqual([0]);
        const cyc = rows(
            mkRow({ key: 'a', takeoff: { kind: 'row', ref: 'b' } }),
            mkRow({ key: 'b', takeoff: { kind: 'row', ref: 'a' } }),
        );
        expect(roofingTakeoffs(cyc)).toEqual([0, 0]);
    });
    it('a row reference to a slope row follows K7 (50 m2 at 60 deg = 100)', () => {
        const input = { ...rows(mkRow({ key: 'a', takeoff: { kind: 'slope' } }), mkRow({ key: 'b', takeoff: { kind: 'row', ref: 'a' } })), slopeDeg: 60, planArea: 50 };
        const t = roofingTakeoffs(input);
        expect(t[0]).toBeCloseTo(100, 9);
        expect(t[1]).toBeCloseTo(100, 9);
    });
    it('typed lengths with NaN / Infinity entries ignore them', () => {
        expect(roofingTakeoffs(rows(mkRow({ takeoff: { kind: 'lengths', lengths: [1, Number.NaN, Infinity, 2] } })))).toEqual([3]);
    });
    it('decimal lengths add up the way a calculator would (0.1 + 0.2 + 5.7 = 6)', () => {
        const t = roofingTakeoffs(rows(mkRow({ takeoff: { kind: 'lengths', lengths: [0.1, 0.2, 5.7] } })));
        expect(t[0]).toBeCloseTo(6, 9);
    });
    it('negative length reduces the total', () => {
        expect(roofingTakeoffs(rows(mkRow({ takeoff: { kind: 'lengths', lengths: [10, -4] } })))).toEqual([6]);
    });
});

describe('roofing edge: dropdown items and BOQ text', () => {
    it.each([...ROOFING_ITEMS])('item "%s" flows to BOQ D162 text, trimmed', (item) => {
        const input = { ...blank(), rows: blank().rows.map((r, i) => (i === 0 ? { ...r, item: `  ${item}  ` } : r)) };
        const text = roofing.boqText?.(input, ctx);
        expect(text?.R162?.desc).toBe(item);
    });
    it('the 16 items of the dropdown are unique and carry no trailing space', () => {
        expect(new Set(ROOFING_ITEMS).size).toBe(16);
        for (const i of ROOFING_ITEMS) expect(i).toBe(i.trim());
    });
    it('empty purchase unit is left out of the BOQ text; a typed unit is kept', () => {
        const input = { ...blank(), rows: blank().rows.map((r, i) => (i === 0 ? { ...r, unit: ' ' } : r)) };
        const text = roofing.boqText?.(input, ctx);
        expect(text?.R162).toEqual({ desc: 'กระเบื้องหลังคาซีแพคโมเนีย' });
        expect(text?.R163?.unit).toBe('แผ่น');
        expect(text?.R174?.unit).toBe('ม้วน');
    });
});

describe('roofing edge: table size (0 / 1 / 13 / more than Excel / delete row)', () => {
    it('no rows at all: every BOQ quantity is 0 and nothing throws', () => {
        const out = roofing.compute({ planArea: 100, slopeDeg: 30, rows: [] }, ctx);
        for (const l of roofing.boqLinks.filter(x => x.line !== 'R175')) expect(out[l.output], l.line).toBe(0);
        expect(out.R175).toBeCloseTo(115.47005383792515, 9);   // labour still follows the roof area
        expect(out.R176).toBe(0);
    });
    it('one row feeds R162 only; later BOQ lines stay 0', () => {
        const out = roofing.compute({ planArea: 100, slopeDeg: 0, rows: [mkRow({ factor: 11, factorUnit: 'แผ่น/ตร.ม.', takeoff: { kind: 'slope' } })] }, ctx);
        expect(out.R162).toBe(1100);
        for (let i = 163; i <= 174; i++) expect(out[`R${i}`], `R${i}`).toBe(0);
    });
    it('rows beyond the 13 BOQ rows are computed (qty.13) but do not reach any BOQ line', () => {
        const base = roofing.defaults();
        const extra = mkRow({ key: 'extra', factor: 2, factorUnit: 'แผ่น/ม.', takeoff: { kind: 'lengths', lengths: [10] } });
        const out = roofing.compute({ ...base, rows: [...base.rows, extra] }, ctx);
        const ref = roofing.compute(base, ctx);
        expect(out['qty.13']).toBe(20);
        for (const l of LINES) expect(out[l], l).toBe(ref[l]);
    });
    it('Excel max: 17 rows (5-21) all compute', () => {
        const base = roofing.defaults();
        const more = Array.from({ length: 4 }, (_, i) => mkRow({ key: `m${i}`, factor: 1, factorUnit: 'แผ่น', takeoff: { kind: 'lengths', lengths: [i + 1] } }));
        const out = roofing.compute({ ...base, rows: [...base.rows, ...more] }, ctx);
        expect([out['qty.13'], out['qty.14'], out['qty.15'], out['qty.16']]).toEqual([1, 2, 3, 4]);
    });
    it('deleting the first row shifts every row up one BOQ line (BOQ follows position, like Excel)', () => {
        const base = roofing.defaults();
        const out = roofing.compute({ ...base, rows: base.rows.slice(1) }, ctx);
        expect(out.R162).toBe(64);    // the ridge row is now first
        expect(out.R173).toBe(2);     // the foil row slid into the fascia line
        expect(out.R174).toBe(0);     // 13th line has no row
    });
    it('deleting a row above the fascia row keeps R176 / fasciaLength on the fascia take-off (found by key; fixed, docs/qa/BUGS.md)', () => {
        const base = roofing.defaults();
        const out = roofing.compute({ ...base, rows: base.rows.slice(1) }, ctx);
        expect(out.R176).toBeCloseTo(62.3, 9);
        expect(out.fasciaLength).toBeCloseTo(62.3, 9);
    });
    it('deleting the last row only zeroes the last BOQ line', () => {
        const base = roofing.defaults();
        const out = roofing.compute({ ...base, rows: base.rows.slice(0, 12) }, ctx);
        expect(out.R174).toBe(0);
        expect(out.R162).toBe(1623);
    });
});

describe('roofing edge: through computeProject (BOQ money)', () => {
    it('area 100, flat: tile R162 net 1100, gross ROUNDUP(1100 x 1.05) = 1155, material 12.5 x 1155 = 14,437.5', () => {
        const { row } = runProject({ ...blank(), planArea: 100 });
        const r = row('R162');
        expect(r.qty).toBe(1100);
        expect(r.grossQty).toBe(1155);
        expect(r.matTotal).toBe(14437.5);
        expect(r.labTotal).toBe(0);
    });
    it('foil R174: net 2, gross ROUNDUP(2.1) = 3, material 1680 x 3 = 5,040', () => {
        const { row } = runProject({ ...blank(), planArea: 100 });
        expect(row('R174').qty).toBe(2);
        expect(row('R174').grossQty).toBe(3);
        expect(row('R174').matTotal).toBe(5040);
    });
    it('roofing labour R175 = 150 x 100 = 15,000 and fascia labour R176 = 100 x 62.3 = 6,230 (labour on net qty)', () => {
        const { row } = runProject(setLengths({ ...blank(), planArea: 100 }, 'fascia', [62.3]));
        expect(row('R175').labTotal).toBe(15000);
        expect(row('R176').labTotal).toBeCloseTo(6230, 9);
    });
    it('ridge 10 m: R163 net 33, gross ROUNDUP(33 x 1.05 = 34.65) = 35, material 38 x 35 = 1,330', () => {
        const { row } = runProject(setLengths(blank(), 'ridge', [10]));
        expect(row('R163').qty).toBe(33);
        expect(row('R163').grossQty).toBe(35);
        expect(row('R163').matTotal).toBe(1330);
    });
    it('section total equals the sum of its rows and mat + lab', () => {
        const { sec } = runProject(roofing.defaults(), { blankProject: false });
        const sum = (sec?.rows ?? []).reduce((s, r) => s + (r.type === 'item' ? r.total : 0), 0);
        expect(sec?.total).toBeCloseTo(sum, 6);
        expect(sec?.total).toBeCloseTo((sec?.matTotal ?? 0) + (sec?.labTotal ?? 0), 6);
    });
    it('level skipped (journey.roofing = skipped): every line of section 16 is qty 0 even with a full roof', () => {
        const { sec, row } = runProject(roofing.defaults(), { skipped: true });
        for (const l of LINES) { expect(row(l).qty, l).toBe(0); expect(row(l).total, l).toBe(0); }
        expect(sec?.total).toBe(0);
    });
    it('skipped level ignores a quantity typed on the BOQ page', () => {
        const { row } = runProject(roofing.defaults(), { skipped: true, qtyOverride: { R162: 500 } });
        expect(row('R162').qty).toBe(0);
        expect(row('R162').total).toBe(0);
    });
    it('a level that is not skipped uses a quantity typed on the BOQ page', () => {
        const { row } = runProject({ ...blank(), planArea: 100 }, { qtyOverride: { R162: 500 } });
        expect(row('R162').qty).toBe(500);
    });
    it('skipped roofing zeroes slope area, and with it roof-structure rafters / purlins - pinned, see report', () => {
        const { res } = runProject(roofing.defaults(), { skipped: true });
        expect(res.calcOutputs.roofing?.slopeArea).toBe(0);
        expect(res.calcOutputs.roofing?.fasciaLength).toBe(0);
        expect(res.calcOutputs['roof-structure']?.R156).toBe(0);
        expect(res.calcOutputs['roof-structure']?.R159).toBe(0);
    });
    it('changing the roof size moves roof-structure rafters (dependency roofing -> roof-structure)', () => {
        const a = runProject({ ...blank(), planArea: 100 }).res.calcOutputs['roof-structure'];
        const b = runProject({ ...blank(), planArea: 200 }).res.calcOutputs['roof-structure'];
        expect(a?.['rafter.area']).toBe(100);
        expect(b?.['rafter.area']).toBe(200);
        expect(a?.R156).toBe(20);   // ROUNDUP((100/1 x 1.15) / 6) = ROUNDUP(19.17)
        expect(b?.R156).toBe(39);   // ROUNDUP(230 / 6) = ROUNDUP(38.33)
    });
    it('sample row keys are unique and the fascia row is at index 11', () => {
        const keys = roofing.defaults().rows.map(r => r.key);
        expect(new Set(keys).size).toBe(keys.length);
        expect(idx(roofing.defaults(), 'fascia')).toBe(11);
    });
});
