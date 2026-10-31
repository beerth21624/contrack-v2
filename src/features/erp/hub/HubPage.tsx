'use client';

// ─── /hub: every project of the workspace — summary on top, filters, project cards; new project from here ───
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { App, Button, Result, Skeleton } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { type HubProjectStatus, type HubSummaryDto, type ProjectType, can } from '@/shared/contract';
import { defaultProjectTypeFor } from '@/domain/erp/profiles';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { CreateProjectModal } from '@/features/cloud/projects/ProjectsPage';
import { useCompanyProfile } from '../company/hooks';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { EMPTY_HUB_FILTER, HubFilters, type HubFilterValue, hubFilterActive } from './HubFilters';
import { HubFieldsDrawer } from './HubFieldsDrawer';
import { ProjectCard, projectHref } from './ProjectCard';
import { hubKeys, useAssignProjectCode, useHubProjects, useHubSummary } from './hooks';

const ACTIVE: readonly HubProjectStatus[] = ['won', 'in_progress', 'handover'];
const PIPELINE: readonly HubProjectStatus[] = ['lead', 'estimating', 'quoted'];

const countOf = (s: HubSummaryDto, statuses: readonly HubProjectStatus[]): number =>
    statuses.reduce((n, st) => n + (s.byStatus[st] ?? 0), 0);

function SummaryTile({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-card border border-gray-200 bg-white px-4 py-3">
            <div className="truncate text-[12px] text-gray-500">{label}</div>
            <div className="truncate text-[20px] font-semibold text-gray-900 tabular-nums">{children}</div>
        </div>
    );
}

function HubSummary({ summary }: { summary: HubSummaryDto }) {
    const t = useTranslations('hub');
    return (
        <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <SummaryTile label={t('summary.total')}>{summary.total}</SummaryTile>
            <SummaryTile label={t('summary.pipeline')}>{countOf(summary, PIPELINE)}</SummaryTile>
            <SummaryTile label={t('summary.active')}>{countOf(summary, ACTIVE)}</SummaryTile>
            {summary.contractValue !== null && <SummaryTile label={t('summary.contractValue')}><MoneyText value={summary.contractValue} /></SummaryTile>}
            {summary.outstandingReceivable !== null && <SummaryTile label={t('summary.outstandingReceivable')}><MoneyText value={summary.outstandingReceivable} /></SummaryTile>}
            {summary.overdueReceivable !== null && <SummaryTile label={t('summary.overdueReceivable')}><MoneyText value={summary.overdueReceivable} /></SummaryTile>}
        </div>
    );
}

export function HubPage() {
    const t = useTranslations('hub');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const ws = useErpWorkspace();
    const wsId = ws.workspaceId;
    const mayCreate = can(ws.role, 'projects.create');
    const [filter, setFilter] = useState<HubFilterValue>(EMPTY_HUB_FILTER);
    const [q, setQ] = useState('');
    const [creating, setCreating] = useState(false);
    const [created, setCreated] = useState<string | undefined>(undefined);
    const assignCode = useAssignProjectCode();
    const qc = useQueryClient();

    useEffect(() => {
        const id = setTimeout(() => setQ(filter.text), 300);
        return () => clearTimeout(id);
    }, [filter.text]);

    const list = useHubProjects(wsId, { q, status: filter.status, customerId: filter.customerId, type: filter.type, archived: filter.archived });
    const summary = useHubSummary(wsId);
    const company = useCompanyProfile(can(ws.role, 'company.read') ? wsId : undefined);
    const defaultType: ProjectType | undefined = company.data === undefined
        ? undefined
        : company.data.defaultProjectType ?? defaultProjectTypeFor(company.data.businessProfiles);

    const filtered = hubFilterActive({ ...filter, text: q });

    const onCreated = async (projectId: string) => {
        setCreating(false);
        void message.success(t('created'));
        // The code comes from document numbering; a failure (e.g. a clash with a hand-typed code) leaves it empty.
        try {
            await assignCode.mutateAsync(projectId);
        } catch (e) {
            void message.warning(t('codeFailed', { error: toText(e) }));
            if (wsId !== undefined) void qc.invalidateQueries({ queryKey: hubKeys.all(wsId) });
        }
        setCreated(projectId);
    };

    const addButton = mayCreate && wsId !== undefined
        ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>{t('add')}</Button>
        : undefined;

    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')} extra={addButton}>
            {summary.data !== undefined && <HubSummary summary={summary.data} />}
            <HubFilters value={filter} onChange={setFilter} workspaceId={wsId} />
            {list.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(list.error)}
                    extra={<Button onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
            ) : list.data === undefined ? (
                <Skeleton active />
            ) : list.data.length === 0 ? (
                <div className="rounded-card border border-gray-200 bg-white">
                    <EmptyState
                        title={filtered ? t('emptySearch') : t('empty')}
                        hint={!filtered && mayCreate ? t('emptyHint') : undefined}
                        action={!filtered ? addButton : undefined}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {list.data.map(row => <ProjectCard key={row.project.id} row={row} defaultType={defaultType} />)}
                </div>
            )}
            {wsId !== undefined && (
                <CreateProjectModal open={creating} workspaceId={wsId} onClose={() => setCreating(false)}
                    onCreated={id => { void onCreated(id); }} />
            )}
            <HubFieldsDrawer
                projectId={created}
                open={created !== undefined}
                isNew
                onClose={() => {
                    const id = created;
                    setCreated(undefined);
                    if (id !== undefined) router.push(projectHref(id));
                }}
            />
        </ErpPage>
    );
}
