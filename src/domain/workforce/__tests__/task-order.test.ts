import { describe, expect, it } from 'vitest';
import { TASK_TRADES } from '../task-trades';
import { TASK_AFTER, lagAfter, presentPredecessors, taskAfter, taskSuccessors } from '../task-order';

describe('task order (TASK_AFTER)', () => {
    it('covers exactly the 32 plan tasks of TASK_TRADES', () => {
        expect(Object.keys(TASK_AFTER)).toHaveLength(32);
        expect(new Set(Object.keys(TASK_AFTER))).toEqual(new Set(Object.keys(TASK_TRADES)));
    });

    it('lists every task after the tasks it waits for (topological key order, so acyclic)', () => {
        const seen = new Set<string>();
        for (const [id, before] of Object.entries(TASK_AFTER)) {
            for (const p of before) {
                expect(Object.hasOwn(TASK_AFTER, p)).toBe(true);
                expect(seen.has(p)).toBe(true); // listed earlier
                expect(p).not.toBe(id);
            }
            seen.add(id);
        }
    });

    it('starts with 1.1 alone and has every other task wait for something', () => {
        const roots = Object.entries(TASK_AFTER).filter(([, b]) => b.length === 0).map(([id]) => id);
        expect(roots).toEqual(['1.1']);
    });

    it('answers [] for an unknown id and lists direct successors', () => {
        expect(taskAfter('9.9')).toEqual([]);
        expect(taskAfter('__proto__')).toEqual([]);
        expect(taskAfter('5.1')).toEqual(['3.3', '4.1']);
        expect(taskSuccessors('5.1').sort()).toEqual(['6.1', '6.2', '6.3', '6.4']);
        expect(taskSuccessors('8.6')).toEqual([]);
    });
});

describe('presentPredecessors', () => {
    it('takes the nearest crewed tasks, skipping absent ones', () => {
        // 1.4 piles has no crew: 1.5 waits for 1.3.
        expect(presentPredecessors('1.5', new Set(['1.3', '1.5']))).toEqual(['1.3']);
        expect(presentPredecessors('1.5', new Set(['1.3', '1.4', '1.5']))).toEqual(['1.4']);
        // 4.1 → 3.1 → (2.4, 2.5) → … → 1.7 when only 1.7 is crewed before it.
        expect(presentPredecessors('4.1', new Set(['1.5', '1.7', '4.1']))).toEqual(['1.7']);
        // Both branches of a join.
        expect(presentPredecessors('5.1', new Set(['3.3', '4.1', '5.1']))).toEqual(['3.3', '4.1']);
        // Through an absent join: 6.5 waits for 5.1 when 6.1–6.4 have no crew.
        expect(presentPredecessors('6.5', new Set(['5.1', '6.5']))).toEqual(['5.1']);
    });

    it('is empty for the first task or when nothing before is crewed', () => {
        expect(presentPredecessors('1.1', new Set(['1.1']))).toEqual([]);
        expect(presentPredecessors('4.1', new Set(['4.1']))).toEqual([]);
    });
});

describe('lagAfter', () => {
    it('reads the override, else the default, never below 0', () => {
        expect(lagAfter('5.1', [])).toBe(14);
        expect(lagAfter('5.1', [{ taskId: '5.1', days: 21 }])).toBe(21);
        expect(lagAfter('5.1', [{ taskId: '5.1', days: 0 }])).toBe(0);
        expect(lagAfter('1.1', [])).toBe(0);
    });
});
