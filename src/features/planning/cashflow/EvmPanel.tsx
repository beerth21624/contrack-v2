'use client';

// "💵Finance Dashboard (สำหรับ ADVANCE)" of CashFLOW_Basic: X1:AE18 (EVM) and Y21:Z53 (% complete / EV per task).
import { Select } from 'antd';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { InputNumberField } from '@/components/sheet/SheetFields';
import type { CashFlowInput, CashFlowResult } from '@/domain/planning';
import { bucketLabel, cls } from '../shared/planning-ui';
import { usePlanningText } from '../usePlanningText';

interface MetricRow {
    label: string;
    formula?: string;
    value: number | null;
    unit?: string;
    digits?: number;
    note?: string;
}

export function EvmPanel({ cf, input, onChange }: {
    cf: CashFlowResult;
    input: CashFlowInput;
    onChange: (next: CashFlowInput) => void;
}) {
    const { t: tr, locale, task: taskName } = usePlanningText();
    const e = cf.evm;
    const metrics: MetricRow[] = [
        { label: tr('cashflow.evm.duration'), value: e.duration, unit: tr('unit.days'), digits: 0, note: tr('cashflow.evm.durationNote') },
        { label: tr('cashflow.evm.bac'), value: e.bac, unit: tr('unit.baht'), note: tr('cashflow.evm.bacNote', { pct: formatNumber(input.operatingCostRate * 100, 0) }) },
        { label: tr('cashflow.evm.pv'), value: e.pv, unit: tr('unit.baht'), note: tr('cashflow.evm.pvNote', { bucket: bucketLabel(cf.buckets[input.pvBuckets - 1], locale) }) },
        { label: tr('cashflow.evm.ev'), value: e.ev, unit: tr('unit.baht'), note: tr('cashflow.evm.evNote') },
        { label: tr('cashflow.evm.ac'), value: e.ac, unit: tr('unit.baht'), note: tr('cashflow.evm.acNote') },
        { label: tr('cashflow.evm.sv'), formula: 'EV-PV', value: e.sv, unit: tr('unit.baht'), note: tr('cashflow.evm.svNote') },
        { label: tr('cashflow.evm.cv'), formula: 'EV-AC', value: e.cv, unit: tr('unit.baht'), note: tr('cashflow.evm.cvNote') },
        { label: tr('cashflow.evm.spi'), formula: 'EV/PV', value: e.spi, digits: 3, note: tr('cashflow.evm.spiNote') },
        { label: tr('cashflow.evm.cpi'), formula: 'EV/AC', value: e.cpi, digits: 3, note: tr('cashflow.evm.cpiNote') },
        { label: tr('cashflow.evm.eacDays'), formula: tr('cashflow.evm.eacDaysFormula'), value: e.eacDays, unit: tr('unit.days'), digits: 1 },
        { label: tr('cashflow.evm.eacCost'), formula: tr('cashflow.evm.eacCostFormula'), value: e.eacCost, unit: tr('unit.baht') },
        { label: tr('cashflow.evm.vac'), value: e.vac, unit: tr('unit.baht'), note: tr('cashflow.evm.vacNote') },
        { label: tr('cashflow.evm.profitPlan'), value: e.profitPlan, unit: tr('unit.baht') },
        { label: tr('cashflow.evm.profitForecast'), value: e.profitForecast, unit: tr('unit.baht'), note: tr('cashflow.evm.profitForecastNote') },
    ];
    const pvOptions = cf.buckets.map((b, i) => ({ value: i + 1, label: tr('cashflow.evm.pvOption', { n: i + 1, bucket: bucketLabel(b, locale) }) }));

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-3 min-w-0">
                <div>
                    <InputNumberField label={tr('cashflow.evm.acInput')} unit={tr('unit.baht')} value={input.actualCost}
                        onChange={v => onChange({ ...input, actualCost: v })} />
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
                        <span className="text-[13px] text-gray-700">{tr('cashflow.evm.pvUntil')}</span>
                        <Select size="small" value={input.pvBuckets} options={pvOptions} aria-label={tr('cashflow.evm.pvAria')}
                            onChange={(v: number) => onChange({ ...input, pvBuckets: v })}
                            style={{ background: SHEET_COLORS.input, borderRadius: 3 }} variant="borderless" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <tbody>
                            {metrics.map(m => (
                                <tr key={m.label}>
                                    <td className={`${cls.td} text-[12px]`}>
                                        <div className="font-medium text-gray-800">{m.label}</div>
                                        {m.note && <div className="text-[11px] text-gray-400">{m.note}</div>}
                                    </td>
                                    <td className={`${cls.td} text-[11px] text-gray-500 whitespace-nowrap`}>{m.formula}</td>
                                    <td className={cls.num} style={{ background: SHEET_COLORS.calc, minWidth: 110 }}>
                                        <span className={m.value !== null && m.value < 0 ? 'text-red-600' : ''}>{formatNumber(m.value, m.digits ?? 2)}</span>
                                    </td>
                                    <td className={`${cls.td} text-[11px] text-gray-500`}>{m.unit}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <div className="min-w-0">
                <div className="text-[13px] font-medium text-gray-700 mb-1">{tr('cashflow.evm.progressTitle')}</div>
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0">
                            <tr>
                                <th className={cls.th}>{tr('cashflow.evm.colTask')}</th>
                                <th className={cls.th}>{tr('cashflow.evm.colShare')}</th>
                                <th className={cls.th} style={{ width: 80 }}>{tr('cashflow.evm.colDone')}</th>
                                <th className={cls.th}>{tr('cashflow.evm.colEv')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cf.tasks.map(t => (
                                <tr key={t.id}>
                                    <td className={`${cls.td} text-[12px]`}><span className="text-gray-400 mr-1 tabular-nums">{t.id}</span>{taskName(t.id, t.name)}</td>
                                    <td className={cls.num}>{(t.share * 100).toFixed(2)}%</td>
                                    <td className={cls.td}>
                                        <NumberCell value={t.progress} percent ariaLabel={tr('cashflow.evm.doneOf', { name: taskName(t.id, t.name) })}
                                            onCommit={v => onChange({ ...input, progress: { ...input.progress, [t.id]: v ?? 0 } })} />
                                    </td>
                                    <td className={cls.num} style={{ background: SHEET_COLORS.calc }}>{formatNumber(t.earnedValue, 2)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
