'use client';

// ─── รายการงาน: the frozen lines of the current version, grouped by BOQ section; BOQ drift → addendum ───
import { useTranslations } from 'next-intl';
import { Alert, Button } from 'antd';
import type { BuyerPackageDto, BuyerPackageLineDto } from '@/shared/contract';
import { fmtDateTime, money, money0, providerLabel, qty } from '../format';
import { groupLines, isSentUndecided } from './helpers';

export function LinesTab({ pkg, canSeePrices, canManage, onAddendum }: {
    pkg: BuyerPackageDto;
    canSeePrices: boolean;
    canManage: boolean;
    onAddendum: () => void;
}) {
    const t = useTranslations('subcontracting');
    const perLine = pkg.supplyMode === 'per_line';
    const cols = 3 + (perLine ? 1 : 0) + (canSeePrices ? 2 : 0);
    const drift = pkg.boqDrift.length;

    return (
        <div className="flex flex-col gap-3">
            {drift > 0 && isSentUndecided(pkg.status) && (
                <Alert type="warning" showIcon title={t('buyer.linesTab.theBoqChangedOnIssue', { drift })}
                    description={t('buyer.linesTab.recipientsQuoteOnTheOriginal')}
                    action={canManage ? <Button size="small" onClick={onAddendum}>{t('buyer.linesTab.issueAddendum')}</Button> : undefined} />
            )}
            <div className="overflow-x-auto border border-gray-200 rounded-card">
                <table className="w-full text-body min-w-[640px]">
                    <thead className="bg-gray-50 text-secondary text-gray-600">
                        <tr>
                            <th className="text-left font-medium px-3 py-2">{t('buyer.linesTab.item')}</th>
                            <th className="text-right font-medium px-3 py-2 w-32">{t('buyer.linesTab.quantity')}</th>
                            <th className="text-left font-medium px-3 py-2 w-20">{t('buyer.linesTab.unit')}</th>
                            {perLine && <th className="text-left font-medium px-3 py-2 w-28">{t('buyer.linesTab.material')}</th>}
                            {canSeePrices && <th className="text-right font-medium px-3 py-2 w-32">{t('buyer.linesTab.labourUnit')}</th>}
                            {canSeePrices && <th className="text-right font-medium px-3 py-2 w-32">{t('buyer.linesTab.estimatedTotal')}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {groupLines(pkg.lines).map(g => (
                            <Group key={`${g.title}-${String(g.lines[0]?.idx ?? 0)}`} title={g.title} lines={g.lines} cols={cols}
                                perLine={perLine} canSeePrices={canSeePrices} />
                        ))}
                    </tbody>
                    {canSeePrices && (
                        <tfoot>
                            <tr className="border-t border-gray-200 font-medium">
                                <td className="px-3 py-2" colSpan={cols - 1}>{t('buyer.linesTab.estimateTotal')}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{money0(pkg.estimateTotal)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>
            {pkg.versions.length > 1 && (
                <div className="text-secondary text-gray-600">
                    <div className="font-medium text-gray-900 mb-1">{t('buyer.linesTab.addendum')}</div>
                    <ul className="m-0 pl-4 flex flex-col gap-0.5">
                        {pkg.versions.map(v => (
                            <li key={v.version}>
                                {t('buyer.linesTab.version')} {v.version} · {fmtDateTime(v.createdAt)}{v.note !== '' ? ` · ${v.note}` : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}

function Group({ title, lines, cols, perLine, canSeePrices }: {
    title: string;
    lines: BuyerPackageLineDto[];
    cols: number;
    perLine: boolean;
    canSeePrices: boolean;
}) {
    return (
        <>
            <tr className="border-t border-gray-100 bg-gray-50/60">
                <td colSpan={cols} className="px-3 py-1.5 text-secondary font-medium text-gray-700">{title}</td>
            </tr>
            {lines.map(l => (
                <tr key={l.idx} className="border-t border-gray-100">
                    <td className="px-3 py-2">{l.desc}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qty(l.qtyPriced)}</td>
                    <td className="px-3 py-2">{l.unit}</td>
                    {perLine && <td className="px-3 py-2 text-secondary">{providerLabel(l.materialBy)}</td>}
                    {canSeePrices && <td className="px-3 py-2 text-right tabular-nums">{money(l.estLabUnit)}</td>}
                    {canSeePrices && <td className="px-3 py-2 text-right tabular-nums">{money(l.estTotal)}</td>}
                </tr>
            ))}
        </>
    );
}
