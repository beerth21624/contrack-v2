'use client';

// The full CashFLOW_Basic grid: Cash-IN rows 6–14, totals 15–18, Cash-OUT rows 21–52 and cost rows 54–59.
import { Fragment } from 'react';
import { formatNumber } from '@/components/sheet/NumberCell';
import type { CashFlowResult } from '@/domain/planning';
import { cls, installmentColors } from '../shared/planning-ui';
import { usePlanningText } from '../usePlanningText';

const pct = (v: number | undefined) => (v !== undefined && v > 0 ? `${(v * 100).toFixed(2)}%` : '');
const W = 76;

export function CashFlowDetailGrid({ cf, opexRate, profitRate }: { cf: CashFlowResult; opexRate: number; profitRate: number }) {
    const { t: tr, month, task: taskName, installment } = usePlanningText();
    const { buckets, months } = cf;
    const edge = (i: number) => (buckets[i]?.week === 1 ? { borderLeft: '1px solid #c3c2b7' } : undefined);
    const money = (vals: number[], opts?: { signed?: boolean; blankZero?: boolean }) => buckets.map(b => {
        const v = vals[b.index] ?? 0;
        return (
            <td key={b.index} className={`${cls.num} ${opts?.signed && v < 0 ? 'text-red-600' : ''}`} style={{ ...edge(b.index), minWidth: W }}>
                {opts?.blankZero && v === 0 ? '' : formatNumber(v, 2)}
            </td>
        );
    });
    const header = (title: string, bg: string) => (
        <>
            <tr style={{ background: bg }}>
                <th className={cls.th} rowSpan={2} style={{ background: bg, width: 56 }}>{tr('cashflow.grid.installmentNo')}</th>
                <th className={cls.th} rowSpan={2} style={{ background: bg, width: 64 }}>{tr('cashflow.grid.installmentPct')}</th>
                <th className={cls.th} rowSpan={2} style={{ background: bg, minWidth: 200 }}>{title}</th>
                {months.map(m => <th key={m.index} className={cls.th} colSpan={4} style={{ background: bg, borderLeft: '1px solid #c3c2b7' }}>{month(m.label)}</th>)}
            </tr>
            <tr>
                {buckets.map(b => <th key={b.index} className={cls.th} style={{ background: bg, ...edge(b.index) }}>{b.weekLabel}</th>)}
            </tr>
        </>
    );
    const totalRow = (label: string, vals: number[], bg: string, signed?: boolean) => (
        <tr style={{ background: bg }} className="font-semibold">
            <td className={`${cls.td} text-[12px]`} colSpan={3}>{label}</td>
            {money(vals, { signed })}
        </tr>
    );

    return (
        <div className="overflow-x-auto">
            <table className="border-collapse">
                <thead>{header(tr('cashflow.grid.income'), '#d9ead3')}</thead>
                <tbody>
                    {cf.installments.map(inst => (
                        <tr key={inst.no}>
                            <td className={`${cls.td} text-center tabular-nums`}>{inst.no}</td>
                            <td className={cls.num}>{formatNumber(inst.pct * 100, 0)}%</td>
                            <td className={cls.td}>{installment(inst.label)}</td>
                            {money(inst.weekly, { blankZero: true })}
                        </tr>
                    ))}
                    {totalRow(tr('cashflow.grid.totalIncome'), cf.incomeWeekly, '#f2f2f2')}
                    {totalRow(tr('cashflow.grid.totalOutflow'), cf.outflowWeekly, '#f2f2f2')}
                    {totalRow(tr('cashflow.grid.netWeekly'), cf.netWeekly, '#f2f2f2', true)}
                    {totalRow(tr('cashflow.grid.netCumulative'), cf.cumulative, '#cfe2f3', true)}
                </tbody>
                <tbody>
                    <tr><td colSpan={buckets.length + 3} className="h-3" /></tr>
                    {header(tr('cashflow.grid.outflow'), '#f4cccc')}
                    {cf.groups.map(g => {
                        const ts = cf.tasks.filter(t => t.installment === g.no);
                        return (
                            <Fragment key={g.no}>
                                {ts.map((t, i) => (
                                    <tr key={t.id}>
                                        {i === 0 && (
                                            <>
                                                <td className={`${cls.td} text-center font-semibold`} rowSpan={ts.length} style={installmentColors(g.no)}>{g.no}</td>
                                                <td className={cls.num} rowSpan={ts.length}>{(g.share * 100).toFixed(1)}%</td>
                                            </>
                                        )}
                                        <td className={cls.td}><span className="text-gray-400 mr-1 tabular-nums">{t.id}</span>{taskName(t.id, t.name)}</td>
                                        {buckets.map(b => {
                                            const v = t.weekly[b.index];
                                            return (
                                                <td key={b.index} className={cls.num}
                                                    style={{ ...edge(b.index), minWidth: W, background: v !== undefined && v > 0 ? '#fbe3dd' : undefined }}>{pct(v)}</td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </Fragment>
                        );
                    })}
                    <tr className="bg-gray-50 font-semibold">
                        <td className={cls.td} />
                        <td className={cls.num}>{(cf.groups.reduce((s, g) => s + g.share, 0) * 100).toFixed(0)}%</td>
                        <td className={`${cls.td} text-[12px]`}>{tr('cashflow.grid.constructionPct')}</td>
                        {buckets.map(b => <td key={b.index} className={cls.num} style={edge(b.index)}>{pct(cf.planPctWeekly[b.index])}</td>)}
                    </tr>
                    {totalRow(tr('cashflow.grid.constructionBaht'), cf.costWeekly, '#f9fafb')}
                    {totalRow(tr('cashflow.grid.opex', { pct: formatNumber(opexRate * 100, 0) }), cf.opexWeekly, '#f9fafb')}
                    {totalRow(tr('cashflow.grid.costPlusOpex'), cf.outflowWeekly, '#f9fafb')}
                    <tr><td colSpan={buckets.length + 3} className="h-2" /></tr>
                    {totalRow(tr('cashflow.grid.profit', { pct: formatNumber(profitRate * 100, 0) }), cf.profitWeekly, '#f9fafb')}
                </tbody>
            </table>
        </div>
    );
}
