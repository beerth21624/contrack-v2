// QA edge tests for project-level computation: sample / blank starts, overrides, journey skips, planning links.
import { describe, expect, it } from 'vitest';
import golden from '../boq/__tests__/golden.v5.json';
import type { BoqItemRow, BoqResult } from '../boq/types';
import { CALCULATORS } from '../calculators/registry';
import { JOURNEY_LEVELS } from '../journey/levels';
import { PLAN_TASKS } from '../planning';
import {
    calculatorBase, calculatorInput, computeProject, createProject, DEFAULT_PROJECT_META, projectPlanningInput,
    PROJECT_SCHEMA_VERSION, type Project,
} from '../project';

/** First path of a non-finite number inside any value, or null. */
function badNumber(v: unknown, path = ''): string | null {
    if (typeof v === 'number') return Number.isFinite(v) ? null : `${path}=${v}`;
    if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) { const b = badNumber(v[i], `${path}[${i}]`); if (b) return b; }
    } else if (typeof v === 'object' && v !== null) {
        for (const [k, x] of Object.entries(v)) { const b = badNumber(x, `${path}.${k}`); if (b) return b; }
    }
    return null;
}

const item = (boq: BoqResult, key: string): BoqItemRow => {
    for (const s of boq.sections) for (const r of s.rows) if (r.type === 'item' && r.key === key) return r;
    throw new Error(`row ${key} missing`);
};
const section = (boq: BoqResult, no: number) => {
    const s = boq.sections.find(x => x.no === no);
    if (!s) throw new Error(`section ${no} missing`);
    return s;
};
const withProject = (base: Project, patch: Partial<Project>): Project => ({ ...base, ...patch });

describe('createProject', () => {
    it('default is the sample house, blank has an empty project name', () => {
        const sample = createProject();
        expect(sample.start).toBe('sample');
        expect(sample.meta.projectName).toBe(DEFAULT_PROJECT_META.projectName);
        const blank = createProject('blank');
        expect(blank.start).toBe('blank');
        expect(blank.meta.projectName).toBe('');
        expect(blank.schemaVersion).toBe(PROJECT_SCHEMA_VERSION);
        expect(blank.boqOverrides).toEqual({});
        expect(blank.calculators).toEqual({});
        expect(blank.journey).toEqual({});
    });

    it('each call returns an independent project (mutating one does not leak)', () => {
        const a = createProject('sample');
        const b = createProject('sample');
        a.meta.projectName = 'changed';
        a.boqOverrides.R9 = { qty: 9 };
        expect(b.meta.projectName).toBe(DEFAULT_PROJECT_META.projectName);
        expect(b.boqOverrides).toEqual({});
        expect(DEFAULT_PROJECT_META.projectName).not.toBe('changed');
    });
});

describe('sample project', () => {
    const result = computeProject(createProject('sample'));

    it('construction total is the app sample 1,855,162.2484765165', () => {
        expect(result.boq.constructionTotal).toBeCloseTo(1855162.2484765165, 6);
    });

    it('differs from Excel M310 only by the documented KNOWN_DELTAS (-31 + 4,191.90522 + 684)', () => {
        const delta = -31 + 4191.90522 + 684;
        expect(result.boq.constructionTotal).toBeCloseTo(golden.constructionTotal + delta, 2);
        expect(golden.constructionTotal).toBeCloseTo(1850317.34, 2);
    });

    it('land inspection 7,500 is outside the construction total', () => {
        expect(result.boq.preConstructionTotal).toBe(7500);
        expect(section(result.boq, 0).inConstructionTotal).toBe(false);
        const withoutSection0 = result.boq.sections.filter(s => s.no !== 0).reduce((a, s) => a + s.total, 0);
        expect(result.boq.constructionTotal).toBeCloseTo(withoutSection0, 6);
    });

    it('a project without the "start" field (saved before it existed) is the sample', () => {
        const legacy: Project = { ...createProject('sample') };
        delete legacy.start;
        expect(computeProject(legacy).boq.constructionTotal).toBe(result.boq.constructionTotal);
    });

    it('no NaN / Infinity anywhere in the whole result', () => {
        expect(badNumber(result)).toBeNull();
    });

    it('computeProject is deterministic and does not mutate the project', () => {
        const p = createProject('sample');
        p.boqOverrides.R9 = { lab: 100 };
        const snapshot = structuredClone(p);
        const a = computeProject(p);
        const b = computeProject(p);
        expect(p).toEqual(snapshot);
        expect(a.boq.constructionTotal).toBe(b.boq.constructionTotal);
        expect(a.boq.preConstructionTotal).toBe(100);
    });
});

describe('blank project', () => {
    const result = computeProject(createProject('blank'));

    // Lump sums that ship with a blank project (typed prices x qty 1 from the Excel template, not calculators):
    // R16 เดินน้ำ-ไฟชั่วคราว 2,700 (sec 2), R32 วางผัง / ปักหมุด 5,500 (sec 4), R158 งานทาสีกันสนิม 10,000 (sec 15).
    it('only three documented lump sums are non-zero in the construction total (18,200)', () => {
        const nonZero = result.boq.sections.filter(s => s.inConstructionTotal && s.total !== 0).map(s => [s.no, s.total]);
        expect(nonZero).toEqual([[2, 2700], [4, 5500], [15, 10000]]);
        expect(result.boq.constructionTotal).toBe(18200);
    });

    it('the land inspection 7,500 stays in the pre-construction total', () => {
        expect(result.boq.preConstructionTotal).toBe(7500);
    });

    it('blank template zeroes the typed column-plate quantities (section 14)', () => {
        expect(item(result.boq, 'R148').qty).toBe(0);
        expect(item(result.boq, 'R149').qty).toBe(0);
        expect(section(result.boq, 14).total).toBe(0);
        // while the sample house keeps them
        const sample = computeProject(createProject('sample'));
        expect(item(sample.boq, 'R148').qty).toBe(21);
        expect(section(sample.boq, 14).total).toBe(9450);
    });

    it('typing a column-plate quantity on a blank project brings money back (300 per plate)', () => {
        const p = withProject(createProject('blank'), { boqOverrides: { R148: { qty: 10 } } });
        expect(section(computeProject(p).boq, 14).total).toBeCloseTo(3000, 6);
    });

    it('every calculator output is finite and the planning result has no NaN', () => {
        expect(badNumber(result.calcOutputs)).toBeNull();
        expect(badNumber(result.planning)).toBeNull();
    });

    it('every non-lump-sum section is exactly 0 (no stray sample money)', () => {
        for (const s of result.boq.sections) {
            if ([0, 2, 4, 15].includes(s.no)) continue;
            expect(s.total, `section ${s.no}`).toBe(0);
        }
    });

    it('blank planning: no sample progress, no actual cost, EVM EV 0 and CPI null', () => {
        const input = projectPlanningInput(createProject('blank'));
        expect(input.cashflow.actualCost).toBe(0);
        expect(Object.values(input.cashflow.progress).every(v => v === 0)).toBe(true);
        expect(input.schedule.tasks['1.1']?.actual).toBeUndefined();
        expect(result.planning.cashflow.evm.ev).toBe(0);
        expect(result.planning.cashflow.evm.cpi).toBeNull();
        expect(result.planning.cashflow.evm.eacCost).toBeNull();
    });

    it('sample planning keeps the Excel progress (task 1.1 actual 7,000, actual cost 850,000)', () => {
        const input = projectPlanningInput(createProject('sample'));
        expect(input.cashflow.actualCost).toBe(850000);
        expect(input.schedule.tasks['1.1']?.actual?.cost).toBe(7000);
    });
});

describe('BOQ overrides through the project', () => {
    const base = createProject('sample');
    const total0 = computeProject(base).boq;

    it('R9 land inspection: qty / waste / mat / lab overrides and clearing back', () => {
        const run = (ov: Project['boqOverrides']) => computeProject(withProject(base, { boqOverrides: ov })).boq;
        expect(run({ R9: { qty: 3 } }).preConstructionTotal).toBe(22500);
        expect(run({ R9: { lab: 1000 } }).preConstructionTotal).toBe(1000);
        expect(run({ R9: { mat: 100 } }).preConstructionTotal).toBe(7600);
        expect(run({ R9: { waste: 1, mat: 100 } }).preConstructionTotal).toBe(7700);
        expect(run({ R9: { qty: 0 } }).preConstructionTotal).toBe(0);
        // construction total unaffected by section 0 edits
        expect(run({ R9: { qty: 3 } }).constructionTotal).toBe(total0.constructionTotal);
        // cleared override = untouched project
        expect(run({}).constructionTotal).toBe(total0.constructionTotal);
        expect(run({ R9: {} }).constructionTotal).toBe(total0.constructionTotal);
    });

    it('negative and huge qty overrides stay finite', () => {
        const neg = computeProject(withProject(base, { boqOverrides: { R9: { qty: -1 } } })).boq;
        expect(neg.preConstructionTotal).toBe(-7500);
        const huge = computeProject(withProject(base, { boqOverrides: { R9: { qty: 1e9 } } }));
        expect(huge.boq.preConstructionTotal).toBe(7.5e12);
        expect(badNumber(huge)).toBeNull();
    });

    it('an override on a construction row moves the construction total by exactly its delta', () => {
        // R16 has qty 1, mat 1,200 (typed) -> mat override 2,000 adds 800
        const m = computeProject(withProject(base, { boqOverrides: { R16: { mat: 2000 } } })).boq;
        expect(m.constructionTotal - total0.constructionTotal).toBeCloseTo(item(m, 'R16').matUnit - item(total0, 'R16').matUnit, 6);
    });

    it('overrides flow into planning (Man-Day budget of the category and cash-flow quotation)', () => {
        const p = computeProject(withProject(base, { boqOverrides: { R16: { lab: 100000 } } }));
        const block = p.planning.manday.blocks.find(b => b.id === '1.1');
        expect(block?.budget).toBeCloseTo(section(p.boq, 2).total, 6);
        expect(p.planning.cashflow.quotation).toBeCloseTo(p.boq.constructionTotal * 1.3, 6);
    });

    it('stale override keys (no such BOQ line) are harmless', () => {
        const p = withProject(base, { boqOverrides: { R99999: { qty: 5 }, 'x:y:z': { mat: 1 } } });
        expect(computeProject(p).boq.constructionTotal).toBe(total0.constructionTotal);
    });
});

describe('journey "ไม่มีในโครงการนี้" (skipped levels)', () => {
    const base = createProject('sample');
    const full = computeProject(base);

    it('skipping the layout level zeroes R32 (extra row) and every output of its calculator', () => {
        const p = computeProject(withProject(base, { journey: { layout: 'skipped' } }));
        expect(item(p.boq, 'R32').qty).toBe(0);
        expect(item(p.boq, 'R32').total).toBe(0);
        expect(Object.values(p.calcOutputs.layout ?? {}).every(v => v === 0)).toBe(true);
        expect(p.boq.constructionTotal).toBeCloseTo(full.boq.constructionTotal - 5500, 6);
    });

    it('a quantity typed on the BOQ page for a skipped level line is dropped, other edits stay', () => {
        const ov = { R32: { qty: 50, mat: 10, lab: 20 } };
        const skipped = computeProject(withProject(base, { journey: { layout: 'skipped' }, boqOverrides: ov })).boq;
        expect(item(skipped, 'R32').qty).toBe(0);
        expect(item(skipped, 'R32').total).toBe(0);
        expect(item(skipped, 'R32').matUnit).toBe(10);
        expect(item(skipped, 'R32').labUnit).toBe(20);
    });

    it('state transition: skip -> done again brings the typed quantity back', () => {
        const ov = { R32: { qty: 2 } };
        const on = computeProject(withProject(base, { journey: { layout: 'done' }, boqOverrides: ov })).boq;
        const off = computeProject(withProject(base, { journey: { layout: 'skipped' }, boqOverrides: ov })).boq;
        const undone = computeProject(withProject(base, { journey: {}, boqOverrides: ov })).boq;
        expect(item(on, 'R32').total).toBeCloseTo(2 * (4000 + 1500), 6);
        expect(item(off, 'R32').total).toBe(0);
        expect(undone.constructionTotal).toBe(on.constructionTotal);
    });

    it('roof-structure level zeroes its extra row R158', () => {
        const p = computeProject(withProject(base, { journey: { 'roof-structure': 'skipped' }, boqOverrides: { R158: { qty: 7 } } })).boq;
        expect(item(p, 'R158').total).toBe(0);
    });

    it('a skipped calculator level empties its slots: its BOQ section loses those rows and money', () => {
        const p = computeProject(withProject(base, { journey: { brick: 'skipped' } }));
        expect(Object.values(p.calcOutputs.brick ?? {}).every(v => v === 0)).toBe(true);
        expect(p.boq.constructionTotal).toBeLessThan(full.boq.constructionTotal);
        expect(badNumber(p)).toBeNull();
    });

    it('skipping every level of the journey still computes without NaN and costs less than the full sample', () => {
        const journey = Object.fromEntries(JOURNEY_LEVELS.map(l => [l.id, 'skipped' as const]));
        const p = computeProject(withProject(base, { journey }));
        expect(badNumber(p)).toBeNull();
        expect(p.boq.constructionTotal).toBeLessThan(full.boq.constructionTotal);
    });

    it('"done" marks never change the numbers', () => {
        const journey = Object.fromEntries(JOURNEY_LEVELS.map(l => [l.id, 'done' as const]));
        expect(computeProject(withProject(base, { journey })).boq.constructionTotal).toBe(full.boq.constructionTotal);
    });

    // Decision table: marking a "type quantities on the BOQ page" level (column plates, section 14) as
    // "ไม่มีในโครงการนี้" must leave no money in that section, like every calculator level does.
    // skippedWork() only zeroes calculator levels and levels with extraRows; kind 'boq' levels are ignored.
    it('inputs: journey column-plates = skipped on the sample (R148/R149 qty 21), expected section 14 total 0, got 9,450 (project.ts skippedWork)', () => {
        const p = computeProject(withProject(base, { journey: { 'column-plates': 'skipped' } }));
        expect(section(p.boq, 14).total).toBe(0);
    });
    it('inputs: journey column-plates = skipped with typed qty override R148=10, expected section 14 total 0, got 3,000 (project.ts skippedWork)', () => {
        const p = computeProject(withProject(createProject('blank'), { journey: { 'column-plates': 'skipped' }, boqOverrides: { R148: { qty: 10 } } }));
        expect(section(p.boq, 14).total).toBe(0);
    });
});

describe('calculator input resolution', () => {
    const def = CALCULATORS.find(c => c.blank !== undefined) ?? CALCULATORS[0];

    it('calculatorBase gives the sample for sample projects and the blank form for blank ones', () => {
        if (!def) throw new Error('no calculators');
        expect(calculatorBase(createProject('sample'), def)).toEqual(def.defaults());
        if (def.blank) expect(calculatorBase(createProject('blank'), def)).toEqual(def.blank());
    });

    it('stored input is merged over the base so new fields keep a default', () => {
        if (!def) throw new Error('no calculators');
        const p = withProject(createProject('sample'), { calculators: { [def.id]: {} } });
        expect(calculatorInput(p, def)).toEqual(def.defaults());
    });

    it('a non-object stored value (corrupt save) falls back to the base', () => {
        if (!def) throw new Error('no calculators');
        for (const bad of [null, 5, 'text', undefined]) {
            const p = withProject(createProject('sample'), { calculators: { [def.id]: bad } });
            expect(calculatorInput(p, def)).toEqual(def.defaults());
        }
    });

    it('unknown calculator ids in the project are ignored', () => {
        const p = withProject(createProject('sample'), { calculators: { 'no-such-calculator': { a: 1 } } });
        expect(computeProject(p).boq.constructionTotal).toBe(computeProject(createProject('sample')).boq.constructionTotal);
    });
});

describe('planning links to the BOQ', () => {
    const sample = computeProject(createProject('sample'));

    it('every Man-Day block budget equals its BOQ category (split sections add up)', () => {
        const bySection = new Map<number, number>();
        for (const b of sample.planning.manday.blocks) bySection.set(b.section, (bySection.get(b.section) ?? 0) + b.budget);
        for (const [no, budget] of bySection) expect(budget, `section ${no}`).toBeCloseTo(section(sample.boq, no).total, 6);
    });

    it('the sample plan budget equals the BOQ construction total', () => {
        expect(sample.planning.manday.totalBudget).toBeCloseTo(sample.boq.constructionTotal, 6);
        expect(sample.planning.schedule.budget).toBeCloseTo(sample.boq.constructionTotal, 6);
        expect(PLAN_TASKS).toHaveLength(32);
    });

    // BOQ section 1 (demolition, fill) has no plan task (PLAN_TASKS maps sections 2..31). Its money is in the
    // construction total but not in the S-curve budget / task weights, so the plan under-weights it.
    it('inputs: R12 demolition lab 50,000 (section 1), expected schedule.budget = constructionTotal, got constructionTotal - 50,000 (tasks.ts has no section-1 task)', () => {
        const p = computeProject(withProject(createProject('sample'), { boqOverrides: { R12: { qty: 1, lab: 50000 } } }));
        expect(section(p.boq, 1).total).toBe(50000);
        expect(p.planning.schedule.budget).toBeCloseTo(p.boq.constructionTotal, 6);
    });

    it('cash-in total equals the quotation (installments sum to 100 %) on the sample', () => {
        const c = sample.planning.cashflow;
        expect(c.installmentPctTotal).toBeCloseTo(1, 12);
        expect(c.totalIncome).toBeCloseTo(c.quotation, 6);
        expect(c.quotation).toBeCloseTo(sample.boq.constructionTotal * 1.3, 6);
    });

    it('a corrupt stored planning block resolves to defaults instead of throwing', () => {
        const bad = { schedule: 'oops', manday: 7, cashflow: null } as unknown as Project['planning'];
        const p = computeProject(withProject(createProject('sample'), { planning: bad }));
        expect(p.planning.schedule.budget).toBeCloseTo(sample.planning.schedule.budget, 6);
        expect(badNumber(p.planning)).toBeNull();
    });

    it('a partial stored planning input keeps the other defaults (crew change only)', () => {
        const planning = { manday: { blocks: { '1.5': { skilled: 2, labourers: 5, wageSet: 'A' as const, days: 10 } } } } as unknown as Project['planning'];
        const p = computeProject(withProject(createProject('sample'), { planning }));
        const b15 = p.planning.manday.blocks.find(b => b.id === '1.5');
        expect(b15?.dailyWage).toBe(2 * 800 + 5 * 500);
        expect(p.planning.manday.blocks.find(b => b.id === '1.6')?.days).toBe(1);
    });
});
