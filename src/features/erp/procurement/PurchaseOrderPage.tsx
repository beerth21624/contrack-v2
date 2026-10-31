'use client';

// ─── /p/[projectId]/procurement/orders/[orderId]: a purchase order — edit the draft, issue, receive goods, print ───
import { useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Input, Select, Skeleton, Switch, Table } from 'antd';
import { CheckOutlined, InboxOutlined, PrinterOutlined, SaveOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { orderLineAmount, orderTotals } from '@/domain/procurement/order-totals';
import { THAI_VAT_RATE } from '@/domain/money/tax';
import {
    DOC_LANGUAGES, can, type BudgetWarning, type DocLanguage, type GoodsReceiptDto, type PatchPurchaseOrderRequest, type PurchaseOrderDto,
} from '@/shared/contract';
import { ApiError } from '@/features/cloud/api/errors';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProject } from '../hub/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { QtyText } from '../shared/QtyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { SupplierPicker } from '../shared/SupplierPicker';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { BudgetWarnings } from './BudgetWarnings';
import { GoodsReceiptDialog } from './GoodsReceiptDialog';
import {
    useCancelGoodsReceipt, useCancelPurchaseOrder, useClosePurchaseOrder, useGoodsReceipts, useIssuePurchaseOrder, usePatchPurchaseOrder, usePurchaseOrder,
} from './hooks';
import { OrderLinesEditor, OrderLinesTable, orderLineForms, orderLineValid, toOrderLineInputs, type OrderLineForm } from './OrderLinesTable';
import { ORDER_STATUS_TONES, procurementHref } from './status';

const printHref = (orderId: string): string => `/print/purchase-order/${encodeURIComponent(orderId)}`;

interface Form {
    supplierId: string;
    orderDate: string;
    deliveryDate: string;
    deliveryAddress: string;
    language: DocLanguage;
    vat: boolean;
    discount: number;
    paymentTermDays: number | null;
    terms: string;
    reason: string;
    lines: OrderLineForm[];
}

const formOf = (o: PurchaseOrderDto): Form => ({
    supplierId: o.supplierId, orderDate: o.orderDate ?? '', deliveryDate: o.deliveryDate ?? '', deliveryAddress: o.deliveryAddress, language: o.language,
    vat: o.vatRate > 0, discount: o.discount, paymentTermDays: o.paymentTermDays, terms: o.terms, reason: o.overrideReason, lines: orderLineForms(o.lines),
});

function patchBody(f: Form, o: PurchaseOrderDto): PatchPurchaseOrderRequest {
    return {
        ...(f.supplierId !== o.supplierId ? { supplierId: f.supplierId } : {}),
        orderDate: f.orderDate === '' ? null : f.orderDate,
        deliveryDate: f.deliveryDate === '' ? null : f.deliveryDate,
        deliveryAddress: f.deliveryAddress.trim(),
        language: f.language,
        vatRate: f.vat ? (o.vatRate > 0 ? o.vatRate : THAI_VAT_RATE) : 0,
        discount: f.discount,
        paymentTermDays: f.paymentTermDays,
        terms: f.terms,
        overrideReason: f.reason.trim(),
        lines: toOrderLineInputs(f.lines),
    };
}

function Totals({ subtotal, discount, vat, total }: { subtotal: number; discount: number; vat: number; total: number }) {
    const t = useTranslations('procurement.order.totals');
    const row = (label: string, value: number, strong = false) => (
        <div className={`flex justify-between gap-6 ${strong ? 'text-[15px] font-semibold' : 'text-[13px] text-gray-600'}`}>
            <span>{label}</span><MoneyText value={value} />
        </div>
    );
    return (
        <div className="ml-auto flex w-full max-w-[320px] flex-col gap-1">
            {row(t('subtotal'), subtotal)}
            {discount > 0 && row(t('discount'), -discount)}
            {row(t('vat'), vat)}
            {row(t('total'), total, true)}
        </div>
    );
}

function DraftBody({ order, workspaceId }: { order: PurchaseOrderDto; workspaceId: string | undefined }) {
    const t = useTranslations('procurement.order');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchPurchaseOrder(order.id);
    const issue = useIssuePurchaseOrder(order.id);
    const [form, setForm] = useState<Form>(() => formOf(order));
    const serverKey = JSON.stringify(formOf(order));
    const [base, setBase] = useState(serverKey);
    // Warnings the server found when issuing (it recomputes them then), shown until the next save.
    const [issueWarnings, setIssueWarnings] = useState<BudgetWarning[] | null>(null);
    if (base !== serverKey) {
        setBase(serverKey);
        setForm(formOf(order));
    }
    const set = (p: Partial<Form>) => setForm(f => ({ ...f, ...p }));
    const dirty = JSON.stringify(form) !== serverKey;
    const valid = form.lines.length > 0 && form.lines.every(orderLineValid) && form.supplierId !== '';

    const amounts = form.lines.map(l => orderLineAmount(l.qty ?? 0, l.unitPrice));
    const totals = orderTotals(amounts, Math.min(form.discount, amounts.reduce((a, b) => a + b, 0)), form.vat ? (order.vatRate > 0 ? order.vatRate : THAI_VAT_RATE) : 0);
    const warnings = issueWarnings ?? order.budgetWarnings;

    const save = async (): Promise<PurchaseOrderDto> => {
        const saved = await patch.mutateAsync(patchBody(form, order));
        setIssueWarnings(null);
        return saved;
    };

    const onSave = async () => {
        try {
            await save();
            void message.success(t('saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const onIssue = async () => {
        try {
            if (dirty) await save();
            const done = await issue.mutateAsync({ overrideReason: form.reason.trim() });
            void message.success(done.status === 'issued' ? t('issued') : t('submitted'));
        } catch (e) {
            if (e instanceof ApiError && (e.details as { reason?: string } | undefined)?.reason === 'override_reason_required') {
                const w = (e.details as { warnings?: BudgetWarning[] } | undefined)?.warnings;
                if (Array.isArray(w)) setIssueWarnings(w);
            }
            void message.error(toText(e));
        }
    };

    const label = (text: string, node: React.ReactNode, cls = '') => (
        <label className={`flex flex-col gap-1 text-[13px] text-gray-600 ${cls}`}>{text}{node}</label>
    );

    return (
        <>
            <SectionCard title={t('details.title')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="flex flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('fields.supplier')}
                        <SupplierPicker value={form.supplierId} workspaceId={workspaceId} allowClear={false} onChange={id => { if (id !== null) set({ supplierId: id }); }} />
                    </div>
                    {label(t('fields.orderDate'), <Input type="date" value={form.orderDate} onChange={e => set({ orderDate: e.target.value })} />)}
                    {label(t('fields.deliveryDate'), <Input type="date" value={form.deliveryDate} onChange={e => set({ deliveryDate: e.target.value })} />)}
                    {label(t('fields.deliveryAddress'),
                        <Input.TextArea value={form.deliveryAddress} rows={2} maxLength={1000} onChange={e => set({ deliveryAddress: e.target.value })} />, 'sm:col-span-2')}
                    {label(t('fields.language'), <Select value={form.language} onChange={(language: DocLanguage) => set({ language })}
                        options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />)}
                    {label(t('fields.paymentTermDays'), <Input type="number" min={0} max={3650} value={form.paymentTermDays ?? ''}
                        onChange={e => set({ paymentTermDays: e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))) })} />)}
                    {label(t('fields.discount'), <MoneyInput value={form.discount} onChange={v => set({ discount: v ?? 0 })} />)}
                    <div className="flex items-center gap-2 text-[13px] text-gray-600 sm:pt-6">
                        <Switch checked={form.vat} onChange={vat => set({ vat })} /> {t('fields.vat')}
                    </div>
                    {label(t('fields.terms'), <Input.TextArea value={form.terms} rows={3} maxLength={4000} onChange={e => set({ terms: e.target.value })} />, 'sm:col-span-2')}
                </div>
            </SectionCard>
            <SectionCard title={t('lines.title')}>
                <div className="flex min-w-0 flex-col gap-4">
                    <OrderLinesEditor projectId={order.projectId} lines={form.lines} onChange={lines => set({ lines })} />
                    <Totals {...totals} />
                </div>
            </SectionCard>
            <BudgetWarnings warnings={warnings} reason={form.reason} onReasonChange={reason => set({ reason })} />
            {order.canEdit && (
                <div className="flex flex-wrap justify-end gap-2">
                    <Button icon={<SaveOutlined />} disabled={!dirty || !valid} loading={patch.isPending && !issue.isPending} onClick={() => { void onSave(); }}>{t('save')}</Button>
                    <Button type="primary" icon={<CheckOutlined />} disabled={!valid} loading={issue.isPending} onClick={() => { void onIssue(); }}>{t('issue')}</Button>
                </div>
            )}
        </>
    );
}

function ReadBody({ order }: { order: PurchaseOrderDto }) {
    const t = useTranslations('procurement.order');
    const row = (label: string, value: React.ReactNode) => (
        <div className="flex min-w-0 flex-col"><span className="text-[12px] text-gray-500">{label}</span><span className="break-words">{value}</span></div>
    );
    const snap = order.supplierSnapshot;
    return (
        <>
            <SectionCard title={t('details.title')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {row(t('fields.supplier'), order.supplierName)}
                    {row(t('fields.orderDate'), <DateText value={order.orderDate} />)}
                    {row(t('fields.deliveryDate'), <DateText value={order.deliveryDate} />)}
                    {row(t('fields.paymentTermDays'), order.paymentTermDays === null ? '–' : t('days', { count: order.paymentTermDays }))}
                    {row(t('fields.deliveryAddress'), order.deliveryAddress !== '' ? order.deliveryAddress : '–')}
                    {row(t('fields.language'), t(`languages.${order.language}`))}
                    {snap !== null && row(t('fields.supplierTaxId'), snap.taxId !== '' ? snap.taxId : '–')}
                    {snap !== null && row(t('fields.supplierContact'), [snap.contactName, snap.phone, snap.email].filter(x => x !== '').join(' · ') || '–')}
                    {order.terms !== '' && <div className="sm:col-span-2 lg:col-span-4">{row(t('fields.terms'), <span className="whitespace-pre-wrap">{order.terms}</span>)}</div>}
                </div>
            </SectionCard>
            <SectionCard title={t('lines.title')}>
                <div className="flex min-w-0 flex-col gap-4">
                    <OrderLinesTable lines={order.lines} />
                    <Totals subtotal={order.subtotal} discount={order.discount} vat={order.vat} total={order.total} />
                </div>
            </SectionCard>
            <BudgetWarnings warnings={order.budgetWarnings} reason={order.overrideReason} readOnly />
        </>
    );
}

function Receipts({ order, canReceive }: { order: PurchaseOrderDto; canReceive: boolean }) {
    const t = useTranslations('procurement.order.receipts');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const q = useGoodsReceipts(order.id);
    const cancel = useCancelGoodsReceipt(order.id);
    const lineName = (id: string): string => {
        const l = order.lines.find(x => x.id === id);
        return l === undefined ? '' : (l.descTh !== '' ? l.descTh : l.descEn);
    };

    const columns: ColumnsType<GoodsReceiptDto> = [
        { key: 'number', title: t('columns.number'), render: (_, r) => <DocumentNumberTag number={r.number} /> },
        { key: 'date', title: t('columns.date'), render: (_, r) => <DateText value={r.receivedDate} /> },
        { key: 'note', title: t('columns.deliveryNoteNo'), render: (_, r) => r.deliveryNoteNo !== '' ? r.deliveryNoteNo : '–' },
        { key: 'status', title: t('columns.status'), render: (_, r) => <StatusTag enumName="goodsReceiptStatus" value={r.status} tones={{ confirmed: 'success' }} /> },
        { key: 'amount', title: t('columns.amount'), align: 'right', render: (_, r) => <MoneyText value={r.amount} className="font-semibold" /> },
        {
            key: 'actions', title: '', align: 'right',
            render: (_, r) => (r.status === 'draft' && canReceive ? (
                <Button size="small" danger loading={cancel.isPending}
                    onClick={() => { cancel.mutateAsync(r.id).catch((e: unknown) => { void message.error(toText(e)); }); }}>{t('cancelDraft')}</Button>
            ) : null),
        },
    ];

    return (
        <Table<GoodsReceiptDto> size="small" rowKey="id" columns={columns} dataSource={q.data ?? []} loading={q.isLoading} pagination={false}
            locale={{ emptyText: q.isError ? toText(q.error) : t('empty') }} scroll={{ x: 'max-content' }}
            expandable={{
                rowExpandable: r => r.lines.length > 0 || r.photos.length > 0 || r.note !== '',
                expandedRowRender: r => (
                    <div className="flex min-w-0 flex-col gap-2 text-[13px]">
                        <ul className="m-0 flex list-none flex-col gap-1 p-0">
                            {r.lines.map(l => (
                                <li key={l.id} className="flex flex-wrap items-baseline gap-x-3">
                                    <span className="min-w-0 break-words">{lineName(l.orderLineId) || (l.descTh !== '' ? l.descTh : l.descEn)}</span>
                                    <QtyText value={l.qtyReceived} unit={l.unit} />
                                    {l.qtyRejected > 0 && <span className="text-red-600">{t('rejected')} <QtyText value={l.qtyRejected} unit={l.unit} /></span>}
                                    {l.condition !== 'ok' && <StatusTag enumName="receiptCondition" value={l.condition} tones={{ damaged: 'error', short: 'warning' }} />}
                                    {l.note !== '' && <span className="text-gray-500">{l.note}</span>}
                                </li>
                            ))}
                        </ul>
                        {r.note !== '' && <div className="break-words text-gray-600">{r.note}</div>}
                        {r.photos.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {r.photos.map(p => p.file !== null && (
                                    <a key={p.fileId} href={p.file.url} target="_blank" rel="noopener noreferrer" className="max-w-[240px] truncate">{p.file.name}</a>
                                ))}
                            </div>
                        )}
                    </div>
                ),
            }} />
    );
}

function Editor({ order }: { order: PurchaseOrderDto }) {
    const t = useTranslations('procurement.order');
    const { message } = App.useApp();
    const hub = useHubProject(order.projectId);
    const workspaceId = hub.data?.project.workspaceId;
    const ws = useErpWorkspace(workspaceId);
    const canManage = can(ws.role, 'procurement.manage');
    const cancel = useCancelPurchaseOrder(order.id);
    const close = useClosePurchaseOrder(order.id);
    const [receiving, setReceiving] = useState(false);
    const draft = order.status === 'draft';
    const anyReceived = order.lines.some(l => l.receivedQty > 0);
    const mayCancel = canManage && (draft || order.status === 'pending_approval' || (order.status === 'issued' && !anyReceived));
    const mayClose = canManage && (order.status === 'issued' || order.status === 'partially_received' || order.status === 'received');
    const hasOpen = order.lines.some(l => l.qty - l.receivedQty > 0);

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
                title={(
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words">{t('title')}</span>
                        <DocumentNumberTag number={order.number} />
                        <StatusTag enumName="purchaseOrderStatus" value={order.status} tones={ORDER_STATUS_TONES} />
                    </span>
                )}
                extra={(
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={printHref(order.id)} target="_blank"><Button icon={<PrinterOutlined />}>{t('print')}</Button></Link>
                        {mayCancel && (
                            <ConfirmAction danger title={t('cancel.confirm')} onConfirm={async () => { await cancel.mutateAsync(); void message.success(t('cancel.done')); }}>
                                {t('cancel.button')}
                            </ConfirmAction>
                        )}
                        {mayClose && (
                            <ConfirmAction title={t('close.confirm')} content={t('close.hint')} onConfirm={async () => { await close.mutateAsync(); void message.success(t('close.done')); }}>
                                {t('close.button')}
                            </ConfirmAction>
                        )}
                        {order.canReceive && hasOpen && (
                            <Button type="primary" icon={<InboxOutlined />} onClick={() => setReceiving(true)}>{t('receive')}</Button>
                        )}
                    </div>
                )}
            >
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
                    <Link href={procurementHref(order.projectId, 'orders')}>{t('backToList')}</Link>
                    <span>·</span>
                    <span>{order.supplierName}</span>
                </div>
                {order.status === 'pending_approval' && <Alert className="!mt-3" type="info" showIcon title={t('pendingHint')} />}
                {order.status === 'draft' && order.rfqId !== null && <Alert className="!mt-3" type="info" showIcon title={t('fromRfq')} />}
            </SectionCard>

            {draft && order.canEdit ? <DraftBody order={order} workspaceId={workspaceId} /> : <ReadBody order={order} />}

            {!draft && order.status !== 'pending_approval' && order.status !== 'cancelled' && (
                <SectionCard title={t('receipts.title')}>
                    <Receipts order={order} canReceive={order.canReceive} />
                </SectionCard>
            )}
            {receiving && <GoodsReceiptDialog order={order} workspaceId={workspaceId} onClose={() => setReceiving(false)} />}
        </div>
    );
}

export function PurchaseOrderPage({ orderId }: { projectId: string; orderId: string }) {
    const t = useTranslations('procurement.order');
    const toText = useErrorMessage();
    const q = usePurchaseOrder(orderId);
    if (q.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (q.data === undefined) return <Skeleton active />;
    // A fresh editor per status: a draft that became issued / pending leaves its form behind.
    return <Editor key={`${q.data.id}:${q.data.status}`} order={q.data} />;
}
