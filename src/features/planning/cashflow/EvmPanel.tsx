'use client';

// "💵Finance Dashboard (สำหรับ ADVANCE)" of CashFLOW_Basic: X1:AE18 (EVM) and Y21:Z53 (% complete / EV per task).
import { Select } from 'antd';
import { NumberCell, SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { InputNumberField } from '@/components/sheet/SheetFields';
import type { CashFlowInput, CashFlowResult } from '@/domain/planning';
import { bucketLabel, cls } from '../shared/planning-ui';

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
    const e = cf.evm;
    const metrics: MetricRow[] = [
        { label: 'Duration (Plan)', value: e.duration, unit: 'วัน', digits: 0, note: 'ระยะเวลาตามแผน S-Curve' },
        { label: 'Budget (BAC)', value: e.bac, unit: 'บาท', note: `ต้นทุน × (1 + ค่าดำเนินงาน ${formatNumber(input.operatingCostRate * 100, 0)}%)` },
        { label: 'Plan Value (PV)', value: e.pv, unit: 'บาท', note: `มูลค่างานตามแผนถึงสิ้น ${bucketLabel(cf.buckets[input.pvBuckets - 1])}` },
        { label: 'Earned Value (EV)', value: e.ev, unit: 'บาท', note: 'มูลค่างานที่ทำได้จริง (% เสร็จ × สัดส่วนงาน × BAC)' },
        { label: 'Actual Cost (AC)', value: e.ac, unit: 'บาท', note: 'เงินที่จ่ายไปจริง (กรอก)' },
        { label: 'Schedule Variance', formula: 'EV-PV', value: e.sv, unit: 'บาท', note: 'ติดลบ = งานช้ากว่าแผน' },
        { label: 'Cost Variance', formula: 'EV-AC', value: e.cv, unit: 'บาท', note: 'ติดลบ = ใช้เงินเกินมูลค่างาน' },
        { label: 'Schedule Performance Index', formula: 'EV/PV', value: e.spi, digits: 3, note: 'น้อยกว่า 1 = ช้ากว่าแผน' },
        { label: 'Cost Performance Index', formula: 'EV/AC', value: e.cpi, digits: 3, note: 'น้อยกว่า 1 = เกินงบ' },
        { label: 'Estimated Time at Completion', formula: 'Duration/SPI', value: e.eacDays, unit: 'วัน', digits: 1 },
        { label: 'Cost Estimate at Completion', formula: 'Budget/CPI', value: e.eacCost, unit: 'บาท' },
        { label: 'Budget − EAC', value: e.vac, unit: 'บาท', note: 'Excel AA13 (ไม่มีชื่อ)' },
        { label: 'Net Profit (Plan)', value: e.profitPlan, unit: 'บาท' },
        { label: 'Net Profit (Forecasting)', value: e.profitForecast, unit: 'บาท', note: 'กำไรตามแผน + (Budget − EAC)' },
    ];
    const pvOptions = cf.buckets.map((b, i) => ({ value: i + 1, label: `${i + 1} สัปดาห์แรก (ถึงสิ้น ${bucketLabel(b)})` }));

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
            <div className="flex flex-col gap-3 min-w-0">
                <div>
                    <InputNumberField label="Actual Cost (AC) — เงินที่จ่ายไปจริง" unit="บาท" value={input.actualCost}
                        onChange={v => onChange({ ...input, actualCost: v })} />
                    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-center gap-2 py-1">
                        <span className="text-[13px] text-gray-700">Plan Value (PV) นับถึง</span>
                        <Select size="small" value={input.pvBuckets} options={pvOptions} aria-label="PV นับถึงสัปดาห์"
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
                <div className="text-[13px] font-medium text-gray-700 mb-1">% งานที่เสร็จ (ใช้คิด EV)</div>
                <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
                    <table className="w-full border-collapse">
                        <thead className="sticky top-0">
                            <tr>
                                <th className={cls.th}>งาน</th>
                                <th className={cls.th}>สัดส่วนงาน</th>
                                <th className={cls.th} style={{ width: 80 }}>% เสร็จ</th>
                                <th className={cls.th}>EV (บาท)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cf.tasks.map(t => (
                                <tr key={t.id}>
                                    <td className={`${cls.td} text-[12px]`}><span className="text-gray-400 mr-1 tabular-nums">{t.id}</span>{t.name}</td>
                                    <td className={cls.num}>{(t.share * 100).toFixed(2)}%</td>
                                    <td className={cls.td}>
                                        <NumberCell value={t.progress} percent ariaLabel={`${t.name} % เสร็จ`}
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
