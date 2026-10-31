'use client';

// ─── /p/[projectId]/procurement: purchase requests, RFQs and purchase orders of a project (PO screens: WP-41) ───
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, App, Button, Input, Modal, Skeleton, Table, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import {
    PURCHASE_REQUEST_ORDERABLE_STATUSES, can, type PurchaseOrderSummaryDto, type PurchaseRequestDto, type PurchaseRequestLineDto,
    type PurchaseRequestSummaryDto, type RfqSummaryDto,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProject } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { EmptyState } from '../shared/EmptyState';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { FromBoqPicker } from './FromBoqPicker';
import {
    useCreatePurchaseRequest, useCreateRfq, usePurchaseOrders, usePurchaseRequestDetails, usePurchaseRequests, useRfqs,
} from './hooks';
import { PurchaseRequestEditor } from './PurchaseRequestEditor';
import { ORDER_STATUS_TONES, REQUEST_STATUS_TONES, RFQ_STATUS_TONES, orderHref, rfqHref } from './status';

type TabKey = 'requests' | 'rfqs' | 'orders';
const TAB_KEYS: readonly TabKey[] = ['requests', 'rfqs', 'orders'];

interface RfqLineChoice {
    line: PurchaseRequestLineDto;
    requestNumber: string | null;
}

function NewRfqDialog({ projectId, requests, onClose }: { projectId: string; requests: readonly PurchaseRequestSummaryDto[]; onClose: () => void }) {
    const t = useTranslations('procurement.newRfq');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const create = useCreateRfq(projectId);
    const orderable = requests.filter(r => PURCHASE_REQUEST_ORDERABLE_STATUSES.includes(r.status));
    const details = usePurchaseRequestDetails(orderable.map(r => r.id));
    const [title, setTitle] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [selected, setSelected] = useState<string[]>([]);

    const loaded = details.map(d => d.data).filter((d): d is PurchaseRequestDto => d !== undefined);
    const choices: RfqLineChoice[] = loaded.flatMap(r => r.lines.filter(l => l.qty - l.orderedQty > 0).map(l => ({ line: l, requestNumber: r.number })));
    const loading = details.some(d => d.isLoading);

    const submit = async () => {
        try {
            const rfq = await create.mutateAsync({
                requestLineIds: selected,
                ...(title.trim() !== '' ? { title: title.trim() } : {}),
                ...(dueDate !== '' ? { dueDate } : {}),
            });
            void message.success(t('done'));
            onClose();
            router.push(rfqHref(projectId, rfq.id));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const columns: ColumnsType<RfqLineChoice> = [
        { key: 'pr', title: t('columns.request'), render: (_, c) => <DocumentNumberTag number={c.requestNumber} /> },
        { key: 'desc', title: t('columns.desc'), render: (_, c) => <span className="break-words">{c.line.descTh !== '' ? c.line.descTh : c.line.descEn}</span> },
        { key: 'qty', title: t('columns.remaining'), align: 'right', render: (_, c) => <QtyText value={c.line.qty - c.line.orderedQty} unit={c.line.unit} /> },
    ];

    return (
        <Modal open title={t('title')} width={760} okText={t('submit', { count: selected.length })} confirmLoading={create.isPending}
            okButtonProps={{ disabled: selected.length === 0 }} onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex min-w-0 flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.title')}
                        <Input value={title} maxLength={200} placeholder={t('fields.titlePlaceholder')} onChange={e => setTitle(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.dueDate')}
                        <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                    </label>
                </div>
                <div className="text-[13px] text-gray-500">{t('hint')}</div>
                <Table<RfqLineChoice> size="small" rowKey={c => c.line.id} columns={columns} dataSource={choices} loading={loading}
                    locale={{ emptyText: t('empty') }}
                    rowSelection={{ selectedRowKeys: selected, onChange: keys => setSelected(keys.map(String)) }}
                    pagination={choices.length > 50 ? { pageSize: 50, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
            </div>
        </Modal>
    );
}

function RequestsTab({ projectId, canRequest }: { projectId: string; canRequest: boolean }) {
    const t = useTranslations('procurement');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const list = usePurchaseRequests(projectId);
    const createFromBoq = useCreatePurchaseRequest(projectId);
    // `null` = closed; `{}` = a new site request; `{ id }` = an existing one
    const [editor, setEditor] = useState<{ id?: string } | null>(null);
    const [picker, setPicker] = useState(false);

    const pickBoq = async (costCodeIds: string[]) => {
        try {
            const r = await createFromBoq.mutateAsync({ source: 'boq', costCodeIds });
            setPicker(false);
            setEditor({ id: r.id });
        } catch (e) {
            void message.error(toText(e));
        }
    };

    if (list.isLoading) return <Skeleton active />;
    if (list.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`}
                action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const rows = list.data ?? [];
    const actions = canRequest ? (
        <div className="flex flex-wrap gap-2">
            <Button onClick={() => setPicker(true)}>{t('requests.fromBoq')}</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditor({})}>{t('requests.create')}</Button>
        </div>
    ) : undefined;

    const columns: ColumnsType<PurchaseRequestSummaryDto> = [
        {
            key: 'number', title: t('requests.columns.number'),
            render: (_, r) => <Button type="link" className="!p-0" onClick={() => setEditor({ id: r.id })}>{r.number ?? t('requests.draft')}</Button>,
        },
        { key: 'status', title: t('requests.columns.status'), render: (_, r) => <StatusTag enumName="purchaseRequestStatus" value={r.status} tones={REQUEST_STATUS_TONES} /> },
        { key: 'required', title: t('requests.columns.requiredDate'), render: (_, r) => <DateText value={r.requiredDate} /> },
        { key: 'lines', title: t('requests.columns.lines'), align: 'right', render: (_, r) => <span className="tabular-nums">{r.lineCount}</span> },
        { key: 'total', title: t('requests.columns.estTotal'), align: 'right', render: (_, r) => <MoneyText value={r.estTotal} className="font-semibold" /> },
        {
            key: 'warnings', title: t('requests.columns.warnings'),
            render: (_, r) => (r.budgetWarnings.length > 0 ? <span className="text-orange-600">{t('requests.warningCount', { count: r.budgetWarnings.length })}</span> : null),
        },
        { key: 'updatedAt', title: t('requests.columns.updatedAt'), render: (_, r) => <DateText value={r.updatedAt} style="dateTime" /> },
    ];

    return (
        <>
            <SectionCard title={t('requests.title')} extra={actions}>
                {rows.length === 0 ? (
                    <EmptyState title={t('requests.empty.title')} hint={t('requests.empty.hint')} action={actions} />
                ) : (
                    <Table<PurchaseRequestSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
                )}
            </SectionCard>
            {editor !== null && (
                <PurchaseRequestEditor projectId={projectId} requestId={editor.id} onCreated={id => setEditor({ id })} onClose={() => setEditor(null)} />
            )}
            {picker && <FromBoqPicker projectId={projectId} busy={createFromBoq.isPending} onPick={ids => { void pickBoq(ids); }} onClose={() => setPicker(false)} />}
        </>
    );
}

function RfqsTab({ projectId, canManage }: { projectId: string; canManage: boolean }) {
    const t = useTranslations('procurement');
    const toText = useErrorMessage();
    const list = useRfqs(projectId);
    const requests = usePurchaseRequests(projectId);
    const [dialog, setDialog] = useState(false);

    if (list.isLoading) return <Skeleton active />;
    if (list.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`}
                action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const rows = list.data ?? [];
    const create = canManage
        ? <Button type="primary" icon={<PlusOutlined />} onClick={() => setDialog(true)}>{t('rfqs.create')}</Button>
        : undefined;

    const columns: ColumnsType<RfqSummaryDto> = [
        {
            key: 'title', title: t('rfqs.columns.title'),
            render: (_, r) => <Link href={rfqHref(projectId, r.id)} className="font-medium break-words">{r.title !== '' ? r.title : (r.number ?? t('rfqs.draft'))}</Link>,
        },
        { key: 'number', title: t('rfqs.columns.number'), render: (_, r) => <DocumentNumberTag number={r.number} /> },
        { key: 'status', title: t('rfqs.columns.status'), render: (_, r) => <StatusTag enumName="rfqStatus" value={r.status} tones={RFQ_STATUS_TONES} /> },
        { key: 'due', title: t('rfqs.columns.dueDate'), render: (_, r) => <DateText value={r.dueDate} /> },
        { key: 'lines', title: t('rfqs.columns.lines'), align: 'right', render: (_, r) => <span className="tabular-nums">{r.lineCount}</span> },
        { key: 'quotes', title: t('rfqs.columns.quotes'), align: 'right', render: (_, r) => <span className="tabular-nums">{r.quoteCount}/{r.supplierCount}</span> },
        { key: 'updatedAt', title: t('rfqs.columns.updatedAt'), render: (_, r) => <DateText value={r.updatedAt} style="dateTime" /> },
    ];

    return (
        <>
            <SectionCard title={t('rfqs.title')} extra={create}>
                {rows.length === 0 ? (
                    <EmptyState title={t('rfqs.empty.title')} hint={t('rfqs.empty.hint')} action={create} />
                ) : (
                    <Table<RfqSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                        pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
                )}
            </SectionCard>
            {dialog && <NewRfqDialog projectId={projectId} requests={requests.data ?? []} onClose={() => setDialog(false)} />}
        </>
    );
}

function OrdersTab({ projectId }: { projectId: string }) {
    const t = useTranslations('procurement');
    const toText = useErrorMessage();
    const list = usePurchaseOrders(projectId);

    if (list.isLoading) return <Skeleton active />;
    if (list.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`}
                action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    const rows = list.data ?? [];
    const columns: ColumnsType<PurchaseOrderSummaryDto> = [
        {
            key: 'number', title: t('orders.columns.number'),
            render: (_, o) => <Link href={orderHref(projectId, o.id)} className="font-medium">{o.number ?? t('orders.draft')}</Link>,
        },
        { key: 'supplier', title: t('orders.columns.supplier'), render: (_, o) => <span className="break-words">{o.supplierName}</span> },
        { key: 'status', title: t('orders.columns.status'), render: (_, o) => <StatusTag enumName="purchaseOrderStatus" value={o.status} tones={ORDER_STATUS_TONES} /> },
        { key: 'date', title: t('orders.columns.orderDate'), render: (_, o) => <DateText value={o.orderDate} /> },
        { key: 'total', title: t('orders.columns.total'), align: 'right', render: (_, o) => <MoneyText value={o.total} className="font-semibold" /> },
    ];
    return (
        <SectionCard title={t('orders.title')}>
            {rows.length === 0 ? (
                <EmptyState title={t('orders.empty.title')} hint={t('orders.empty.hint')} />
            ) : (
                <Table<PurchaseOrderSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                    pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
            )}
        </SectionCard>
    );
}

function ProcurementTabs({ projectId }: { projectId: string }) {
    const t = useTranslations('procurement');
    const hub = useHubProject(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);
    // `?tab=rfqs|orders` (links from the award result)
    const wanted = useSearchParams().get('tab');
    const [tab, setTab] = useState<TabKey>(() => TAB_KEYS.find(k => k === wanted) ?? 'requests');

    return (
        <Tabs
            activeKey={tab}
            onChange={k => setTab(k as TabKey)}
            items={[
                { key: 'requests', label: t('tabs.requests'), children: <RequestsTab projectId={projectId} canRequest={can(ws.role, 'procurement.request')} /> },
                { key: 'rfqs', label: t('tabs.rfqs'), children: <RfqsTab projectId={projectId} canManage={can(ws.role, 'procurement.manage')} /> },
                { key: 'orders', label: t('tabs.orders'), children: <OrdersTab projectId={projectId} /> },
            ]}
        />
    );
}

export function ProcurementPage({ projectId }: { projectId: string }) {
    return (
        <Suspense fallback={<Skeleton active />}>
            <ProcurementTabs projectId={projectId} />
        </Suspense>
    );
}
