import { describe, expect, it } from 'vitest';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import { CAMP_GROUPS, campLine, groupRooms, siteCamp, type CampMaterialLine, type SiteCampInput } from '.';

const ctx = { outputs: () => undefined };
const blankInput = (): SiteCampInput => siteCamp.blank?.() ?? siteCamp.defaults();
const mk = (i: Partial<SiteCampInput>, base: 'defaults' | 'blank' = 'defaults'): SiteCampInput =>
    ({ ...(base === 'blank' ? blankInput() : siteCamp.defaults()), ...i });
const out = (i: Partial<SiteCampInput>, base: 'defaults' | 'blank' = 'defaults') => siteCamp.compute(mk(i, base), ctx);
const mat = (group: CampMaterialLine['group'], baseQty: number, basePer: number, unitPrice: number): CampMaterialLine =>
    ({ group, code: 'X', item: 'x', unit: 'u', baseQty, basePer, unitPrice });

function boqRow(res: ProjectResult, key: string) {
    const r = res.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (r?.type !== 'item') throw new Error(`row ${key} missing`);
    return r;
}
const section = (res: ProjectResult, no: number) => {
    const s = res.boq.sections.find(x => x.no === no);
    if (!s) throw new Error(`section ${String(no)} missing`);
    return s;
};
function projectWith(input: Partial<SiteCampInput>, start: 'blank' | 'sample' = 'blank'): Project {
    const p = createProject(start);
    p.calculators['site-camp'] = mk(input, start === 'blank' ? 'blank' : 'defaults');
    return p;
}

describe('site-camp edge — structure, defaults, blank', () => {
    it('4 groups, each reading its own room input and filling its own BOQ row', () => {
        expect(CAMP_GROUPS.map(g => [g.id, g.rooms, g.boqLine])).toEqual([
            ['camp', 'workerRooms', 'R19'], ['toilet', 'toilets', 'R20'], ['shower', 'showers', 'R21'], ['store', 'stores', 'R22'],
        ]);
    });

    it('defaults: 4 / 2 / 1 / 1 rooms, waste 5 %, labour 20 %, 22 take-off rows (9 camp + 13 toilet)', () => {
        const d = siteCamp.defaults();
        expect([d.workerRooms, d.toilets, d.showers, d.stores, d.waste, d.labourRate]).toEqual([4, 2, 1, 1, 0.05, 0.2]);
        expect(d.materials).toHaveLength(22);
        expect(d.materials.filter(m => m.group === 'camp')).toHaveLength(9);
        expect(d.materials.filter(m => m.group === 'toilet')).toHaveLength(13);
    });

    it('blank: all room counts 0, every output finite and 0', () => {
        const o = out({}, 'blank');
        for (const [k, v] of Object.entries(o)) {
            expect(Number.isFinite(v), k).toBe(true);
            expect(v, k).toBe(0);
        }
    });

    it('blank project: BOQ rows 19-29 all 0 baht, section 3 = 0', () => {
        const res = computeProject(createProject('blank'));
        for (let r = 19; r <= 29; r++) expect(boqRow(res, `R${String(r)}`).total, `R${String(r)}`).toBe(0);
        expect(section(res, 3).total).toBe(0);
    });

    it('defaults() returns independent material rows each call', () => {
        const a = siteCamp.defaults();
        a.materials.pop();
        expect(siteCamp.defaults().materials).toHaveLength(22);
    });
});

describe('site-camp edge — each room count alone (hand computed, waste 5 %)', () => {
    it('workerRooms 1: PLY 3×1.05 → 4 (2,200), EUC 50 → 53 (2,915), … camp material 9,830, labour 1,966', () => {
        const i = mk({ workerRooms: 1 });
        const [ply, euc, zinc6, zinc7, zinc8, nail, nail15, zincNail, string] = i.materials.filter(m => m.group === 'camp').map(m => campLine(m, i));
        expect(ply?.grossQty).toBe(4);   // 12 × 1 / 4 = 3 → 3.15
        expect(euc?.grossQty).toBe(53);  // 200 / 4 = 50 → 52.5
        expect(zinc6?.grossQty).toBe(15); // 13.75 → 14.4375
        expect(zinc7?.grossQty).toBe(4);  // 3.75 → 3.9375
        expect(zinc8?.grossQty).toBe(4);
        expect(nail?.grossQty).toBe(1);   // 0.25 → 0.2625
        expect(nail15?.grossQty).toBe(1); // 0.75 → 0.7875
        expect(zincNail?.grossQty).toBe(2); // 1.25 → 1.3125
        expect(string?.grossQty).toBe(1); // 0.5 → 0.525
        // 2,200 + 2,915 + 2,250 + 680 + 760 + 850 + 60 + 70 + 45
        const o = out({ workerRooms: 1 });
        expect(o.mat_camp).toBe(9830);
        expect(o.lab_camp).toBeCloseTo(1966, 9);
        expect(o.matPerRoom_camp).toBe(9830);
        expect(o.mat_toilet).toBe(9934);   // toilets untouched at 2 rooms
    });

    it('toilets 1: material 5,856 (each row ⌈base/2 × 1.05⌉ × price)', () => {
        // 7×55 + 2×150 + 6×170 + 3×280 + 2×160 + 2×850 + 2×165 + 6×45 + 4×55 + 2×120 + 2×85 + 1×25 + 2×18
        const o = out({ toilets: 1 });
        expect(o.mat_toilet).toBe(385 + 300 + 1020 + 840 + 320 + 1700 + 330 + 270 + 220 + 240 + 170 + 25 + 36);
        expect(o.mat_toilet).toBe(5856);
        expect(o.mat_camp).toBe(35445);
    });

    it('waste 0 with toilets 2: exact base quantities, material 7,756', () => {
        const o = out({ waste: 0 });
        expect(o.mat_toilet).toBe(7756);
        // camp at 4 rooms: 12×550 + 200×55 + 55×150 + 15×170 + 15×190 + 1×850 + 3×60 + 5×35 + 2×45
        expect(o.mat_camp).toBe(6600 + 11000 + 8250 + 2550 + 2850 + 850 + 180 + 175 + 90);
        expect(o.mat_camp).toBe(32545);
    });

    it('showers / stores have no take-off rows (deck cut off): counts alone cost 0 material', () => {
        const o = out({ showers: 5, stores: 7 });
        expect(o.showers).toBe(5);
        expect(o.stores).toBe(7);
        expect(o.mat_shower).toBe(0);
        expect(o.mat_store).toBe(0);
        expect(o.matPerRoom_shower).toBe(0);
        expect(o.total).toBe(out({}).total);
    });

    it('labour rate: 0 → no labour; 100 % → labour = material; total = material × (1 + rate)', () => {
        const base = out({}).materialTotal;
        expect(base).toBe(45379);
        const zero = out({ labourRate: 0 });
        expect(zero.labour).toBe(0);
        expect(zero.total).toBe(45379);
        const full = out({ labourRate: 1 });
        expect(full.labour).toBe(45379);
        expect(full.total).toBe(2 * 45379);
        expect(full.lab_camp).toBe(full.mat_camp);
    });

    it('waste 100 % doubles before rounding: camp ply ⌈3 × 4/... ⌉ at 4 rooms = ⌈12 × 2⌉ = 24', () => {
        const i = mk({ waste: 1 });
        const first = i.materials[0];
        expect(first && campLine(first, i).grossQty).toBe(24);
    });

    it('material total is the sum of the four group totals, labour the sum of the group labours', () => {
        const o = out({ workerRooms: 3, toilets: 5, showers: 2, stores: 2 });
        expect(o.materialTotal).toBeCloseTo((o.mat_camp ?? 0) + (o.mat_toilet ?? 0) + (o.mat_shower ?? 0) + (o.mat_store ?? 0), 9);
        expect(o.labour).toBeCloseTo((o.lab_camp ?? 0) + (o.lab_toilet ?? 0) + (o.lab_shower ?? 0) + (o.lab_store ?? 0), 9);
        expect(o.total).toBeCloseTo((o.materialTotal ?? 0) + (o.labour ?? 0), 9);
    });
});

describe('site-camp edge — rounding boundaries', () => {
    const one = (baseQty: number, waste: number, rooms = 1, basePer = 1) =>
        campLine(mat('camp', baseQty, basePer, 10), mk({ waste, workerRooms: rooms }));

    it('exact integer after waste does not round up: 20 × 1.05 = 21 (float 21.000000000000004), 100 × 1.1 = 110', () => {
        expect(one(20, 0.05).grossQty).toBe(21);
        expect(one(100, 0.1).grossQty).toBe(110);
        expect(one(10, 0.1).grossQty).toBe(11);
    });

    it('just above an integer rounds up: 20.001 × 1.05 = 21.00105 → 22', () => {
        expect(one(20.001, 0.05).grossQty).toBe(22);
    });

    it('waste 0: integers stay, a fraction rounds up (3.2 → 4), 0 stays 0', () => {
        expect(one(3, 0).grossQty).toBe(3);
        expect(one(3.2, 0).grossQty).toBe(4);
        expect(one(0, 0).grossQty).toBe(0);
        expect(Object.is(one(0, 0.05).grossQty, 0)).toBe(true);
    });

    it('a tiny positive quantity still orders 1 (0.001 → 1)', () => {
        expect(one(0.001, 0.05).grossQty).toBe(1);
    });

    it('scaling by rooms: 3 per 4 rooms, 5 rooms → 3.75 × 1.05 = 3.9375 → 4; 8 rooms → 6.3 → 7', () => {
        expect(one(3, 0.05, 5, 4).grossQty).toBe(4);
        expect(one(3, 0.05, 8, 4).grossQty).toBe(7);
        expect(one(3, 0.05, 8, 4).calcQty).toBe(6);
    });

    it('total = gross × unit price', () => {
        const r = campLine(mat('camp', 3, 1, 55), mk({ waste: 0, workerRooms: 2 }));
        expect(r).toEqual({ rooms: 2, calcQty: 6, grossQty: 6, total: 330 });
    });
});

describe('site-camp edge — table rows', () => {
    it('empty take-off table: all material, labour and per-room figures 0; BOQ counts unaffected', () => {
        const o = out({ materials: [] });
        expect(o.materialTotal).toBe(0);
        expect(o.labour).toBe(0);
        expect(o.total).toBe(0);
        expect(o.workerRooms).toBe(4);
        expect(computeProject(projectWith({ materials: [], workerRooms: 4 })).boq.sections.find(s => s.no === 3)?.rows.length).toBeGreaterThan(0);
    });

    it('a single row', () => {
        const o = out({ materials: [mat('toilet', 2, 1, 100)], toilets: 3, waste: 0 });
        expect(o.mat_toilet).toBe(600);
        expect(o.matPerRoom_toilet).toBe(200);
        expect(o.mat_camp).toBe(0);
        expect(o.total).toBeCloseTo(720, 9);
    });

    it('more rows than the 22 of the sheet (D5): 100 added rows', () => {
        const rows = Array.from({ length: 100 }, () => mat('camp', 1, 1, 10));
        const o = out({ materials: rows, workerRooms: 2, waste: 0 });
        expect(o.mat_camp).toBe(100 * 2 * 10);
    });

    it('rows of different groups are independent; deleting one removes only its money', () => {
        const rows = [mat('camp', 1, 1, 100), mat('toilet', 1, 1, 200), mat('shower', 1, 1, 300), mat('store', 1, 1, 400)];
        const i = { materials: rows, workerRooms: 1, toilets: 1, showers: 1, stores: 1, waste: 0 };
        const o = out(i);
        expect([o.mat_camp, o.mat_toilet, o.mat_shower, o.mat_store]).toEqual([100, 200, 300, 400]);
        const o2 = out({ ...i, materials: rows.filter((_, k) => k !== 2) });
        expect([o2.mat_camp, o2.mat_toilet, o2.mat_shower, o2.mat_store]).toEqual([100, 200, 0, 400]);
        expect(o2.materialTotal).toBe(700);
    });

    it('a row added to a group with 0 rooms costs nothing; with rooms it scales by baseQty/basePer', () => {
        const o0 = out({ materials: [mat('shower', 10, 1, 170)], showers: 0, waste: 0 });
        expect(o0.mat_shower).toBe(0);
        const o2 = out({ materials: [mat('shower', 10, 2, 170)], showers: 4, waste: 0 });
        expect(o2.mat_shower).toBe(20 * 170);
        expect(o2.matPerRoom_shower).toBe(850);
    });

    it('basePer 0 or NaN gives 0 (no division by zero)', () => {
        expect(campLine(mat('camp', 5, 0, 10), mk({ workerRooms: 3 }))).toEqual({ rooms: 3, calcQty: 0, grossQty: 0, total: 0 });
        expect(campLine(mat('camp', 5, NaN, 10), mk({ workerRooms: 3 })).total).toBe(0);
    });
});

describe('site-camp edge — zero, decimal, negative, huge rooms', () => {
    it('zero rooms in one group zeroes that group only and its per-room figures', () => {
        const o = out({ toilets: 0 });
        expect(o.mat_toilet).toBe(0);
        expect(o.matPerRoom_toilet).toBe(0);
        expect(o.labPerRoom_toilet).toBe(0);
        expect(o.mat_camp).toBe(35445);
    });

    it('fractional rooms are used as typed: 2.5 camp rooms → PLY 12 × 2.5 / 4 = 7.5 × 1.05 = 7.875 → 8', () => {
        const i = mk({ workerRooms: 2.5 });
        const first = i.materials[0];
        expect(first && campLine(first, i)).toEqual({ rooms: 2.5, calcQty: 7.5, grossQty: 8, total: 4400 });
    });

    it('NaN / Infinity room counts count as 0', () => {
        for (const bad of [NaN, Infinity, -Infinity]) {
            const o = out({ workerRooms: bad, toilets: bad, showers: bad, stores: bad });
            for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), `${k} ${String(bad)}`).toBe(true);
            expect(o.total).toBe(0);
        }
        expect(groupRooms(mk({ workerRooms: NaN }), 'camp')).toBe(0);
    });

    it('NaN waste, labour rate, price or base quantity never poison totals', () => {
        const o = out({ waste: NaN, labourRate: NaN, materials: [mat('camp', NaN, 1, 10), mat('camp', 2, 1, NaN), mat('camp', 2, 1, 10)] });
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
        expect(o.mat_camp).toBe(2 * 4 * 10);
        expect(o.labour).toBe(0);
    });

    it('huge: 1e6 rooms stay finite and scale linearly', () => {
        const o = out({ workerRooms: 1e6, toilets: 1e6, waste: 0, materials: [mat('camp', 1, 1, 10), mat('toilet', 1, 1, 20)] });
        expect(o.mat_camp).toBe(1e7);
        expect(o.mat_toilet).toBe(2e7);
        expect(o.matPerRoom_camp).toBe(10);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });

    it('negative rooms stay finite', () => {
        const o = out({ workerRooms: -2, toilets: -1 });
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
    });
});

describe('site-camp edge — BOQ links and skipping', () => {
    it('R19-R22 quantities are the room counts; each group has its own row', () => {
        const res = computeProject(projectWith({ workerRooms: 3, toilets: 2, showers: 4, stores: 5 }));
        expect(['R19', 'R20', 'R21', 'R22'].map(k => boqRow(res, k).qty)).toEqual([3, 2, 4, 5]);
        // prices stay as typed in Excel: (7,000 + 1,000), (4,700 + 500), (4,500 + 500), (7,000 + 1,000)
        expect(['R19', 'R20', 'R21', 'R22'].map(k => boqRow(res, k).total)).toEqual([3 * 8000, 2 * 5200, 4 * 5000, 5 * 8000]);
        expect(section(res, 3).total).toBe(24000 + 10400 + 20000 + 40000);
    });

    it('rows R23-R29 (not linked) stay 0 whatever the camp input', () => {
        const res = computeProject(projectWith({ workerRooms: 9, toilets: 9, showers: 9, stores: 9 }));
        for (let r = 23; r <= 29; r++) expect(boqRow(res, `R${String(r)}`).total).toBe(0);
    });

    it('sample project with 0 rooms → section 3 = 0; with defaults = 55,400', () => {
        expect(section(computeProject(createProject('sample')), 3).total).toBe(32000 + 10400 + 5000 + 8000);
        expect(section(computeProject(projectWith({ workerRooms: 0, toilets: 0, showers: 0, stores: 0 }, 'sample')), 3).total).toBe(0);
    });

    it('fractional rooms reach the BOQ as typed: 2.5 rooms → 20,000', () => {
        expect(boqRow(computeProject(projectWith({ workerRooms: 2.5 })), 'R19').total).toBe(20000);
    });

    it('take-off prices / waste / labour do not change BOQ money (only counts are linked, D8)', () => {
        const a = computeProject(projectWith({ workerRooms: 2 }));
        const b = computeProject(projectWith({ workerRooms: 2, waste: 0.5, labourRate: 0.9, materials: [] }));
        expect(section(b, 3).total).toBe(section(a, 3).total);
    });

    it('marked "ไม่มีในโครงการนี้": every output 0 and R19-R22 quantity 0, section 3 = 0', () => {
        for (const start of ['blank', 'sample'] as const) {
            const p = projectWith({ workerRooms: 6, toilets: 3 }, start);
            p.journey = { 'site-camp': 'skipped' };
            const res = computeProject(p);
            expect(Object.values(res.calcOutputs['site-camp'] ?? {}).every(v => v === 0)).toBe(true);
            for (const k of ['R19', 'R20', 'R21', 'R22']) {
                expect(boqRow(res, k).qty, k).toBe(0);
                expect(boqRow(res, k).total, k).toBe(0);
            }
            expect(section(res, 3).total).toBe(0);
        }
    });

    it('skipped site camp ignores quantities typed on the BOQ page for its rows', () => {
        const p = createProject('sample');
        p.boqOverrides = { R19: { qty: 10 }, R22: { qty: 3 } };
        p.journey = { 'site-camp': 'skipped' };
        expect(section(computeProject(p), 3).total).toBe(0);
    });
});
