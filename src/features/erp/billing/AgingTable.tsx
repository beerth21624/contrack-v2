'use client';

// ─── Receivables by age: totals per bucket, per customer, and the open invoices (click through to the project) ───
import { useState } from 'react';
import Link from 'next/link';
import { Button, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { AR_AGING_BUCKETS, type ArAgingDto } from '@/shared/contract';
import { MoneyText } from '../shared/MoneyText';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { ReceiveDialog } from './ReceiveDialog';
import { useInvoice } from './hooks';
import { billingHref } from './status';

type CustomerRow = ArAgingDto['customers'][number];
type InvoiceRow = ArAgingDto['invoices'][number];

function ReceiveLoader({ invoiceId, workspaceId, onClose }: { invoiceId: string; workspaceId: string | undefined; onClose: () => void }) {
    const q = useInvoice(invoiceId);
    if (q.data === undefined) return null;
    return <ReceiveDialog invoice={q.data} workspaceId={workspaceId} onClose={onClose} />;
}

export function AgingTable({ aging, workspaceId, canReceive }: { aging: ArAgingDto; workspaceId: string | undefined; canReceive: boolean }) {
    const t = useTranslations('billing');
    const te = useTranslations('enums');
    const [receiveId, setReceiveId] = useState<string | null>(null);

    const bucketColumns: ColumnsType<CustomerRow> = AR_AGING_BUCKETS.map(b => ({
        key: b, title: te(`agingBucket.${b}`), align: 'right' as const, render: (_: unknown, c: CustomerRow) => <MoneyText value={c.buckets[b]} muted={c.buckets[b] === 0} />,
    }));
    const columns: ColumnsType<CustomerRow> = [
        { key: 'customer', title: t('fields.customer'), render: (_, c) => <Link href={`/customers/${encodeURIComponent(c.customerId)}`}>{c.customerName}</Link> },
        ...bucketColumns,
        { key: 'total', title: t('aging.total'), align: 'right', render: (_, c) => <b><MoneyText value={c.total} /></b> },
    ];

    const invoiceColumns: ColumnsType<InvoiceRow> = [
        {
            key: 'number', title: t('fields.number'),
            render: (_, i) => (i.projectId !== null ? <Link href={billingHref(i.projectId)}><DocumentNumberTag number={i.number} /></Link> : <DocumentNumberTag number={i.number} />),
        },
        { key: 'kind', title: t('fields.kind'), render: (_, i) => te(`invoiceKind.${i.kind}`) },
        { key: 'due', title: t('fields.dueDate'), render: (_, i) => <DateText value={i.dueDate} /> },
        { key: 'days', title: t('aging.daysOverdue'), align: 'right', render: (_, i) => (i.daysOverdue > 0 ? <Tag color="error" className="!m-0">{i.daysOverdue}</Tag> : '–') },
        { key: 'bucket', title: t('aging.bucket'), render: (_, i) => te(`agingBucket.${i.bucket}`) },
        { key: 'outstanding', title: t('aging.outstanding'), align: 'right', render: (_, i) => <MoneyText value={i.outstanding} /> },
        {
            key: 'actions', title: '',
            render: (_, i) => canReceive && <Button size="small" type="primary" onClick={() => setReceiveId(i.invoiceId)}>{t('invoices.receive')}</Button>,
        },
    ];

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                {AR_AGING_BUCKETS.map(b => (
                    <div key={b} className="rounded-card border border-gray-200 bg-white p-3 shadow-card">
                        <div className="text-[12px] text-gray-500">{te(`agingBucket.${b}`)}</div>
                        <div className="text-[16px] font-semibold"><MoneyText value={aging.buckets[b]} /></div>
                    </div>
                ))}
                <div className="rounded-card border border-gray-200 bg-white p-3 shadow-card">
                    <div className="text-[12px] text-gray-500">{t('aging.total')}</div>
                    <div className="text-[16px] font-semibold"><MoneyText value={aging.total} /></div>
                    <div className="text-[12px] text-red-600">{t('aging.overdue')}: <MoneyText value={aging.overdue} /></div>
                </div>
            </div>
            <Table<CustomerRow> size="small" rowKey="customerId" columns={columns} dataSource={aging.customers} pagination={false} scroll={{ x: 'max-content' }}
                locale={{ emptyText: t('aging.empty') }}
                expandable={{
                    expandedRowRender: c => (
                        <Table<InvoiceRow> size="small" rowKey="invoiceId" columns={invoiceColumns} dataSource={aging.invoices.filter(i => i.customerId === c.customerId)}
                            pagination={false} scroll={{ x: 'max-content' }} />
                    ),
                }} />
            {receiveId !== null && <ReceiveLoader invoiceId={receiveId} workspaceId={workspaceId} onClose={() => setReceiveId(null)} />}
        </div>
    );
}
