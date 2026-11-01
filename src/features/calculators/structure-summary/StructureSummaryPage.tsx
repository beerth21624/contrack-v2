'use client';

import Link from 'next/link';
import { SUMMARY_COLUMNS, SUMMARY_ELEMENTS, structureSummary } from '@/domain/calculators/structure-summary';
import { getCalculator } from '@/domain/calculators/registry';
import { SheetCard } from '@/components/sheet/SheetFields';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';
import { CalculatorShell } from '../CalculatorShell';
import { useCalculator } from '../useCalculator';
import { useTranslations } from 'next-intl';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 bg-gray-50 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px] text-right tabular-nums whitespace-nowrap';

/** Excel sheet 24: read-only overview of every structural element sheet (no inputs). */
export default function StructureSummaryPage() {
    const t = useTranslations('calculators');
    const { outputs, result, reset, isDefault } = useCalculator(structureSummary);
    const value = (key: string) => {
        const v = outputs[key] ?? 0;
        return v === 0 ? '' : formatNumber(v);
    };

    return (
        <CalculatorShell def={structureSummary} result={result} isDefault={isDefault} onReset={reset}>
            <SheetCard title={t('structureSummary.structuralWorkMaterialSummaryTable')}>
                <div className="overflow-x-auto">
                    <table className="border-collapse min-w-full">
                        <thead>
                            <tr>
                                <th className={th} rowSpan={2}>{t('structureSummary.totalStructuralWork')}</th>
                                {SUMMARY_COLUMNS.slice(0, 6).map(c => <th key={c.key} className={th} rowSpan={2}>{c.label}<br />({c.unit})</th>)}
                                <th className={th} colSpan={5}>{t('structureSummary.reinforcementKg')}</th>
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
                                <td className={`${td} text-left font-semibold`}>{t('common.total')}</td>
                                {SUMMARY_COLUMNS.map(c => (
                                    <td key={c.key} className={`${td} font-semibold`}>{value(`total.${c.key}`)}</td>
                                ))}
                            </tr>
                        </tbody>
                    </table>
                </div>
                <p className="mt-3 text-[13px] text-gray-700">
                    {t('structureSummary.totalReinforcement')}<b className="tabular-nums">{formatNumber(outputs['total.rebar'])}</b>{t('structureSummary.kg')}
                </p>
                <p className="mt-1 text-[12px] text-gray-500">
                    {t('structureSummary.thisTablePullsItsFigures')}
                </p>
            </SheetCard>
        </CalculatorShell>
    );
}
