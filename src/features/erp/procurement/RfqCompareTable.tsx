'use client';

// ─── Quotes side by side: lowest price per line, normalized total (lines not offered at budget price), award ───
import { Tag } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import type { RfqCompareDto } from '@/shared/contract';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';

export function RfqCompareTable({ compare, canAward, onAward }: {
    compare: RfqCompareDto;
    /** The RFQ is `sent` and the caller may manage it. */
    canAward: boolean;
    onAward: (supplierId: string) => Promise<unknown>;
}) {
    const t = useTranslations('procurement.compare');
    const locale = useLocale();
    const suppliers = compare.suppliers;
    const nameOf = (s: { nameTh: string; nameEn: string }): string => (locale === 'en' && s.nameEn !== '' ? s.nameEn : s.nameTh !== '' ? s.nameTh : s.nameEn);
    const dash = <span className="text-gray-400">–</span>;
    const head = 'whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2 text-left text-[12px] font-medium text-gray-600';
    const cell = 'border-b border-gray-100 px-3 py-2 align-top';
    const labelCell = `${cell} sticky left-0 bg-white font-medium text-gray-600`;

    if (suppliers.length === 0) return <div className="text-gray-500">{t('noQuotes')}</div>;

    return (
        <div className="min-w-0 overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
                <thead>
                    <tr>
                        <th className={`${head} sticky left-0 z-[1]`}>{t('line')}</th>
                        {suppliers.map(s => (
                            <th key={s.supplierId} className={`${head} min-w-[150px] text-right`}>
                                <div className="break-words">{nameOf(s)}</div>
                                {s.supplierId === compare.bestSupplierId && <Tag color="success" icon={<TrophyOutlined />} className="!mr-0 !mt-1">{t('best')}</Tag>}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {compare.lines.map(l => (
                        <tr key={l.rfqLineId}>
                            <td className={`${cell} sticky left-0 min-w-[200px] bg-white`}>
                                <div className="break-words">{l.descTh !== '' ? l.descTh : l.descEn}</div>
                                <div className="text-[12px] text-gray-500"><QtyText value={l.qty} unit={l.unit} /> · {t('budgetPrice')} <MoneyText value={l.budgetUnitPrice} /></div>
                            </td>
                            {suppliers.map(s => {
                                const c = l.cells.find(x => x.supplierId === s.supplierId);
                                const price = c?.unitPrice ?? null;
                                return (
                                    <td key={s.supplierId} className={`${cell} text-right ${c?.lowest === true ? 'bg-green-50' : ''}`}>
                                        {c === undefined || price === null ? (
                                            <span className="text-gray-400">{t('notOffered')}</span>
                                        ) : (
                                            <>
                                                <div className={c.lowest ? 'font-semibold text-green-700' : ''}><MoneyText value={price} /></div>
                                                <div className="text-[12px] text-gray-500"><MoneyText value={c.amount} /></div>
                                            </>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                    <tr>
                        <td className={labelCell}>{t('quotedTotal')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right`}><MoneyText value={s.quotedTotal} /></td>)}
                    </tr>
                    <tr>
                        <td className={labelCell}>
                            {t('normalizedTotal')}
                            <div className="text-[12px] font-normal text-gray-500">{t('normalizedHint')}</div>
                        </td>
                        {suppliers.map(s => (
                            <td key={s.supplierId} className={`${cell} text-right`}>
                                <MoneyText value={s.normalizedTotal} className="font-semibold" />
                                {s.missingLines > 0 && <div className="text-[12px] text-orange-600">{t('missing', { count: s.missingLines })}</div>}
                            </td>
                        ))}
                    </tr>
                    <tr>
                        <td className={labelCell}>{t('lowestLines')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right tabular-nums`}>{s.lowestLines}</td>)}
                    </tr>
                    <tr>
                        <td className={labelCell}>{t('vat')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right`}><MoneyText value={s.vat} /></td>)}
                    </tr>
                    <tr>
                        <td className={labelCell}>{t('total')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right`}><MoneyText value={s.total} className="font-semibold" /></td>)}
                    </tr>
                    <tr>
                        <td className={labelCell}>{t('deliveryDays')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right tabular-nums`}>{s.deliveryDays ?? dash}</td>)}
                    </tr>
                    <tr>
                        <td className={labelCell}>{t('paymentTermDays')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right tabular-nums`}>{s.paymentTermDays ?? dash}</td>)}
                    </tr>
                    <tr>
                        <td className={labelCell}>{t('validUntil')}</td>
                        {suppliers.map(s => <td key={s.supplierId} className={`${cell} text-right`}><DateText value={s.validUntil} /></td>)}
                    </tr>
                    {canAward && (
                        <tr>
                            <td className={labelCell} />
                            {suppliers.map(s => (
                                <td key={s.supplierId} className={`${cell} text-right`}>
                                    <ConfirmAction type={s.supplierId === compare.bestSupplierId ? 'primary' : 'default'} title={t('awardConfirm', { name: nameOf(s) })}
                                        content={t('awardHint')} onConfirm={() => onAward(s.supplierId)}>
                                        {t('award')}
                                    </ConfirmAction>
                                </td>
                            ))}
                        </tr>
                    )}
                </tbody>
            </table>
            <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-gray-500">
                <span>{t('budgetTotal')}: <MoneyText value={compare.budgetTotal} /></span>
            </div>
        </div>
    );
}

