'use client';

// ACTUAL rows of S-Curve_Plan_Basic (D/E/G typed per task) and the % คืบหน้า column BF.
import { Fragment } from 'react';
import { usePlanningText } from '../usePlanningText';
import type { ScheduleActualInput, ScheduleResult, ScheduleTaskInput } from '@/domain/planning';
import { CalcText, DateCell, OptionalNumberCell, cls, formatDate, installmentColors } from '../shared/planning-ui';

/**
 * New ACTUAL input with one field changed. Always an object (never undefined): a cleared actual is
 * stored as {} so the Excel sample actual of task 1.1 does not come back on reload.
 */
function patchActual(a: ScheduleActualInput | undefined, patch: Partial<ScheduleActualInput>): ScheduleActualInput {
    const merged = { ...a, ...patch };
    const out: ScheduleActualInput = {};
    if (merged.start !== undefined && merged.start !== '') out.start = merged.start;
    if (merged.days !== undefined) out.days = merged.days;
    if (merged.cost !== undefined) out.cost = merged.cost;
    return out;
}

export function ActualTable({ schedule, tasks, onTask }: {
    schedule: ScheduleResult;
    tasks: Record<string, ScheduleTaskInput>;
    onTask: (id: string, patch: Partial<ScheduleTaskInput>) => void;
}) {
    const { t: tr, task: taskName, installment } = usePlanningText();
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
                <thead>
                    <tr>
                        <th className={cls.th} style={{ width: 52 }}>{tr('schedule.grid.no')}</th>
                        <th className={cls.th}>{tr('schedule.grid.task')}</th>
                        <th className={cls.th} style={{ width: 150 }}>{tr('schedule.grid.planShort')}<br /><span className="font-normal">{tr('schedule.actual.startFinish')}</span></th>
                        <th className={cls.th} style={{ width: 130 }}>{tr('schedule.actual.actualStart')}</th>
                        <th className={cls.th} style={{ width: 76 }}>{tr('schedule.actual.actualDays')}<br /><span className="font-normal">{tr('schedule.grid.unitDays')}</span></th>
                        <th className={cls.th} style={{ width: 92 }}>{tr('schedule.actual.actualFinish')}</th>
                        <th className={cls.th} style={{ width: 120 }}>{tr('schedule.actual.actualCost')}<br /><span className="font-normal">{tr('schedule.grid.unitBaht')}</span></th>
                        <th className={cls.th} style={{ width: 84 }}>{tr('schedule.grid.progressPct')}</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule.installments.map(inst => (
                        <Fragment key={inst.no}>
                            <tr>
                                <td className={`${cls.td} font-semibold text-[12px]`} colSpan={8} style={installmentColors(inst.no)}>{installment(inst.label)}</td>
                            </tr>
                            {inst.taskIds.map(id => {
                                const t = schedule.tasks.find(x => x.id === id);
                                if (!t) return null;
                                const ti = tasks[id];
                                const set = (patch: Partial<ScheduleActualInput>) => onTask(id, { actual: patchActual(ti?.actual, patch) });
                                return (
                                    <tr key={id}>
                                        <td className={`${cls.td} text-center text-gray-500 tabular-nums`}>{t.id}</td>
                                        <td className={cls.td}>{taskName(t.id, t.name)}</td>
                                        <td className={`${cls.td} text-[12px] text-gray-500 whitespace-nowrap text-center`}>
                                            {t.start ? `${formatDate(t.start)} – ${formatDate(t.finish).slice(0, 5)}` : '–'}
                                        </td>
                                        <td className={cls.td}>
                                            <DateCell value={ti?.actual?.start} ariaLabel={tr('schedule.actual.startOf', { name: taskName(t.id, t.name) })} onCommit={iso => set({ start: iso })} />
                                        </td>
                                        <td className={cls.td}>
                                            <OptionalNumberCell value={ti?.actual?.days} ariaLabel={tr('schedule.actual.daysOf', { name: taskName(t.id, t.name) })} onCommit={v => set({ days: v })} />
                                        </td>
                                        <td className={cls.td}><CalcText>{formatDate(t.actual.finish)}</CalcText></td>
                                        <td className={cls.td}>
                                            <OptionalNumberCell value={ti?.actual?.cost} digits={2} ariaLabel={tr('schedule.actual.costOf', { name: taskName(t.id, t.name) })} onCommit={v => set({ cost: v })} />
                                        </td>
                                        <td className={cls.td}>
                                            <OptionalNumberCell value={t.progress === 0 ? null : t.progress} percent ariaLabel={tr('schedule.actual.progressOf', { name: taskName(t.id, t.name) })}
                                                onCommit={v => onTask(id, { progress: v ?? 0 })} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
