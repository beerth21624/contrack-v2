'use client';

// ACTUAL rows of S-Curve_Plan_Basic (D/E/G typed per task) and the % คืบหน้า column BF.
import { Fragment } from 'react';
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
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[860px]">
                <thead>
                    <tr>
                        <th className={cls.th} style={{ width: 52 }}>ลำดับ</th>
                        <th className={cls.th}>รายละเอียดงาน</th>
                        <th className={cls.th} style={{ width: 150 }}>แผน<br /><span className="font-normal">(เริ่ม – เสร็จ)</span></th>
                        <th className={cls.th} style={{ width: 130 }}>เริ่มจริง</th>
                        <th className={cls.th} style={{ width: 76 }}>ทำจริง<br /><span className="font-normal">(วัน)</span></th>
                        <th className={cls.th} style={{ width: 92 }}>เสร็จจริง</th>
                        <th className={cls.th} style={{ width: 120 }}>ค่าใช้จ่ายจริง<br /><span className="font-normal">(บาท)</span></th>
                        <th className={cls.th} style={{ width: 84 }}>% คืบหน้า</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule.installments.map(inst => (
                        <Fragment key={inst.no}>
                            <tr>
                                <td className={`${cls.td} font-semibold text-[12px]`} colSpan={8} style={installmentColors(inst.no)}>{inst.label}</td>
                            </tr>
                            {inst.taskIds.map(id => {
                                const t = schedule.tasks.find(x => x.id === id);
                                if (!t) return null;
                                const ti = tasks[id];
                                const set = (patch: Partial<ScheduleActualInput>) => onTask(id, { actual: patchActual(ti?.actual, patch) });
                                return (
                                    <tr key={id}>
                                        <td className={`${cls.td} text-center text-gray-500 tabular-nums`}>{t.id}</td>
                                        <td className={cls.td}>{t.name}</td>
                                        <td className={`${cls.td} text-[12px] text-gray-500 whitespace-nowrap text-center`}>
                                            {t.start ? `${formatDate(t.start)} – ${formatDate(t.finish).slice(0, 5)}` : '–'}
                                        </td>
                                        <td className={cls.td}>
                                            <DateCell value={ti?.actual?.start} ariaLabel={`${t.name} เริ่มจริง`} onCommit={iso => set({ start: iso })} />
                                        </td>
                                        <td className={cls.td}>
                                            <OptionalNumberCell value={ti?.actual?.days} ariaLabel={`${t.name} วันทำจริง`} onCommit={v => set({ days: v })} />
                                        </td>
                                        <td className={cls.td}><CalcText>{formatDate(t.actual.finish)}</CalcText></td>
                                        <td className={cls.td}>
                                            <OptionalNumberCell value={ti?.actual?.cost} digits={2} ariaLabel={`${t.name} ค่าใช้จ่ายจริง`} onCommit={v => set({ cost: v })} />
                                        </td>
                                        <td className={cls.td}>
                                            <OptionalNumberCell value={t.progress === 0 ? null : t.progress} percent ariaLabel={`${t.name} % คืบหน้า`}
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
