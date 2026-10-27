// ─── Default waiting windows after planned tasks (ช่วงรอ) ───
// Common practice for a 1–2 storey reinforced-concrete house in Thailand; every value is a starting point the
// contractor can change per project (GET/PUT /projects/:id/task-lags). Waits never move the S-Curve dates: they only
// mark, on the crew board, the days a crew can be moved to another project and, later, shape suggested starts.
import type { TaskLag } from '../../shared/contract/workforce';

export interface DefaultTaskLag {
    days: number;
    /** Why the work waits (Thai, shown on the board and in the lag editor). */
    reason: string;
}

/** By S-Curve task id ("1.5" …). Tasks not listed wait 0 days. */
export const DEFAULT_TASK_LAGS: Readonly<Record<string, DefaultTaskLag>> = {
    '1.5': { days: 7, reason: 'บ่มคอนกรีตฐานราก' },
    '1.6': { days: 3, reason: 'บ่มคอนกรีตเสาตอม่อ' },
    '1.7': { days: 7, reason: 'บ่มคอนกรีตคานคอดิน' },
    '2.1': { days: 7, reason: 'บ่มคอนกรีตพื้น' },
    '2.3': { days: 3, reason: 'รอถอดแบบเสา' },
    '2.4': { days: 14, reason: 'รอถอดค้ำยันคาน-พื้นดาดฟ้า' },
    '2.5': { days: 7, reason: 'บ่มคอนกรีตบันได' },
    '4.1': { days: 7, reason: 'ผนังก่อตั้งตัวก่อนฉาบ' },
    '5.1': { days: 14, reason: 'ปูนฉาบแห้งก่อนทาสีรองพื้น' },
    '6.2': { days: 1, reason: 'กระเบื้องพื้นเซ็ตตัว' },
    '6.3': { days: 1, reason: 'กระเบื้องห้องน้ำเซ็ตตัว' },
    '6.5': { days: 1, reason: 'สีรองพื้นแห้ง' },
    '7.2': { days: 1, reason: 'สีรอบแรกแห้ง' },
};

export interface EffectiveTaskLag {
    taskId: string;
    days: number;
    reason: string;
    /** The project changed the default. */
    overridden: boolean;
}

/** The wait after `taskId`: the project's override, else the default, else 0. */
export function effectiveTaskLag(taskId: string, overrides: readonly TaskLag[]): EffectiveTaskLag {
    const own = overrides.find(l => l.taskId === taskId);
    const def = DEFAULT_TASK_LAGS[taskId];
    if (own !== undefined) {
        const note = (own.note ?? '').trim();
        return { taskId, days: own.days, reason: note !== '' ? note : def?.reason ?? 'รอตามที่กำหนด', overridden: true };
    }
    return { taskId, days: def?.days ?? 0, reason: def?.reason ?? '', overridden: false };
}

/**
 * Overrides to store for the waits the user typed: only the tasks that differ from the default (so a later change of
 * the defaults still reaches untouched tasks).
 */
export function lagOverrides(typed: Readonly<Record<string, { days: number; note?: string | null }>>): TaskLag[] {
    return Object.entries(typed)
        .filter(([taskId, v]) => v.days !== (DEFAULT_TASK_LAGS[taskId]?.days ?? 0) || (v.note ?? '').trim() !== '')
        .map(([taskId, v]) => ({ taskId, days: v.days, note: (v.note ?? '').trim() === '' ? null : (v.note ?? '').trim() }))
        .sort((a, b) => a.taskId.localeCompare(b.taskId, undefined, { numeric: true }));
}
