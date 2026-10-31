'use client';

// ─── /p/[projectId]/versions: the BOQ versions of a project (one per revision) and the comparison of two ───
import { useState } from 'react';
import { Alert, Button, Drawer, Select, Skeleton, Table, Tag } from 'antd';
import { SwapOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { BoqVersionDto, BoqVersionLineDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';
import { SectionCard } from '../shared/SectionCard';
import { useOpenProjectBoq } from '../hub/ProjectShell';
import type { CompareTarget } from './api';
import { useBoqVersion, useBoqVersions } from './hooks';
import { VersionCompareTable } from './VersionCompareTable';
import { BaselinePanel } from './BaselinePanel';

function VersionName({ v }: { v: BoqVersionDto }) {
    const t = useTranslations('boqControl');
    const tEnums = useTranslations('enums');
    return (
        <span className="inline-flex flex-wrap items-center gap-1">
            <Tag color="orange" className="!font-semibold">{t('list.versionNo', { no: v.versionNo })}</Tag>
            <span className="font-medium">{v.label}</span>
            {v.kind === 'baseline' && <Tag color="blue">{tEnums('boqVersionKind.baseline')}</Tag>}
        </span>
    );
}

function VersionDrawer({ versionId, onClose }: { versionId: string | undefined; onClose: () => void }) {
    const t = useTranslations('boqControl');
    const toText = useErrorMessage();
    const detail = useBoqVersion(versionId);
    const d = detail.data;
    const titles = new Map((d?.sections ?? []).map(s => [s.sectionNo, s]));
    const columns: ColumnsType<BoqVersionLineDto> = [
        { key: 'itemNo', title: t('detail.itemNo'), render: (_, l) => <span className="whitespace-nowrap text-gray-500">{l.itemNo}</span> },
        { key: 'desc', title: t('detail.desc'), render: (_, l) => <div className="min-w-[200px] break-words">{l.descTh}</div> },
        { key: 'qty', title: t('detail.qty'), align: 'right', render: (_, l) => <QtyText value={l.qty} unit={l.unit} /> },
        { key: 'matUnit', title: t('detail.matUnit'), align: 'right', render: (_, l) => <MoneyText value={l.matUnit} /> },
        { key: 'labUnit', title: t('detail.labUnit'), align: 'right', render: (_, l) => <MoneyText value={l.labUnit} /> },
        { key: 'total', title: t('detail.total'), align: 'right', render: (_, l) => <MoneyText value={l.total} /> },
    ];
    const groups = d === undefined ? [] : d.sections
        .map(s => ({ section: s, lines: d.lines.filter(l => l.sectionNo === s.sectionNo) }))
        .filter(g => g.lines.length > 0);

    return (
        <Drawer open={versionId !== undefined} onClose={onClose} destroyOnHidden
            title={d === undefined ? t('list.view') : t('detail.title', { no: d.version.versionNo, label: d.version.label })}
            styles={{ wrapper: { width: 'min(960px, 100vw)' } }}>
            {detail.isLoading && <Skeleton active />}
            {detail.isError && <Alert type="error" showIcon title={toText(detail.error)} />}
            {d !== undefined && (
                <div className="flex flex-col gap-4">
                    {groups.map(g => (
                        <div key={g.section.sectionNo} className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-semibold">{g.section.sectionNo}. {titles.get(g.section.sectionNo)?.titleTh}</span>
                                <span className="text-[13px] text-gray-600">
                                    {t('detail.sectionTotal')} <MoneyText value={g.section.total} className="font-semibold text-gray-900" />
                                </span>
                            </div>
                            <Table<BoqVersionLineDto> size="small" rowKey="lineKey" columns={columns} dataSource={g.lines}
                                pagination={false} scroll={{ x: 'max-content' }} />
                        </div>
                    ))}
                    <div className="text-[12px] text-gray-500">{t('roundingNote')}</div>
                </div>
            )}
        </Drawer>
    );
}

export function VersionsPage({ projectId }: { projectId: string }) {
    const t = useTranslations('boqControl');
    const toText = useErrorMessage();
    const versions = useBoqVersions(projectId);
    const { open, opening } = useOpenProjectBoq(projectId);
    const [from, setFrom] = useState<string | undefined>();
    const [to, setTo] = useState<CompareTarget | undefined>();
    const [viewId, setViewId] = useState<string | undefined>();

    if (versions.isLoading) return <Skeleton active />;
    if (versions.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(versions.error)}`}
                action={<Button size="small" onClick={() => { void versions.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const list = versions.data ?? [];
    if (list.length === 0) {
        return (
            <div className="flex min-w-0 flex-col gap-4">
                <BaselinePanel projectId={projectId} versions={list} />
                <SectionCard title={t('title')}>
                    <EmptyState title={t('empty.title')} hint={t('empty.hint')}
                        action={<Button type="primary" loading={opening} onClick={() => { void open(); }}>{t('empty.openBoq')}</Button>} />
                </SectionCard>
            </div>
        );
    }

    // Default: the two newest versions (older → newer), or the only one against the live BOQ.
    const known = new Set(list.map(v => v.id));
    const newest = list[0]?.id ?? '';
    const effFrom = from !== undefined && known.has(from) ? from : list[1]?.id ?? newest;
    const effTo: CompareTarget = to !== undefined && (to === 'live' || known.has(to)) ? to : list.length > 1 ? newest : 'live';

    const options = list.map(v => ({ value: v.id, label: `${t('list.versionNo', { no: v.versionNo })} · ${v.label}` }));
    const toOptions = [...options, { value: 'live', label: t('compare.live') }];

    const columns: ColumnsType<BoqVersionDto> = [
        { key: 'version', title: t('list.columns.version'), render: (_, v) => <div className="min-w-[180px]"><VersionName v={v} />{v.note !== null && v.note !== '' && <div className="whitespace-pre-wrap text-[12px] text-gray-500">{v.note}</div>}</div> },
        { key: 'createdAt', title: t('list.columns.createdAt'), render: (_, v) => <DateText value={v.createdAt} style="dateTime" /> },
        { key: 'constructionTotal', title: t('list.columns.constructionTotal'), align: 'right', render: (_, v) => <MoneyText value={v.constructionTotal} className="font-semibold" /> },
        { key: 'lineCount', title: t('list.columns.lineCount'), align: 'right', render: (_, v) => <span className="tabular-nums">{v.lineCount}</span> },
        { key: 'view', title: '', align: 'right', render: (_, v) => <Button size="small" onClick={() => setViewId(v.id)}>{t('list.view')}</Button> },
    ];

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <BaselinePanel projectId={projectId} versions={list} />
            <SectionCard title={t('title')}>
                <div className="mb-3 text-[13px] text-gray-500">{t('subtitle')}</div>
                <Table<BoqVersionDto> size="small" rowKey="id" columns={columns} dataSource={list}
                    pagination={list.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
            </SectionCard>

            <SectionCard title={t('compare.title')}>
                <div className="mb-4 flex flex-wrap items-end gap-3">
                    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                        {t('compare.from')}
                        <Select className="!w-[280px] max-w-full" value={effFrom} options={options} onChange={v => setFrom(v)} />
                    </label>
                    <Button icon={<SwapOutlined />} disabled={effTo === 'live'} aria-label={t('compare.swap')} title={t('compare.swap')}
                        onClick={() => { if (effTo !== 'live') { setFrom(effTo); setTo(effFrom); } }} />
                    <label className="flex min-w-0 flex-col gap-1 text-[13px] text-gray-600">
                        {t('compare.to')}
                        <Select className="!w-[280px] max-w-full" value={effTo} options={toOptions} onChange={v => setTo(v)} />
                    </label>
                </div>
                {list.length === 1 && effTo === 'live' && <div className="mb-3 text-[13px] text-gray-500">{t('compare.needMore')}</div>}
                {effFrom === effTo
                    ? <div className="text-gray-500">{t('compare.pickDifferent')}</div>
                    : <VersionCompareTable projectId={projectId} from={effFrom} to={effTo} />}
            </SectionCard>

            <VersionDrawer versionId={viewId} onClose={() => setViewId(undefined)} />
        </div>
    );
}
