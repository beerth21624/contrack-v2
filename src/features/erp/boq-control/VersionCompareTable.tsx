'use client';

// ─── Result of comparing two BOQ versions (or a version with the live BOQ): totals, sections, lines ───
import { useMemo, useState } from 'react';
import { Alert, Button, Skeleton, Switch, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { BoqLineChangeKind, BoqVersionCompareDto, BoqVersionLineDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';
import type { CompareTarget } from './api';
import { useBoqCompare } from './hooks';

type CompareLine = BoqVersionCompareDto['lines'][number];
type CompareSection = BoqVersionCompareDto['sections'][number];
type TotalKey = keyof BoqVersionCompareDto['totals']['before'];

const TOTAL_KEYS: readonly TotalKey[] = ['constructionTotal', 'preConstructionTotal', 'matTotal', 'labTotal'];

export const CHANGE_COLORS: Record<BoqLineChangeKind, string> = {
    added: 'green', removed: 'red', changed: 'orange', same: 'default',
};

/** A signed difference: `+1,250.00` (red: costs more) / `−300.00` (green) / `0.00` (grey). */
function Delta({ value, qty = false, unit }: { value: number; qty?: boolean; unit?: string }) {
    const fmt = useFormat();
    const text = qty ? fmt.qty(Math.abs(value)) : fmt.money(Math.abs(value));
    const sign = value > 0 ? '+' : value < 0 ? '−' : '';
    const tone = value > 0 ? 'text-red-600' : value < 0 ? 'text-green-700' : 'text-gray-400';
    return (
        <span className={`whitespace-nowrap tabular-nums ${tone}`}>
            {sign}{text}{unit !== undefined && unit !== '' && value !== 0 ? <span className="text-gray-500"> {unit}</span> : null}
        </span>
    );
}

/** `before → after` of one field (only the after value when the line is the same / added, the before when removed). */
function BeforeAfter({ line, render }: { line: CompareLine; render: (l: BoqVersionLineDto) => React.ReactNode }) {
    if (line.change === 'changed' && line.before !== undefined && line.after !== undefined) {
        return (
            <div className="flex flex-col">
                <span className="text-[12px] text-gray-400 line-through">{render(line.before)}</span>
                <span>{render(line.after)}</span>
            </div>
        );
    }
    const l = line.after ?? line.before;
    return l === undefined ? null : <span className={line.change === 'removed' ? 'text-gray-400 line-through' : ''}>{render(l)}</span>;
}

export function VersionCompareTable({ projectId, from, to }: { projectId: string; from: string; to: CompareTarget }) {
    const t = useTranslations('boqControl');
    const tEnums = useTranslations('enums');
    const fmt = useFormat();
    const toText = useErrorMessage();
    const compare = useBoqCompare(projectId, from, to);
    const [onlyChangedLines, setOnlyChangedLines] = useState(true);
    const [onlyChangedSections, setOnlyChangedSections] = useState(false);

    const sectionTitle = useMemo(() => {
        const m = new Map<number, string>();
        for (const s of compare.data?.sections ?? []) m.set(s.no, s.titleTh);
        return m;
    }, [compare.data]);

    if (compare.isLoading) return <Skeleton active />;
    if (compare.isError) {
        return (
            <Alert type="error" showIcon title={toText(compare.error)}
                action={<Button size="small" onClick={() => { void compare.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const d = compare.data;
    if (d === undefined) return null;

    const sections = onlyChangedSections ? d.sections.filter(s => s.delta !== 0) : d.sections;
    const lines = onlyChangedLines ? d.lines.filter(l => l.change !== 'same') : d.lines;

    const sectionColumns: ColumnsType<CompareSection> = [
        {
            key: 'section', title: t('compare.sections.section'),
            render: (_, s) => (
                <div className="min-w-[180px]">
                    <span className="tabular-nums text-gray-500">{s.no}.</span> {s.titleTh}
                    {!s.inConstructionTotal && <Tag className="!ml-2">{t('compare.sections.outside')}</Tag>}
                </div>
            ),
        },
        { key: 'before', title: t('compare.before'), align: 'right', render: (_, s) => <MoneyText value={s.before} /> },
        { key: 'after', title: t('compare.after'), align: 'right', render: (_, s) => <MoneyText value={s.after} /> },
        { key: 'delta', title: t('compare.delta'), align: 'right', render: (_, s) => <Delta value={s.delta} /> },
    ];

    const lineColumns: ColumnsType<CompareLine> = [
        {
            key: 'change', title: t('compare.lines.change'), width: 96,
            render: (_, l) => <Tag color={CHANGE_COLORS[l.change]}>{tEnums(`boqLineChange.${l.change}`)}</Tag>,
        },
        {
            key: 'item', title: t('compare.lines.item'),
            render: (_, l) => {
                const x = l.after ?? l.before;
                return (
                    <div className="min-w-[220px]">
                        <div className="text-[12px] text-gray-400">
                            {l.sectionNo}. {sectionTitle.get(l.sectionNo) ?? ''}{x !== undefined && x.itemNo !== '' ? ` · ${x.itemNo}` : ''}
                        </div>
                        <div className="break-words">{x?.descTh ?? l.lineKey}</div>
                    </div>
                );
            },
        },
        {
            key: 'qty', title: t('compare.lines.qty'), align: 'right',
            render: (_, l) => <BeforeAfter line={l} render={x => <QtyText value={x.qty} unit={x.unit} />} />,
        },
        {
            key: 'unitPrice', title: t('compare.lines.unitPrice'), align: 'right',
            render: (_, l) => (
                <BeforeAfter line={l} render={x => (
                    <span className="whitespace-nowrap tabular-nums">{fmt.money(x.matUnit)} + {fmt.money(x.labUnit)}</span>
                )} />
            ),
        },
        {
            key: 'total', title: t('compare.lines.total'), align: 'right',
            render: (_, l) => <BeforeAfter line={l} render={x => <MoneyText value={x.total} />} />,
        },
        {
            key: 'deltaQty', title: t('compare.lines.deltaQty'), align: 'right',
            render: (_, l) => <Delta value={l.deltaQty} qty unit={(l.after ?? l.before)?.unit} />,
        },
        { key: 'deltaTotal', title: t('compare.lines.deltaTotal'), align: 'right', render: (_, l) => <Delta value={l.deltaTotal} /> },
    ];

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {TOTAL_KEYS.map(k => (
                    <div key={k} className="min-w-0 rounded-card border border-gray-100 bg-gray-50 px-3 py-2">
                        <div className="truncate text-[12px] text-gray-500">{t(`compare.totals.${k}`)}</div>
                        <div className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                            <span className="text-[13px] text-gray-500"><MoneyText value={d.totals.before[k]} /></span>
                            <span className="text-gray-400">→</span>
                            <span className="text-[16px] font-semibold text-gray-900"><MoneyText value={d.totals.after[k]} /></span>
                        </div>
                        <div className="text-[13px]"><Delta value={d.totals.delta[k]} /></div>
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap gap-2">
                {(['added', 'removed', 'changed'] as const).map(c => (
                    <Tag key={c} color={CHANGE_COLORS[c]}>{tEnums(`boqLineChange.${c}`)} {fmt.number(d.counts[c])}</Tag>
                ))}
                <span className="text-[12px] text-gray-500 self-center">{t('compare.counts', d.counts)}</span>
            </div>

            <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{t('compare.sections.title')}</span>
                    <label className="flex items-center gap-2 text-[13px] text-gray-600">
                        <Switch size="small" checked={onlyChangedSections} onChange={setOnlyChangedSections} />
                        {t('compare.sections.onlyChanged')}
                    </label>
                </div>
                <Table<CompareSection> size="small" rowKey="no" columns={sectionColumns} dataSource={sections}
                    pagination={false} scroll={{ x: 'max-content' }} />
            </div>

            <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{t('compare.lines.title')}</span>
                    <label className="flex items-center gap-2 text-[13px] text-gray-600">
                        <Switch size="small" checked={onlyChangedLines} onChange={setOnlyChangedLines} />
                        {t('compare.lines.onlyChanged')}
                    </label>
                </div>
                <Table<CompareLine> size="small" rowKey="lineKey" columns={lineColumns} dataSource={lines}
                    locale={{ emptyText: t('compare.lines.none') }}
                    pagination={lines.length > 100 ? { pageSize: 100, showSizeChanger: false } : false}
                    scroll={{ x: 'max-content' }} />
            </div>
            <div className="text-[12px] text-gray-500">{t('roundingNote')}</div>
        </div>
    );
}
