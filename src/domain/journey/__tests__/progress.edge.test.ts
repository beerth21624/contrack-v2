import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS, type JourneyLevel } from '../levels';
import {
    availableLevels, blockingLevels, currentLevel, isUnlocked, journeyComplete, journeyRatio, levelStates, nextLevel, previousLevel,
    type JourneyProgress, type LevelState,
} from '../progress';

const IDS = JOURNEY_LEVELS.map(l => l.id);
const N = IDS.length;
const at = (i: number): string => IDS[i] ?? '';
const states = (p: JourneyProgress) => levelStates(p);
const count = (s: Record<string, LevelState>, v: LevelState) => Object.values(s).filter(x => x === v).length;
const byId = new Map(JOURNEY_LEVELS.map(l => [l.id, l]));
/** Every prerequisite of `id` is marked. */
const prereqsPassed = (id: string, p: JourneyProgress): boolean => (byId.get(id)?.after ?? []).every(a => p[a] !== undefined);
const marked = (idx: number[], mark: 'done' | 'skipped' = 'done'): JourneyProgress => Object.fromEntries(idx.map(i => [at(i), mark]));

const allDone = (): JourneyProgress => marked(IDS.map((_, i) => i));
const upTo = (id: string): JourneyProgress => marked(IDS.map((_, i) => i).filter(i => i <= IDS.indexOf(id)));

describe('journey progress — state transitions (walk the whole journey)', () => {
    it('37 levels', () => {
        expect(N).toBe(37);
    });

    it('passing the first available level one by one: each step was open, the passed count grows by one, the end is complete', () => {
        const p: JourneyProgress = {};
        const order: string[] = [];
        for (let i = 0; i < N; i++) {
            const s = states(p);
            const cur = currentLevel(p);
            expect(cur, `step ${String(i)}`).toBeDefined();
            const id = cur?.id ?? '';
            expect(s[id]).toBe('current');
            expect(prereqsPassed(id, p)).toBe(true);
            expect(count(s, 'done') + count(s, 'skipped')).toBe(i);
            expect(count(s, 'current')).toBeGreaterThanOrEqual(1);
            expect(count(s, 'current') + count(s, 'locked') + i).toBe(N);
            expect(availableLevels(p).map(l => l.id)).toContain(id);
            expect(journeyRatio(p)).toBeCloseTo(i / N, 12);
            expect(journeyComplete(p)).toBe(false);
            for (const k of IDS) expect(isUnlocked(k, p), `${k} after ${String(i)}`).toBe(s[k] !== 'locked');
            order.push(id);
            p[id] = i % 2 === 0 ? 'done' : 'skipped';
        }
        expect([...order].sort()).toEqual([...IDS].sort());   // every level was passed exactly once
        expect(currentLevel(p)).toBeUndefined();
        expect(availableLevels(p)).toEqual([]);
        expect(journeyComplete(p)).toBe(true);
        expect(journeyRatio(p)).toBe(1);
        expect(count(states(p), 'current')).toBe(0);
        expect(count(states(p), 'locked')).toBe(0);
        for (const id of IDS) expect(isUnlocked(id, p)).toBe(true);
    });

    it('a level opens exactly when every prerequisite is passed: current <=> unmarked with all `after` marked, else locked', () => {
        for (const idx of [[], [0], [0, 1], [0, 1, 2, 3], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], IDS.map((_, i) => i).filter(i => i % 2 === 0)]) {
            const p = marked(idx);
            const s = states(p);
            for (const id of IDS) {
                if (p[id] !== undefined) expect(s[id]).toBe(p[id]);
                else expect(s[id], id).toBe(prereqsPassed(id, p) ? 'current' : 'locked');
            }
        }
    });

    it('"done" and "skipped" unlock and count identically', () => {
        for (const mark of ['done', 'skipped'] as const) {
            const p = marked([0, 1, 2], mark);
            expect(currentLevel(p)?.id).toBe(at(3));
            expect(journeyRatio(p)).toBeCloseTo(3 / N, 12);
            expect(states(p)[at(0)]).toBe(mark);
        }
    });

    it('an empty journey: only the first level is open', () => {
        const s = states({});
        expect(s[at(0)]).toBe('current');
        expect(count(s, 'locked')).toBe(N - 1);
        expect(isUnlocked(at(0), {})).toBe(true);
        expect(isUnlocked(at(1), {})).toBe(false);
        expect(journeyRatio({})).toBe(0);
    });

    it('all skipped counts as complete', () => {
        const all = marked(IDS.map((_, i) => i), 'skipped');
        expect(journeyComplete(all)).toBe(true);
        expect(journeyRatio(all)).toBe(1);
    });
});

describe('journey progress — gaps and reopening', () => {
    it('a level passed far ahead (gap before it) stays open and opens what only waits for it', () => {
        const p: JourneyProgress = { 'project-info': 'done', 'site-camp': 'done' };
        const s = states(p);
        expect(s['land-inspection']).toBe('current');
        for (const id of ['demolition', 'fill', 'temp-utilities']) expect(s[id], id).toBe('locked');   // wait for land-inspection
        expect(s['site-camp']).toBe('done');
        expect(s.layout).toBe('current');   // its only prerequisite (site-camp) is passed, the gap before does not matter
        expect(s.piles).toBe('locked');
        expect(isUnlocked('site-camp', p)).toBe(true);
        expect(isUnlocked('layout', p)).toBe(true);
        expect(isUnlocked('temp-utilities', p)).toBe(false);
        expect(journeyRatio(p)).toBeCloseTo(2 / N, 12);
    });

    it('reopening level 10 (unmark it) makes it current and keeps the later passed levels open', () => {
        const all = marked(IDS.map((_, i) => i));
        const p: JourneyProgress = Object.fromEntries(Object.entries(all).filter(([k]) => k !== at(10)));
        const s = states(p);
        expect(s[at(10)]).toBe('current');
        expect(currentLevel(p)?.id).toBe(at(10));
        expect(s[at(11)]).toBe('done');
        expect(s[at(36)]).toBe('done');
        expect(journeyComplete(p)).toBe(false);
        expect(journeyRatio(p)).toBeCloseTo(36 / N, 12);
        expect(isUnlocked(at(20), p)).toBe(true);
    });

    it('with two gaps, each gap whose prerequisites are passed is current, the rest stay locked', () => {
        const p: JourneyProgress = { 'project-info': 'done', 'land-inspection': 'done', fill: 'done', 'temp-utilities': 'done' };   // demolition left open
        const s = states(p);
        expect(s.demolition).toBe('current');
        expect(s['site-camp']).toBe('current');   // temp-utilities is passed
        expect(s.layout).toBe('locked');
        expect(count(s, 'current')).toBe(2);
        expect(availableLevels(p).map(l => l.id)).toEqual(['demolition', 'site-camp']);   // journey order
        expect(currentLevel(p)?.id).toBe('demolition');
    });

    it('several levels can be current at once: after the plates, roofing and door-window open together', () => {
        const p = upTo('column-plates');
        const s = states(p);
        expect(s.roofing).toBe('current');
        expect(s['door-window']).toBe('current');
        expect(s['roof-structure']).toBe('locked');
        expect(s.brick).toBe('locked');
        expect(s.plaster).toBe('locked');
        expect(blockingLevels('plaster', p).map(l => l.id)).toEqual(['roof-structure', 'brick']);
    });

    it('for any pattern of marks: keys follow the list, current/locked agree with the prerequisites, and while unfinished something is open', () => {
        const patterns: number[][] = [[], [0], [36], [0, 36], [1, 3, 5, 7], IDS.map((_, i) => i).filter(i => i % 3 === 0), IDS.map((_, i) => i).filter(i => i !== 20)];
        for (const idx of patterns) {
            const p = marked(idx);
            const s = states(p);
            expect(Object.keys(s)).toEqual(IDS);
            expect(count(s, 'current') >= 1).toBe(idx.length < N);   // an acyclic graph always has an open level while something is left
            for (const id of IDS) if (p[id] === undefined) expect(s[id] === 'current').toBe(prereqsPassed(id, p));
            expect(availableLevels(p).map(l => l.id)).toEqual(IDS.filter(id => s[id] === 'current'));
        }
    });

    it('marking only the last level leaves level 1 current and all others locked', () => {
        const p = marked([36]);
        const s = states(p);
        expect(s[at(0)]).toBe('current');
        expect(s[at(36)]).toBe('done');
        expect(count(s, 'current')).toBe(1);
        expect(count(s, 'locked')).toBe(N - 2);
    });
});

describe('journey progress — odd input', () => {
    it('unknown ids in the map are ignored (no crash, no effect on ratio, current or completion)', () => {
        const p: JourneyProgress = { nope: 'done', '': 'skipped', ...marked([0]) };
        expect(currentLevel(p)?.id).toBe(at(1));
        expect(journeyRatio(p)).toBeCloseTo(1 / N, 12);
        expect(Object.keys(states(p))).toEqual(IDS);
        expect(isUnlocked('nope', p)).toBe(false);
        const all: JourneyProgress = { ...marked(IDS.map((_, i) => i)), extra: 'done' };
        expect(journeyComplete(all)).toBe(true);
        expect(journeyRatio(all)).toBe(1);
    });

    it('unknown level id is neither unlocked nor has a state', () => {
        expect(isUnlocked('nope', {})).toBe(false);
        expect(isUnlocked('', marked([0, 1, 2]))).toBe(false);
        expect(states({}).nope).toBeUndefined();
    });

    it('does not mutate the progress map', () => {
        const p = marked([0, 1]);
        const copy = { ...p };
        levelStates(p);
        currentLevel(p);
        journeyRatio(p);
        expect(p).toEqual(copy);
    });
});

describe('journey progress — custom level lists', () => {
    const sub: JourneyLevel[] = JOURNEY_LEVELS.slice(0, 3);

    it('works on a subset: 3 levels, ratio and completion follow the subset only', () => {
        expect(journeyRatio(marked([0]), sub)).toBeCloseTo(1 / 3, 12);
        expect(journeyComplete(marked([0, 1, 2]), sub)).toBe(true);
        expect(journeyComplete(marked([0, 1]), sub)).toBe(false);
        expect(currentLevel(marked([0, 1]), sub)?.id).toBe(at(2));
        expect(currentLevel(marked([0, 1, 2]), sub)).toBeUndefined();
        expect(Object.keys(levelStates({}, sub))).toEqual(IDS.slice(0, 3));
        expect(isUnlocked(at(2), {}, sub)).toBe(false);
        expect(isUnlocked(at(5), marked([0, 1, 2, 3, 4, 5]), sub)).toBe(false);   // not in the list
    });

    it('an empty list: ratio 1, complete, no current, no states', () => {
        expect(journeyRatio({}, [])).toBe(1);
        expect(journeyComplete({}, [])).toBe(true);
        expect(currentLevel({}, [])).toBeUndefined();
        expect(levelStates({}, [])).toEqual({});
        expect(nextLevel(at(0), {}, [])).toBeUndefined();
        expect(previousLevel(at(0), {}, [])).toBeUndefined();
    });

    it('next / previous respect the given list', () => {
        expect(nextLevel(at(2), marked([0, 1]), sub)).toBeUndefined();            // every level of the list passed
        expect(nextLevel(at(1), marked([0]), sub)?.id).toBe(at(2));
        expect(nextLevel('piles', marked([0]), sub)).toBeUndefined();              // not in the list
        expect(previousLevel(at(2), marked([0, 1]), sub)?.id).toBe(at(1));
    });
});

describe('journey progress — next / previous', () => {
    it('confirm-and-next chains through all 37 levels, each step open and none repeated; previous chains back through the whole list', () => {
        const p: JourneyProgress = {};
        let id = at(0);
        const visited = [id];
        for (;;) {
            const next = nextLevel(id, p);
            p[id] = 'done';
            if (!next) break;
            expect(prereqsPassed(next.id, p), `${next.id} opened by confirming ${id}`).toBe(true);
            expect(visited).not.toContain(next.id);
            visited.push(next.id);
            id = next.id;
        }
        expect([...visited].sort()).toEqual([...IDS].sort());
        expect(journeyComplete(p)).toBe(true);
        const all = allDone();
        const back = [at(36)];
        for (let prev = previousLevel(at(36), all); prev; prev = previousLevel(prev.id, all)) back.push(prev.id);
        expect(back).toEqual([...IDS].reverse());
        expect(previousLevel(at(11), all)?.id).toBe(at(10));
    });

    it('edges: no previous of the first, nothing for unknown ids, nothing after the last when everything is passed', () => {
        expect(previousLevel(at(0), {})).toBeUndefined();
        expect(previousLevel(at(0), allDone())).toBeUndefined();
        expect(nextLevel(at(36), allDone())).toBeUndefined();
        expect(nextLevel('nope', {})).toBeUndefined();
        expect(previousLevel('nope', {})).toBeUndefined();
        expect(nextLevel('', {})).toBeUndefined();
    });

    it('nextLevel at the end of the list goes back to work left behind (the first available level before it)', () => {
        expect(nextLevel(at(36), {})?.id).toBe(at(0));
        expect(nextLevel(at(36), marked([0, 1]))?.id).toBe('demolition');
    });

    it('previousLevel passes over locked levels', () => {
        expect(previousLevel('misc', {})?.id).toBe('project-info');   // everything between is locked
        expect(previousLevel('roofing', allDone())?.id).toBe('column-plates');
    });

    it('crosses a phase boundary: layout -> piles, ground-beam -> slab-on-grade, misc is last', () => {
        expect(nextLevel('layout', {})?.id).toBe('piles');
        expect(nextLevel('ground-beam', {})?.id).toBe('slab-on-grade');
        const p = upTo('column-plates');
        p.roofing = 'done';
        expect(nextLevel('roof-structure', p)?.id).toBe('door-window');
    });
});
