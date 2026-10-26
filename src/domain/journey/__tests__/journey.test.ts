import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS, getLevel } from '../levels';
import { currentLevel, isUnlocked, journeyComplete, journeyRatio, levelStates, nextLevel, previousLevel } from '../progress';
import { CALCULATORS } from '../../calculators/registry';
import { BOQ_TEMPLATE_V5 } from '../../boq/template.v5';
import { calculatorInput, computeProject, createProject } from '../../project';
import { levelTotal } from '../money';

describe('journey levels', () => {
    it('have unique ids', () => {
        const ids = JOURNEY_LEVELS.map(l => l.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('cover every calculator that has inputs, each once', () => {
        const inJourney = JOURNEY_LEVELS.flatMap(l => (l.kind.type === 'calc' ? [l.kind.calc] : []));
        expect(new Set(inJourney).size).toBe(inJourney.length);
        // structure-summary is read-only (no inputs): shown as a checkpoint, not a level.
        const expected = CALCULATORS.map(c => c.id).filter(id => id !== 'structure-summary');
        expect([...inJourney].sort()).toEqual([...expected].sort());
    });

    it('cover every BOQ section', () => {
        const covered = new Set(JOURNEY_LEVELS.flatMap(l => l.sections));
        for (const s of BOQ_TEMPLATE_V5) expect(covered.has(s.no), `section ${s.no}`).toBe(true);
    });

    it('come after every calculator they read from', () => {
        const order = new Map(JOURNEY_LEVELS.map((l, i) => [l.kind.type === 'calc' ? l.kind.calc : l.id, i]));
        for (const c of CALCULATORS) {
            const at = order.get(c.id);
            if (at === undefined) continue;
            for (const d of c.deps) {
                const depAt = order.get(d);
                if (depAt !== undefined) expect(depAt, `${d} before ${c.id}`).toBeLessThan(at);
            }
        }
    });
});

describe('journey progress', () => {
    const at = (i: number) => JOURNEY_LEVELS[i]?.id ?? '';
    const [a, b, c] = [at(0), at(1), at(2)];

    it('starts with only the first level open', () => {
        const states = levelStates({});
        expect(states[a]).toBe('current');
        expect(states[b]).toBe('locked');
        expect(currentLevel({})?.id).toBe(a);
        expect(isUnlocked(b, {})).toBe(false);
    });

    it('unlocks the next level when one is passed or skipped', () => {
        expect(levelStates({ [a]: 'done' })[b]).toBe('current');
        const states = levelStates({ [a]: 'done', [b]: 'skipped' });
        expect(states[b]).toBe('skipped');
        expect(states[c]).toBe('current');
    });

    it('reopening a passed level keeps later passed levels open', () => {
        const states = levelStates({ [b]: 'done', [c]: 'done' });
        expect(states[a]).toBe('current');
        expect(states[c]).toBe('done');
        expect(isUnlocked(c, { [b]: 'done', [c]: 'done' })).toBe(true);
    });

    it('reports completion and ratio', () => {
        const all = Object.fromEntries(JOURNEY_LEVELS.map(l => [l.id, 'done' as const]));
        expect(journeyComplete(all)).toBe(true);
        expect(journeyRatio(all)).toBe(1);
        expect(journeyComplete({})).toBe(false);
        expect(journeyRatio({ [a]: 'done' })).toBeCloseTo(1 / JOURNEY_LEVELS.length);
    });

    it('steps forward and back', () => {
        expect(nextLevel(a)?.id).toBe(b);
        expect(previousLevel(b)?.id).toBe(a);
        expect(previousLevel(a)).toBeUndefined();
        expect(nextLevel(at(JOURNEY_LEVELS.length - 1))).toBeUndefined();
    });
});

describe('project with journey', () => {
    it('a skipped level puts nothing into the BOQ', () => {
        const sample = computeProject(createProject());
        // Section 1 (demolition, fill) is priced 0 in the Excel sample; precast slab has money.
        const level = getLevel('precast-slab');
        expect(level).toBeDefined();
        if (!level) return;
        expect(levelTotal(level, sample)).toBeGreaterThan(0);
        const skipped = computeProject({ ...createProject(), journey: { 'precast-slab': 'skipped' } });
        expect(levelTotal(level, skipped)).toBe(0);
        expect(skipped.calcOutputs['precast-slab']).toBeDefined();
        expect(Object.values(skipped.calcOutputs['precast-slab'] ?? {}).every(v => v === 0)).toBe(true);
        // Rows priced from it (consumables %) drop too, so the total falls by at least the level's own rows.
        expect(skipped.boq.constructionTotal).toBeLessThanOrEqual(sample.boq.constructionTotal - levelTotal(level, sample) + 1e-6);
    });

    it('a blank project uses the blank input of each calculator', () => {
        const blankProject = createProject('blank');
        for (const def of CALCULATORS) {
            const expected = def.blank ? def.blank() : def.defaults();
            expect(calculatorInput(blankProject, def), def.id).toEqual(expected);
        }
        const result = computeProject(blankProject);
        expect(Number.isFinite(result.boq.constructionTotal)).toBe(true);
    });
});
describe('level money', () => {
    it('counts calculator rows that sit in other sections (column rebar in section 6)', () => {
        const result = computeProject(createProject());
        const column = getLevel('column');
        expect(column).toBeDefined();
        if (!column) return;
        const section11 = result.boq.sections.find(s => s.no === 11)?.total ?? 0;
        expect(levelTotal(column, result)).toBeGreaterThan(0);
        expect(levelTotal(column, result)).not.toBeCloseTo(section11, 0);
    });

    it('splits nothing twice: level totals never exceed the construction + pre-construction total', () => {
        const result = computeProject(createProject());
        const sum = JOURNEY_LEVELS.reduce((s, l) => s + levelTotal(l, result), 0);
        expect(sum).toBeLessThanOrEqual(result.boq.constructionTotal + result.boq.preConstructionTotal + 1e-6);
    });
});
