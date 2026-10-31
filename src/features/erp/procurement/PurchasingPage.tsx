'use client';

// ─── /purchasing: purchase orders of every project of the workspace (what is waiting for goods, for approval, …) ───
import { useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { PURCHASE_ORDER_STATUSES, type PurchaseOrderStatus, type PurchaseOrderSummaryDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProjects } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useWorkspacePurchaseOrders } from './hooks';
import { ORDER_STATUS_TONES, orderHref } from './status';

type Preset = 'open' | 'pending' | 'draft' | 'closed' | 'all';
const PRESETS: Record<Preset, readonly PurchaseOrderStatus[]> = {
    open: ['issued', 'partially_received'],
    pending: ['pending_approval'],
    draft: ['draft'],
    closed: ['received', 'closed', 'cancelled'],
    all: [],
};

export function PurchasingPage() {
    const t = useTranslations('procurement.purchasing');
    const toText = useErrorMessage();
    const ws = useErpWorkspace();
    const [preset, setPreset] = useState<Preset>('open');
    const list = useWorkspacePurchaseOrders(ws.workspaceId, PRESETS[preset]);
    const projects = useHubProjects(ws.workspaceId);
    const names = new Map((projects.data ?? []).map(p => [p.project.id, p.project.name]));
    const rows = (list.data ?? []).filter(o => PURCHASE_ORDER_STATUSES.includes(o.status));

    const columns: ColumnsType<PurchaseOrderSummaryDto> = [
        {
            key: 'number', title: t('columns.number'),
            render: (_, o) => <Link href={orderHref(o.projectId, o.id)} className="font-medium">{o.number ?? <DocumentNumberTag number={null} />}</Link>,
        },
        { key: 'project', title: t('columns.project'), render: (_, o) => <span className="break-words">{names.get(o.projectId) ?? '–'}</span> },
        { key: 'supplier', title: t('columns.supplier'), render: (_, o) => <span className="break-words">{o.supplierName}</span> },
        { key: 'status', title: t('columns.status'), render: (_, o) => <StatusTag enumName="purchaseOrderStatus" value={o.status} tones={ORDER_STATUS_TONES} /> },
        { key: 'date', title: t('columns.orderDate'), render: (_, o) => <DateText value={o.orderDate} /> },
        { key: 'delivery', title: t('columns.deliveryDate'), render: (_, o) => <DateText value={o.deliveryDate} /> },
        { key: 'total', title: t('columns.total'), align: 'right', render: (_, o) => <MoneyText value={o.total} className="font-semibold" /> },
    ];

    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')}>
            <SectionCard
                extra={(
                    <Select<Preset> value={preset} onChange={setPreset} className="min-w-[200px]"
                        options={(Object.keys(PRESETS) as Preset[]).map(k => ({ value: k, label: t(`filters.${k}`) }))} />
                )}
            >
                {list.isError ? (
                    <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`}
                        action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
                ) : list.isLoading || ws.workspaceId === undefined ? <Skeleton active /> : rows.length === 0 ? (
                    <EmptyState title={t('empty.title')} hint={t('empty.hint')} />
                ) : (
                    <Table<PurchaseOrderSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
                )}
            </SectionCard>
        </ErpPage>
    );
}
