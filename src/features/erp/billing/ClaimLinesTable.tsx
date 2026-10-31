'use client';

// ─── The lines of a claim: previous / this / cumulative progress and amount per cost code ───
// Cumulative % starts from the reported progress (the server fills it); a lower % than the previous claim needs a note.
// Phones get a list of cards instead of the table.
import { useMemo, useState } from 'react';
import { Grid, Input, Select, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { ArClaimLineDto } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { MoneyText } from '../shared/MoneyText';
import { PercentInput } from '../quotations/PercentInput';

export interface LineEdit {
    cum?: number;
    note?: string;
}
export type LineEdits = Record<string, LineEdit>;

export function ClaimLinesTable({ lines, editable, edits, onEdit }: {
    lines: readonly ArClaimLineDto[];
    /** Progress claims in draft / submitted: the cumulative % can be typed. */
    editable: boolean;
    edits: LineEdits;
    onEdit: (costCodeId: string, patch: LineEdit) => void;
}) {
    const t = useTranslations('billing');
    const fmt = useFormat();
    const screens = Grid.useBreakpoint();
    const mobile = screens.md === false;
    const [section, setSection] = useState<number | 'all'>('all');
    const sections = useMemo(() => [...new Set(lines.map(l => l.sectionNo))].sort((a, b) => a - b), [lines]);
    const rows = section === 'all' ? lines : lines.filter(l => l.sectionNo === section);
    const desc = (l: ArClaimLineDto) => (fmt.locale === 'th' ? (l.descTh !== '' ? l.descTh : l.descEn) : (l.descEn !== '' ? l.descEn : l.descTh));
    const cumOf = (l: ArClaimLineDto) => edits[l.costCodeId]?.cum ?? l.cumProgress;
    const noteOf = (l: ArClaimLineDto) => edits[l.costCodeId]?.note ?? l.note;
    const lowered = (l: ArClaimLineDto) => cumOf(l) < l.prevProgress - 1e-9;

    const progressInput = (l: ArClaimLineDto) => (editable ? (
        <PercentInput value={cumOf(l)} max={100} aria-label={t('lines.cum')} className="!w-[100px]" onChange={v => onEdit(l.costCodeId, { cum: v ?? 0 })} />
    ) : fmt.percent(l.cumProgress));
    const noteInput = (l: ArClaimLineDto) => (editable && lowered(l) ? (
        <Input size="small" value={noteOf(l)} maxLength={1000} status={noteOf(l).trim() === '' ? 'error' : undefined} placeholder={t('lines.noteRequired')}
            onChange={e => onEdit(l.costCodeId, { note: e.target.value })} />
    ) : (noteOf(l) === '' ? null : <span className="text-gray-500">{noteOf(l)}</span>));

    const columns: ColumnsType<ArClaimLineDto> = [
        { key: 'code', title: t('lines.code'), width: 90, render: (_, l) => <span className="font-mono">{l.code}</span> },
        { key: 'desc', title: t('lines.desc'), render: (_, l) => <span className="break-words">{desc(l)}</span> },
        { key: 'contract', title: t('lines.contractAmount'), align: 'right', render: (_, l) => <MoneyText value={l.contractAmount} /> },
        { key: 'reported', title: t('lines.reported'), align: 'right', render: (_, l) => fmt.percent(l.reportedProgress) },
        { key: 'prev', title: t('lines.prev'), align: 'right', render: (_, l) => <span>{fmt.percent(l.prevProgress)}<br /><MoneyText value={l.prevAmount} muted /></span> },
        { key: 'cum', title: t('lines.cum'), align: 'right', render: (_, l) => <span>{progressInput(l)}<br /><MoneyText value={l.cumAmount} muted /></span> },
        { key: 'this', title: t('lines.this'), align: 'right', render: (_, l) => <MoneyText value={l.thisAmount} /> },
        { key: 'note', title: t('lines.note'), render: (_, l) => noteInput(l) },
    ];

    return (
        <div className="flex flex-col gap-3">
            {sections.length > 1 && (
                <Select className="!w-full md:!w-[260px]" value={section} onChange={setSection} aria-label={t('lines.section')}
                    options={[{ value: 'all', label: t('lines.allSections') }, ...sections.map(s => ({ value: s, label: t('lines.sectionNo', { no: s }) }))]} />
            )}
            {mobile ? (
                <div className="flex flex-col gap-2">
                    {rows.map(l => (
                        <div key={l.costCodeId} className="rounded border border-gray-200 p-3">
                            <div className="mb-1 break-words font-medium"><span className="font-mono">{l.code}</span> {desc(l)}</div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
                                <span className="text-gray-500">{t('lines.contractAmount')}</span><MoneyText value={l.contractAmount} className="text-right" />
                                <span className="text-gray-500">{t('lines.reported')}</span><span className="text-right">{fmt.percent(l.reportedProgress)}</span>
                                <span className="text-gray-500">{t('lines.prev')}</span><span className="text-right">{fmt.percent(l.prevProgress)} · <MoneyText value={l.prevAmount} /></span>
                                <span className="text-gray-500">{t('lines.cum')}</span><span className="text-right">{progressInput(l)}</span>
                                <span className="text-gray-500">{t('lines.this')}</span><MoneyText value={l.thisAmount} className="text-right font-medium" />
                            </div>
                            <div className="mt-1">{noteInput(l)}</div>
                        </div>
                    ))}
                </div>
            ) : (
                <Table<ArClaimLineDto> size="small" rowKey="costCodeId" columns={columns} dataSource={[...rows]} pagination={false} scroll={{ x: 'max-content' }} />
            )}
        </div>
    );
}
