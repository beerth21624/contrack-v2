// Wage sets as a list (W0, docs/workforce/00-crew-management-design.md §2): add / rename / delete,
// delete protection, unknown ids, the older { A, B } shape, and Excel numbers unchanged.
import { describe, expect, it } from 'vitest';
import { computeBoq } from '../../boq/engine';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { computeProject, createProject, type Project } from '../../project';
import { validateDoc, validateProject } from '../../sync/project-docs';
import {
    addWageSet, builtInWageSets, computeManDay, computePlanning, defaultPlanningInput, nextWageSetId, normaliseWageSets,
    PLAN_TASKS, removeWageSet, resolvePlanningInput, resolveWageSet, updateWageSet, wageSetLabel, wageSetUsage,
    type ManDayInput, type PlanningInput, type WageSet,
} from '..';

const boq = computeBoq({ sections: BOQ_TEMPLATE_V5 });
const block = (md: ManDayInput, id: string) => {
    const b = md.blocks[id];
    if (!b) throw new Error(`block ${id} missing`);
    return b;
};
const resultBlock = (md: ManDayInput, id: string) => {
    const b = computeManDay(md, boq).blocks.find(x => x.id === id);
    if (!b) throw new Error(`result ${id} missing`);
    return b;
};
/** A planning input as stored before the list: wage sets keyed by 'A' / 'B', no names. */
function oldShape(p: PlanningInput): PlanningInput {
    const rec = Object.fromEntries(p.manday.wageSets.map(s => [s.id, { skilled: s.skilled, labourer: s.labourer }]));
    return { ...p, manday: { ...p.manday, wageSets: rec as unknown as WageSet[] } };
}

describe('built-in sets', () => {
    it('A and B are the Excel sets, in that order', () => {
        expect(defaultPlanningInput().manday.wageSets).toEqual([
            { id: 'A', name: 'งานทั่วไป', skilled: 800, labourer: 500 },
            { id: 'B', name: 'หลังคา ไฟฟ้า ฝ้า สี อลูมิเนียม เบ็ดเตล็ด', skilled: 1000, labourer: 600 },
        ]);
        expect(wageSetLabel({ id: 'A', name: 'งานทั่วไป', skilled: 0, labourer: 0 })).toBe('A · งานทั่วไป');
        expect(wageSetLabel({ id: 'C', name: '  ', skilled: 0, labourer: 0 })).toBe('ชุด C');
    });
});

describe('add, rename, delete', () => {
    it('adds sets with generated ids (C, D, …) and A’s rates unless given', () => {
        const md0 = defaultPlanningInput().manday;
        const { input: md1, id: c } = addWageSet(md0);
        expect(c).toBe('C');
        expect(md1.wageSets.at(-1)).toEqual({ id: 'C', name: '', skilled: 800, labourer: 500 });
        const { input: md2, id: d } = addWageSet(md1, { name: 'ทีมไฟฟ้า ช่างพงษ์', skilled: 1200, labourer: 650 });
        expect(d).toBe('D');
        expect(md2.wageSets.map(s => s.id)).toEqual(['A', 'B', 'C', 'D']);
        expect(md0.wageSets).toHaveLength(2);   // inputs are not mutated
    });

    it('ids after Z continue as AA, AB, … and skip ids in use', () => {
        const sets = (ids: string[]): WageSet[] => ids.map(id => ({ id, name: '', skilled: 0, labourer: 0 }));
        expect(nextWageSetId(sets(['A', 'B', 'D']))).toBe('C');
        expect(nextWageSetId(sets(['A', 'B', 'C']))).toBe('D');
        const az = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
        expect(nextWageSetId(sets(az))).toBe('AA');
        expect(nextWageSetId(sets([...az, 'AA']))).toBe('AB');
    });

    it('renames and re-rates any set, built-in ones too; unknown ids change nothing', () => {
        const { input } = addWageSet(defaultPlanningInput().manday);
        const md = updateWageSet(updateWageSet(input, 'C', { name: 'ทีมทาสี' }), 'A', { name: 'งานโครงสร้าง', skilled: 850 });
        expect(md.wageSets.find(s => s.id === 'C')?.name).toBe('ทีมทาสี');
        expect(md.wageSets.find(s => s.id === 'A')).toEqual({ id: 'A', name: 'งานโครงสร้าง', skilled: 850, labourer: 500 });
        expect(updateWageSet(md, 'Z', { name: 'x' })).toBe(md);
    });

    it('deletes a user set and moves the blocks that used it to set A', () => {
        const { input, id } = addWageSet(defaultPlanningInput().manday, { skilled: 1200, labourer: 650 });
        const md: ManDayInput = { ...input, blocks: { ...input.blocks, '3.2': { ...block(input, '3.2'), wageSet: id }, '1.5': { ...block(input, '1.5'), wageSet: id } } };
        expect(wageSetUsage(md, id).sort()).toEqual(['1.5', '3.2']);
        const after = removeWageSet(md, id);
        expect(after.wageSets.map(s => s.id)).toEqual(['A', 'B']);
        expect(block(after, '3.2').wageSet).toBe('A');
        expect(block(after, '1.5').wageSet).toBe('A');
        expect(wageSetUsage(after, id)).toEqual([]);
        // Other blocks keep their set.
        expect(block(after, '3.3').wageSet).toBe(block(md, '3.3').wageSet);
        expect(resultBlock(after, '3.2').dailyWage).toBe(block(after, '3.2').skilled * 800 + block(after, '3.2').labourers * 500);
    });

    it('A and B cannot be deleted', () => {
        const md = defaultPlanningInput().manday;
        expect(removeWageSet(md, 'A')).toBe(md);
        expect(removeWageSet(md, 'B')).toBe(md);
        expect(removeWageSet(md, 'nope')).toBe(md);
        // A stored list without them gets them back.
        expect(normaliseWageSets([{ id: 'C', name: 'x', skilled: 1, labourer: 2 }]).map(s => s.id)).toEqual(['A', 'B', 'C']);
    });
});

describe('daily wage R', () => {
    it('computes R with a user set (ช่าง × rate + คนงาน × rate) and S = labour ÷ R', () => {
        const { input, id } = addWageSet(defaultPlanningInput().manday, { name: 'ทีมฐานราก', skilled: 1200, labourer: 650 });
        const md: ManDayInput = { ...input, blocks: { ...input.blocks, '1.5': { skilled: 2, labourers: 4, wageSet: id, days: 10 } } };
        const r = resultBlock(md, '1.5');
        expect(r.wageSet).toBe('C');
        expect(r.dailyWage).toBe(2 * 1200 + 4 * 650);
        expect(r.calcDays).toBeCloseTo(37357.026 / 5000, 9);
        expect(r.suggestedDays).toBe(7);
        expect(r.budget).toBeCloseTo(104693.0694, 3);   // U is the BOQ total, whatever the set
    });

    it('an unknown set id falls back to the task’s Excel set, without crashing', () => {
        const md = defaultPlanningInput().manday;
        const b32 = block(md, '3.2');   // Excel set B
        const b11 = block(md, '1.1');   // Excel set A
        const broken: ManDayInput = { ...md, blocks: { ...md.blocks, '3.2': { ...b32, wageSet: 'deleted' }, '1.1': { ...b11, wageSet: '' } } };
        const r32 = resultBlock(broken, '3.2');
        expect(r32.wageSet).toBe('B');
        expect(r32.dailyWage).toBe(b32.skilled * 1000 + b32.labourers * 600);
        expect(resultBlock(broken, '1.1').wageSet).toBe('A');
        expect(computePlanning({ ...defaultPlanningInput(), manday: broken }, boq)).toEqual(computePlanning(defaultPlanningInput(), boq));
        // Even with no sets at all, the Excel constants of the task's set are used.
        expect(resolveWageSet([], 'x', 'B')).toMatchObject({ id: 'B', skilled: 1000, labourer: 600 });
    });
});

describe('older stored shape { A, B }', () => {
    it('normalises the record, each set over its default, names from the defaults', () => {
        expect(normaliseWageSets({ A: { skilled: 900 }, B: { skilled: 1100, labourer: 650 } })).toEqual([
            { id: 'A', name: 'งานทั่วไป', skilled: 900, labourer: 500 },
            { id: 'B', name: 'หลังคา ไฟฟ้า ฝ้า สี อลูมิเนียม เบ็ดเตล็ด', skilled: 1100, labourer: 650 },
        ]);
        expect(normaliseWageSets(undefined)).toEqual(builtInWageSets());
        expect(normaliseWageSets('garbage')).toEqual(builtInWageSets());
        expect(normaliseWageSets({})).toEqual(builtInWageSets());
    });

    it('drops broken and duplicate entries of a stored list', () => {
        expect(normaliseWageSets([
            { id: 'B', skilled: 1100 }, null, { name: 'no id' }, { id: 'C', name: 'x', skilled: 1, labourer: 2 }, { id: 'C', skilled: 9 },
        ])).toEqual([
            { id: 'A', name: 'งานทั่วไป', skilled: 800, labourer: 500 },
            { id: 'B', name: 'หลังคา ไฟฟ้า ฝ้า สี อลูมิเนียม เบ็ดเตล็ด', skilled: 1100, labourer: 600 },
            { id: 'C', name: 'x', skilled: 1, labourer: 2 },
        ]);
    });

    it('gives exactly the same planning numbers as the list (sample and typed wages)', () => {
        const typed = defaultPlanningInput();
        typed.manday.wageSets = [
            { id: 'A', name: 'งานทั่วไป', skilled: 900, labourer: 550 },
            { id: 'B', name: 'หลังคา ไฟฟ้า ฝ้า สี อลูมิเนียม เบ็ดเตล็ด', skilled: 1100, labourer: 650 },
        ];
        for (const t of PLAN_TASKS) {
            const b = block(typed.manday, t.id);
            typed.manday.blocks[t.id] = { ...b, wageSet: b.wageSet === 'A' ? 'B' : 'A' };
        }
        for (const p of [defaultPlanningInput(), typed]) {
            const resolved = resolvePlanningInput(oldShape(p));
            expect(resolved).toEqual(p);
            expect(computePlanning(resolved, boq)).toEqual(computePlanning(p, boq));
            // computeManDay also takes the record directly (an input that skipped resolvePlanningInput).
            expect(computeManDay(oldShape(p).manday, boq)).toEqual(computeManDay(p.manday, boq));
        }
    });

    it('an old project document still computes the same and validates', () => {
        const project: Project = { ...createProject('sample'), planning: { manday: oldShape(defaultPlanningInput()).manday } };
        expect(computeProject(project).planning).toEqual(computeProject(createProject('sample')).planning);
        expect(validateProject(project)).toEqual({ ok: true });
    });
});

describe('planning:manday document validation', () => {
    const md = defaultPlanningInput().manday;
    it('accepts the list, the older record and partial documents', () => {
        expect(validateDoc('planning:manday', md)).toEqual({ ok: true });
        expect(validateDoc('planning:manday', addWageSet(md, { name: 'ทีมไฟฟ้า' }).input)).toEqual({ ok: true });
        expect(validateDoc('planning:manday', oldShape(defaultPlanningInput()).manday)).toEqual({ ok: true });
        expect(validateDoc('planning:manday', { wageSets: { A: { skilled: 900 } } })).toEqual({ ok: true });
        expect(validateDoc('planning:manday', { subcontractLabourShare: 0.3 })).toEqual({ ok: true });
        expect(validateDoc('planning:manday', { blocks: { '1.1': { days: 3 } } })).toEqual({ ok: true });
        expect(validateDoc('planning:manday', { blocks: { '1.1': { wageSet: 'C' } } })).toEqual({ ok: true });
    });

    it('rejects broken wage sets and block set ids', () => {
        const bad = (wageSets: unknown) => validateDoc('planning:manday', { wageSets }).ok;
        expect(bad('A')).toBe(false);
        expect(bad([{ name: 'no id', skilled: 1, labourer: 1 }])).toBe(false);
        expect(bad([{ id: 'C', skilled: '1200' }])).toBe(false);
        expect(bad([{ id: 'C' }, { id: 'C' }])).toBe(false);
        expect(bad([{ id: 'C', name: 'x'.repeat(101) }])).toBe(false);
        expect(bad([{ id: 'C', colour: 'red' }])).toBe(false);
        expect(bad(Array.from({ length: 51 }, (_, i) => ({ id: `S${String(i)}` })))).toBe(false);
        expect(bad({ A: { skilled: Number.POSITIVE_INFINITY } })).toBe(false);
        expect(bad({ A: 800 })).toBe(false);
        expect(validateDoc('planning:manday', { blocks: { '1.1': { wageSet: 3 } } }).ok).toBe(false);
        expect(validateDoc('planning:manday', { blocks: [] }).ok).toBe(false);
        // Other planning sheets keep the old rule (any object).
        expect(validateDoc('planning:schedule', { anything: [1] }).ok).toBe(true);
    });

    it('a project with a user set computes and validates', () => {
        const { input, id } = addWageSet(md, { skilled: 1200, labourer: 650 });
        const withSet: ManDayInput = { ...input, blocks: { ...input.blocks, '2.1': { ...block(input, '2.1'), wageSet: id } } };
        expect(validateProject({ ...createProject('sample'), planning: { manday: withSet } })).toEqual({ ok: true });
    });
});
