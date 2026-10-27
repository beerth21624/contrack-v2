import { describe, expect, it } from 'vitest';
import { PLAN_TASKS } from '../../planning/tasks';
import { DEFAULT_TASK_LAGS, effectiveTaskLag, lagOverrides } from '../task-lags';

describe('default waits after tasks', () => {
    it('only name real plan tasks, with whole days and a Thai reason', () => {
        const ids = new Set(PLAN_TASKS.map(t => t.id));
        for (const [id, lag] of Object.entries(DEFAULT_TASK_LAGS)) {
            expect(ids.has(id)).toBe(true);
            expect(Number.isInteger(lag.days) && lag.days > 0).toBe(true);
            expect(lag.reason.trim()).not.toBe('');
        }
    });

    it('effective wait: override, else default, else 0', () => {
        expect(effectiveTaskLag('1.5', [])).toEqual({ taskId: '1.5', days: 7, reason: 'บ่มคอนกรีตฐานราก', overridden: false });
        expect(effectiveTaskLag('1.1', [])).toEqual({ taskId: '1.1', days: 0, reason: '', overridden: false });
        expect(effectiveTaskLag('5.1', [{ taskId: '5.1', days: 21, note: 'ฝนตก ปูนแห้งช้า' }]))
            .toEqual({ taskId: '5.1', days: 21, reason: 'ฝนตก ปูนแห้งช้า', overridden: true });
        expect(effectiveTaskLag('5.1', [{ taskId: '5.1', days: 0 }]).reason).toBe('ปูนฉาบแห้งก่อนทาสีรองพื้น');
    });

    it('stores only what differs from the default, in task order', () => {
        expect(lagOverrides({ '1.5': { days: 7 }, '5.1': { days: 21 }, '1.1': { days: 0 }, '1.10': { days: 2 } }))
            .toEqual([{ taskId: '1.10', days: 2, note: null }, { taskId: '5.1', days: 21, note: null }].sort((a, b) =>
                a.taskId.localeCompare(b.taskId, undefined, { numeric: true })));
        expect(lagOverrides({ '1.5': { days: 7, note: ' ฝนตก ' } })).toEqual([{ taskId: '1.5', days: 7, note: 'ฝนตก' }]);
    });
});
