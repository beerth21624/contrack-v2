'use client';

// ─── One supplier: edit the details, archive / restore, ratings, history ───
import { useEffect, useState } from 'react';
import { Alert, App, Button, Input, Rate, Result, Skeleton, Tag } from 'antd';
import { useTranslations } from 'next-intl';
import { can } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { AuditTimeline } from '../shared/AuditTimeline';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { SectionCard } from '../shared/SectionCard';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { SupplierPriceHistory } from '../procurement/SupplierPriceHistory';
import { SupplierForm } from './SupplierForm';
import { usePatchSupplier, useRateSupplier, useSetSupplierArchived, useSupplier, useSupplierRatings } from './hooks';

function SupplierRatings({ supplierId, mayRate }: { supplierId: string; mayRate: boolean }) {
    const t = useTranslations('suppliers');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const ratings = useSupplierRatings(supplierId);
    const rate = useRateSupplier(supplierId);
    const [score, setScore] = useState(0);
    const [note, setNote] = useState('');

    const submit = async () => {
        try {
            await rate.mutateAsync({ score, note: note.trim() });
            setScore(0);
            setNote('');
            void message.success(t('rating.saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <SectionCard title={t('rating.title')}>
            {mayRate && (
                <div className="mb-4 flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
                    <span className="font-medium">{t('rating.add')}</span>
                    <Rate value={score} onChange={setScore} />
                    <Input.TextArea rows={2} maxLength={1000} value={note} placeholder={t('rating.notePlaceholder')} onChange={e => setNote(e.target.value)} />
                    <Button className="self-end" type="primary" disabled={score < 1} loading={rate.isPending} onClick={() => { void submit(); }}>
                        {t('rating.submit')}
                    </Button>
                </div>
            )}
            {ratings.isError ? (
                <Alert type="warning" showIcon title={t('loadFailed')} description={toText(ratings.error)}
                    action={<Button size="small" onClick={() => { void ratings.refetch(); }}>{t('retry')}</Button>} />
            ) : ratings.data === undefined ? <Skeleton active /> : ratings.data.length === 0 ? <EmptyState title={t('rating.empty')} /> : (
                <ul className="flex flex-col divide-y divide-gray-100">
                    {ratings.data.map(r => (
                        <li key={r.id} className="flex flex-col gap-1 py-2">
                            <span className="flex flex-wrap items-center gap-2">
                                <Rate disabled value={r.score} className="!text-sm" />
                                <span className="text-gray-500">
                                    {r.createdByName ?? t('rating.unknownUser')} · <DateText value={r.createdAt} style="dateTime" />
                                </span>
                            </span>
                            {r.note !== '' && <span className="whitespace-pre-wrap">{r.note}</span>}
                        </li>
                    ))}
                </ul>
            )}
        </SectionCard>
    );
}

export function SupplierDetailPage({ supplierId }: { supplierId: string }) {
    const t = useTranslations('suppliers');
    const tEnums = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const q = useSupplier(supplierId);
    const ws = useErpWorkspace(q.data?.workspaceId);
    const mayManage = can(ws.role, 'suppliers.manage');
    const patch = usePatchSupplier(supplierId);
    const setArchived = useSetSupplierArchived(supplierId);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);

    const crumbs = [{ label: t('title'), href: '/suppliers' }];
    if (q.isError) {
        return (
            <ErpPage breadcrumb={crumbs}>
                <Result status="warning" title={t('loadFailed')} subTitle={toText(q.error)}
                    extra={<Button onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
            </ErpPage>
        );
    }
    const s = q.data;
    if (s === undefined) return <ErpPage breadcrumb={crumbs}><Skeleton active /></ErpPage>;

    const archived = s.archivedAt !== null;
    const name = s.nameTh !== '' ? s.nameTh : s.nameEn;
    return (
        <ErpPage
            title={(
                <span className="flex flex-wrap items-center gap-2">
                    {name}
                    {s.scVendorListEntryId !== null && <Tag className="!m-0" color="orange">{t('fromScTag')}</Tag>}
                    {archived && <Tag className="!m-0">{t('archivedTag')}</Tag>}
                </span>
            )}
            subtitle={(
                <span className="flex flex-wrap items-center gap-2">
                    {tEnums(`supplierKind.${s.kind}`)}
                    {s.rating !== null && (
                        <span className="flex items-center gap-1">
                            <Rate disabled allowHalf value={Math.round(s.rating * 2) / 2} className="!text-sm" />
                            <span className="tabular-nums">{s.rating.toFixed(2)} ({s.ratingCount})</span>
                        </span>
                    )}
                </span>
            )}
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
            <SupplierForm
                key={s.updatedAt}
                supplier={s}
                readOnly={!mayManage || archived}
                submitting={patch.isPending}
                submitLabel={t('actions.save')}
                onDirtyChange={setDirty}
                onSubmit={async body => {
                    await patch.mutateAsync(body);
                    void message.success(t('saved'));
                }}
            />
            <SupplierPriceHistory supplierId={s.id} />
            <SupplierRatings supplierId={s.id} mayRate={mayManage && !archived} />
            <AuditTimeline workspaceId={s.workspaceId} entityType="supplier" entityId={s.id} />
        </ErpPage>
    );
}
