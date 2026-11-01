'use client';

// ─── What is waiting on the payables desk: bills due, and the documents that can become a bill (PO, subcontract claim, labour period) ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Modal, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { BillableScClaimDto, BillablePayPeriodDto, PurchaseOrderSummaryDto, SupplierBillDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useModuleEnabled } from '@/features/modules/modules';
import { useHubProjects } from '../hub/hooks';
import { useWorkspacePurchaseOrders } from '../procurement/hooks';
import { orderHref } from '../procurement/status';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { SupplierPicker } from '../shared/SupplierPicker';
import { useBillFromOrder, useBillFromPayPeriod, useBillFromScClaim, usePayablesDue } from './hooks';
import { BillsTable } from './BillsTable';
import { billHref } from './status';

const BILLABLE_ORDER_STATUSES = ['issued', 'partially_received', 'received'] as const;

export function DueList({ workspaceId, canManage }: { workspaceId: string | undefined; canManage: boolean }) {
    const t = useTranslations('payables.due');
    const toText = useErrorMessage();
    const router = useRouter();
    const { message } = App.useApp();
    const due = usePayablesDue(workspaceId);
    const procurement = useModuleEnabled('procurement', workspaceId);
    const orders = useWorkspacePurchaseOrders(procurement.enabled ? workspaceId : undefined, BILLABLE_ORDER_STATUSES);
    const projects = useHubProjects(workspaceId);
    const names = new Map((projects.data ?? []).map(p => [p.project.id, p.project.name]));
    const fromOrder = useBillFromOrder();
    const fromClaim = useBillFromScClaim(workspaceId ?? '');
    const fromPeriod = useBillFromPayPeriod(workspaceId ?? '');
    const [pickFor, setPickFor] = useState<BillableScClaimDto | null>(null);
    const [supplierId, setSupplierId] = useState<string | null>(null);

    const go = (bill: SupplierBillDto) => {
        void message.success(t('billCreated'));
        router.push(billHref(bill.id));
    };
    const fail = (e: unknown) => { void message.error(toText(e)); };

    const claimColumns: ColumnsType<BillableScClaimDto> = [
        { key: 'contract', title: t('claims.contract'), render: (_, c) => <span className="break-words">{c.contractNo !== '' ? `${c.contractNo} · ` : ''}{c.title}</span> },
        { key: 'project', title: t('claims.project'), render: (_, c) => names.get(c.projectId) ?? '–' },
        { key: 'vendor', title: t('claims.vendor'), render: (_, c) => c.vendorName },
        { key: 'no', title: t('claims.installment'), align: 'right', render: (_, c) => c.installmentNo },
        { key: 'approved', title: t('claims.approvedOn'), render: (_, c) => <DateText value={c.approvedOn} /> },
        { key: 'net', title: t('claims.net'), align: 'right', render: (_, c) => <MoneyText value={c.net} className="font-semibold" /> },
        {
            key: 'act', title: '', align: 'right',
            render: (_, c) => canManage && (
                <Button size="small" type="primary" loading={fromClaim.isPending && pickFor === null}
                    onClick={() => {
                        if (c.supplierId === null) { setSupplierId(null); setPickFor(c); return; }
                        fromClaim.mutateAsync({ claimId: c.claimId }).then(go).catch(fail);
                    }}>{t('createBill')}</Button>
            ),
        },
    ];

    const periodColumns: ColumnsType<BillablePayPeriodDto> = [
        { key: 'period', title: t('periods.period'), render: (_, p) => p.periodKey },
        { key: 'dates', title: t('periods.dates'), render: (_, p) => <span><DateText value={p.startDate} /> – <DateText value={p.endDate} /></span> },
        { key: 'net', title: t('periods.net'), align: 'right', render: (_, p) => <MoneyText value={p.net} className="font-semibold" /> },
        {
            key: 'act', title: '', align: 'right',
            render: (_, p) => canManage && (
                <Button size="small" type="primary" loading={fromPeriod.isPending}
                    onClick={() => { fromPeriod.mutateAsync({ periodId: p.periodId }).then(go).catch(fail); }}>{t('createBill')}</Button>
            ),
        },
    ];

    const orderColumns: ColumnsType<PurchaseOrderSummaryDto> = [
        { key: 'number', title: t('orders.number'), render: (_, o) => <Link href={orderHref(o.projectId, o.id)} className="font-medium">{o.number ?? '–'}</Link> },
        { key: 'project', title: t('orders.project'), render: (_, o) => names.get(o.projectId) ?? '–' },
        { key: 'supplier', title: t('orders.supplier'), render: (_, o) => <span className="break-words">{o.supplierName}</span> },
        { key: 'total', title: t('orders.total'), align: 'right', render: (_, o) => <MoneyText value={o.total} /> },
        {
            key: 'act', title: '', align: 'right',
            render: (_, o) => canManage && (
                <Button size="small" type="primary" loading={fromOrder.isPending}
                    onClick={() => { fromOrder.mutateAsync({ orderId: o.id, body: {} }).then(go).catch(fail); }}>{t('createBill')}</Button>
            ),
        },
    ];

    if (due.isError) {
        return <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(due.error)}`} action={<Button size="small" onClick={() => { void due.refetch(); }}>{t('retry')}</Button>} />;
    }
    if (due.data === undefined || workspaceId === undefined) return <Skeleton active />;
    const d = due.data;
    const orderRows = orders.data ?? [];

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard title={t('bills.title')}>
                <div className="flex min-w-0 flex-col gap-4">
                    <div className="flex flex-wrap gap-8">
                        <div className="flex flex-col"><span className="text-[12px] text-gray-500">{t('bills.totalDue')}</span><MoneyText value={d.totalDue} className="text-[20px] font-semibold" /></div>
                        <div className="flex flex-col">
                            <span className="text-[12px] text-gray-500">{t('bills.totalOverdue')}</span>
                            <MoneyText value={d.totalOverdue} className={`text-[20px] font-semibold ${d.totalOverdue > 0 ? 'text-red-600' : ''}`} />
                        </div>
                    </div>
                    <BillsTable bills={d.bills} emptyText={t('bills.empty')} />
                </div>
            </SectionCard>
            {d.scClaims.length > 0 && (
                <SectionCard title={t('claims.title')}>
                    <Table<BillableScClaimDto> size="small" rowKey="claimId" columns={claimColumns} dataSource={d.scClaims} pagination={false} scroll={{ x: 'max-content' }} />
                </SectionCard>
            )}
            {d.payPeriods.length > 0 && (
                <SectionCard title={t('periods.title')}>
                    <Table<BillablePayPeriodDto> size="small" rowKey="periodId" columns={periodColumns} dataSource={d.payPeriods} pagination={false} scroll={{ x: 'max-content' }} />
                </SectionCard>
            )}
            {procurement.enabled && (
                <SectionCard title={t('orders.title')}>
                    {orders.isLoading ? <Skeleton active /> : orderRows.length === 0 ? <EmptyState title={t('orders.empty')} /> : (
                        <Table<PurchaseOrderSummaryDto> size="small" rowKey="id" columns={orderColumns} dataSource={orderRows}
                            pagination={orderRows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
                    )}
                </SectionCard>
            )}
            {pickFor !== null && (
                <Modal open title={t('pickSupplier.title')} okText={t('createBill')} okButtonProps={{ disabled: supplierId === null }} confirmLoading={fromClaim.isPending}
                    onCancel={() => setPickFor(null)} destroyOnHidden
                    onOk={() => {
                        if (supplierId === null) return;
                        fromClaim.mutateAsync({ claimId: pickFor.claimId, supplierId }).then(b => { setPickFor(null); go(b); }).catch(fail);
                    }}>
                    <div className="mb-2 text-[13px] text-gray-500">{t('pickSupplier.hint', { vendor: pickFor.vendorName })}</div>
                    <SupplierPicker value={supplierId} workspaceId={workspaceId} allowClear={false} onChange={id => setSupplierId(id)} />
                </Modal>
            )}
        </div>
    );
}
