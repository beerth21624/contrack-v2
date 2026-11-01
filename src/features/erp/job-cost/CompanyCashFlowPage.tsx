'use client';

// ─── /finance/cashflow: cash plan vs actual of the whole company (every live project), week by week ───
import { useState } from 'react';
import { Alert, Button, Segmented, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { can, type CashPlanItemDto, type CashWeekDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { CashFlowChart } from './CashFlowChart';
import { CashSettingsDialog } from './CashSettingsDialog';
import { useCompanyCashFlow } from './hooks';

export function CompanyCashFlowPage() {
    const t = useTranslations('jobCost.cash');
    const te = useTranslations('enums.cashPlanSource');
    const toText = useErrorMessage();
    const fmt = useFormat();
    const ws = useErpWorkspace();
    const allowed = can(ws.role, 'cost.read');
    const [weeks, setWeeks] = useState(13);
    const [past, setPast] = useState(4);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [project, setProject] = useState<string | undefined>(undefined);
    const cash = useCompanyCashFlow(allowed ? ws.workspaceId : undefined, weeks, past);

    if (ws.loading) return <ErpPage><Skeleton active /></ErpPage>;
    if (!allowed) return <ErpPage title={t('title')}><Alert type="warning" showIcon title={t('noAccess')} /></ErpPage>;

    const data = cash.data;
    const canManage = can(ws.role, 'cost.manage');
    const projects = data === undefined ? [] : [...new Map(data.items.map(i => [i.projectId, i.projectName])).entries()];
    const items = (data?.items ?? []).filter(i => project === undefined || i.projectId === project);

    const weekColumns: ColumnsType<CashWeekDto> = [
        { key: 'week', title: t('columns.week'), render: (_, r) => <span><DateText value={r.weekStart} /> – <DateText value={r.weekEnd} /></span> },
        { key: 'pin', title: t('columns.plannedIn'), align: 'right', render: (_, r) => (r.past ? '–' : <MoneyText value={r.plannedIn} />) },
        { key: 'pout', title: t('columns.plannedOut'), align: 'right', render: (_, r) => (r.past ? '–' : <MoneyText value={r.plannedOut} />) },
        { key: 'ain', title: t('columns.actualIn'), align: 'right', render: (_, r) => <MoneyText value={r.actualIn} /> },
        { key: 'aout', title: t('columns.actualOut'), align: 'right', render: (_, r) => <MoneyText value={r.actualOut} /> },
        {
            key: 'balance', title: t('columns.balance'), align: 'right',
            render: (_, r) => <MoneyText value={r.balance} className={`font-semibold ${data !== undefined && r.balance < data.minBalance && !r.past ? 'text-red-600' : ''}`} />,
        },
    ];
    const itemColumns: ColumnsType<CashPlanItemDto> = [
        { key: 'date', title: t('columns.date'), render: (_, r) => <DateText value={r.date} /> },
        { key: 'project', title: t('columns.project'), dataIndex: 'projectName' },
        { key: 'source', title: t('columns.source'), render: (_, r) => te(r.source) },
        { key: 'ref', title: t('columns.ref'), dataIndex: 'ref' },
        { key: 'in', title: t('columns.in'), align: 'right', render: (_, r) => (r.direction === 'in' ? <MoneyText value={r.amount} /> : '') },
        { key: 'out', title: t('columns.out'), align: 'right', render: (_, r) => (r.direction === 'out' ? <MoneyText value={r.amount} /> : '') },
    ];

    return (
        <ErpPage
            title={t('title')}
            subtitle={t('subtitle')}
            extra={canManage ? <Button onClick={() => setSettingsOpen(true)}>{t('settings')}</Button> : undefined}
        >
            {cash.isError ? <Alert type="error" showIcon title={toText(cash.error)} />
                : data === undefined ? <Skeleton active />
                    : (
                        <>
                            {data.settings?.asOf === null && (
                                <Alert type="info" showIcon title={t('noSettings')}
                                    action={canManage ? <Button size="small" onClick={() => setSettingsOpen(true)}>{t('settings')}</Button> : undefined} />
                            )}
                            {data.firstBelowMin !== null && (
                                <Alert type="error" showIcon title={t('belowMin', { date: fmt.date(data.firstBelowMin), min: fmt.money(data.minBalance) })} />
                            )}
                            <SectionCard>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <Stat label={t('stats.opening')} value={data.opening} />
                                    <Stat label={t('stats.min')} value={data.minBalance} />
                                    <Stat label={t('stats.lowest')} value={data.lowestBalance} warn={data.firstBelowMin !== null} />
                                    <div>
                                        <div className="text-[12px] text-gray-500">{t('stats.firstBelow')}</div>
                                        <div className="text-[18px] font-semibold">{data.firstBelowMin === null ? t('stats.none') : <DateText value={data.firstBelowMin} />}</div>
                                    </div>
                                </div>
                            </SectionCard>
                            <SectionCard
                                title={t('chartTitle')}
                                extra={(
                                    <div className="flex flex-wrap gap-2">
                                        <Segmented<number> value={weeks} onChange={setWeeks} options={[13, 26, 52].map(n => ({ value: n, label: t('weeksN', { n }) }))} />
                                        <Select<number> value={past} onChange={setPast} className="min-w-[130px]" aria-label={t('past')}
                                            options={[0, 4, 8, 13, 26].map(n => ({ value: n, label: t('pastN', { n }) }))} />
                                    </div>
                                )}
                            >
                                <CashFlowChart data={data} />
                            </SectionCard>
                            <SectionCard title={t('weeklyTitle')}>
                                <Table<CashWeekDto> rowKey="weekStart" size="small" columns={weekColumns} dataSource={data.weeks} pagination={false} scroll={{ x: 'max-content' }}
                                    rowClassName={r => (r.past ? 'text-gray-500' : '')} />
                            </SectionCard>
                            <SectionCard
                                title={t('itemsTitle')}
                                extra={projects.length > 1 ? (
                                    <Select<string> allowClear className="min-w-[200px]" placeholder={t('allProjects')} value={project} onChange={setProject}
                                        options={projects.map(([id, name]) => ({ value: id, label: name }))} />
                                ) : undefined}
                            >
                                <Table<CashPlanItemDto> rowKey={(r, i) => `${r.projectId}|${r.source}|${r.ref}|${r.date}|${String(i)}`} size="small" columns={itemColumns}
                                    dataSource={items} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 'max-content' }} locale={{ emptyText: t('noItems') }} />
                            </SectionCard>
                        </>
                    )}
            {ws.workspaceId !== undefined && (
                <CashSettingsDialog workspaceId={ws.workspaceId} open={settingsOpen} settings={data?.settings ?? null} onClose={() => setSettingsOpen(false)} />
            )}
        </ErpPage>
    );
}

function Stat({ label, value, warn = false }: { label: string; value: number | null; warn?: boolean }) {
    return (
        <div className="min-w-0">
            <div className="text-[12px] text-gray-500">{label}</div>
            <div className="text-[18px] font-semibold"><MoneyText value={value} className={warn ? 'text-red-600' : ''} /></div>
        </div>
    );
}
