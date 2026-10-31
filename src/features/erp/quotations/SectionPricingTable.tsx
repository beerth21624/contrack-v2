'use client';

// ─── Sections of the quotation: include, rates (markup / overhead / profit), VAT per section, cost and sell; lines inside ───
import { useState } from 'react';
import { Button, Input, Switch, Table } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useLocale, useTranslations } from 'next-intl';
import type { QuotationSection, QuotationSectionInput } from '@/domain/quotation';
import { CUSTOM_SECTION_NO_MIN } from '@/shared/contract';
import { MoneyText } from '../shared/MoneyText';
import { LinesTable } from './LinesTable';
import type { EditorForm, FormLine, PricedLine, PricedView } from './logic';
import { sectionTitle } from './logic';
import { PercentInput } from './PercentInput';

export function SectionPricingTable({ form, priced, editable, seesMargins, onPatchSection, onAddSection, onRemoveSection, onPatchLine, onRemoveLine, onAddLine }: {
    form: Pick<EditorForm, 'format' | 'pricing'>;
    priced: PricedView;
    editable: boolean;
    seesMargins: boolean;
    onPatchSection: (sectionNo: number, patch: Partial<QuotationSectionInput>) => void;
    onAddSection: (titleTh: string, titleEn: string) => void;
    onRemoveSection: (sectionNo: number) => void;
    onPatchLine: (ck: string, patch: Partial<FormLine>) => void;
    onRemoveLine: (ck: string) => void;
    onAddLine: (sectionNo: number, kind: 'custom' | 'note') => void;
}) {
    const t = useTranslations('quotations');
    const locale = useLocale() === 'en' ? 'en' : 'th';
    const [newTh, setNewTh] = useState('');
    const [newEn, setNewEn] = useState('');
    const government = form.format === 'government';
    const perCategory = form.pricing.vatMode === 'per_category';
    const linesBySection = new Map<number, PricedLine[]>();
    for (const l of priced.lines) {
        const list = linesBySection.get(l.sectionNo) ?? [];
        list.push(l);
        linesBySection.set(l.sectionNo, list);
    }
    const isCustom = (s: QuotationSection) => s.sectionNo >= CUSTOM_SECTION_NO_MIN;

    const columns: ColumnsType<QuotationSection> = [
        {
            key: 'included', title: t('sections.included'), width: 80,
            render: (_, s) => (
                <Switch size="small" checked={s.included} disabled={!editable} aria-label={t('sections.included')}
                    onChange={checked => onPatchSection(s.sectionNo, { included: checked })} />
            ),
        },
        {
            key: 'title', title: t('sections.title'),
            render: (_, s) => (editable && isCustom(s) ? (
                <div className="flex min-w-[200px] flex-col gap-1">
                    <Input value={s.titleTh} maxLength={300} aria-label={t('lines.descTh')} placeholder={t('lines.descTh')} onChange={e => onPatchSection(s.sectionNo, { titleTh: e.target.value })} />
                    <Input value={s.titleEn} maxLength={300} aria-label={t('lines.descEn')} placeholder={t('lines.descEn')} onChange={e => onPatchSection(s.sectionNo, { titleEn: e.target.value })} />
                </div>
            ) : (
                <div className={`min-w-[200px] break-words ${s.included ? '' : 'text-gray-400'}`}>
                    {isCustom(s) ? '' : `${s.sectionNo}. `}{sectionTitle(s, locale)}
                </div>
            )),
        },
        ...(seesMargins ? [{
            key: 'cost', title: t('sections.cost'), align: 'right' as const,
            render: (_: unknown, s: QuotationSection) => <MoneyText value={s.costTotal} muted />,
        }] : []),
        ...(seesMargins && !government ? (['markupRate', 'overheadRate', 'profitRate'] as const).map(k => ({
            key: k, title: t(`sections.${k}`), align: 'right' as const,
            render: (_: unknown, s: QuotationSection) => (editable
                ? <PercentInput value={s[k]} aria-label={t(`sections.${k}`)} onChange={v => { if (v !== null) onPatchSection(s.sectionNo, { [k]: v }); }} />
                : <span className="tabular-nums">{(s[k] * 100).toFixed(2)}%</span>),
        })) : []),
        ...(perCategory ? [{
            key: 'vatRate', title: t('sections.vatRate'), align: 'right' as const,
            render: (_: unknown, s: QuotationSection) => (editable
                ? <PercentInput value={s.vatRate} allowEmpty max={100} placeholder={t('sections.vatDocument')} aria-label={t('sections.vatRate')} onChange={v => onPatchSection(s.sectionNo, { vatRate: v })} />
                : <span className="tabular-nums">{s.vatRate === null ? t('sections.vatDocument') : `${(s.vatRate * 100).toFixed(2)}%`}</span>),
        }] : []),
        { key: 'sell', title: t('sections.sell'), align: 'right', render: (_, s) => <MoneyText value={s.included ? s.sellTotal : 0} className="font-semibold" muted={!s.included} /> },
        ...(editable ? [{
            key: 'actions', title: '', width: 48,
            render: (_: unknown, s: QuotationSection) => (isCustom(s)
                ? <Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={t('sections.remove')} title={t('sections.remove')} onClick={() => onRemoveSection(s.sectionNo)} />
                : null),
        }] : []),
    ];

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <Table<QuotationSection> size="small" rowKey="sectionNo" columns={columns} dataSource={priced.sections} pagination={false}
                scroll={{ x: 'max-content' }} locale={{ emptyText: t('sections.empty') }}
                expandable={{
                    expandedRowRender: s => (
                        <LinesTable lines={linesBySection.get(s.sectionNo) ?? []} editable={editable} seesMargins={seesMargins}
                            onPatch={onPatchLine} onRemove={onRemoveLine} onAdd={kind => onAddLine(s.sectionNo, kind)} />
                    ),
                }} />
            {editable && (
                <div className="flex flex-wrap items-end gap-2">
                    <Input className="!w-[220px] max-w-full" maxLength={300} value={newTh} placeholder={t('sections.newTh')} aria-label={t('sections.newTh')} onChange={e => setNewTh(e.target.value)} />
                    <Input className="!w-[220px] max-w-full" maxLength={300} value={newEn} placeholder={t('sections.newEn')} aria-label={t('sections.newEn')} onChange={e => setNewEn(e.target.value)} />
                    <Button icon={<PlusOutlined />} disabled={newTh.trim() === ''}
                        onClick={() => { onAddSection(newTh.trim(), newEn.trim()); setNewTh(''); setNewEn(''); }}>
                        {t('sections.add')}
                    </Button>
                </div>
            )}
        </div>
    );
}
