'use client';

import { useTranslations } from 'next-intl';
import { REBAR_SIZES, type RebarSize } from '@/domain/boq/slots';
import { SHEET_COLORS, formatNumber } from '@/components/sheet/NumberCell';

const th = 'border border-gray-200 px-2 py-1 text-[12px] font-semibold text-gray-700 text-center';
const td = 'border border-gray-200 px-2 py-1 text-[13px]';
const tdNum = `${td} text-right tabular-nums whitespace-nowrap`;

/**
 * Row 5–6 of an Excel structural sheet: kg per bar size (RB6 … DB20) for each bar group, in green.
 * Also used by the roof-slab and stair pages.
 */
export function RebarSummary({ groups }: { groups: { label: string; kg: Record<RebarSize, number> }[] }) {
    const t = useTranslations('sheet');
    const total = (s: RebarSize) => groups.reduce((sum, g) => sum + g.kg[s], 0);
    return (
        <div className="overflow-x-auto">
            <table className="w-full border-collapse">
                <thead>
                    <tr style={{ background: '#fce5cd' }}>
                        <th className={th}>{t('rebar.header')}</th>
                        {REBAR_SIZES.map(s => <th key={s} className={th}>{s}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {groups.map(g => (
                        <tr key={g.label}>
                            <td className={td}>{g.label}</td>
                            {REBAR_SIZES.map(s => (
                                <td key={s} className={tdNum} style={{ background: SHEET_COLORS.calc }}>{formatNumber(g.kg[s])}</td>
                            ))}
                        </tr>
                    ))}
                    {groups.length > 1 && (
                        <tr>
                            <td className={`${td} font-semibold`}>{t('rebar.total')}</td>
                            {REBAR_SIZES.map(s => (
                                <td key={s} className={`${tdNum} font-semibold`} style={{ background: SHEET_COLORS.calc }}>
                                    {formatNumber(total(s))}
                                </td>
                            ))}
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
}
