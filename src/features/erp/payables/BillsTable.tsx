'use client';

// ─── Supplier bills as a table (list tab, due list); optional row selection for building a payment run ───
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Table } from 'antd';
import type { ColumnsType, TableRowSelection } from 'antd/es/table/interface';
import { useTranslations } from 'next-intl';
import type { SupplierBillSummaryDto } from '@/shared/contract';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';
import { BILL_STATUS_TONES, MATCH_TONES, billHref } from './status';

export function BillsTable({ bills, loading, selection, emptyText, actions }: {
    bills: readonly SupplierBillSummaryDto[];
    loading?: boolean;
    selection?: TableRowSelection<SupplierBillSummaryDto>;
    emptyText?: string;
    /** A last column of row actions. */
    actions?: (bill: SupplierBillSummaryDto) => ReactNode;
}) {
    const t = useTranslations('payables.bills');
    const columns: ColumnsType<SupplierBillSummaryDto> = [
        {
            key: 'number', title: t('columns.number'),
            render: (_, b) => <Link href={billHref(b.id)} className="font-medium">{b.number ?? <DocumentNumberTag number={null} />}</Link>,
        },
        { key: 'supplier', title: t('columns.supplier'), render: (_, b) => <span className="break-words">{b.supplierName !== '' ? b.supplierName : t('labourBill')}</span> },
        { key: 'invoice', title: t('columns.invoiceNo'), render: (_, b) => (b.supplierInvoiceNo !== '' ? b.supplierInvoiceNo : '–') },
        { key: 'kind', title: t('columns.kind'), render: (_, b) => <StatusTag enumName="supplierBillKind" value={b.kind} /> },
        { key: 'status', title: t('columns.status'), render: (_, b) => <StatusTag enumName="supplierBillStatus" value={b.status} tones={BILL_STATUS_TONES} /> },
        { key: 'match', title: t('columns.match'), render: (_, b) => (b.matchStatus === 'not_applicable' ? '–' : <StatusTag enumName="billMatchStatus" value={b.matchStatus} tones={MATCH_TONES} />) },
        { key: 'due', title: t('columns.dueDate'), render: (_, b) => <DateText value={b.dueDate} /> },
        { key: 'total', title: t('columns.total'), align: 'right', render: (_, b) => <MoneyText value={b.total} /> },
        { key: 'payable', title: t('columns.outstanding'), align: 'right', render: (_, b) => <MoneyText value={b.payable - b.paidAmount} className="font-semibold" /> },
        ...(actions !== undefined ? [{ key: 'actions', title: '', align: 'right' as const, render: (_: unknown, b: SupplierBillSummaryDto) => actions(b) }] : []),
    ];
    return (
        <Table<SupplierBillSummaryDto> size="small" rowKey="id" columns={columns} dataSource={[...bills]} loading={loading} rowSelection={selection}
            locale={emptyText !== undefined ? { emptyText } : undefined}
            pagination={bills.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
    );
}
