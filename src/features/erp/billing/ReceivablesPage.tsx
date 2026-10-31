'use client';

// ─── /receivables: what customers owe across all projects, by age ───
import { Button, Result, Skeleton } from 'antd';
import { useTranslations } from 'next-intl';
import { can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { AgingTable } from './AgingTable';
import { useAging } from './hooks';

export function ReceivablesPage() {
    const t = useTranslations('billing');
    const toText = useErrorMessage();
    const ws = useErpWorkspace();
    const q = useAging(ws.workspaceId);

    return (
        <ErpPage title={t('receivables.title')} subtitle={q.data !== undefined ? <span>{t('receivables.asOf')} <DateText value={q.data.asOf} /></span> : undefined}>
            {q.isError ? (
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)} extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            ) : q.data === undefined ? <Skeleton active /> : (
                <AgingTable aging={q.data} workspaceId={ws.workspaceId} canReceive={can(ws.role, 'billing.receive')} />
            )}
        </ErpPage>
    );
}
