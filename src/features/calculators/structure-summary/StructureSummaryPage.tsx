'use client';

import Link from 'next/link';
import { SUMMARY_COLUMNS, SUMMARY_ELEMENTS, structureSummary } from '@/domain/calculators/structure-summary';
import { getCalculator } from '@/domain/calculators/registry';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums whitespace-nowrap';

/** Excel sheet 24: read-only overview of every structural element sheet (no inputs). */
export default function StructureSummaryPage() {
    const { outputs, result, reset, isDefault } = useCalculator(structureSummary);
    const value = (key: string) => {
        const v = outputs[key] ?? 0;
        return v === 0 ? '' : formatNumber(v);
    };

    return (
        <CalculatorShell def={structureSummary} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title="ตารางสรุปวัสดุงานโครงสร้าง">
                <div className="overflow-x-auto">
                    <table className="border-collapse min-w-full">
                        <thead>
                            <tr>
                                <th className={th} rowSpan={2}>รวมงานโครงสร้าง</th>
                                {SUMMARY_COLUMNS.slice(0, 6).map(c => <th key={c.key} className={th} rowSpan={2}>{c.label}<br />({c.unit})</th>)}
                                <th className={th} colSpan={5}>เหล็กเสริม (กก.)</th>
                                {SUMMARY_COLUMNS.slice(11).map(c => <th key={c.key} className={th} rowSpan={2}>{c.label}<br />({c.unit})</th>)}
                            </tr>
                            <tr>
                                {SUMMARY_COLUMNS.slice(6, 11).map(c => <th key={c.key} className={th}>{c.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {SUMMARY_ELEMENTS.map(el => (
                                <tr key={el.calc}>
                                    <td className={`${td} text-left`}>
                                        <Link href={`/calc/${el.calc}`} className="text-blue-600 hover:underline">
                                            {getCalculator(el.calc)?.title ?? el.label}
                                        </Link>
                                    </td>
                                    {SUMMARY_COLUMNS.map(c => (
                                        <td key={c.key} className={td} style={{ background: SHEET_COLORS.calc }}>
                                            {value(`${el.calc}.${c.key}`)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            <tr style={{ background: SHEET_COLORS.subtotal }}>
                                <td className={`${td} text-left font-semibold`}>รวม</td>
                                {SUMMARY_COLUMNS.map(c => (
                                    <td key={c.key} className={`${td} font-semibold`}>{value(`total.${c.key}`)}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-[13px] text-gray-700">
                    เหล็กเสริมรวม <b className="tabular-nums">{formatNumber(outputs['total.rebar'])}</b> กก.
                </p>
                <p className="mt-1 text-[12px] text-gray-500">
                    ตารางนี้ดึงตัวเลขจากชีตแต่ละงาน (กดชื่องานเพื่อแก้ไข) — แก้ข้อมูลที่ชีตต้นทาง ไม่ใช่ที่นี่.
                    ยอดดินถมกลับรวมนับดินถมกลับของฐานรากด้วย (Excel Q18 ไม่นับ).
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
