// ─── Which trade (ประเภทงานช่าง) each planned task needs ───
// The 32 S-Curve tasks ("1.1" … "8.6", src/domain/planning/tasks.ts) mapped to the workforce trade ids
// (src/shared/contract/workforce.ts, the same ids as the subcontracting module). Used to put the crews of the task's
// trade first when a crew is assigned. A view only: nothing here feeds the BOQ, Man-Day or S-Curve numbers.
import type { WorkforceTradeId } from '@/shared/contract/workforce';

export const TASK_TRADES: Readonly<Record<string, WorkforceTradeId>> = {
    '1.1': 'temp-utilities',
    '1.2': 'site-prep',
    '1.3': 'site-prep',
    '1.4': 'piling',
    '1.5': 'structure',
    '1.6': 'structure',
    '1.7': 'structure',
    '2.1': 'structure',
    '2.2': 'structure',
    '2.3': 'structure',
    '2.4': 'structure',
    '2.5': 'structure',
    '3.1': 'roof-structure',
    '3.2': 'roof-structure',
    '3.3': 'roofing',
    '4.1': 'masonry',
    '4.2': 'electrical',
    '5.1': 'masonry',
    '5.2': 'electrical',
    '6.1': 'ceiling',
    '6.2': 'tiling',
    '6.3': 'tiling',
    '6.4': 'tiling',
    '6.5': 'painting',
    '7.1': 'doors-windows',
    '7.2': 'painting',
    '8.1': 'electrical',
    '8.2': 'plumbing',
    '8.3': 'misc',
    '8.4': 'plumbing',
    '8.5': 'doors-windows',
    '8.6': 'painting',
};

/** The trade a planned task needs; undefined for an id that is not one of the 32 plan tasks. */
export function taskTrade(taskId: string): WorkforceTradeId | undefined {
    return Object.hasOwn(TASK_TRADES, taskId) ? TASK_TRADES[taskId] : undefined;
}
