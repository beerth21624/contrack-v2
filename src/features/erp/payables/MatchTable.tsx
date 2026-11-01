'use client';

// ─── The lines of a supplier bill with the 3-way match (bill ↔ PO price ↔ goods received) per line ───
import { Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { SupplierBillLineDto } from '@/shared/contract';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';
import { StatusTag } from '../shared/StatusTag';
import { LINE_MATCH_TONES } from './status';

export function MatchTable({ lines, showMatch }: {
    lines: readonly SupplierBillLineDto[];
    /** false for bills without a purchase order (service / expense / subcontract / labour): the match columns are hidden. */
    showMatch: boolean;
}) {
    const t = useTranslations('payables.match');
    const columns: ColumnsType<SupplierBillLineDto> = [
        { key: 'desc', title: t('desc'), render: (_, l) => <span className="break-words">{l.desc}</span> },
        { key: 'category', title: t('category'), render: (_, l) => <StatusTag enumName="costCategory" value={l.category} /> },
        { key: 'qty', title: t('qty'), align: 'right', render: (_, l) => <QtyText value={l.qty} unit={l.unit} /> },
        { key: 'unitPrice', title: t('unitPrice'), align: 'right', render: (_, l) => <MoneyText value={l.unitPrice} /> },
        ...(showMatch ? [
            { key: 'poPrice', title: t('poPrice'), align: 'right' as const, render: (_: unknown, l: SupplierBillLineDto) => <MoneyText value={l.orderUnitPrice} /> },
            { key: 'billable', title: t('billable'), align: 'right' as const, render: (_: unknown, l: SupplierBillLineDto) => <QtyText value={l.billableQty} unit={l.unit} /> },
        ] : []),
        { key: 'amount', title: t('amount'), align: 'right', render: (_, l) => <MoneyText value={l.amount} className="font-semibold" /> },
        ...(showMatch ? [
            { key: 'match', title: t('match'), render: (_: unknown, l: SupplierBillLineDto) => <StatusTag enumName="billLineMatch" value={l.match} tones={LINE_MATCH_TONES} /> },
        ] : []),
    ];
    return <Table<SupplierBillLineDto> size="small" rowKey="id" columns={columns} dataSource={[...lines]} pagination={false} scroll={{ x: 'max-content' }} locale={{ emptyText: t('empty') }} />;
}
