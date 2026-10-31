'use client';

// ─── /home: the role-based start page — quick actions, tasks, risky projects, cash outlook, module tiles ───
import { Button, Result, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { ErpPage } from '../shared/ErpPage';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { CashOutlookChart } from './CashOutlookChart';
import { ModuleTiles } from './ModuleTiles';
import { QuickActions } from './QuickActions';
import { RiskyProjects } from './RiskyProjects';
import { TasksList } from './TasksList';
import { usePortal } from './hooks';

export function PortalPage() {
    const t = useTranslations('portal');
    const toText = useErrorMessage();
    const ws = useErpWorkspace();
    const portal = usePortal(ws.workspaceId);
    const data = portal.data;

    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')}>
            {portal.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(portal.error)}
                    extra={<Button onClick={() => { void portal.refetch(); }}>{t('retry')}</Button>} />
            ) : data === undefined ? (
                <Skeleton active />
            ) : (
                <>
                    <QuickActions actions={data.quickActions} />
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                        <div className="min-w-0 lg:col-span-2"><TasksList tasks={data.tasks} /></div>
                        <div className="min-w-0"><RiskyProjects projects={data.riskyProjects} /></div>
                    </div>
                    {data.cashOutlook !== null && data.cashOutlook.length > 0 && <CashOutlookChart weeks={data.cashOutlook} />}
                    <ModuleTiles tiles={data.tiles} generatedAt={data.generatedAt} />
                </>
            )}
        </ErpPage>
    );
}
