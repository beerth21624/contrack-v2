'use client';

// ─── The frame of every /p/[projectId] page: project header (code, status, status change) + module tabs ───
// Project pages call the API with the id from the URL; only the BOQ tab opens the project in the project store
// (openCloudProject) and goes to /boq (docs/erp/01-architecture.md §3.2).
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { App, Button, Dropdown, Result, Skeleton, Tabs, Tag } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import type { ProjectMeta } from '@/domain/project';
import type { HubProjectStatus } from '@/shared/contract';
import { ApiError } from '@/features/cloud/api/errors';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { openCloudProject } from '@/features/cloud/projects/controller';
import { useProjectStore } from '@/store/project-store';
import { PageHeader } from '../shared/ErpPage';
import { StatusTag } from '../shared/StatusTag';
import { activeProjectTabKey, useProjectTabs } from './nav-registry';
import { useHubProject, usePatchHubProject } from './hooks';
import { PROJECT_STATUS_TONES } from './status';

/**
 * Opens the project as the working copy and goes to /boq. `meta`: header fields written through the store after
 * opening (synced like any edit; a viewer gets the read-only notice instead).
 */
export function useOpenProjectBoq(projectId: string): { open: (meta?: Partial<ProjectMeta>) => Promise<boolean>; opening: boolean } {
    const qc = useQueryClient();
    const router = useRouter();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const t = useTranslations('hub');
    const [opening, setOpening] = useState(false);
    const open = async (meta?: Partial<ProjectMeta>): Promise<boolean> => {
        setOpening(true);
        try {
            const binding = useProjectStore.getState().binding;
            if (binding.kind !== 'cloud' || binding.projectId !== projectId) await openCloudProject(qc, projectId);
            if (meta !== undefined && Object.keys(meta).length > 0) useProjectStore.getState().setMeta(meta);
            router.push('/boq');
            return true;
        } catch (e) {
            void message.error(`${t('shell.openFailed')}: ${toText(e)}`);
            return false;
        } finally {
            setOpening(false);
        }
    };
    return { open, opening };
}

function StatusMenu({ projectId, current, next }: { projectId: string; current: HubProjectStatus; next: readonly HubProjectStatus[] }) {
    const t = useTranslations('hub');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchHubProject(projectId);
    if (next.length === 0) return <StatusTag enumName="projectStatus" value={current} tones={PROJECT_STATUS_TONES} />;
    return (
        <Dropdown
            trigger={['click']}
            disabled={patch.isPending}
            menu={{
                items: next.map(s => ({ key: s, label: tEnums(`projectStatus.${s}`) })),
                onClick: ({ key }) => {
                    const status = key as HubProjectStatus;
                    patch.mutateAsync({ status })
                        .then(() => { void message.success(t('shell.statusChanged', { status: tEnums(`projectStatus.${status}`) })); })
                        .catch((e: unknown) => { void message.error(toText(e)); });
                },
            }}
        >
            <Button size="small" loading={patch.isPending} aria-label={t('shell.changeStatus')} title={t('shell.changeStatus')}
                className="!inline-flex !items-center !gap-1">
                <StatusTag enumName="projectStatus" value={current} tones={PROJECT_STATUS_TONES} />
                <DownOutlined className="text-[10px]" />
            </Button>
        </Dropdown>
    );
}

export function ProjectShell({ projectId, children }: { projectId: string; children: React.ReactNode }) {
    const t = useTranslations('hub');
    const toText = useErrorMessage();
    const pathname = usePathname();
    const router = useRouter();
    const detail = useHubProject(projectId);
    const d = detail.data;
    const tabs = useProjectTabs(projectId, d?.project.workspaceId);
    const boq = useOpenProjectBoq(projectId);

    if (detail.isError) {
        const missing = detail.error instanceof ApiError && (detail.error.status === 404 || detail.error.status === 403);
        return (
            <Result status={missing ? '404' : 'warning'} title={missing ? t('shell.notFound') : toText(detail.error)}
                extra={<Link href="/hub"><Button>{t('shell.back')}</Button></Link>} />
        );
    }
    if (d === undefined) return <Skeleton active />;

    const activeKey = activeProjectTabKey(pathname) ?? 'overview';

    return (
        <div className="flex w-full min-w-0 flex-col gap-4">
            <PageHeader
                breadcrumb={[{ label: t('shell.back'), href: '/hub' }, { label: d.project.name }]}
                title={
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words">{d.project.name}</span>
                        {d.hub.code !== null && <Tag className="!m-0 tabular-nums">{d.hub.code}</Tag>}
                    </span>
                }
                extra={d.canEdit
                    ? <StatusMenu projectId={projectId} current={d.hub.status} next={d.nextStatuses} />
                    : <StatusTag enumName="projectStatus" value={d.hub.status} tones={PROJECT_STATUS_TONES} />}
            />
            <Tabs
                className="min-w-0"
                tabBarStyle={{ marginBottom: 0 }}
                activeKey={activeKey}
                items={tabs.map(tab => ({ key: tab.key, label: tab.key === 'boq' && boq.opening ? t('shell.openingBoq') : tab.label, icon: tab.icon }))}
                onChange={key => {
                    const tab = tabs.find(x => x.key === key);
                    if (tab === undefined) return;
                    if (tab.key === 'boq') { void boq.open(); return; }
                    router.push(tab.href);
                }}
            />
            {children}
        </div>
    );
}
