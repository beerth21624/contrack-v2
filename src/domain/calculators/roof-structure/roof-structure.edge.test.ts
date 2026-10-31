// QA edge tests (group U3) for roof-structure: blank, each member alone, stick rounding boundaries (ROUNDUP(I/6)),
// dropdowns (ซีคู่ 1/2, Factor Roof 1.15/1.10/1.05/1.00), area link to roofing, tables, BOQ money and journey skip.
// Expected values are hand-computed from docs/excel-spec/03-roof-brick-plaster-doors.md section 2.
import { describe, expect, it } from 'vitest';
import {
    areaTotal, DOUBLE_C_OPTIONS, linkedSlopeArea, partTotal, ROOF_FACTOR_OPTIONS, roofStructure, sticks, STICK_LENGTH,
    valleyLength, type AreaMember, type RoofStructureInput,
} from '.';
import { roofing, type RoofingInput } from '../roofing';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const blank = (): RoofStructureInput => roofStructure.blank?.() ?? roofStructure.defaults();
/** ctx with the roofing output "slopeArea" (what roofing publishes). */
const withRoof = (slopeArea: number) => ({ outputs: (id: string) => (id === 'roofing' ? { slopeArea } : undefined) });
const noRoof = { outputs: () => undefined };
const LINES = ['R152', 'R153', 'R154', 'R155', 'R156', 'R157', 'R159'];

function runProject(rs?: RoofStructureInput, roof?: RoofingInput, opts: { skipped?: boolean } = {}) {
    const p = createProject('blank');
    if (rs) p.calculators['roof-structure'] = rs;
    if (roof) p.calculators.roofing = roof;
    if (opts.skipped) p.journey = { 'roof-structure': 'skipped' };
    const res = computeProject(p);
    const sec = res.boq.sections.find(s => s.no === 15);
    const row = (key: string): BoqItemRow => {
        const r = sec?.rows.find(x => x.key === key);
        if (r?.type !== 'item') throw new Error(`no BOQ row ${key}`);
        return r;
    };
    return { res, sec, row, out: res.calcOutputs['roof-structure'] };
}
const flatRoof = (area: number): RoofingInput => ({ ...(roofing.blank?.() ?? roofing.defaults()), planArea: area });

describe('roof-structure edge: blank()', () => {
    it('with a blank roofing sheet every output is finite and every BOQ-linked output is 0', () => {
        const out = roofStructure.compute(blank(), withRoof(0));
        for (const [k, v] of Object.entries(out)) expect(Number.isFinite(v), k).toBe(true);
        for (const l of roofStructure.boqLinks) expect(out[l.output], l.line).toBe(0);
    });
    it('blank project end to end: R152-R157 and R159 are 0 (rafter/purlin area comes from blank roofing = 0)', () => {
        const { out, row } = runProject();
        for (const l of LINES) { expect(out?.[l], l).toBe(0); expect(row(l).qty, l).toBe(0); expect(row(l).total, l).toBe(0); }
    });
    it('blank keeps the steel sections, factor 1.15 and spacings 1 / 0.34', () => {
        const b = blank();
        expect(b.rafter).toMatchObject({ c: 1, factor: 1.15, area: null, spacing: 1 });
        expect(b.purlin).toMatchObject({ c: 1, factor: 1.15, area: null, spacing: 0.34 });
        expect(b.wallPlate).toMatchObject({ c: 2, count: 1, lengths: [] });
        expect(b.kingPosts.parts).toEqual([]);
        expect(b.valley).toMatchObject({ runA: 0, runB: 0, deg: 0, count: 0 });
    });
    it('without any roofing output the linked area falls back to the Excel sample 147.511 (documented fallback)', () => {
        expect(linkedSlopeArea(noRoof)).toBeCloseTo(147.5110237, 6);
        expect(roofStructure.compute(blank(), noRoof).R159).toBeCloseTo(147.5110237, 6);
    });
});

describe('roof-structure edge: stick rounding ROUNDUP(I / 6)', () => {
    it.each([
        [0, 0], [0.001, 1], [5.99, 1], [6, 1], [6.0000000001, 1], [6.01, 2], [12, 2], [12.0001, 3], [60, 10], [-6, -1], [-0.5, 0],
    ])('total length %f m -> %d sticks', (len, n) => {
        expect(sticks(len)).toBe(n);
    });
    it('stick length is 6 m', () => {
        expect(STICK_LENGTH).toBe(6);
    });
    it('NaN / Infinity length counts as 0', () => {
        expect(sticks(Number.NaN)).toBe(0);
        expect(sticks(Infinity)).toBe(0);
    });
    it('float noise: wall plate segments 0.1 + 0.2 + 5.7 (= 6.000000000000001 in IEEE) still need 1 stick', () => {
        const input = { ...blank(), wallPlate: { ...blank().wallPlate, c: 1, lengths: [0.1, 0.2, 5.7] } };
        expect(roofStructure.compute(input, withRoof(0)).R152).toBe(1);
    });
});

describe('roof-structure edge: wall plate (I = count x sum of lengths x C)', () => {
    it('[6, 6] count 1 double C: 12 x 2 = 24 m -> 4 sticks', () => {
        const input = { ...blank(), wallPlate: { ...blank().wallPlate, lengths: [6, 6] } };
        const out = roofStructure.compute(input, withRoof(0));
        expect(out['wallPlate.length']).toBe(12);
        expect(out['wallPlate.total']).toBe(24);
        expect(out.R152).toBe(4);
    });
    it('single C: [6] -> 6 m -> exactly 1 stick; [6.01] -> 2', () => {
        const mk = (l: number) => ({ ...blank(), wallPlate: { ...blank().wallPlate, c: 1, lengths: [l] } });
        expect(roofStructure.compute(mk(6), withRoof(0)).R152).toBe(1);
        expect(roofStructure.compute(mk(6.01), withRoof(0)).R152).toBe(2);
    });
    it('count 3 lines of 2 m, single C = 6 m -> 1 stick; count 0 -> 0', () => {
        const mk = (count: number) => ({ ...blank(), wallPlate: { ...blank().wallPlate, c: 1, lengths: [2], count } });
        expect(roofStructure.compute(mk(3), withRoof(0)).R152).toBe(1);
        expect(roofStructure.compute(mk(0), withRoof(0)).R152).toBe(0);
    });
    it('Excel sample segments sum to 92.9 m x 2 = 185.8 -> 31 sticks', () => {
        const out = roofStructure.compute(roofStructure.defaults(), withRoof(147.5110237));
        expect(out['wallPlate.length']).toBeCloseTo(92.9, 9);
        expect(out['wallPlate.total']).toBeCloseTo(185.8, 9);
        expect(out.R152).toBe(31);
    });
    it('negative or NaN length values stay finite', () => {
        const input = { ...blank(), wallPlate: { ...blank().wallPlate, lengths: [Number.NaN, 6, -2] } };
        const out = roofStructure.compute(input, withRoof(0));
        expect(out['wallPlate.length']).toBe(4);
        for (const v of Object.values(out)) expect(Number.isFinite(v)).toBe(true);
    });
});

describe('roof-structure edge: ridge (I = count x sum x C)', () => {
    it('[5, 7.5] count 2 double C: 2 x 12.5 x 2 = 50 m -> 9 sticks', () => {
        const input = { ...blank(), ridge: { ...blank().ridge, lengths: [5, 7.5], count: 2 } };
        const out = roofStructure.compute(input, withRoof(0));
        expect(out['ridge.length']).toBe(12.5);
        expect(out['ridge.total']).toBe(50);
        expect(out.R154).toBe(9);
    });
    it('only lengths typed, count 1: [3] x 2 = 6 -> 1 stick', () => {
        const input = { ...blank(), ridge: { ...blank().ridge, lengths: [3] } };
        expect(roofStructure.compute(input, withRoof(0)).R154).toBe(1);
    });
});

describe('roof-structure edge: king posts (ดั้ง) group', () => {
    const part = (c: number, length: number, count: number) => ({ desc: '-', c, length, count });
    it('partTotal = count x length x C', () => {
        expect(partTotal(part(2, 1.6, 2))).toBeCloseTo(6.4, 9);
        expect(partTotal(part(1, 3, 0))).toBe(0);
        expect(partTotal(part(1, Number.NaN, 4))).toBe(0);
    });
    it('no parts: 0 sticks', () => {
        const out = roofStructure.compute(blank(), withRoof(0));
        expect(out['kingPosts.total']).toBe(0);
        expect(out.R153).toBe(0);
    });
    it('one part 3 posts x 2 m single C = 6 m -> 1 stick', () => {
        const input = { ...blank(), kingPosts: { desc: 'ดั้ง', parts: [part(1, 2, 3)] } };
        const out = roofStructure.compute(input, withRoof(0));
        expect(out['kingPosts.part.0']).toBe(6);
        expect(out.R153).toBe(1);
    });
    it('group total is the sum of parts BEFORE rounding: 2 parts of 3.5 m = 7 m -> 2 sticks (not 1 + 1)', () => {
        const input = { ...blank(), kingPosts: { desc: 'ดั้ง', parts: [part(1, 3.5, 1), part(1, 3.5, 1)] } };
        expect(roofStructure.compute(input, withRoof(0)).R153).toBe(2);
        // and 3 + 3 = 6 -> 1 stick although each part alone is half a stick
        const six = { ...blank(), kingPosts: { desc: 'ดั้ง', parts: [part(1, 3, 1), part(1, 3, 1)] } };
        expect(roofStructure.compute(six, withRoof(0)).R153).toBe(1);
    });
    it('Excel sample: 6.4 + 10.8 + 24.4 + 15.9 + 19.2 = 76.7 m -> 13 sticks', () => {
        const out = roofStructure.compute(roofStructure.defaults(), withRoof(0));
        expect(out['kingPosts.total']).toBeCloseTo(76.7, 9);
        expect(out.R153).toBe(13);
    });
    it('more parts than Excel (5): 8 parts of 1 m single C -> 8 m -> 2 sticks; each part output present', () => {
        const parts = Array.from({ length: 8 }, () => part(1, 1, 1));
        const out = roofStructure.compute({ ...blank(), kingPosts: { desc: 'ดั้ง', parts } }, withRoof(0));
        expect(out['kingPosts.total']).toBe(8);
        expect(out['kingPosts.part.7']).toBe(1);
        expect(out['kingPosts.part.8']).toBeUndefined();
        expect(out.R153).toBe(2);
    });
    it('deleting a part lowers the total (Excel sample minus ดั้ง-5 = 57.5 m -> 10 sticks)', () => {
        const d = roofStructure.defaults();
        const input = { ...d, kingPosts: { ...d.kingPosts, parts: d.kingPosts.parts.slice(0, 4) } };
        const out = roofStructure.compute(input, withRoof(0));
        expect(out['kingPosts.total']).toBeCloseTo(57.5, 9);
        expect(out.R153).toBe(10);
    });
});

describe('roof-structure edge: valley (ตะเข้ราง)', () => {
    const v = (runA: number, runB: number, deg: number, count: number, c = 1) => ({ desc: 'ตะเข้', c, runA, runB, deg, count });
    it('3-4-5 plan runs at 0 deg: length 5 m; 2 valleys single C = 10 m -> 2 sticks', () => {
        expect(valleyLength(v(3, 4, 0, 2))).toBe(5);
        const out = roofStructure.compute({ ...blank(), valley: v(3, 4, 0, 2) }, withRoof(0));
        expect(out['valley.length']).toBe(5);
        expect(out['valley.total']).toBe(10);
        expect(out.R155).toBe(2);
    });
    it('3-4-5 at 60 deg: 5 / 0.5 = 10 m, 1 valley -> 10 m -> 2 sticks', () => {
        expect(valleyLength(v(3, 4, 60, 1))).toBeCloseTo(10, 9);
        expect(roofStructure.compute({ ...blank(), valley: v(3, 4, 60, 1) }, withRoof(0)).R155).toBe(2);
    });
    it('boundary: 3-4-5 at 60 deg, 0.6 valleys... count 1.2 -> 12 m -> exactly 2 sticks despite cos(60) float noise', () => {
        expect(roofStructure.compute({ ...blank(), valley: v(3, 4, 60, 1.2) }, withRoof(0)).R155).toBe(2);
    });
    it('Excel sample: sqrt(2) x 3.6 / cos 40 = 6.64605 m x 4 = 26.5842 -> 5 sticks', () => {
        const out = roofStructure.compute(roofStructure.defaults(), withRoof(0));
        expect(out['valley.length']).toBeCloseTo(6.646049, 5);
        expect(out['valley.total']).toBeCloseTo(26.58420, 4);
        expect(out.R155).toBe(5);
    });
    it('one run only (runB 0): length = runA / cos', () => {
        expect(valleyLength(v(4, 0, 0, 1))).toBe(4);
    });
    it('double C doubles the metres: 3-4-5, count 1, C 2 -> 10 m -> 2 sticks', () => {
        const out = roofStructure.compute({ ...blank(), valley: v(3, 4, 0, 1, 2) }, withRoof(0));
        expect(out['valley.total']).toBe(10);
        expect(out.R155).toBe(2);
    });
    it('count 0 or runs 0: 0 sticks, finite', () => {
        expect(roofStructure.compute({ ...blank(), valley: v(3, 4, 0, 0) }, withRoof(0)).R155).toBe(0);
        expect(roofStructure.compute({ ...blank(), valley: v(0, 0, 40, 4) }, withRoof(0)).R155).toBe(0);
    });
    it('pitch 90 or more never gives NaN / Infinity', () => {
        for (const deg of [90, 100, 180, 1e6, Number.NaN]) {
            const out = roofStructure.compute({ ...blank(), valley: v(3, 4, deg, 2) }, withRoof(0));
            for (const [k, val] of Object.entries(out)) expect(Number.isFinite(val), `${deg} ${k}`).toBe(true);
        }
    });
    it('valley pitch is its own input, not linked to the roofing pitch (Excel hard-codes 40)', () => {
        const roof = { ...flatRoof(100), slopeDeg: 60 };
        const a = runProject({ ...blank(), valley: v(3, 4, 0, 1) }, roof).out;
        expect(a?.['valley.length']).toBe(5);
    });
});

describe('roof-structure edge: area members (rafter / purlin) I = ((E / F) x D) x C', () => {
    const m = (area: number | null, spacing: number, factor: number, c = 1): AreaMember => ({ desc: 'x', c, factor, area, spacing });
    it('typed area 60, spacing 0.5, factor 1.15: 138 m -> 23 sticks exactly (float 137.99999999999997 must not matter)', () => {
        expect(areaTotal(m(60, 0.5, 1.15), 0)).toBeCloseTo(138, 9);
        const input = { ...blank(), rafter: m(60, 0.5, 1.15) };
        expect(roofStructure.compute(input, withRoof(0)).R156).toBe(23);
    });
    it('typed area 60.1 -> 138.23 m -> 24 sticks', () => {
        const input = { ...blank(), rafter: m(60.1, 0.5, 1.15) };
        expect(roofStructure.compute(input, withRoof(0)).R156).toBe(24);
    });
    it.each(ROOF_FACTOR_OPTIONS.map((f, i) => [f, [20, 19, 18, 17][i]]))('Factor Roof %f, area 100 spacing 1 -> %d sticks', (f, n) => {
        // 115 / 110 / 105 / 100 m of steel -> ROUNDUP(/6) = 20 / 19 / 18 / 17
        expect(roofStructure.compute({ ...blank(), rafter: m(100, 1, f) }, withRoof(0)).R156).toBe(n);
    });
    it.each(DOUBLE_C_OPTIONS.map(c => [c, c === 1 ? 17 : 34]))('ซีคู่ %d, area 100 spacing 1 factor 1 -> %d sticks', (c, n) => {
        expect(roofStructure.compute({ ...blank(), rafter: m(100, 1, 1, c) }, withRoof(0)).R156).toBe(n);
    });
    it('spacing 0 gives 0 (Excel #DIV/0!), not Infinity', () => {
        expect(areaTotal(m(100, 0, 1.15), 0)).toBe(0);
        expect(roofStructure.compute({ ...blank(), purlin: m(100, 0, 1.15) }, withRoof(0)).R157).toBe(0);
    });
    it('spacing narrower is more members: 100 m2 at 0.34 factor 1.15 = 338.235 m -> 57 sticks', () => {
        expect(roofStructure.compute({ ...blank(), purlin: m(100, 0.34, 1.15) }, withRoof(0)).R157).toBe(57);
    });
    it('negative spacing and negative area stay finite', () => {
        const out = roofStructure.compute({ ...blank(), rafter: m(-100, 1, 1.15), purlin: m(100, -0.34, 1.15) }, withRoof(0));
        for (const v of Object.values(out)) expect(Number.isFinite(v)).toBe(true);
    });
    it('huge area stays finite', () => {
        const out = roofStructure.compute({ ...blank(), rafter: m(1e12, 0.34, 1.15, 2) }, withRoof(0));
        expect(Number.isFinite(out.R156)).toBe(true);
        expect(out.R156).toBeCloseTo(Math.ceil(((1e12 / 0.34) * 1.15 * 2) / 6), -6);
    });
    it('decimal area 0.1 spacing 0.34: finite, rounds up to 1 stick', () => {
        expect(roofStructure.compute({ ...blank(), purlin: m(0.1, 0.34, 1.15) }, withRoof(0)).R157).toBe(1);
    });
});

describe('roof-structure edge: link to the roofing sheet (area = null) and typed override', () => {
    it('linked: roofing slope area 100 -> rafter 115 m = 20 sticks, purlin 338.235 m = 57 sticks, labour qty = 100', () => {
        const out = roofStructure.compute(blank(), withRoof(100));
        expect(out['rafter.area']).toBe(100);
        expect(out.R156).toBe(20);
        expect(out.R157).toBe(57);
        expect(out.R159).toBe(100);
        expect(out.linkedSlopeArea).toBe(100);
    });
    it('typed rafter area wins over the link; purlin stays linked', () => {
        const input = { ...blank(), rafter: { ...blank().rafter, area: 50 } };
        const out = roofStructure.compute(input, withRoof(100));
        expect(out['rafter.area']).toBe(50);
        expect(out['purlin.area']).toBe(100);
        expect(out.R156).toBe(10);   // 50 x 1.15 = 57.5 -> 9.58 -> 10
    });
    it('typed purlin area drives the labour line R159 (E159 = purlin E15)', () => {
        const input = { ...blank(), purlin: { ...blank().purlin, area: 80 } };
        expect(roofStructure.compute(input, withRoof(100)).R159).toBe(80);
    });
    it('a typed area of 0 is a value, not "linked" (0 sticks although the roof has area)', () => {
        const input = { ...blank(), rafter: { ...blank().rafter, area: 0 } };
        const out = roofStructure.compute(input, withRoof(100));
        expect(out['rafter.area']).toBe(0);
        expect(out.R156).toBe(0);
    });
    it('real chain: roofing 50 m2 at 60 deg = 100 m2 of slope -> rafter 20 sticks', () => {
        const { out } = runProject(blank(), { ...flatRoof(50), slopeDeg: 60 });
        expect(out?.['rafter.area']).toBeCloseTo(100, 6);
        expect(out?.R156).toBe(20);
        expect(out?.R159).toBeCloseTo(100, 6);
    });
it('NaN linked area: stick counts stay finite (the published area outputs are not sanitised; unreachable, roofing never emits NaN)', () => {        const out = roofStructure.compute(blank(), withRoof(Number.NaN));        for (const k of ['R152', 'R153', 'R154', 'R155', 'R156', 'R157']) expect(Number.isFinite(out[k]), k).toBe(true);    });
});

describe('roof-structure edge: BOQ money through computeProject', () => {
    it('roof 100 m2 flat: rafter R156 net 20, gross ROUNDUP(22) = 22, material 580 x 22 = 12,760', () => {
        const { row } = runProject(undefined, flatRoof(100));
        expect(row('R156').qty).toBe(20);
        expect(row('R156').grossQty).toBe(22);
        expect(row('R156').matTotal).toBe(12760);
        expect(row('R156').labTotal).toBe(0);
    });
    it('purlin R157 net 57, gross ROUNDUP(62.7) = 63, material 110 x 63 = 6,930', () => {
        const { row } = runProject(undefined, flatRoof(100));
        expect(row('R157').qty).toBe(57);
        expect(row('R157').grossQty).toBe(63);
        expect(row('R157').matTotal).toBe(6930);
    });
    it('steel labour R159 = 150 x 100 m2 = 15,000', () => {
        const { row } = runProject(undefined, flatRoof(100));
        expect(row('R159').labTotal).toBe(15000);
    });
    it('wall plate 4 sticks: gross ROUNDUP(4.4) = 5 x 1010 = 5,050', () => {
        const input = { ...blank(), wallPlate: { ...blank().wallPlate, lengths: [6, 6] } };
        const { row } = runProject(input);
        expect(row('R152').qty).toBe(4);
        expect(row('R152').grossQty).toBe(5);
        expect(row('R152').matTotal).toBe(5050);
    });
    it('boq text: descriptions follow the inputs, trimmed; blank description keeps the template text', () => {
        const input = { ...blank(), wallPlate: { ...blank().wallPlate, desc: '  อะเส ใหม่  ' }, ridge: { ...blank().ridge, desc: '  ' } };
        const text = roofStructure.boqText?.(input, noRoof);
        expect(text?.R152?.desc).toBe('อะเส ใหม่');
        expect(text?.R154).toBeUndefined();
    });
    it('level skipped: R152-R159 (incl. the typed anti-rust lump R158) are qty 0 with a full sample roof frame', () => {
        const rs = roofStructure.defaults();
        const { sec, row, res } = runProject(rs, roofing.defaults(), { skipped: true });
        for (const l of [...LINES, 'R158']) { expect(row(l).qty, l).toBe(0); expect(row(l).total, l).toBe(0); }
        expect(sec?.total).toBe(0);
        for (const v of Object.values(res.calcOutputs['roof-structure'] ?? {})) expect(v).toBe(0);
    });
    it('level not skipped but roofing skipped: roof frame member counts by length survive, area-based ones are 0 (pinned, see report)', () => {
        const p = createProject('blank');
        p.calculators['roof-structure'] = roofStructure.defaults();
        p.calculators.roofing = roofing.defaults();
        p.journey = { roofing: 'skipped' };
        const out = computeProject(p).calcOutputs['roof-structure'];
        expect(out?.R152).toBe(31);
        expect(out?.R156).toBe(0);
        expect(out?.R157).toBe(0);
    });
});

describe('roof-structure edge: sample sanity', () => {
    it('Excel sample with Excel roofing: 31 / 13 / 15 / 5 / 29 / 84 sticks, labour 147.511', () => {
        const out = roofStructure.compute(roofStructure.defaults(), withRoof(147.5110237));
        expect([out.R152, out.R153, out.R154, out.R155, out.R156, out.R157]).toEqual([31, 13, 15, 5, 29, 84]);
        expect(out.R159).toBeCloseTo(147.5110237, 6);
    });
});
