'use client';

// ─── One customer: edit the details, archive / restore, history ───
import { useEffect, useState } from 'react';
import { App, Button, Result, Skeleton, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { AuditTimeline } from '../shared/AuditTimeline';
import { ConfirmAction } from '../shared/ConfirmAction';
import { ErpPage } from '../shared/ErpPage';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { CustomerForm } from './CustomerForm';
import { useCustomer, usePatchCustomer, useSetCustomerArchived } from './hooks';

export function CustomerDetailPage({ customerId }: { customerId: string }) {
    const t = useTranslations('customers');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const q = useCustomer(customerId);
    const ws = useErpWorkspace(q.data?.workspaceId);
    const mayManage = can(ws.role, 'customers.manage');
    const patch = usePatchCustomer(customerId);
    const setArchived = useSetCustomerArchived(customerId);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const crumbs = [{ label: t('title'), href: '/customers' }];
    if (q.isError) {
        return (
            <ErpPage breadcrumb={crumbs}>
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)}
                    extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            </ErpPage>
        );
    }
    const c = q.data;
    if (c === undefined) return <ErpPage breadcrumb={crumbs}><Skeleton active /></ErpPage>;

    const archived = c.archivedAt !== null;
    const name = c.nameTh !== '' ? c.nameTh : c.nameEn;
    return (
        <ErpPage
            title={<span className="flex flex-wrap items-center gap-2">{name}{archived && <Tag className="!m-0">{t('archivedTag')}</Tag>}</span>}
            subtitle={tEnums(`customerKind.${c.kind}`)}
            breadcrumb={[...crumbs, { label: name }]}
            extra={mayManage ? (
                archived ? (
                    <ConfirmAction title={t('actions.restoreConfirm')} onConfirm={async () => { await setArchived.mutateAsync(false); void message.success(t('restoredDone')); }}>
                        {t('actions.restore')}
                    </ConfirmAction>
                ) : (
                    <ConfirmAction danger title={t('actions.archiveConfirm')} content={t('actions.archiveHint')}
                        onConfirm={async () => { await setArchived.mutateAsync(true); void message.success(t('archivedDone')); }}>
                        {t('actions.archive')}
                    </ConfirmAction>
                )
            ) : undefined}
        >
            <CustomerForm
                key={c.updatedAt}
                customer={c}
                readOnly={!mayManage || archived}
                submitting={patch.isPending}
                submitLabel={t('actions.save')}
                onDirtyChange={setDirty}
                onSubmit={async body => {
                    await patch.mutateAsync(body);
                    void message.success(t('saved'));
                }}
            />
            <AuditTimeline workspaceId={c.workspaceId} entityType="customer" entityId={c.id} />
        </ErpPage>
    );
}
