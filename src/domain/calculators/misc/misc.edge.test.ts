// QA edge tests (group U5) — เบ็ดเตล็ด_Other (pick-list, BOQ slot `misc.items`). Spec docs/excel-spec/05 §8.
// A row reaches the BOQ when it has an item and qty > 0; unit/prices follow the catalogue (railing: ม., 4,000 / 0)
// unless typed on the row. J = I × qty (waste 0), L = K × qty, M = J + L.
import { describe, expect, it } from 'vitest';
import { misc, MISC_CATALOGUE, MISC_ITEMS, MISC_UNITS, type MiscInput } from '.';
import {
    pickRow, emptyPickRow, setOptionQty, optionIndex, needsPrice, qtyDigits, matchKey, keyedRows, boqRows,
    type PickRow,
} from '../shared/pick-list';
import { computeProject, createProject, type Project } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };
const RAIL = 'ราวกันตกกระจก เฉลียง 1 และ 2';
const out = (items: PickRow[]) => misc.compute({ items }, ctx);

const projectWith = (items: PickRow[], start: 'blank' | 'sample' = 'blank'): Project => {
    const p = createProject(start);
    p.calculators.misc = { items } satisfies MiscInput;
    return p;
};
const section28 = (p: Project) => computeProject(p).boq.sections.find(s => s.no === 28);
const slotRows = (p: Project): BoqItemRow[] =>
    (section28(p)?.rows ?? []).filter((x): x is BoqItemRow => x.type === 'item' && x.key.startsWith('misc:items:'));

describe('misc — blank()', () => {
    it('is an empty list; compute is finite and 0; no slot rows', () => {
        const b = misc.blank?.() ?? { items: [pickRow('x', 1, '')] };
        expect(b).toEqual({ items: [] });
        const o = misc.compute(b, ctx);
        expect(o).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(misc.boqSlots?.(b, ctx)).toEqual({ items: [] });
        expect(misc.boqLinks).toEqual([]);
    });
    it('blank project: no misc rows and section 28 total 0', () => {
        const p = createProject('blank');
        expect(slotRows(p)).toEqual([]);
        expect(section28(p)?.total ?? 0).toBe(0);
    });
});

describe('misc — pick-list items alone (equivalence partitions)', () => {
    it('railing qty 1 → 4,000 material, 0 labour', () => {
        expect(out([pickRow(RAIL, 1, 'ม.')])).toEqual({ rows: 1, mat: 4000, lab: 0, total: 4000 });
    });
    it('railing qty 7.1 → 28,400 (Excel sample)', () => {
        expect(out([pickRow(RAIL, 7.1, 'ม.')]).total).toBeCloseTo(28400, 9);
    });
    it('railing decimal qty 0.25 → 1,000', () => {
        expect(out([pickRow(RAIL, 0.25, 'ม.')]).mat).toBeCloseTo(1000, 9);
    });
    it('unit falls back to the catalogue unit when blank', () => {
        const [row] = misc.boqSlots?.({ items: [pickRow(RAIL, 2, '')] }, ctx).items ?? [];
        expect(row).toMatchObject({ unit: 'ม.', mat: 4000, lab: 0 });
    });
    it('the dropdowns each have exactly the Excel option', () => {
        expect(MISC_ITEMS).toEqual([RAIL]);
        expect(MISC_UNITS).toEqual(['ม.']);
        expect(Object.keys(MISC_CATALOGUE)).toEqual([RAIL]);
        expect(MISC_CATALOGUE[RAIL]).toEqual({ unit: 'ม.', mat: 4000, lab: 0 });
        expect(optionIndex(MISC_ITEMS, RAIL)).toBe(0);
        expect(optionIndex(MISC_ITEMS, 'อื่น')).toBe(-1);
        expect(optionIndex(MISC_ITEMS, '  ')).toBe(-1);
    });
    it('item text matches the catalogue with stray spaces', () => {
        expect(matchKey(`  ${RAIL}  `)).toBe(RAIL);
        expect(out([pickRow(`${RAIL} `, 1, 'ม.')]).mat).toBe(4000);
        expect(out([pickRow(RAIL.replace(' ', '   '), 1, 'ม.')]).mat).toBe(4000);
    });
    it('names that look like Object.prototype members are not catalogue hits', () => {
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(out([pickRow(name, 3, 'ชุด')]), name).toEqual({ rows: 1, mat: 0, lab: 0, total: 0 });
        }
    });
});

describe('misc — free-text items and typed prices', () => {
    it('free text with its own prices: 3 × (1,200 + 300) = 4,500', () => {
        const o = out([{ item: 'ป้ายชื่อ', qty: 3, unit: 'ชุด', mat: 1200, lab: 300 }]);
        expect(o).toEqual({ rows: 1, mat: 3600, lab: 900, total: 4500 });
    });
    it('free text without a price is a row priced 0 and flagged needsPrice', () => {
        const row = pickRow('ราวตากผ้า', 2, 'ชุด');
        expect(out([row]).total).toBe(0);
        expect(needsPrice(row, MISC_CATALOGUE)).toBe(true);
        expect(needsPrice(pickRow(RAIL, 1, 'ม.'), MISC_CATALOGUE)).toBe(false);
        expect(needsPrice({ ...row, mat: 10 }, MISC_CATALOGUE)).toBe(false);
        expect(needsPrice(pickRow('', 1, ''), MISC_CATALOGUE)).toBe(false);
    });
    it('a typed 0 is a price (kept), only null means "use the catalogue"', () => {
        expect(out([{ ...pickRow(RAIL, 2, 'ม.'), mat: 0 }]).mat).toBe(0);
        expect(out([{ ...pickRow(RAIL, 2, 'ม.'), mat: null }]).mat).toBe(8000);
        expect(out([{ ...pickRow(RAIL, 2, 'ม.'), lab: 150 }]).lab).toBe(300);
    });
    it('NaN / Infinity prices count as 0', () => {
        const o = out([{ item: 'a', qty: 2, unit: 'ชุด', mat: Number.NaN, lab: Number.POSITIVE_INFINITY }]);
        expect(o).toEqual({ rows: 1, mat: 0, lab: 0, total: 0 });
    });
    it('mat and lab are computed separately and total = mat + lab', () => {
        const o = out([{ item: 'a', qty: 4, unit: 'ชุด', mat: 10.5, lab: 2.25 }]);
        expect(o.mat).toBeCloseTo(42, 12);
        expect(o.lab).toBeCloseTo(9, 12);
        expect(o.total).toBeCloseTo(51, 12);
    });
});

describe('misc — which rows reach the BOQ', () => {
    it('qty 0, negative, NaN, Infinity and empty-item rows are skipped', () => {
        const items: PickRow[] = [
            pickRow(RAIL, 0, 'ม.'), pickRow(RAIL, -3, 'ม.'), pickRow(RAIL, Number.NaN, 'ม.'),
            pickRow(RAIL, Number.POSITIVE_INFINITY, 'ม.'), pickRow('', 5, 'ม.'), pickRow('   ', 5, 'ม.'), emptyPickRow(),
        ];
        expect(out(items)).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(misc.boqSlots?.({ items }, ctx).items).toEqual([]);
        expect(boqRows(items)).toEqual([]);
    });
    it('rows are numbered 1), 2), … in list order, skipping hidden rows', () => {
        const items = [pickRow('ก', 1, 'ชุด'), pickRow('ข', 0, 'ชุด'), pickRow('ค', 2, 'ชุด')];
        const rows = misc.boqSlots?.({ items }, ctx).items ?? [];
        expect(rows.map(x => (x.type === 'item' ? x.itemNo : ''))).toEqual(['1)', '2)']);
        expect(rows.map(x => x.key)).toEqual(['ก', 'ค']);
    });
    it('duplicate item names get keys name, name~2, name~3 — counted over every row with an item', () => {
        const items = [pickRow('ก', 0, 'ชุด'), pickRow('ก', 1, 'ชุด'), pickRow('ก', 2, 'ชุด')];
        expect(keyedRows(items).map(k => k.key)).toEqual(['ก', 'ก~2', 'ก~3']);
        const rows = misc.boqSlots?.({ items }, ctx).items ?? [];
        expect(rows.map(x => x.key)).toEqual(['ก~2', 'ก~3']);
    });
    it('slot rows carry waste 0, material on gross, labour on net, qty as input', () => {
        const [row] = misc.boqSlots?.({ items: [pickRow(RAIL, 2, 'ม.')] }, ctx).items ?? [];
        expect(row).toMatchObject({
            type: 'item', desc: RAIL, unit: 'ม.', waste: 0, mat: 4000, lab: 0,
            materialBasis: 'gross', labourBasis: 'net', qty: { kind: 'input', value: 2 },
        });
    });
});

describe('misc — table sizes', () => {
    it('empty / 1 / Excel 14 / more than Excel 60 / delete', () => {
        expect(out([]).rows).toBe(0);
        expect(out([pickRow(RAIL, 1, 'ม.')]).rows).toBe(1);
        const make = (n: number): PickRow[] => Array.from({ length: n }, (_, i) => ({ item: `รายการ ${i}`, qty: 1, unit: 'ชุด', mat: 100, lab: 10 }));
        expect(out(make(14))).toEqual({ rows: 14, mat: 1400, lab: 140, total: 1540 });
        expect(out(make(60))).toEqual({ rows: 60, mat: 6000, lab: 600, total: 6600 });
        const rows = make(60);
        rows.splice(0, 10);
        expect(out(rows).rows).toBe(50);
        rows.length = 0;
        expect(out(rows).total).toBe(0);
    });
});

describe('misc — setOptionQty (journey count sheet)', () => {
    it('adds a catalogue-priced row for an option, updates an existing row, never removes rows', () => {
        const added = setOptionQty([], MISC_ITEMS, 0, 4, MISC_CATALOGUE);
        expect(added).toEqual([pickRow(RAIL, 4, 'ม.')]);
        const updated = setOptionQty(added, MISC_ITEMS, 0, 0, MISC_CATALOGUE);
        expect(updated).toEqual([pickRow(RAIL, 0, 'ม.')]);
        expect(out(updated).rows).toBe(0);
    });
    it('qty 0 on a missing option adds nothing; bad option index changes nothing', () => {
        expect(setOptionQty([], MISC_ITEMS, 0, 0, MISC_CATALOGUE)).toEqual([]);
        const rows = [pickRow('x', 1, 'ชุด')];
        expect(setOptionQty(rows, MISC_ITEMS, 5, 3, MISC_CATALOGUE)).toEqual(rows);
    });
    it('a new option row goes before free text rows', () => {
        const rows = setOptionQty([pickRow('ของอื่น', 1, 'ชุด')], MISC_ITEMS, 0, 2, MISC_CATALOGUE);
        expect(rows.map(x => x.item)).toEqual([RAIL, 'ของอื่น']);
    });
    it('qtyDigits: whole counts show as integers, lengths with 2 decimals', () => {
        expect(qtyDigits(3, 'ชุด')).toBe(0);
        expect(qtyDigits(3.5, 'ชุด')).toBe(2);
        expect(qtyDigits(3, 'ม.')).toBe(2);
    });
});

describe('misc — boundaries', () => {
    it('tiny qty 0.001 × 4,000 = 4', () => {
        expect(out([pickRow(RAIL, 0.001, 'ม.')]).mat).toBeCloseTo(4, 12);
    });
    it('huge qty stays finite: 1e9 m → 4e12', () => {
        const o = out([pickRow(RAIL, 1e9, 'ม.')]);
        expect(o.mat).toBe(4e12);
        for (const v of Object.values(o)) expect(Number.isFinite(v)).toBe(true);
    });
    it('Excel sample: 7.1 m → 28,400', () => {
        expect(misc.compute(misc.defaults(), ctx)).toEqual({ rows: 1, mat: 28400, lab: 0, total: 28400 });
    });
});

describe('misc — BOQ slot misc.items through computeProject', () => {
    it('a row becomes BOQ row misc:items:<item> with qty, prices and totals; section 28 sums them', () => {
        const p = projectWith([pickRow(RAIL, 3, 'ม.'), { item: 'ป้าย', qty: 2, unit: 'ชุด', mat: 500, lab: 100 }]);
        const rows = slotRows(p);
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({ key: `misc:items:${RAIL}`, itemNo: '1)', qty: 3, matUnit: 4000, matTotal: 12000, labTotal: 0, total: 12000 });
        expect(rows[1]).toMatchObject({ key: 'misc:items:ป้าย', itemNo: '2)', qty: 2, unit: 'ชุด', matTotal: 1000, labTotal: 200, total: 1200 });
        expect(section28(p)?.total).toBe(13200);
    });
    it('removing a row removes its BOQ row and its money', () => {
        const items = [pickRow(RAIL, 3, 'ม.'), pickRow('ป้าย', 2, 'ชุด')];
        const p = projectWith(items);
        expect(slotRows(p)).toHaveLength(2);
        p.calculators.misc = { items: items.slice(0, 1) };
        expect(slotRows(p)).toHaveLength(1);
        expect(section28(p)?.total).toBe(12000);
    });
    it('skipped level leaves the slot empty and section 28 at 0', () => {
        const p = projectWith([pickRow(RAIL, 3, 'ม.')]);
        p.journey = { misc: 'skipped' };
        expect(slotRows(p)).toEqual([]);
        expect(section28(p)?.total ?? 0).toBe(0);
        for (const [k, v] of Object.entries(computeProject(p).calcOutputs.misc ?? {})) expect(v, k).toBe(0);
    });
    it('sample project: 1 row, 28,400', () => {
        const p = createProject('sample');
        expect(slotRows(p)).toHaveLength(1);
        expect(section28(p)?.total).toBe(28400);
    });
    it('misc does not depend on, and does not change, other calculators', () => {
        expect(misc.deps).toEqual([]);
        const base = computeProject(createProject('blank')).calcOutputs;
        const withMisc = computeProject(projectWith([pickRow(RAIL, 3, 'ม.')])).calcOutputs;
        expect(withMisc.paint).toEqual(base.paint);
        expect(withMisc.ceiling).toEqual(base.ceiling);
    });
});
