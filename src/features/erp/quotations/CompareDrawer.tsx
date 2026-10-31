'use client';

// ─── Compare two versions of a quotation: totals, sections and the lines that changed ───
import { useState } from 'react';
import { Alert, Drawer, Select, Skeleton, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useLocale, useTranslations } from 'next-intl';
import type { QuotationCompareDto, QuotationVersionSummaryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { MoneyText } from '../shared/MoneyText';
import { useQuotationCompare } from './hooks';
import { sectionTitle } from './logic';

type SectionRow = QuotationCompareDto['sections'][number];
type LineRow = QuotationCompareDto['lines'][number];
const CHANGE_COLOR = { added: 'success', removed: 'error', changed: 'warning', same: 'default' } as const;

function ChangeTag({ change }: { change: SectionRow['change'] }) {
    const t = useTranslations('quotations');
    return <Tag color={CHANGE_COLOR[change]} className="!m-0">{t(`compare.change.${change}`)}</Tag>;
}

function Delta({ value }: { value: number }) {
    if (value === 0) return <span className="text-gray-400">–</span>;
    return <MoneyText value={value} className={value > 0 ? 'text-green-700' : 'text-red-600'} />;
}

function Body({ data }: { data: QuotationCompareDto }) {
    const t = useTranslations('quotations');
    const locale = useLocale() === 'en' ? 'en' : 'th';
    const sectionCols: ColumnsType<SectionRow> = [
        { key: 'title', title: t('sections.title'), render: (_, s) => <span className="break-words">{s.sectionNo < 100 ? `${s.sectionNo}. ` : ''}{sectionTitle(s, locale)}</span> },
        { key: 'change', title: t('compare.changeCol'), render: (_, s) => <ChangeTag change={s.change} /> },
        { key: 'before', title: t('compare.before'), align: 'right', render: (_, s) => <MoneyText value={s.sellBefore} /> },
        { key: 'after', title: t('compare.after'), align: 'right', render: (_, s) => <MoneyText value={s.sellAfter} /> },
        { key: 'delta', title: t('compare.delta'), align: 'right', render: (_, s) => <Delta value={s.deltaSell} /> },
    ];
    const lineCols: ColumnsType<LineRow> = [
        {
            key: 'desc', title: t('lines.desc'),
            render: (_, l) => {
                const x = l.after ?? l.before;
                return <span className="break-words">{x === undefined ? l.key : (locale === 'en' && x.descEn !== '' ? x.descEn : x.descTh)}</span>;
            },
        },
        { key: 'change', title: t('compare.changeCol'), render: (_, l) => <ChangeTag change={l.change} /> },
        { key: 'qty', title: t('lines.qty'), align: 'right', render: (_, l) => <span className="tabular-nums">{l.before?.qty ?? 0} → {l.after?.qty ?? 0}</span> },
        { key: 'before', title: t('compare.before'), align: 'right', render: (_, l) => <MoneyText value={l.before?.sellAmount ?? 0} /> },
        { key: 'after', title: t('compare.after'), align: 'right', render: (_, l) => <MoneyText value={l.after?.sellAmount ?? 0} /> },
        { key: 'delta', title: t('compare.delta'), align: 'right', render: (_, l) => <Delta value={l.deltaSell} /> },
    ];
    const totalRows = [
        { key: 'sell', label: t('totals.sell'), k: 'sell' as const },
        { key: 'discount', label: t('totals.discount'), k: 'discount' as const },
        { key: 'roundingAdj', label: t('totals.rounding'), k: 'roundingAdj' as const },
        { key: 'vatBase', label: t('totals.vatBase'), k: 'vatBase' as const },
        { key: 'vat', label: t('totals.vat'), k: 'vat' as const },
        { key: 'grandTotal', label: t('totals.grandTotal'), k: 'grandTotal' as const },
        ...(data.totals.after.cost !== undefined ? [
            { key: 'cost', label: t('totals.cost'), k: 'cost' as const },
            { key: 'marginAmount', label: t('totals.margin'), k: 'marginAmount' as const },
        ] : []),
    ];
    const totalCols: ColumnsType<(typeof totalRows)[number]> = [
        { key: 'label', title: '', dataIndex: 'label' },
        { key: 'before', title: t('compare.before'), align: 'right', render: (_, r) => <MoneyText value={data.totals.before[r.k]} /> },
        { key: 'after', title: t('compare.after'), align: 'right', render: (_, r) => <MoneyText value={data.totals.after[r.k]} /> },
        { key: 'delta', title: t('compare.delta'), align: 'right', render: (_, r) => <Delta value={data.totals.delta[r.k] ?? 0} /> },
    ];
    const changedLines = data.lines.filter(l => l.change !== 'same');
    const changedSections = data.sections.filter(s => s.change !== 'same');
    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
                {(['added', 'removed', 'changed', 'same'] as const).map(c => (
                    <Tag key={c} color={CHANGE_COLOR[c]} className="!m-0">{t(`compare.change.${c}`)}: {data.counts[c] ?? 0}</Tag>
                ))}
            </div>
            <Table size="small" rowKey="key" columns={totalCols} dataSource={totalRows} pagination={false} scroll={{ x: 'max-content' }} />
            <div>
                <div className="mb-1 font-semibold">{t('compare.sections')}</div>
                <Table<SectionRow> size="small" rowKey="sectionNo" columns={sectionCols} dataSource={changedSections} pagination={false}
                    scroll={{ x: 'max-content' }} locale={{ emptyText: t('compare.noChanges') }} />
            </div>
            <div>
                <div className="mb-1 font-semibold">{t('compare.lines')}</div>
                <Table<LineRow> size="small" rowKey="key" columns={lineCols} dataSource={changedLines}
                    pagination={changedLines.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
                    scroll={{ x: 'max-content' }} locale={{ emptyText: t('compare.noChanges') }} />
            </div>
        </div>
    );
}

export function CompareDrawer({ quotationId, versions, open, currentId, onClose }: {
    quotationId: string;
    versions: readonly QuotationVersionSummaryDto[];
    open: boolean;
    /** The version on screen (the "to" side by default). */
    currentId: string;
    onClose: () => void;
}) {
    const t = useTranslations('quotations');
    const toText = useErrorMessage();
    const sorted = [...versions].sort((a, b) => a.versionNo - b.versionNo);
    const [from, setFrom] = useState<string | undefined>();
    const [to, setTo] = useState<string | undefined>();
    const known = new Set(sorted.map(v => v.id));
    const effTo = to !== undefined && known.has(to) ? to : currentId;
    const before = sorted.filter(v => v.versionNo < (sorted.find(x => x.id === effTo)?.versionNo ?? 0)).pop();
    const effFrom = from !== undefined && known.has(from) ? from : (before ?? sorted.find(v => v.id !== effTo))?.id;
    const q = useQuotationCompare(quotationId, open ? effFrom : undefined, open ? effTo : undefined);
    const options = sorted.map(v => ({ value: v.id, label: `${t('versionNo', { no: v.versionNo })}${v.number !== null ? ` · ${v.number}` : ''}` }));

    return (
        <Drawer open={open} onClose={onClose} destroyOnHidden title={t('compare.title')} styles={{ wrapper: { width: 'min(960px, 100vw)' } }}>
            <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                    {t('compare.from')}
                    <Select className="!w-[240px] max-w-full" value={effFrom} options={options} onChange={setFrom} />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                    {t('compare.to')}
                    <Select className="!w-[240px] max-w-full" value={effTo} options={options} onChange={setTo} />
                </label>
            </div>
            {sorted.length < 2 && <div className="text-gray-500">{t('compare.needMore')}</div>}
            {effFrom === effTo && sorted.length >= 2 && <div className="text-gray-500">{t('compare.pickDifferent')}</div>}
            {q.isLoading && <Skeleton active />}
            {q.isError && <Alert type="error" showIcon title={toText(q.error)} />}
            {q.data !== undefined && effFrom !== effTo && <Body data={q.data} />}
        </Drawer>
    );
}
