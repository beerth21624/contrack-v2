'use client';

// ─── Cost per BOQ section → cost code: budget, committed, actual, forecast (EAC), variance; filter, ledger, forecast ───
import { useMemo, useState } from 'react';
import { Button, Empty, Input, Select, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { JobCostFigures, JobCostLevel, JobCostLineDto, JobCostReportDto } from '@/shared/contract';
import { JOB_COST_LEVELS } from '@/shared/contract';
import { useFormat } from '@/i18n/useFormat';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';

const LEVEL_TONES = { ok: 'success', warning: 'warning', critical: 'error' } as const;

type Row =
    | { kind: 'section'; key: string; sectionNo: number; figures: JobCostFigures; progress: number; children: Row[] }
    | { kind: 'line'; key: string; line: JobCostLineDto }
    | { kind: 'unassigned'; key: string; committedOpen: number; actual: number };

const norm = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

export function CostTable({ report, sectionTitles, canManage, onLedger, onForecast }: {
    report: JobCostReportDto;
    sectionTitles: ReadonlyMap<number, string>;
    canManage: boolean;
    onLedger: (costCodeId: string | null, title: string) => void;
    onForecast: (line: JobCostLineDto) => void;
}) {
    const t = useTranslations('jobCost.table');
    const fmt = useFormat();
    const [section, setSection] = useState<number | undefined>(undefined);
    const [level, setLevel] = useState<JobCostLevel | undefined>(undefined);
    const [search, setSearch] = useState('');
    const [open, setOpen] = useState<readonly string[]>([]);

    const q = norm(search);
    const filtering = section !== undefined || level !== undefined || q !== '';

    const rows = useMemo<Row[]>(() => {
        const out: Row[] = [];
        for (const s of report.sections) {
            if (section !== undefined && s.sectionNo !== section) continue;
            const lines = report.lines.filter(l =>
                l.sectionNo === s.sectionNo
                && (level === undefined || l.level === level)
                && (q === '' || norm(`${l.code} ${l.descTh} ${l.descEn}`).includes(q)));
            if (lines.length === 0 && (level !== undefined || q !== '')) continue;
            out.push({
                kind: 'section', key: `s${String(s.sectionNo)}`, sectionNo: s.sectionNo, figures: s, progress: s.progress,
                children: lines.map(l => ({ kind: 'line' as const, key: l.costCodeId, line: l })),
            });
        }
        const u = report.unassigned;
        if (!filtering && (u.actual !== 0 || u.committedOpen !== 0)) out.push({ kind: 'unassigned', key: 'unassigned', committedOpen: u.committedOpen, actual: u.actual });
        return out;
    }, [report, section, level, q, filtering]);

    const expandedKeys = filtering ? rows.filter(r => r.kind === 'section').map(r => r.key) : open;
    const sectionLabel = (no: number): string => {
        const title = sectionTitles.get(no);
        return `${t('section', { no })}${title !== undefined && title !== '' ? ` · ${title}` : ''}`;
    };

    const money = (v: number, strong = false, tone = '') => <MoneyText value={v} className={`${strong ? 'font-semibold' : ''} ${tone}`} />;
    const figs = (r: Row): { budget: number; committedOpen: number; actual: number; eac: number; variance: number; level: JobCostLevel | null; progress: number | null } => {
        if (r.kind === 'line') return { ...r.line, progress: r.line.progress };
        if (r.kind === 'section') return { ...r.figures, progress: r.progress };
        return { budget: 0, committedOpen: r.committedOpen, actual: r.actual, eac: r.committedOpen + r.actual, variance: -(r.committedOpen + r.actual), level: null, progress: null };
    };

    const columns: ColumnsType<Row> = [
        {
            key: 'name', title: t('columns.name'),
            render: (_, r) => {
                if (r.kind === 'section') return <span className="font-semibold">{sectionLabel(r.sectionNo)}</span>;
                if (r.kind === 'unassigned') return <span className="font-semibold">{t('unassigned')}</span>;
                const l = r.line;
                return (
                    <div className="min-w-0">
                        <span className="font-medium tabular-nums">{l.code}</span>
                        {l.status === 'omitted' && <Tag color="error" className="!ml-2 !mr-0">{t('omitted')}</Tag>}
                        {l.forecastMethod === 'manual' && <Tag color="processing" className="!ml-2 !mr-0">{t('manual')}</Tag>}
                        <div className="text-[13px] text-gray-700 whitespace-normal break-words">{l.descTh}</div>
                    </div>
                );
            },
        },
        { key: 'unit', title: t('columns.unit'), width: 70, render: (_, r) => (r.kind === 'line' ? r.line.unit : '') },
        { key: 'budget', title: t('columns.budget'), align: 'right', render: (_, r) => (r.kind === 'unassigned' ? '–' : money(figs(r).budget, r.kind === 'section')) },
        { key: 'committed', title: t('columns.committed'), align: 'right', render: (_, r) => money(figs(r).committedOpen, r.kind === 'section') },
        { key: 'actual', title: t('columns.actual'), align: 'right', render: (_, r) => money(figs(r).actual, r.kind === 'section') },
        { key: 'eac', title: t('columns.eac'), align: 'right', render: (_, r) => money(figs(r).eac, r.kind === 'section') },
        { key: 'variance', title: t('columns.variance'), align: 'right', render: (_, r) => (r.kind === 'unassigned' ? '–' : money(figs(r).variance, r.kind === 'section', figs(r).variance < 0 ? 'text-red-600' : '')) },
        { key: 'progress', title: t('columns.progress'), align: 'right', render: (_, r) => { const p = figs(r).progress; return p === null ? '–' : fmt.percent(p, 1); } },
        { key: 'level', title: t('columns.level'), render: (_, r) => { const l = figs(r).level; return l === null ? null : <StatusTag enumName="costLevel" value={l} tones={LEVEL_TONES} />; } },
        {
            key: 'actions', title: '', align: 'right',
            render: (_, r) => {
                if (r.kind === 'section') return null;
                if (r.kind === 'unassigned') return <Button size="small" onClick={() => onLedger(null, t('unassigned'))}>{t('ledger')}</Button>;
                return (
                    <div className="flex justify-end gap-2">
                        <Button size="small" onClick={() => onLedger(r.line.costCodeId, `${r.line.code} ${r.line.descTh}`)}>{t('ledger')}</Button>
                        {canManage && <Button size="small" onClick={() => onForecast(r.line)}>{t('forecast')}</Button>}
                    </div>
                );
            },
        },
    ];

    const tot = report.totals;
    const u = report.unassigned;
    return (
        <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
                <Select<number>
                    allowClear className="min-w-[200px] max-w-full" placeholder={t('filterSection')} value={section} onChange={setSection}
                    options={report.sections.map(s => ({ value: s.sectionNo, label: sectionLabel(s.sectionNo) }))}
                    showSearch={{ optionFilterProp: 'label' }}
                />
                <Select<JobCostLevel>
                    allowClear className="min-w-[150px]" placeholder={t('filterLevel')} value={level} onChange={setLevel}
                    options={JOB_COST_LEVELS.map(l => ({ value: l, label: <StatusTag enumName="costLevel" value={l} tones={LEVEL_TONES} /> }))}
                />
                <Input.Search allowClear className="!w-[240px] max-w-full" placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Table<Row>
                rowKey="key" size="small" columns={columns} dataSource={rows} pagination={false} scroll={{ x: 'max-content' }}
                locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={report.baselineLocked ? t('empty') : t('noBaseline')} /> }}
                expandable={{
                    expandedRowKeys: [...expandedKeys],
                    onExpandedRowsChange: keys => { if (!filtering) setOpen(keys.map(String)); },
                }}
                summary={() => (rows.length === 0 ? null : (
                    <Table.Summary.Row className="font-semibold bg-gray-50">
                        <Table.Summary.Cell index={0}>{t('total')}</Table.Summary.Cell>
                        <Table.Summary.Cell index={1} />
                        <Table.Summary.Cell index={2} align="right"><MoneyText value={tot.budget} /></Table.Summary.Cell>
                        <Table.Summary.Cell index={3} align="right"><MoneyText value={tot.committedOpen + u.committedOpen} /></Table.Summary.Cell>
                        <Table.Summary.Cell index={4} align="right"><MoneyText value={tot.actual + u.actual} /></Table.Summary.Cell>
                        <Table.Summary.Cell index={5} align="right"><MoneyText value={tot.eac + u.committedOpen + u.actual} /></Table.Summary.Cell>
                        <Table.Summary.Cell index={6} align="right"><MoneyText value={tot.budget - tot.eac - u.committedOpen - u.actual} /></Table.Summary.Cell>
                        <Table.Summary.Cell index={7} />
                        <Table.Summary.Cell index={8} />
                        <Table.Summary.Cell index={9} />
                    </Table.Summary.Row>
                ))}
            />
        </div>
    );
}
