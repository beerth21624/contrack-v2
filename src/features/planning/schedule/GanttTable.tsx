'use client';

// Task table (B..F of S-Curve_Plan_Basic) with a Gantt bar grid over the week buckets.
import { Fragment } from 'react';
import { Button, Tooltip } from 'antd';
import { usePlanningText } from '../usePlanningText';
import { LinkOutlined } from '@ant-design/icons';
import { NumberCell } from '@/components/sheet/NumberCell';
import type { ScheduleResult, ScheduleTaskInput } from '@/domain/planning';
import { CHART_COLORS } from '../shared/charts';
import { CalcText, DateCell, bucketLabel, cls, formatDate, installmentColors, money } from '../shared/planning-ui';

const CELL_W = 22;

export function GanttTable({ schedule, tasks, count, onTask }: {
    schedule: ScheduleResult;
    tasks: Record<string, ScheduleTaskInput>;
    /** Number of week buckets to draw. */
    count: number;
    onTask: (id: string, patch: Partial<ScheduleTaskInput>) => void;
}) {
    const { t: tr, locale, month, task: taskName, installment } = usePlanningText();
    const buckets = schedule.buckets.slice(0, count);
    const months = schedule.months.filter(m => m.firstBucket < count);
    const monthEdge = (i: number) => (buckets[i]?.week === 1 ? '1px solid #c3c2b7' : '1px solid #f0efec');

    return (
        <div className="overflow-x-auto">
            <table className="border-collapse" style={{ minWidth: '100%' }}>
                <thead>
                    <tr>
                        <th className={cls.th} rowSpan={2} style={{ width: 52 }}>{tr('schedule.grid.no')}</th>
                        <th className={cls.th} rowSpan={2} style={{ minWidth: 190 }}>{tr('schedule.grid.task')}</th>
                        <th className={cls.th} rowSpan={2} style={{ width: 72 }}>{tr('schedule.grid.duration')}<br /><span className="font-normal">{tr('schedule.grid.unitDays')}</span></th>
                        <th className={cls.th} rowSpan={2} style={{ width: 128 }}>{tr('schedule.grid.start')}</th>
                        <th className={cls.th} rowSpan={2} style={{ width: 88 }}>{tr('schedule.grid.finish')}</th>
                        {months.map(m => (
                            <th key={m.index} className={cls.th} colSpan={Math.min(4, count - m.firstBucket)} style={{ padding: '2px 0' }}>{month(m.label)}</th>
                        ))}
                    </tr>
                    <tr>
                        {buckets.map(b => (
                            <th key={b.index} className="border border-gray-200 bg-gray-50 text-[10px] font-normal text-gray-500"
                                style={{ width: CELL_W, minWidth: CELL_W, padding: 0, borderLeft: monthEdge(b.index) }}>{b.weekLabel}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {schedule.installments.map(inst => (
                        <Fragment key={inst.no}>
                            <tr>
                                <td className={`${cls.td} text-center font-semibold`} style={installmentColors(inst.no)}>{inst.no}.0</td>
                                <td className={`${cls.td} font-semibold`} colSpan={4} style={installmentColors(inst.no)}>
                                    {installment(inst.label)}
                                    <span className="ml-2 font-normal text-[12px] opacity-90">
                                        {tr('schedule.gantt.installmentSummary', { budget: money(inst.budget), weight: (inst.weight * 100).toFixed(1) })}{inst.finish ? tr('schedule.gantt.installmentFinish', { date: formatDate(inst.finish) }) : ''}
                                    </span>
                                </td>
                                {buckets.map(b => <td key={b.index} className="border border-gray-100" style={{ borderLeft: monthEdge(b.index) }} />)}
                            </tr>
                            {inst.taskIds.map(id => {
                                const t = schedule.tasks.find(x => x.id === id);
                                if (!t) return null;
                                const ti = tasks[id];
                                return (
                                    <tr key={id} className="hover:bg-orange-50/40">
                                        <td className={`${cls.td} text-center text-gray-500 tabular-nums`}>{t.id}</td>
                                        <td className={cls.td}>{taskName(t.id, t.name)}</td>
                                        <td className={cls.td}>
                                            <div className="flex items-center gap-0.5">
                                                <Tooltip title={t.durationFromManDay ? tr('schedule.gantt.fromManDay') : tr('schedule.gantt.typedHere')}>
                                                    <div className="flex-1">
                                                        <NumberCell value={t.duration} digits={Number.isInteger(t.duration) ? 0 : 2}
                                                            tone={t.durationFromManDay ? 'calc' : 'input'} edited={!t.durationFromManDay}
                                                            ariaLabel={tr('schedule.gantt.durationOf', { name: taskName(t.id, t.name) })}
                                                            onCommit={v => onTask(id, { duration: v ?? null })} />
                                                    </div>
                                                </Tooltip>
                                                {!t.durationFromManDay && (
                                                    <Tooltip title={tr('schedule.gantt.useManDay')}>
                                                        <Button size="small" type="text" className="!px-0.5" icon={<LinkOutlined />}
                                                            aria-label={tr('schedule.gantt.useManDay')} onClick={() => onTask(id, { duration: null })} />
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </td>
                                        <td className={cls.td}>
                                            <DateCell value={ti?.start} ariaLabel={tr('schedule.gantt.startOf', { name: taskName(t.id, t.name) })} onCommit={iso => onTask(id, { start: iso ?? '' })} />
                                        </td>
                                        <td className={cls.td}><CalcText>{formatDate(t.finish)}</CalcText></td>
                                        {buckets.map(b => {
                                            const p = t.plan[b.index] ?? 0;
                                            const a = t.actual.weekly[b.index] ?? 0;
                                            const tip = p > 0 || a > 0
                                                ? `${tr('schedule.gantt.tipPlan', { bucket: bucketLabel(b, locale), pct: (p * 100).toFixed(2) })}${a > 0 ? tr('schedule.gantt.tipActual', { pct: (a * 100).toFixed(2) }) : ''}`
                                                : undefined;
                                            return (
                                                <td key={b.index} title={tip} className="border border-gray-100 p-0 align-middle"
                                                    style={{ width: CELL_W, minWidth: CELL_W, borderLeft: monthEdge(b.index) }}>
                                                    <div style={{ height: 9, background: p > 0 ? CHART_COLORS.plan : undefined, borderRadius: 2, margin: '0 1px' }} />
                                                    <div style={{ height: 5, background: a > 0 ? CHART_COLORS.actual : undefined, borderRadius: 2, margin: '2px 1px 0' }} />
                                                </td>
                                            );
                                        })}
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
