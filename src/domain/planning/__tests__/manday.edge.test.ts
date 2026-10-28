// QA edge tests for Man-Day: crew x wage -> days, typed durations, budget per BOQ category.
import { describe, expect, it } from 'vitest';
import type { BoqItemRow, BoqResult, BoqSectionResult } from '../../boq/types';
import {
    blockBoqTotals, computeManDay, computeManDayBlock, defaultManDayInput, PLAN_TASKS, type ManDayInput,
} from '../index';

/** A BOQ whose sections 0..31 each have the given labour / total; 17 and 18 hold two item rows (split blocks). */
function fakeBoq(perSection: (no: number) => { lab: number; total: number } = () => ({ lab: 4000, total: 10000 })): BoqResult {
    const itemRow = (excelRow: number, lab: number, total: number): BoqItemRow => ({
        type: 'item', key: `R${excelRow}`, excelRow, labTotal: lab, matTotal: total - lab, total,
    } as BoqItemRow);
    const sections: BoqSectionResult[] = Array.from({ length: 32 }, (_, no) => {
        const { lab, total } = perSection(no);
        const rows = no === 17 ? [itemRow(180, lab * 0.7, total * 0.7), itemRow(185, lab * 0.3, total * 0.3)]
            : no === 18 ? [itemRow(190, lab * 0.6, total * 0.6), itemRow(195, lab * 0.4, total * 0.4)]
                : [];
        return { no, title: `s${no}`, calculators: [], inConstructionTotal: no !== 0, rows, matTotal: total - lab, labTotal: lab, total };
    });
    const constructionTotal = sections.filter(s => s.no !== 0).reduce((a, s) => a + s.total, 0);
    return { sections, constructionTotal, preConstructionTotal: sections[0]?.total ?? 0 };
}

const block = (id: string) => {
    const t = PLAN_TASKS.find(x => x.id === id);
    if (!t) throw new Error(`task ${id}`);
    return t;
};
const input = (): ManDayInput => defaultManDayInput();
const result = (id: string, i: ManDayInput, boq: BoqResult) => {
    const r = computeManDay(i, boq).blocks.find(b => b.id === id);
    if (!r) throw new Error(`block ${id}`);
    return r;
};

describe('crew x wage -> calculated days', () => {
    it('daily wage = skilled rate x skilled + labourer rate x labourers (wage set A 800/500)', () => {
        // 1.5 footing: 1 skilled + 5 labourers, set A -> 800 + 2,500 = 3,300
        const r = result('1.5', input(), fakeBoq(() => ({ lab: 33000, total: 90000 })));
        expect(r.dailyWage).toBe(3300);
        expect(r.crew).toBe(6);
        expect(r.calcDays).toBe(10);
        expect(r.suggestedDays).toBe(10);
        expect(r.boqLabour).toBe(33000);
    });

    it('wage set B (1000/600) is used for set-B blocks', () => {
        // 3.2 roof frame: 4 skilled + 2 labourers, set B -> 4,000 + 1,200 = 5,200
        const r = result('3.2', input(), fakeBoq(() => ({ lab: 52000, total: 100000 })));
        expect(r.dailyWage).toBe(5200);
        expect(r.calcDays).toBe(10);
    });

    it('changing a wage rate changes the days inversely', () => {
        const i = input();
        i.wageSets = i.wageSets.map(w => (w.id === 'A' ? { ...w, skilled: 1600, labourer: 1000 } : w));
        const r = result('1.5', i, fakeBoq(() => ({ lab: 33000, total: 90000 })));
        expect(r.dailyWage).toBe(6600);
        expect(r.calcDays).toBe(5);
    });

    it.each([
        // labour, expected days, expected suggested (Math.round)
        [0, 0, 0], [1650, 0.5, 1], [1649, 1649 / 3300, 0], [4950, 1.5, 2], [3300, 1, 1], [3301, 3301 / 3300, 1],
    ])('labour %d / 3,300 -> %d days, suggested %d', (lab, days, suggested) => {
        const r = result('1.5', input(), fakeBoq(() => ({ lab, total: 1 })));
        expect(r.calcDays).toBeCloseTo(days, 12);
        expect(r.suggestedDays).toBe(suggested);
    });

    it('no crew (wage 0) gives null days (Excel #DIV/0!), not Infinity or NaN', () => {
        const i = input();
        i.blocks['1.5'] = { skilled: 0, labourers: 0, wageSet: 'A', days: 10 };
        const r = result('1.5', i, fakeBoq());
        expect(r.dailyWage).toBe(0);
        expect(r.calcDays).toBeNull();
        expect(r.suggestedDays).toBeNull();
        expect(r.days).toBe(10);
    });

    it('zero wage rates also give null days', () => {
        const i = input();
        i.wageSets = i.wageSets.map(w => (w.id === 'A' ? { ...w, skilled: 0, labourer: 0 } : w));
        expect(result('1.5', i, fakeBoq()).calcDays).toBeNull();
    });

    it('piles (labourBasis none) never calculate days even with a crew', () => {
        const i = input();
        i.blocks['1.4'] = { skilled: 2, labourers: 2, wageSet: 'A', days: 3 };
        const r = result('1.4', i, fakeBoq());
        expect(r.labourBasis).toBe('none');
        expect(r.calcDays).toBeNull();
        expect(r.labourCost).toBe(0);
        expect(r.days).toBe(3);
    });

    it('sub-contract blocks (aluminium 7.1 and misc 8.3) use 20 % of the total instead of labour', () => {
        const boq = fakeBoq(() => ({ lab: 0, total: 100000 }));
        const r83 = result('8.3', input(), boq);    // 3 skilled + 1 labourer, set B -> 3,600
        expect(r83.labourBasis).toBe('shareOfTotal');
        expect(r83.labourCost).toBe(20000);
        expect(r83.calcDays).toBeCloseTo(20000 / 3600, 12);
    });

    it('the labour share of total is configurable and 0 gives 0 days', () => {
        const i = input();
        i.subcontractLabourShare = 0;
        const r = result('8.3', i, fakeBoq(() => ({ lab: 0, total: 100000 })));
        expect(r.labourCost).toBe(0);
        expect(r.calcDays).toBe(0);
    });

    it('negative or NaN crew numbers are not allowed to poison the wage (NaN -> 0)', () => {
        const i = input();
        i.blocks['1.5'] = { skilled: Number.NaN, labourers: 2, wageSet: 'A', days: 4 };
        const r = result('1.5', i, fakeBoq());
        expect(r.skilled).toBe(0);
        expect(r.dailyWage).toBe(1000);
        expect(Number.isFinite(r.calcDays ?? 0)).toBe(true);
    });
});

describe('typed duration (6.ประเมิน) and totals', () => {
    it('the typed days are independent of the calculated days', () => {
        const i = input();
        i.blocks['1.5'] = { skilled: 1, labourers: 5, wageSet: 'A', days: 99 };
        const r = result('1.5', i, fakeBoq(() => ({ lab: 33000, total: 90000 })));
        expect(r.days).toBe(99);
        expect(r.calcDays).toBe(10);
    });

    it('totalDays = sum of typed days; NaN / Infinity typed days count as 0', () => {
        const i = input();
        const before = computeManDay(i, fakeBoq()).totalDays;
        i.blocks['1.5'] = { skilled: 1, labourers: 5, wageSet: 'A', days: Number.NaN };
        i.blocks['1.6'] = { skilled: 1, labourers: 5, wageSet: 'A', days: Infinity };
        const after = computeManDay(i, fakeBoq());
        expect(after.totalDays).toBe(before - 10 - 1);
        expect(Number.isFinite(after.totalDays)).toBe(true);
    });

    it('a missing block input falls back to the sample crew and days', () => {
        const i = input();
        delete i.blocks['1.5'];
        const r = result('1.5', i, fakeBoq());
        expect(r.days).toBe(block('1.5').sample.days);
        expect(r.crew).toBe(6);
    });

    it('computes exactly the 32 planned blocks in task order, ids unique', () => {
        const r = computeManDay(input(), fakeBoq());
        expect(r.blocks).toHaveLength(32);
        expect(r.blocks.map(b => b.id)).toEqual(PLAN_TASKS.map(t => t.id));
        expect(new Set(r.blocks.map(b => b.id)).size).toBe(32);
    });
});

describe('budget per category = BOQ category', () => {
    it('each block budget equals its BOQ section total', () => {
        const boq = fakeBoq(no => ({ lab: no * 100, total: no * 1000 + 7 }));
        const r = computeManDay(input(), boq);
        for (const b of r.blocks.filter(x => x.id !== '4.1' && x.id !== '4.2' && x.id !== '5.1' && x.id !== '5.2')) {
            // Block 1.2 (site preparation) also carries section 1 (demolition, fill): docs/qa/BUGS.md.
            const extra = b.id === '1.2' ? 1 * 1000 + 7 : 0;
            expect(b.budget, b.id).toBe(b.section * 1000 + 7 + extra);
        }
    });

    it('split sections 17 / 18 divide by BOQ row and add back to the section total', () => {
        const boq = fakeBoq(no => ({ lab: no * 100, total: no * 1000 }));
        const r = computeManDay(input(), boq);
        const b41 = r.blocks.find(b => b.id === '4.1');
        const b42 = r.blocks.find(b => b.id === '4.2');
        const b51 = r.blocks.find(b => b.id === '5.1');
        const b52 = r.blocks.find(b => b.id === '5.2');
        expect((b41?.budget ?? 0) + (b42?.budget ?? 0)).toBeCloseTo(17000, 6);
        expect((b51?.budget ?? 0) + (b52?.budget ?? 0)).toBeCloseTo(18000, 6);
        expect(b41?.budget).toBeCloseTo(17000 * 0.7, 6);
        expect(b42?.budget).toBeCloseTo(17000 * 0.3, 6);
    });

    it('the row boundary is exclusive at 184 / 192: row 183 -> brick, row 184 -> conduit', () => {
        const mk = (excelRow: number): BoqResult => {
            const boq = fakeBoq(() => ({ lab: 0, total: 0 }));
            const s17 = boq.sections.find(s => s.no === 17);
            if (s17) s17.rows = [{ type: 'item', key: 'x', excelRow, labTotal: 5, matTotal: 5, total: 10 } as BoqItemRow];
            return boq;
        };
        const def = block('4.1').manday;
        const def2 = block('4.2').manday;
        expect(blockBoqTotals(def, mk(183)).total).toBe(10);
        expect(blockBoqTotals(def2, mk(183)).total).toBe(0);
        expect(blockBoqTotals(def, mk(184)).total).toBe(0);
        expect(blockBoqTotals(def2, mk(184)).total).toBe(10);
    });

    it('heading rows inside a split section are not summed as money', () => {
        const boq = fakeBoq(() => ({ lab: 0, total: 0 }));
        const s17 = boq.sections.find(s => s.no === 17);
        if (s17) s17.rows = [{ type: 'heading', key: 'h', excelRow: 180, desc: 'h' }];
        expect(blockBoqTotals(block('4.1').manday, boq)).toEqual({ labour: 0, total: 0 });
    });

    it('a BOQ without the section gives 0 budget and 0 labour (no throw)', () => {
        const boq: BoqResult = { sections: [], constructionTotal: 0, preConstructionTotal: 0 };
        const r = computeManDay(input(), boq);
        expect(r.totalBudget).toBe(0);
        expect(r.blocks.every(b => b.boqLabour === 0 && b.budget === 0)).toBe(true);
        expect(r.blocks.every(b => b.calcDays === null || b.calcDays === 0)).toBe(true);
    });

    it('totalBudget = sum of block budgets and a budget change in BOQ moves only its block', () => {
        const a = computeManDay(input(), fakeBoq());
        const b = computeManDay(input(), fakeBoq(no => (no === 9 ? { lab: 4000, total: 20000 } : { lab: 4000, total: 10000 })));
        expect(b.totalBudget - a.totalBudget).toBe(10000);
        expect(b.blocks.filter((x, i) => x.budget !== a.blocks[i]?.budget).map(x => x.id)).toEqual(['2.1']);
    });

    it('negative BOQ labour (credit lines) flows through without NaN', () => {
        const r = computeManDayBlock(block('1.5'), input().blocks['1.5'] ?? { skilled: 1, labourers: 5, wageSet: 'A', days: 1 }, input(),
            fakeBoq(() => ({ lab: -3300, total: -1 })));
        expect(r.calcDays).toBe(-1);
        expect(r.budget).toBe(-1);
    });
});
