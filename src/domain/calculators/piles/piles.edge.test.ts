// QA edge tests for "งานเสาเข็ม" (BOQ rows R35/R39, no Excel sheet). Expected values are hand-computed.
import { describe, expect, it } from 'vitest';
import { missingRequirements } from '../../journey/requirements';
import { composePileSpec, missingPileSpec, piles, PILE_SECTION_GROUPS, PILE_TYPES, type PilesInput } from '.';
import { computeProject, createProject, type Project, type ProjectResult } from '../../project';
import type { BoqItemRow } from '../../boq/types';

const ctx = { outputs: () => undefined };

const blankInput = (): PilesInput => {
    const b = piles.blank?.();
    if (!b) throw new Error('piles has no blank()');
    return b;
};
const make = (patch: Partial<PilesInput>): PilesInput => ({ ...piles.defaults(), ...patch });

function item(r: ProjectResult, key: string): BoqItemRow {
    const row = r.boq.sections.flatMap(s => s.rows).find(x => x.key === key);
    if (row?.type !== 'item') throw new Error(`BOQ item ${key} not found`);
    return row;
}
const run = (input: PilesInput, patch: Partial<Project> = {}): ProjectResult =>
    computeProject({ ...createProject('blank'), calculators: { piles: input }, ...patch });

describe('piles — blank()', () => {
    it('is empty spec + zero count, price keeps Excel 2,500', () => {
        expect(blankInput()).toEqual({ pileType: '', section: '', length: 0, count: 0, pricePerPile: 2500, extraSpec: '' });
    });
    it('outputs are finite and the BOQ-linked count is 0', () => {
        const o = piles.compute(blankInput(), ctx);
        for (const [k, v] of Object.entries(o)) expect(Number.isFinite(v), k).toBe(true);
        expect(o.count).toBe(0);
    });
    it('blank project: R35 and R39 cost nothing, no note', () => {
        const r = computeProject(createProject('blank'));
        expect(item(r, 'R35').total).toBe(0);
        expect(item(r, 'R39').total).toBe(0);
        expect(item(r, 'R35').note ?? '').toBe('');
    });
});

describe('piles — each input changed alone', () => {
    it.each([
        [0, 0], [1, 1], [21, 21], [100, 100], [0.5, 0.5], [1_000_000, 1_000_000], [-3, -3],
    ])('count %s gives count output %s', (count, expected) => {
        expect(piles.compute(make({ count }), ctx).count).toBe(expected);
    });

    it.each([[0, 0], [2500, 2500], [3000.5, 3000.5], [1e9, 1e9]])('price %s gives price output %s', (pricePerPile, expected) => {
        expect(piles.compute(make({ pricePerPile }), ctx).pricePerPile).toBe(expected);
    });

    it('count does not move the price and vice versa', () => {
        const a = piles.compute(make({ count: 7 }), ctx);
        expect(a.pricePerPile).toBe(2500);
        const b = piles.compute(make({ pricePerPile: 99 }), ctx);
        expect(b.count).toBe(21);
    });

    it.each([NaN, Infinity, -Infinity])('non-finite count %s becomes 0, never NaN/Infinity', (count) => {
        const o = piles.compute(make({ count, pricePerPile: count }), ctx);
        expect(o).toEqual({ count: 0, pricePerPile: 0 });
    });

    it('spec text fields do not change any amount', () => {
        const a = piles.compute(make({ pileType: 'เสาเข็มเจาะ', section: 'กลม Ø 60 ซม.', length: 25, extraSpec: 'x' }), ctx);
        expect(a).toEqual({ count: 21, pricePerPile: 2500 });
    });
});

describe('piles — BOQ amounts (R35 labour-only lump sum, R39 follows count)', () => {
    it.each([
        // count, price, R35 total = count × price, R39 total = count × 170
        [1, 2500, 2500, 170],
        [10, 3000, 30000, 1700],
        [21, 2500, 52500, 3570],
        [0, 2500, 0, 0],
        [2.5, 4000, 10000, 425],
    ])('count %s × %s baht', (count, price, r35, r39) => {
        const r = run(make({ count, pricePerPile: price }));
        expect(item(r, 'R35').qty).toBe(count);
        expect(item(r, 'R35').matTotal).toBe(0);
        expect(item(r, 'R35').labTotal).toBeCloseTo(r35, 9);
        expect(item(r, 'R35').total).toBeCloseTo(r35, 9);
        expect(item(r, 'R39').qty).toBe(count);
        expect(item(r, 'R39').total).toBeCloseTo(r39, 9);
    });

    it('a quantity typed on the BOQ page wins over the calculator; the price keeps the calculator value', () => {
        const r = run(make({ count: 10, pricePerPile: 3000 }), { boqOverrides: { R35: { qty: 12 } } });
        expect(item(r, 'R35').total).toBe(36000);
        expect(item(r, 'R39').qty).toBe(12);
    });

    it('a price typed on the BOQ page wins over the calculator', () => {
        const r = run(make({ count: 10, pricePerPile: 3000 }), { boqOverrides: { R35: { lab: 1000 } } });
        expect(item(r, 'R35').total).toBe(10000);
    });
});

describe('piles — "ไม่มีในโครงการนี้" (level skipped)', () => {
    it('R35 and R39 are 0, even with an edited quantity; the price edit is kept', () => {
        const r = run(make({ count: 30 }), { journey: { piles: 'skipped' }, boqOverrides: { R35: { qty: 50, lab: 123 } } });
        expect(item(r, 'R35').qty).toBe(0);
        expect(item(r, 'R35').total).toBe(0);
        expect(item(r, 'R39').qty).toBe(0);
        expect(item(r, 'R39').total).toBe(0);
        expect(item(r, 'R35').labUnit).toBe(123);
        expect(r.calcOutputs.piles).toEqual({ count: 0, pricePerPile: 0 });
    });
    it('marked done (not skipped) keeps the amounts', () => {
        const r = run(make({ count: 30 }), { journey: { piles: 'done' } });
        expect(item(r, 'R35').total).toBe(75000);
    });
});

describe('piles — spec text (composePileSpec / missingPileSpec)', () => {
    it.each(PILE_TYPES)('type %s is the first word of the note', (pileType) => {
        expect(composePileSpec(make({ pileType }))).toBe(`${pileType} (I - 22 x 22 ยาว 6 ม.)`);
    });

    const sections = PILE_SECTION_GROUPS.flatMap(g => g.options);
    it('the dropdown has 18 shapes (6 I + 5 square + 7 round)', () => {
        expect(PILE_SECTION_GROUPS.map(g => g.options.length)).toEqual([6, 5, 7]);
        expect(new Set(sections).size).toBe(18);
    });
    it.each(sections)('shape "%s" is written verbatim', (section) => {
        expect(composePileSpec(make({ section }))).toBe(`เสาเข็มตอก (${section} ยาว 6 ม.)`);
        expect(missingPileSpec(make({ section }))).toEqual([]);
    });

    it.each([
        [6, 'ยาว 6 ม.'], [6.5, 'ยาว 6.5 ม.'], [12.25, 'ยาว 12.25 ม.'], [7.254, 'ยาว 7.25 ม.'], [7.256, 'ยาว 7.26 ม.'], [18, 'ยาว 18 ม.'],
    ])('length %s is written as "%s"', (length, text) => {
        expect(composePileSpec(make({ length }))).toBe(`เสาเข็มตอก (I - 22 x 22 ${text})`);
    });

    it.each([0, -5, NaN, Infinity])('length %s is left out of the note and reported missing', (length) => {
        expect(composePileSpec(make({ length }))).toBe('เสาเข็มตอก (I - 22 x 22)');
        expect(missingPileSpec(make({ length }))).toEqual(['ความยาว']);
    });

    it('extra spec is appended; whitespace is trimmed from every text field', () => {
        const input = make({ pileType: '  เสาเข็มเจาะ ', section: ' กลม Ø 35 ซม.  ', extraSpec: '  30 ตัน  ' });
        expect(composePileSpec(input)).toBe('เสาเข็มเจาะ (กลม Ø 35 ซม. ยาว 6 ม.) 30 ตัน');
    });

    it('only extra spec: note is just that text; everything empty gives an empty note', () => {
        expect(composePileSpec({ ...blankInput(), extraSpec: 'ตามแบบ' })).toBe('ตามแบบ');
        expect(composePileSpec(blankInput())).toBe('');
    });

    it('missing list keeps the Excel order: type, section, length', () => {
        expect(missingPileSpec(blankInput())).toEqual(['ชนิดเสาเข็ม', 'หน้าตัด/รูปทรง', 'ความยาว']);
        expect(missingPileSpec(make({ pileType: '', length: 0 }))).toEqual(['ชนิดเสาเข็ม', 'ความยาว']);
        expect(missingPileSpec(make({ pileType: '   ', section: '   ' }))).toEqual(['ชนิดเสาเข็ม', 'หน้าตัด/รูปทรง']);
    });

    it('the note reaches BOQ row R35 in the project', () => {
        const r = run(make({ pileType: 'เสาเข็มเจาะ', section: 'กลม Ø 50 ซม.', length: 21, count: 4 }));
        expect(item(r, 'R35').note).toBe('เสาเข็มเจาะ (กลม Ø 50 ซม. ยาว 21 ม.)');
    });
});

describe('piles — required fields (REQUIRED_FIELDS decision table)', () => {
    const missing = (input: PilesInput, patch: Partial<Project> = {}) =>
        missingRequirements('piles', { ...createProject('blank'), calculators: { piles: input }, ...patch });
    const keys = (input: PilesInput) => missing(input).map(m => m.fieldKey);

    it('the Excel sample meets every requirement', () => {
        expect(keys(piles.defaults())).toEqual([]);
    });
    it('an untouched form asks for nothing (the step is optional)', () => {
        expect(keys(blankInput())).toEqual([]);
        expect(keys({ ...blankInput(), extraSpec: 'หมายเหตุ', pricePerPile: 9999 })).toEqual([]);
    });
    it.each([
        ['pileType', { pileType: 'เสาเข็มตอก' }], ['section', { section: 'I - 22 x 22' }], ['length', { length: 6 }], ['count', { count: 21 }],
    ] as const)('typing only %s starts the form: the other three are reported', (field, patch) => {
        const got = keys({ ...blankInput(), ...patch });
        expect(got).toHaveLength(3);
        expect(got).not.toContain(field);
    });
    it.each(['pileType', 'section'] as const)('%s blank / whitespace is reported', (field) => {
        for (const v of ['', '   ']) expect(keys({ ...piles.defaults(), [field]: v }), `"${v}"`).toEqual([field]);
    });
    it.each(['length', 'count'] as const)('%s 0 / negative / NaN is reported; 0.0001 is accepted', (field) => {
        for (const v of [0, -1, NaN]) expect(keys({ ...piles.defaults(), [field]: v }), `${field}=${v}`).toEqual([field]);
        expect(keys({ ...piles.defaults(), [field]: 0.0001 })).toEqual([]);
    });
    it('the order is type, section, length, count', () => {
        expect(keys({ ...blankInput(), extraSpec: '', count: 0, length: 0.5 })).toEqual(['pileType', 'section', 'count']);
    });
    it('marked "ไม่มีในโครงการนี้" there is nothing to complete', () => {
        expect(missing({ ...blankInput(), count: 3 }, { journey: { piles: 'skipped' } })).toEqual([]);
    });
});
