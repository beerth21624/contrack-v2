import { describe, expect, it } from 'vitest';
import { computeProject, createProject } from '../../project';
import type { BoqItemRow } from '../../boq/types';
import { matchKey, pickRow, type PickRow } from '../shared/pick-list';
import { electricalEquipment, EQUIPMENT_ITEMS, EQUIPMENT_CATALOGUE, EQUIPMENT_UNITS } from '.';

// QA edge tests for "electrical-equipment" (pick-list sheet → BOQ section 26, slot items).
// Expected values are hand-computed from the Excel BOQ prices (spec 05), never by calling the function under test.

const ID = 'electrical-equipment';
const ctx = { outputs: () => undefined };
const item = (i: number): string => EQUIPMENT_ITEMS[i] ?? '';
interface Spec { unit: string; mat: number; lab: number; note?: string }
/** [unit, material/unit, labour/unit, note] of each dropdown option, in dropdown order (Excel BOQ rows). */
const SPEC: Spec[] = [
    { unit: 'ชุด', mat: 300, lab: 200 },   // ceiling lamp
    { unit: 'ชุด', mat: 150, lab: 120 },   // downlight
    { unit: 'ชุด', mat: 250, lab: 200 },   // waterproof fluorescent
    { unit: 'ตัว', mat: 300, lab: 150 },   // waterproof twin socket
    { unit: 'ตัว', mat: 140, lab: 100 },   // twin socket
    { unit: 'ตัว', mat: 80, lab: 80 },     // one-way switch
];
const spec = (i: number): Spec => SPEC[i] ?? { unit: '', mat: Number.NaN, lab: Number.NaN };
const SAMPLE_TOTAL = { rows: 6, mat: 9920, lab: 7640, total: 17560 };

const bad = [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY];
const isMine = (r: { key: string }) => r.key.startsWith(ID + ':');

function boq(items: PickRow[] | undefined, mutate?: (p: ReturnType<typeof createProject>) => void) {
    const project = createProject('blank');
    if (items) project.calculators[ID] = { items };
    mutate?.(project);
    const res = computeProject(project);
    const rows = res.boq.sections.flatMap(s => s.rows).filter((r): r is BoqItemRow => r.type === 'item' && isMine(r));
    return { res, rows };
}
const calc = (items: PickRow[]) => electricalEquipment.compute({ items }, ctx);
const slot = (items: PickRow[]) => electricalEquipment.boqSlots?.({ items }, ctx).items ?? [];

describe('electrical-equipment edge — blank and structure', () => {
    it('blank(): empty list, finite zero totals, empty slot', () => {
        const b = electricalEquipment.blank?.();
        expect(b).toEqual({ items: [] });
        expect(calc([])).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(slot([])).toEqual([]);
    });

    it('blank project: no BOQ row of this calculator, outputs 0', () => {
        const { res, rows } = boq(undefined);
        expect(rows).toEqual([]);
        expect(res.calcOutputs[ID]).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
    });

    it('the catalogue prices every dropdown option and nothing else', () => {
        expect(Object.keys(EQUIPMENT_CATALOGUE)).toHaveLength(EQUIPMENT_ITEMS.length);
        expect(SPEC).toHaveLength(EQUIPMENT_ITEMS.length);
        for (let i = 0; i < EQUIPMENT_ITEMS.length; i++) expect(EQUIPMENT_CATALOGUE[item(i)], item(i)).toBeDefined();
    });

    it('has no BOQ links (rows come from the slot), sections and deps as the spec says', () => {
        expect(electricalEquipment.boqLinks).toEqual([]);
        expect(electricalEquipment.sections).toEqual([26]);
        expect(electricalEquipment.deps).toEqual([]);
        expect(EQUIPMENT_UNITS.length).toBeGreaterThan(0);
    });

    it('defaults() = Excel sample: totals match the hand-computed sum', () => {
        expect(calc(electricalEquipment.defaults().items)).toEqual(SAMPLE_TOTAL);
    });

    it('sample project (not blank): slot rows = defaults rows and sum to the sheet total', () => {
        const res = computeProject(createProject());
        const rows = res.boq.sections.flatMap(s => s.rows).filter((r): r is BoqItemRow => r.type === 'item' && isMine(r));
        expect(rows).toHaveLength(SAMPLE_TOTAL.rows);
        expect(rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(SAMPLE_TOTAL.total, 6);
        expect(rows.reduce((s, r) => s + r.matTotal, 0)).toBeCloseTo(SAMPLE_TOTAL.mat, 6);
        expect(rows.reduce((s, r) => s + r.labTotal, 0)).toBeCloseTo(SAMPLE_TOTAL.lab, 6);
    });
});

describe('electrical-equipment edge — every catalogue option alone', () => {
    const idx = EQUIPMENT_ITEMS.map((_, i) => i);

    it.each(idx)('option %i: qty 1 → unit/prices/note from the catalogue, row 1), key = item text', i => {
        const s = spec(i);
        const rows = slot([pickRow(item(i), 1, '')]);
        expect(rows).toHaveLength(1);
        const r = rows[0];
        expect(r).toMatchObject({ type: 'item', itemNo: '1)', desc: item(i).trim(), unit: s.unit, mat: s.mat, lab: s.lab, waste: 0 });
        expect(r?.key).toBe(matchKey(item(i)));
        if (s.note) expect(r).toMatchObject({ note: s.note }); else expect(r).not.toHaveProperty('note');
    });

    it.each(idx)('option %i: qty 3 → BOQ row E=3, J = I×3, L = K×3, M = J+L', i => {
        const s = spec(i);
        const { rows } = boq([pickRow(item(i), 3, '')]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ qty: 3, unit: s.unit, matUnit: s.mat, labUnit: s.lab, waste: 0 });
        expect(rows[0]?.matTotal).toBeCloseTo(s.mat * 3, 9);
        expect(rows[0]?.labTotal).toBeCloseTo(s.lab * 3, 9);
        expect(rows[0]?.total).toBeCloseTo((s.mat + s.lab) * 3, 9);
        expect(rows[0]?.key).toBe(ID + ':items:' + matchKey(item(i)));
    });

    it.each(idx)('option %i: sheet totals for qty 2.5 (decimal) = price × 2.5', i => {
        const s = spec(i);
        const out = calc([pickRow(item(i), 2.5, '')]);
        expect(out.rows).toBe(1);
        expect(out.mat).toBeCloseTo(s.mat * 2.5, 9);
        expect(out.lab).toBeCloseTo(s.lab * 2.5, 9);
        expect(out.total).toBeCloseTo((s.mat + s.lab) * 2.5, 9);
    });
});

describe('electrical-equipment edge — quantities', () => {
    const first = (): string => item(0);
    const s0 = (): Spec => spec(0);

    it('qty 0 and negative qty are left out of the BOQ and the totals', () => {
        expect(calc([pickRow(first(), 0, '')])).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(calc([pickRow(first(), -4, '')])).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(slot([pickRow(first(), 0, ''), pickRow(first(), -1, '')])).toEqual([]);
    });

    it.each(bad)('qty %s counts as 0 (never NaN/Infinity)', q => {
        const out = calc([pickRow(first(), q, '')]);
        expect(out).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(slot([pickRow(first(), q, '')])).toEqual([]);
    });

    it('tiny positive qty (0.001) still makes a row, priced proportionally', () => {
        const out = calc([pickRow(first(), 0.001, '')]);
        expect(out.rows).toBe(1);
        expect(out.total).toBeCloseTo((s0().mat + s0().lab) * 0.001, 12);
    });

    it('huge qty (1e9) stays finite and exact', () => {
        const out = calc([pickRow(first(), 1e9, '')]);
        expect(Number.isFinite(out.total)).toBe(true);
        expect(out.mat).toBeCloseTo(s0().mat * 1e9, 0);
        const { rows } = boq([pickRow(first(), 1e9, '')]);
        expect(Number.isFinite(rows[0]?.total)).toBe(true);
        expect(rows[0]?.total).toBeCloseTo((s0().mat + s0().lab) * 1e9, 0);
    });

    it('qty 1e300 × price stays finite in the sheet totals', () => {
        const out = calc([pickRow(first(), 1e300, '')]);
        expect(Object.values(out).every(Number.isFinite)).toBe(true);
    });

    it('decimal qty keeps its decimals in the BOQ row (no rounding)', () => {
        const { rows } = boq([pickRow(first(), 1.37, '')]);
        expect(rows[0]?.qty).toBeCloseTo(1.37, 12);
        expect(rows[0]?.total).toBeCloseTo((s0().mat + s0().lab) * 1.37, 9);
    });
});

describe('electrical-equipment edge — item text', () => {
    it('blank, spaces-only and tab-only items have no row even with a qty', () => {
        expect(calc([pickRow('', 5, 'ชุด'), pickRow('   ', 5, 'ชุด'), pickRow('\t', 5, 'ชุด')])).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
        expect(slot([pickRow('', 5, 'ชุด'), pickRow('  ', 5, 'ชุด')])).toEqual([]);
    });

    it('unknown item: still a BOQ row, priced 0 and no unit unless typed', () => {
        const rows = slot([pickRow('ของที่ไม่มีในรายการ', 2, '')]);
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({ desc: 'ของที่ไม่มีในรายการ', unit: '', mat: 0, lab: 0 });
        expect(calc([pickRow('ของที่ไม่มีในรายการ', 2, '')])).toEqual({ rows: 1, mat: 0, lab: 0, total: 0 });
    });

    it('unknown item with typed unit and prices: total = (mat + lab) × qty', () => {
        const row: PickRow = { item: 'ป้ายพิเศษ', qty: 4, unit: 'อัน', mat: 125, lab: 40 };
        expect(calc([row])).toEqual({ rows: 1, mat: 500, lab: 160, total: 660 });
        const { rows } = boq([row]);
        expect(rows[0]).toMatchObject({ unit: 'อัน', matUnit: 125, labUnit: 40, matTotal: 500, labTotal: 160, total: 660 });
    });

    it('item named like an Object.prototype member is not in the catalogue', () => {
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
            expect(calc([pickRow(name, 1, '')]), name).toEqual({ rows: 1, mat: 0, lab: 0, total: 0 });
        }
    });

    it('trailing / leading / doubled spaces still find the catalogue price; desc is trimmed', () => {
        const s = spec(0);
        for (const text of [item(0) + '   ', '  ' + item(0), item(0).trim().replace(' ', '   '), ' ' + item(0).trim() + '\t']) {
            const out = calc([pickRow(text, 2, '')]);
            expect(out.total, JSON.stringify(text)).toBe((s.mat + s.lab) * 2);
            const r = slot([pickRow(text, 2, '')])[0];
            expect(r).toMatchObject({ unit: s.unit, mat: s.mat, lab: s.lab });
            expect(r?.key).toBe(matchKey(item(0)));
        }
    });

    it('lookup is exact (a near-miss spelling is "unknown", priced 0)', () => {
        const out = calc([pickRow(item(0).trim() + 'x', 1, '')]);
        expect(out).toEqual({ rows: 1, mat: 0, lab: 0, total: 0 });
    });

    it('emoji / very long item text does not break anything', () => {
        const long = 'ก'.repeat(5000) + '🙂';
        const rows = slot([pickRow(long, 1, 'ชุด')]);
        expect(rows).toHaveLength(1);
        expect(rows[0]?.type === 'item' ? rows[0].desc : '').toBe(long);
    });
});

describe('electrical-equipment edge — duplicates, order, keys', () => {
    const a = (): string => item(0);
    const b = (): string => item(1);
    const sa = (): Spec => spec(0);

    it('duplicate items are separate rows: keys X, X~2, X~3 and prices add up', () => {
        const rows = slot([pickRow(a(), 1, ''), pickRow(a(), 2, ''), pickRow(a(), 3, '')]);
        expect(rows.map(r => r.key)).toEqual([matchKey(a()), matchKey(a()) + '~2', matchKey(a()) + '~3']);
        expect(rows.map(r => (r.type === 'item' ? r.itemNo : ''))).toEqual(['1)', '2)', '3)']);
        expect(calc([pickRow(a(), 1, ''), pickRow(a(), 2, ''), pickRow(a(), 3, '')]).total).toBe((sa().mat + sa().lab) * 6);
    });

    it('a qty-0 duplicate still consumes its key, so later rows keep stable keys', () => {
        const withZero = slot([pickRow(a(), 1, ''), pickRow(a(), 0, ''), pickRow(a(), 3, '')]);
        expect(withZero.map(r => r.key)).toEqual([matchKey(a()), matchKey(a()) + '~3']);
        expect(withZero.map(r => (r.type === 'item' ? r.itemNo : ''))).toEqual(['1)', '2)']);
    });

    it('same item with different spacing counts as a duplicate', () => {
        const rows = slot([pickRow(a(), 1, ''), pickRow(a() + '  ', 1, '')]);
        expect(rows.map(r => r.key)).toEqual([matchKey(a()), matchKey(a()) + '~2']);
    });

    it('rows keep the list order, numbered 1), 2), … after dropping blank / zero rows', () => {
        const rows = slot([pickRow(b(), 1, ''), pickRow('', 5, ''), pickRow(a(), 0, ''), pickRow(a(), 2, '')]);
        expect(rows.map(r => (r.type === 'item' ? r.desc : ''))).toEqual([b().trim(), a().trim()]);
        expect(rows.map(r => (r.type === 'item' ? r.itemNo : ''))).toEqual(['1)', '2)']);
    });

    it('changing qty of one row never changes the keys of the others', () => {
        const before = slot([pickRow(a(), 1, ''), pickRow(b(), 1, '')]).map(r => r.key);
        const after = slot([pickRow(a(), 9, ''), pickRow(b(), 1, '')]).map(r => r.key);
        expect(after).toEqual(before);
        const dropped = slot([pickRow(a(), 0, ''), pickRow(b(), 1, '')]).map(r => r.key);
        expect(dropped).toEqual([before[1]]);
    });

    it('all keys of a long list are unique and prefixed with the calculator and slot in the project', () => {
        const items = Array.from({ length: 40 }, (_, i) => pickRow(item(i % EQUIPMENT_ITEMS.length), i + 1, ''));
        const { rows } = boq(items);
        expect(rows).toHaveLength(40);
        expect(new Set(rows.map(r => r.key)).size).toBe(40);
        expect(rows.every(r => r.key.startsWith(ID + ':items:'))).toBe(true);
    });

    it('a literal "~2" item does not collide with a generated duplicate key', () => {
        const rows = slot([pickRow(a(), 1, ''), pickRow(a(), 1, ''), pickRow(a().trim() + '~2', 1, '')]);
        expect(new Set(rows.map(r => r.key)).size).toBe(3);
    });
});

describe('electrical-equipment edge — typed unit and prices', () => {
    const a = (): string => item(0);
    const sa = (): Spec => spec(0);
    const unitOf = (r: { type: string; unit?: string } | undefined) => r?.unit;

    it('typed unit replaces the catalogue unit; blank / spaces fall back to it', () => {
        expect(unitOf(slot([pickRow(a(), 1, 'อัน')])[0])).toBe('อัน');
        expect(unitOf(slot([pickRow(a(), 1, '  ')])[0])).toBe(sa().unit);
        expect(unitOf(slot([pickRow(a(), 1, ' ม. ')])[0])).toBe('ม.');
    });

    it('typed price 0 is a real price (not the catalogue price); null falls back', () => {
        const r: PickRow = { item: a(), qty: 2, unit: '', mat: 0, lab: null };
        expect(calc([r])).toEqual({ rows: 1, mat: 0, lab: sa().lab * 2, total: sa().lab * 2 });
        const r2: PickRow = { item: a(), qty: 2, unit: '', mat: null, lab: 0 };
        expect(calc([r2])).toEqual({ rows: 1, mat: sa().mat * 2, lab: 0, total: sa().mat * 2 });
    });

    it('typed price overrides only the cell typed', () => {
        const r: PickRow = { item: a(), qty: 3, unit: '', mat: 1000, lab: null };
        expect(calc([r])).toEqual({ rows: 1, mat: 3000, lab: sa().lab * 3, total: 3000 + sa().lab * 3 });
    });

    it.each(bad)('typed price %s is read as 0, never NaN/Infinity', p => {
        const out = calc([{ item: a(), qty: 2, unit: '', mat: p, lab: p }]);
        expect(out).toEqual({ rows: 1, mat: 0, lab: 0, total: 0 });
    });

    it('negative typed price stays finite and negative (a credit line)', () => {
        const out = calc([{ item: a(), qty: 2, unit: '', mat: -10, lab: null }]);
        expect(out.mat).toBe(-20);
        expect(Number.isFinite(out.total)).toBe(true);
    });

    it('typed prices reach the BOQ row (I, K) and its J / L / M', () => {
        const { rows } = boq([{ item: a(), qty: 2, unit: 'ชุด', mat: 11, lab: 7 }]);
        expect(rows[0]).toMatchObject({ matUnit: 11, labUnit: 7, matTotal: 22, labTotal: 14, total: 36 });
    });
});

describe('electrical-equipment edge — table size and delete', () => {
    it('0 rows → 0; 1 row; the Excel count; more than Excel (50) all reach the BOQ', () => {
        expect(calc([]).rows).toBe(0);
        expect(calc([pickRow(item(0), 1, '')]).rows).toBe(1);
        const excel = electricalEquipment.defaults().items.length;
        expect(boq(electricalEquipment.defaults().items).rows).toHaveLength(excel);
        const many = Array.from({ length: 50 }, (_, i) => pickRow(item(i % EQUIPMENT_ITEMS.length), 1, ''));
        expect(boq(many).rows).toHaveLength(50);
        expect(calc(many).rows).toBe(50);
    });

    it('deleting a row removes exactly its money; the rest are unchanged', () => {
        const items = electricalEquipment.defaults().items;
        const full = calc(items);
        const gone = (items[0] ?? pickRow('', 0, ''));
        const s = spec(EQUIPMENT_ITEMS.findIndex(x => matchKey(x) === matchKey(gone.item)));
        const less = calc(items.slice(1));
        expect(less.rows).toBe((full.rows ?? NaN) - 1);
        expect(less.total).toBeCloseTo((full.total ?? NaN) - (s.mat + s.lab) * gone.qty, 9);
    });

    it('deleting the last row leaves an empty, finite sheet', () => {
        const items = [pickRow(item(0), 1, '')];
        expect(calc(items.slice(0, 0))).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
    });

    it('sheet totals equal the sum over the BOQ rows (project level)', () => {
        const items = electricalEquipment.defaults().items;
        const { rows, res } = boq(items);
        const out = res.calcOutputs[ID];
        expect(rows.reduce((s, r) => s + r.total, 0)).toBeCloseTo(out?.total ?? NaN, 9);
        expect(rows.reduce((s, r) => s + r.matTotal, 0)).toBeCloseTo(out?.mat ?? NaN, 9);
        expect(rows.reduce((s, r) => s + r.labTotal, 0)).toBeCloseTo(out?.lab ?? NaN, 9);
    });
});

describe('electrical-equipment edge — level skipped (ไม่มีในโครงการนี้)', () => {
    it('skipped: slot empty, every output 0, no BOQ row', () => {
        const { res, rows } = boq(electricalEquipment.defaults().items, p => { p.journey = { [ID]: 'skipped' }; });
        expect(rows).toEqual([]);
        expect(res.calcOutputs[ID]).toEqual({ rows: 0, mat: 0, lab: 0, total: 0 });
    });

    it('skipped on the sample project too, and un-skipping brings the rows back', () => {
        const p = createProject();
        p.journey = { [ID]: 'skipped' };
        const r1 = computeProject(p).boq.sections.flatMap(s => s.rows).filter(isMine);
        expect(r1).toEqual([]);
        p.journey = { [ID]: 'done' };
        const r2 = computeProject(p).boq.sections.flatMap(s => s.rows).filter(isMine);
        expect(r2).toHaveLength(SAMPLE_TOTAL.rows);
    });

    it('skipping other levels does not touch this one', () => {
        const { rows } = boq([pickRow(item(0), 1, '')], p => { p.journey = { fill: 'skipped', 'water-pipe': 'skipped' }; });
        expect(rows).toHaveLength(1);
    });

    it('stored input survives a skip / un-skip round trip', () => {
        const items = [pickRow(item(0), 7, '')];
        const p = createProject('blank');
        p.calculators[ID] = { items };
        p.journey = { [ID]: 'skipped' };
        computeProject(p);
        p.journey = {};
        const rows = computeProject(p).boq.sections.flatMap(s => s.rows).filter((r): r is BoqItemRow => r.type === 'item' && isMine(r));
        expect(rows[0]?.qty).toBe(7);
    });
});
