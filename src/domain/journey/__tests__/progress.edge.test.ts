import { describe, expect, it } from 'vitest';
import { JOURNEY_LEVELS, type JourneyLevel } from '../levels';
import {
    currentLevel, isUnlocked, journeyComplete, journeyRatio, levelStates, nextLevel, previousLevel,
    type JourneyProgress, type LevelState,
} from '../progress';

const IDS = JOURNEY_LEVELS.map(l => l.id);
const N = IDS.length;
const at = (i: number): string => IDS[i] ?? '';
const states = (p: JourneyProgress) => levelStates(p);
const count = (s: Record<string, LevelState>, v: LevelState) => Object.values(s).filter(x => x === v).length;
const marked = (idx: number[], mark: 'done' | 'skipped' = 'done'): JourneyProgress => Object.fromEntries(idx.map(i => [at(i), mark]));

describe('journey progress — state transitions (walk the whole journey)', () => {
    it('37 levels', () => {
        expect(N).toBe(37);
    });

    it('passing levels one by one: current always moves to the next, earlier ones stay done, later ones stay locked', () => {
        const p: JourneyProgress = {};
        for (let i = 0; i < N; i++) {
            const s = states(p);
            expect(currentLevel(p)?.id).toBe(at(i));
            expect(s[at(i)]).toBe('current');
            expect(count(s, 'done') + count(s, 'skipped')).toBe(i);
            expect(count(s, 'current')).toBe(1);
            expect(count(s, 'locked')).toBe(N - 1 - i);
            expect(journeyRatio(p)).toBeCloseTo(i / N, 12);
            expect(journeyComplete(p)).toBe(false);
            for (let k = 0; k < N; k++) expect(isUnlocked(at(k), p), `${at(k)} after ${String(i)}`).toBe(k <= i);
            p[at(i)] = i % 2 === 0 ? 'done' : 'skipped';
        }
        expect(currentLevel(p)).toBeUndefined();
        expect(journeyComplete(p)).toBe(true);
        expect(journeyRatio(p)).toBe(1);
        expect(count(states(p), 'current')).toBe(0);
        expect(count(states(p), 'locked')).toBe(0);
        for (const id of IDS) expect(isUnlocked(id, p)).toBe(true);
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
    it('a level passed far ahead (gap before it) stays open but does not unlock the gap', () => {
        const p = marked([0, 5]);
        const s = states(p);
        expect(s[at(1)]).toBe('current');
        for (const i of [2, 3, 4]) expect(s[at(i)]).toBe('locked');
        expect(s[at(5)]).toBe('done');
        expect(s[at(6)]).toBe('locked');
        expect(isUnlocked(at(5), p)).toBe(true);
        expect(isUnlocked(at(4), p)).toBe(false);
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

    it('with two gaps only the first is current, the second stays locked', () => {
        const p = marked([0, 1, 3, 4]);   // gaps at 2 and 5+
        const s = states(p);
        expect(s[at(2)]).toBe('current');
        expect(s[at(5)]).toBe('locked');
        expect(count(s, 'current')).toBe(1);
    });

    it('never more than one current level, for any pattern of marks', () => {
        const patterns: number[][] = [[], [0], [36], [0, 36], [1, 3, 5, 7], IDS.map((_, i) => i).filter(i => i % 3 === 0), IDS.map((_, i) => i).filter(i => i !== 20)];
        for (const idx of patterns) {
            const s = states(marked(idx));
            expect(count(s, 'current')).toBeLessThanOrEqual(1);
            expect(count(s, 'current') === 1).toBe(idx.length < N);
            expect(Object.keys(s)).toEqual(IDS);
        }
    });

    it('marking only the last level leaves level 1 current and all others locked', () => {
        const p = marked([36]);
        const s = states(p);
        expect(s[at(0)]).toBe('current');
        expect(s[at(36)]).toBe('done');
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
        expect(nextLevel(at(0), [])).toBeUndefined();
        expect(previousLevel(at(0), [])).toBeUndefined();
    });

    it('next / previous respect the given list', () => {
        expect(nextLevel(at(2), sub)).toBeUndefined();
        expect(nextLevel(at(1), sub)?.id).toBe(at(2));
        expect(previousLevel(at(2), sub)?.id).toBe(at(1));
    });
});

describe('journey progress — next / previous', () => {
    it('next and previous chain through all 37 levels, in both directions', () => {
        let id = at(0);
        const forward = [id];
        for (let next = nextLevel(id); next; next = nextLevel(next.id)) forward.push(next.id);
        expect(forward).toEqual(IDS);
        const back = [at(36)];
        for (let prev = previousLevel(at(36)); prev; prev = previousLevel(prev.id)) back.push(prev.id);
        expect(back).toEqual([...IDS].reverse());
        id = at(10);
        expect(previousLevel(nextLevel(id)?.id ?? '')?.id).toBe(id);
    });

    it('edges: no previous of the first, no next of the last, nothing for unknown ids', () => {
        expect(previousLevel(at(0))).toBeUndefined();
        expect(nextLevel(at(36))).toBeUndefined();
        expect(nextLevel('nope')).toBeUndefined();
        expect(previousLevel('nope')).toBeUndefined();
        expect(nextLevel('')).toBeUndefined();
    });

    it('crosses a phase boundary: layout → piles, ground-beam → slab-on-grade, misc is last', () => {
        expect(nextLevel('layout')?.id).toBe('piles');
        expect(nextLevel('ground-beam')?.id).toBe('slab-on-grade');
        expect(previousLevel('roofing')?.id).toBe('column-plates');
        expect(nextLevel('roof-structure')?.id).toBe('door-window');
    });
});
