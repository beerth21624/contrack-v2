import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS, getLevel, type JourneyLevel } from '../levels';
import {
    availableLevels, blockingLevels, currentLevel, firstStepToward, isUnlocked, journeyComplete, journeyRatio, levelStates,
    nextLevel, nextOpenLevel, previousLevel, type JourneyProgress,
} from '../progress';
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
        expect(nextLevel(a, {})?.id).toBe(b);
        expect(previousLevel(b, { [a]: 'done' })?.id).toBe(a);
        expect(previousLevel(a, {})).toBeUndefined();
        const allButLast = Object.fromEntries(JOURNEY_LEVELS.slice(0, -1).map(l => [l.id, 'done' as const]));
        expect(nextLevel(at(JOURNEY_LEVELS.length - 1), allButLast)).toBeUndefined();
    });
});

/** Every level up to and including `lastId` (journey order) marked done, plus `extra`. */
function doneThrough(lastId: string, extra: JourneyProgress = {}): JourneyProgress {
    const i = JOURNEY_LEVELS.findIndex(l => l.id === lastId);
    if (i < 0) throw new Error(`no level ${lastId}`);
    return { ...Object.fromEntries(JOURNEY_LEVELS.slice(0, i + 1).map(l => [l.id, 'done' as const])), ...extra };
}
const ids = (levels: readonly JourneyLevel[]) => levels.map(l => l.id);
const done = (...levelIds: string[]): JourneyProgress => Object.fromEntries(levelIds.map(id => [id, 'done' as const]));

describe('journey prerequisites (docs/rebuild/CONSTRUCTION_FLOW.md §4)', () => {
    const index = new Map(JOURNEY_LEVELS.map((l, i) => [l.id, i]));

    // List order is not part of the rule: a prerequisite may sit later in the list (group D waits for paint).
    // Existing ids and no cycles (next test) are enough for some step to be open until every one is passed.
    it('name existing levels, each once, never the level itself', () => {
        for (const l of JOURNEY_LEVELS) {
            expect(new Set(l.after).size, `${l.id} lists a level twice`).toBe(l.after.length);
            expect(l.after, `${l.id} after itself`).not.toContain(l.id);
            for (const id of l.after) expect(index.get(id), `${l.id} after unknown "${id}"`).toBeDefined();
        }
    });

    it('always leave a step open until every step is passed (passing them in any open order)', () => {
        // Pass the last open step each time, the order furthest from the list order.
        let progress: JourneyProgress = {};
        for (let n = 0; n < JOURNEY_LEVELS.length; n++) {
            const open = availableLevels(progress);
            expect(open.length, `nothing open after ${String(n)} steps`).toBeGreaterThan(0);
            const last = open[open.length - 1];
            if (last === undefined) break;
            progress = { ...progress, [last.id]: 'done' };
        }
        expect(journeyComplete(progress)).toBe(true);
    });

    it('have no cycles', () => {
        const byId = new Map(JOURNEY_LEVELS.map(l => [l.id, l]));
        const visiting = new Set<string>();
        const finished = new Set<string>();
        const visit = (id: string, path: readonly string[]) => {
            if (finished.has(id)) return;
            expect(visiting.has(id), `cycle: ${[...path, id].join(' → ')}`).toBe(false);
            visiting.add(id);
            for (const d of byId.get(id)?.after ?? []) visit(d, [...path, id]);
            visiting.delete(id);
            finished.add(id);
        };
        for (const l of JOURNEY_LEVELS) visit(l.id, []);
    });

    it('only the first level opens with nothing before it', () => {
        expect(JOURNEY_LEVELS.filter(l => l.after.length === 0).map(l => l.id)).toEqual(['project-info']);
    });

    it('wait for every calculator they read from (directly or through other levels)', () => {
        const byId = new Map(JOURNEY_LEVELS.map(l => [l.id, l]));
        const levelOfCalc = new Map(JOURNEY_LEVELS.flatMap(l => (l.kind.type === 'calc' ? [[l.kind.calc, l.id] as const] : [])));
        const ancestors = (id: string, seen = new Set<string>()): Set<string> => {
            for (const d of byId.get(id)?.after ?? []) {
                if (seen.has(d)) continue;
                seen.add(d);
                ancestors(d, seen);
            }
            return seen;
        };
        for (const c of CALCULATORS) {
            const levelId = levelOfCalc.get(c.id);
            if (levelId === undefined) continue;
            const before = ancestors(levelId);
            for (const d of c.deps) {
                const depLevel = levelOfCalc.get(d);
                if (depLevel !== undefined) expect(before.has(depLevel), `${depLevel} before ${levelId}`).toBe(true);
            }
        }
        // The data links the flow document names.
        const links = [['door-window', 'brick'], ['brick', 'plaster'], ['footing', 'pedestal'], ['roofing', 'roof-structure']] as const;
        for (const [from, to] of links) expect(getLevel(to)?.after, `${from} → ${to}`).toContain(from);
    });

    it('a level opens only when everything before it is passed; several open at once', () => {
        const progress = doneThrough('ground-beam');
        expect(ids(availableLevels(progress))).toEqual(['slab-on-grade', 'stair', 'waste-pipe']);
        expect(levelStates(progress)['precast-slab']).toBe('locked');
        expect(currentLevel(progress)?.id).toBe('slab-on-grade');
        expect(isUnlocked('stair', progress)).toBe(true);
        expect(isUnlocked('column-plates', progress)).toBe(false);
    });

    it('group A: stairs beside the slabs and first-floor columns; column plates wait for both', () => {
        const chain = doneThrough('ground-beam', done('slab-on-grade', 'precast-slab', 'column', 'roof-beam', 'roof-slab'));
        expect(levelStates(chain)['column-plates']).toBe('locked');
        expect(ids(blockingLevels('column-plates', chain))).toEqual(['stair']);
        // Stairs first: the plates wait for the slab chain instead.
        const stairsFirst = doneThrough('ground-beam', done('stair'));
        expect(ids(blockingLevels('column-plates', stairsFirst))).toEqual(['roof-beam', 'roof-slab']);
        expect(levelStates({ ...chain, ...done('stair') })['column-plates']).toBe('current');
    });

    it('group B: roofing and openings open together after the plates; plaster waits for the roof frame and the walls', () => {
        const plates = doneThrough('column-plates', done('waste-pipe'));
        expect(ids(availableLevels(plates))).toEqual(['roofing', 'door-window']);
        expect(ids(blockingLevels('roof-structure', plates))).toEqual(['roofing']);
        const openings = { ...plates, ...done('door-window') };
        expect(ids(availableLevels(openings))).toEqual(['roofing', 'brick', 'electrical-pipe']);
        const walls = { ...openings, ...done('brick') };
        expect(ids(blockingLevels('plaster', walls))).toEqual(['roof-structure']);
        expect(levelStates({ ...walls, ...done('roofing', 'roof-structure') }).plaster).toBe('current');
    });

    it('group C: the four finishes open together after plaster; paint waits for all four', () => {
        const plaster = doneThrough('plaster', done('waste-pipe', 'electrical-pipe', 'electrical-cable'));
        const open = ids(availableLevels(plaster));
        for (const id of ['ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing', 'water-pipe']) expect(open).toContain(id);
        expect(ids(blockingLevels('paint', plaster))).toEqual(['ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing']);
        const three = { ...plaster, ...done('ceiling', 'floor-tile', 'toilet-tile') };
        expect(ids(blockingLevels('paint', three))).toEqual(['wall-finishing']);
        expect(levelStates({ ...three, 'wall-finishing': 'skipped' }).paint).toBe('current');
    });

    it('group D: the fittings open with misc after paint; sanitary ware waits for the whole group', () => {
        const groupD = ['load-center', 'electrical-equipment', 'sanitary-system', 'misc'];
        for (const id of groupD) expect(getLevel(id)?.after, id).toEqual(['paint']);
        expect(getLevel('sanitary-ware')?.after).toEqual(groupD);

        const plaster = doneThrough('plaster', done('waste-pipe', 'electrical-pipe', 'electrical-cable'));
        const states = levelStates(plaster);
        for (const id of groupD) expect(states[id], id).toBe('locked');
        // "รอ:" names a step that sits later in the list.
        for (const id of groupD) expect(ids(blockingLevels(id, plaster)), id).toEqual(['paint']);
        expect(ids(blockingLevels('sanitary-ware', plaster))).toEqual(groupD);

        const painted = { ...plaster, ...done('ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing', 'paint') };
        const open = ids(availableLevels(painted));
        for (const id of groupD) expect(open).toContain(id);
        expect(levelStates(painted)['sanitary-ware']).toBe('locked');

        const fittings = { ...painted, ...done('load-center', 'electrical-equipment', 'sanitary-system') };
        expect(ids(blockingLevels('sanitary-ware', fittings))).toEqual(['misc']);
        expect(levelStates({ ...fittings, ...done('misc') })['sanitary-ware']).toBe('current');
    });

    it('a prerequisite later in the list: the way there, confirm-and-next and stepping still work', () => {
        const plaster = doneThrough('plaster', done('waste-pipe', 'electrical-pipe', 'electrical-cable'));
        // The way to a fitting goes through the finishes (later in the list).
        expect(firstStepToward('load-center', plaster)?.id).toBe('ceiling');
        expect(firstStepToward('sanitary-ware', plaster)?.id).toBe('ceiling');
        const fittings = { ...plaster, ...done('ceiling', 'floor-tile', 'toilet-tile', 'wall-finishing', 'paint', 'load-center', 'electrical-equipment', 'sanitary-system') };
        expect(firstStepToward('sanitary-ware', fittings)?.id).toBe('misc');
        // A passed prerequisite blocks nothing, even when its own prerequisites were reopened.
        const { plaster: _reopened, ...reopened } = fittings;
        expect(firstStepToward('sanitary-ware', reopened)?.id).toBe('misc');

        // ← passes over steps that wait for ones later in the list.
        expect(levelStates(plaster)['sanitary-ware']).toBe('locked');
        expect(previousLevel('ceiling', plaster)?.id).toBe('water-pipe');

        // Everything passed but misc and sanitary ware: confirming misc goes back to sanitary ware (earlier in the list).
        const lastTwo = Object.fromEntries(JOURNEY_LEVELS.filter(l => l.id !== 'misc' && l.id !== 'sanitary-ware').map(l => [l.id, 'done' as const]));
        expect(nextLevel('misc', lastTwo)?.id).toBe('sanitary-ware');
        expect(nextOpenLevel('misc', { ...lastTwo, misc: 'done' })?.id).toBe('sanitary-ware');
        expect(nextLevel('sanitary-system', { ...lastTwo, 'sanitary-system': 'done' })?.id).toBe('misc');
    });

    it('"ไม่มีในโครงการนี้" counts as passed', () => {
        const site = done('project-info', 'land-inspection');
        expect(ids(availableLevels(site))).toEqual(['demolition', 'fill']);
        expect(ids(blockingLevels('temp-utilities', { ...site, demolition: 'skipped' }))).toEqual(['fill']);
        expect(levelStates({ ...site, demolition: 'skipped', fill: 'skipped' })['temp-utilities']).toBe('current');
        const noStairs = doneThrough('roof-slab', { stair: 'skipped' });
        expect(levelStates(noStairs)['column-plates']).toBe('current');
        // A skipped level stays open for editing ("มีงานส่วนนี้ กลับไปกรอกข้อมูล").
        expect(isUnlocked('stair', noStairs)).toBe(true);
    });

    it('progress saved by the one-at-a-time journey reads the same: passed stays passed, the next one is open', () => {
        for (const last of ['project-info', 'ground-beam', 'column-plates', 'plaster', 'paint']) {
            const old = doneThrough(last);
            const states = levelStates(old);
            for (const id of Object.keys(old)) expect(states[id], id).toBe('done');
            const i = JOURNEY_LEVELS.findIndex(l => l.id === last);
            expect(currentLevel(old)?.id).toBe(JOURNEY_LEVELS[i + 1]?.id);
        }
        // A level reopened in the old journey: open again, later passed levels stay done.
        const { footing: _reopened, ...reopened } = doneThrough('brick');
        const states = levelStates(reopened);
        expect(states.footing).toBe('current');
        expect(states.pedestal).toBe('done');
        expect(states.plaster).toBe('current');
        expect(currentLevel(reopened)?.id).toBe('footing');
    });

    it('confirm-and-next goes to the next available level in list order', () => {
        const progress = doneThrough('ground-beam');
        // The step being confirmed counts as passed when choosing where to go.
        expect(nextLevel('slab-on-grade', progress)?.id).toBe('precast-slab');
        expect(nextLevel('stair', progress)?.id).toBe('waste-pipe');
        // Nothing open after it: back to the first step left behind.
        expect(nextLevel('waste-pipe', progress)?.id).toBe('slab-on-grade');
        expect(nextLevel('plaster', doneThrough('brick'))?.id).toBe('electrical-pipe');
        expect(nextLevel('column-plates', doneThrough('stair'))?.id).toBe('roofing');
        expect(nextLevel('misc', doneThrough('paint'))).toBeUndefined();
    });

    it('stepping and the way to a waiting level pass over what is still locked', () => {
        const progress = doneThrough('ground-beam', done('stair'));
        expect(previousLevel('stair', progress)?.id).toBe('slab-on-grade');
        expect(previousLevel('waste-pipe', progress)?.id).toBe('stair');
        expect(nextOpenLevel('stair', progress)?.id).toBe('waste-pipe');
        // Nothing open after it: on to the step left behind, as confirm-and-next does.
        expect(nextOpenLevel('waste-pipe', progress)?.id).toBe('slab-on-grade');
        const all = Object.fromEntries(JOURNEY_LEVELS.map(l => [l.id, 'done' as const]));
        const lastId = JOURNEY_LEVELS[JOURNEY_LEVELS.length - 1]?.id ?? '';
        expect(nextOpenLevel(lastId, all)).toBeUndefined();
        // Only this step left: nowhere else to go.
        const { [lastId]: _open, ...allButLast } = all;
        expect(nextOpenLevel(lastId, allButLast)).toBeUndefined();
        expect(firstStepToward('paint', progress)?.id).toBe('slab-on-grade');
        expect(firstStepToward('stair', progress)?.id).toBe('stair');
        expect(firstStepToward('electrical-cable', doneThrough('door-window'))?.id).toBe('brick');
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

describe('review fixes', () => {
    it('a quantity typed on the BOQ page does not survive "ไม่มีในโครงการนี้"', () => {
        const base = createProject();
        const level = getLevel('precast-slab');
        if (!level) throw new Error('level missing');
        const withEdit = { ...base, boqOverrides: { R97: { qty: 40, mat: 123 } } };
        const skipped = computeProject({ ...withEdit, journey: { 'precast-slab': 'skipped' } });
        expect(levelTotal(level, skipped)).toBe(0);
        const r97 = skipped.boq.sections.flatMap(s => s.rows).find(r => r.key === 'R97');
        expect(r97?.type === 'item' ? r97.qty : undefined).toBe(0);
        // Other edits on the line (price) are kept for when the work comes back.
        expect(r97?.type === 'item' ? r97.matUnit : undefined).toBe(123);
    });

    it('a blank project has no quantity on rows typed directly in a level (column plates)', () => {
        const result = computeProject(createProject('blank'));
        const plates = getLevel('column-plates');
        if (!plates) throw new Error('level missing');
        expect(levelTotal(plates, result)).toBe(0);
        // The sample still has the Excel plate count.
        expect(levelTotal(plates, computeProject(createProject()))).toBeGreaterThan(0);
    });

    it('every BOQ row with money belongs to some level (level totals add up to the BOQ)', () => {
        for (const project of [createProject(), createProject('blank')]) {
            const result = computeProject(project);
            const sum = JOURNEY_LEVELS.reduce((s, l) => s + levelTotal(l, result), 0);
            expect(sum).toBeCloseTo(result.boq.constructionTotal + result.boq.preConstructionTotal, 4);
        }
    });

    it('backfill never goes negative (pedestals without a footing pit)', () => {
        const project = createProject('blank');
        const pedestal = CALCULATORS.find(c => c.id === 'pedestal');
        if (!pedestal?.blank) throw new Error('pedestal blank missing');
        const input = pedestal.blank() as { rows: unknown[] };
        expect(input.rows).toEqual([]);
        const result = computeProject(project);
        expect(result.calcOutputs.pedestal?.backfill ?? 0).toBeGreaterThanOrEqual(0);
    });
});
