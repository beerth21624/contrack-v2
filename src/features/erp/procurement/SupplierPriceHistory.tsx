'use client';

// ─── Price history of a supplier: the lines of its issued POs (newest first), searchable by item ───
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Input, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import type { SupplierPriceHistoryItem } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DateText } from '../shared/DateText';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';
import { SectionCard } from '../shared/SectionCard';
import { useSupplierPriceHistory } from './hooks';
import { orderHref } from './status';

export function SupplierPriceHistory({ supplierId }: { supplierId: string }) {
    const t = useTranslations('procurement.priceHistory');
    const toText = useErrorMessage();
    const [text, setText] = useState('');
    const [q, setQ] = useState('');
    const list = useSupplierPriceHistory(supplierId, q);

    useEffect(() => {
        const id = setTimeout(() => setQ(text), 300);
        return () => clearTimeout(id);
    }, [text]);

    const columns: ColumnsType<SupplierPriceHistoryItem> = [
        { key: 'item', title: t('columns.item'), render: (_, r) => <span className="break-words">{r.descTh !== '' ? r.descTh : r.descEn}</span> },
        { key: 'unitPrice', title: t('columns.unitPrice'), align: 'right', render: (_, r) => <MoneyText value={r.unitPrice} className="font-semibold" /> },
        { key: 'qty', title: t('columns.qty'), align: 'right', render: (_, r) => <QtyText value={r.qty} unit={r.unit} /> },
        { key: 'date', title: t('columns.date'), render: (_, r) => <DateText value={r.orderDate ?? r.issuedAt} /> },
        {
            key: 'po', title: t('columns.order'),
            render: (_, r) => <Link href={orderHref(r.projectId, r.orderId)}>{r.orderNumber ?? '–'}</Link>,
        },
    ];

    return (
        <SectionCard title={t('title')} extra={<Input.Search allowClear className="!w-[220px] max-sm:!w-full" placeholder={t('search')} value={text} onChange={e => setText(e.target.value)} />}>
            {list.isError ? (
                <Alert type="warning" showIcon title={t('loadFailed')} description={toText(list.error)}
                    action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
            ) : (
                <Table<SupplierPriceHistoryItem> size="small" rowKey={(r, i) => `${r.orderId}:${String(i)}`}
                    columns={columns} dataSource={list.data ?? []} loading={list.isLoading} locale={{ emptyText: t('empty') }}
                    pagination={(list.data?.length ?? 0) > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
            )}
        </SectionCard>
    );
}
