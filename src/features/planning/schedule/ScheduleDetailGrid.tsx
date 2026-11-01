'use client';

// The full S-Curve_Plan_Basic grid: date axis (rows 9–12), PLAN/ACTUAL rows per task (13–84) and the
// summary rows 86–93, over every week bucket of the axis.
import { Fragment } from 'react';
import { usePlanningText } from '../usePlanningText';
import { formatNumber } from '@/components/sheet/NumberCell';
import type { ScheduleResult } from '@/domain/planning';
import { cls, formatDate, formatDayMonth, installmentColors } from '../shared/planning-ui';

const pct = (v: number | undefined) => (v !== undefined && v > 0 ? `${(v * 100).toFixed(2)}%` : '');
const W = 56;

export function ScheduleDetailGrid({ schedule }: { schedule: ScheduleResult }) {
    const { t: tr, month, task: taskName, installment } = usePlanningText();
    const { buckets, months } = schedule;
    const edge = (i: number) => (buckets[i]?.week === 1 ? { borderLeft: '1px solid #c3c2b7' } : undefined);
    const weekCells = (vals: number[], tint?: string) => buckets.map(b => {
        const v = vals[b.index];
        return (
            <td key={b.index} className={cls.num} style={{ ...edge(b.index), minWidth: W, background: v !== undefined && v > 0 ? tint : undefined }}>
                {pct(v)}
            </td>
        );
    });
    const monthCells = (vals: number[]) => months.map(m => (
        <td key={m.index} className={cls.num} colSpan={4} style={{ borderLeft: '1px solid #c3c2b7' }}>{formatNumber(vals[m.index], 2)}</td>
    ));
    const left = (label: string, sub: string) => (
        <>
            <td className={`${cls.td} font-semibold text-center`} colSpan={6}>{label}</td>
            <td className={`${cls.td} text-[12px]`} colSpan={2}>{sub}</td>
        </>
    );

    return (
        <div className="overflow-x-auto">
            <table className="border-collapse">
                <thead>
                    <tr>
                        <th className={`${cls.th} text-right font-normal`} colSpan={8}>{tr('schedule.grid.weekStart')}</th>
                        {buckets.map(b => <th key={b.index} className={`${cls.th} font-normal`} style={edge(b.index)}>{formatDayMonth(b.start)}</th>)}
                        <th className={cls.th} rowSpan={4} style={{ minWidth: 72 }}>{tr('schedule.grid.progressPct')}</th>
                    </tr>
                    <tr>
                        <th className={`${cls.th} text-right font-normal`} colSpan={8}>{tr('schedule.grid.weekEnd')}</th>
                        {buckets.map(b => <th key={b.index} className={`${cls.th} font-normal`} style={edge(b.index)}>{formatDayMonth(b.end)}</th>)}
                    </tr>
                    <tr>
                        <th className={cls.th} rowSpan={2} style={{ minWidth: 52 }}>{tr('schedule.grid.no')}</th>
                        <th className={cls.th} rowSpan={2} style={{ minWidth: 180 }}>{tr('schedule.grid.task')}</th>
                        <th className={cls.th}>{tr('schedule.grid.duration')}</th>
                        <th className={cls.th}>{tr('schedule.grid.start')}</th>
                        <th className={cls.th}>{tr('schedule.grid.finish')}</th>
                        <th className={cls.th}>{tr('schedule.grid.budget')}</th>
                        <th className={cls.th} />
                        <th className={cls.th} rowSpan={2}>{tr('schedule.grid.plan')}<br />{tr('schedule.grid.slashActual')}</th>
                        {months.map(m => <th key={m.index} className={cls.th} colSpan={4} style={{ borderLeft: '1px solid #c3c2b7' }}>{month(m.label)}</th>)}
                    </tr>
                    <tr>
                        <th className={cls.th}>{tr('schedule.grid.unitDays')}</th><th className={cls.th}>{tr('schedule.grid.unitDate')}</th><th className={cls.th}>{tr('schedule.grid.unitDate')}</th>
                        <th className={cls.th}>{tr('schedule.grid.unitBaht')}</th><th className={cls.th}>(%)</th>
                        {buckets.map(b => <th key={b.index} className={cls.th} style={edge(b.index)}>{b.weekLabel}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {schedule.installments.map(inst => (
                        <Fragment key={inst.no}>
                            <tr style={installmentColors(inst.no)}>
                                <td className={`${cls.td} font-semibold text-center`}>{inst.no}.0</td>
                                <td className={`${cls.td} font-semibold`} colSpan={7}>{installment(inst.label)}</td>
                                <td colSpan={buckets.length + 1} />
                            </tr>
                            {inst.taskIds.map(id => {
                                const t = schedule.tasks.find(x => x.id === id);
                                if (!t) return null;
                                return (
                                    <Fragment key={id}>
                                        <tr>
                                            <td className={`${cls.td} text-center tabular-nums`} rowSpan={2}>{t.id}</td>
                                            <td className={cls.td} rowSpan={2}>{taskName(t.id, t.name)}</td>
                                            <td className={cls.num}>{formatNumber(t.duration, Number.isInteger(t.duration) ? 0 : 2)}</td>
                                            <td className={cls.num}>{formatDate(t.start)}</td>
                                            <td className={cls.num}>{formatDate(t.finish)}</td>
                                            <td className={cls.num}>{formatNumber(t.budget, 2)}</td>
                                            <td className={cls.num}>{(t.weight * 100).toFixed(2)}%</td>
                                            <td className={`${cls.td} text-[11px] text-center`}>{tr('schedule.grid.planShort')}</td>
                                            {weekCells(t.plan, '#cde2fb')}
                                            <td className={cls.num} rowSpan={2}>{t.progress > 0 ? `${(t.progress * 100).toFixed(0)}%` : '0%'}</td>
                                        </tr>
                                        <tr className="bg-gray-50">
                                            <td className={cls.num}>{t.actual.duration === null ? '' : formatNumber(t.actual.duration, 0)}</td>
                                            <td className={cls.num}>{formatDate(t.actual.start)}</td>
                                            <td className={cls.num}>{formatDate(t.actual.finish)}</td>
                                            <td className={cls.num}>{t.actual.cost === null ? '' : formatNumber(t.actual.cost, 2)}</td>
                                            <td className={cls.num}>{(t.actual.weight * 100).toFixed(2)}%</td>
                                            <td className={`${cls.td} text-[11px] text-center`}>{tr('schedule.grid.actualShort')}</td>
                                            {weekCells(t.actual.weekly, '#fbd9c9')}
                                        </tr>
                                    </Fragment>
                                );
                            })}
                        </Fragment>
                    ))}
                    <tr><td colSpan={buckets.length + 9} className="h-3" /></tr>
                    <tr className="bg-blue-50/60">{left(tr('schedule.grid.plan'), tr('schedule.grid.progressWeek'))}{weekCells(schedule.planWeekly)}<td /></tr>
                    <tr className="bg-blue-50/60">{left('', tr('schedule.grid.cumulativeWeek'))}{weekCells(schedule.planCumulative)}<td /></tr>
                    <tr className="bg-blue-50/60">{left('', tr('schedule.grid.costMonth'))}{monthCells(schedule.months.map(m => m.planCost))}<td /></tr>
                    <tr className="bg-blue-50/60">{left('', tr('schedule.grid.cumulativeCostMonth'))}{monthCells(schedule.months.map(m => m.planCumulativeCost))}<td /></tr>
                    <tr className="bg-orange-50/60">{left(tr('schedule.grid.actualWork'), tr('schedule.grid.progressWeek'))}{weekCells(schedule.actualWeekly)}<td /></tr>
                    <tr className="bg-orange-50/60">{left('', tr('schedule.grid.cumulativeWeek'))}{weekCells(schedule.actualCumulative)}<td /></tr>
                    <tr className="bg-orange-50/60">{left('', tr('schedule.grid.costMonth'))}{monthCells(schedule.months.map(m => m.actualCost))}<td /></tr>
                    <tr className="bg-orange-50/60">{left('', tr('schedule.grid.cumulativeCostMonth'))}{monthCells(schedule.months.map(m => m.actualCumulativeCost))}<td /></tr>
                </tbody>
            </table>
        </div>
    );
}
