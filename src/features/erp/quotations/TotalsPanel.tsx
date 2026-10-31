'use client';

// ─── Totals of the quotation: sell, discount, rounding, VAT, grand total; cost and margin for those who may see them ───
import { Descriptions, Tag } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import type { QuotationPartTotal, QuotationTotals } from '@/domain/quotation';
import { useFormat } from '@/i18n/useFormat';
import { MoneyText } from '../shared/MoneyText';

export function TotalsPanel({ totals, parts, seesMargins, government, vatRegistered }: {
    totals: QuotationTotals;
    parts: readonly QuotationPartTotal[];
    seesMargins: boolean;
    government: boolean;
    vatRegistered: boolean;
}) {
    const t = useTranslations('quotations');
    const fmt = useFormat();
    const locale = useLocale() === 'en' ? 'en' : 'th';
    const items = [
        ...(government ? [] : [{ key: 'sell', label: t('totals.sell'), children: <MoneyText value={totals.sell} /> }]),
        ...(totals.discount !== 0 ? [{ key: 'discount', label: t('totals.discount'), children: <MoneyText value={-totals.discount} /> }] : []),
        ...(totals.roundingAdj !== 0 ? [{ key: 'rounding', label: t('totals.rounding'), children: <MoneyText value={totals.roundingAdj} /> }] : []),
        { key: 'vatBase', label: t('totals.vatBase'), children: <MoneyText value={totals.vatBase} /> },
        { key: 'vat', label: t('totals.vat'), children: <MoneyText value={totals.vat} /> },
        { key: 'grand', label: <b>{t('totals.grandTotal')}</b>, children: <MoneyText value={totals.grandTotal} className="text-[16px] font-bold text-gray-900" /> },
        ...(seesMargins ? [
            { key: 'cost', label: t('totals.cost'), children: <MoneyText value={totals.cost} muted /> },
            { key: 'margin', label: t('totals.margin'), children: <span className="tabular-nums"><MoneyText value={totals.marginAmount} muted /> <Tag className="!m-0 !ml-1">{fmt.percent(totals.marginPct, 2)}</Tag></span> },
        ] : []),
    ];
    return (
        <div className="flex flex-col gap-3">
            <Descriptions size="small" column={1} items={items} />
            {!vatRegistered && <div className="text-[12px] text-gray-500">{t('totals.notVatRegistered')}</div>}
            {government && parts.length > 0 && (
                <div className="flex flex-col gap-1 border-t border-gray-100 pt-2 text-[13px]">
                    <div className="font-semibold">{t('totals.parts')}</div>
                    {parts.map(p => (
                        <div key={p.key} className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="min-w-0 break-words">{(locale === 'en' && p.titleEn !== '' ? p.titleEn : p.titleTh) || p.key} <span className="text-gray-500">(F {p.factorF})</span></span>
                            <MoneyText value={p.sell} className="font-semibold" />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
