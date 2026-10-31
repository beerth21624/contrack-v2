'use client';

// ─── /p/[projectId]/procurement/rfqs/[rfqId]: an RFQ — details, invited suppliers, quotes typed in, comparison, award ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Input, Select, Skeleton, Table } from 'antd';
import { PrinterOutlined, SendOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { DOC_LANGUAGES, can, type DocLanguage, type PatchRfqRequest, type RfqDto, type RfqLineDto, type RfqSupplierDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProject } from '../hub/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { QtyInput } from '../shared/QtyInput';
import { QtyText } from '../shared/QtyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { SupplierPicker } from '../shared/SupplierPicker';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useAwardRfq, useCancelRfq, usePatchRfq, usePutRfqSuppliers, useRfq, useRfqCompare, useSendRfq } from './hooks';
import { QuoteEntryDialog } from './QuoteEntryDialog';
import { RfqCompareTable } from './RfqCompareTable';
import { RFQ_STATUS_TONES, orderHref, procurementHref } from './status';

const supplierName = (s: { nameTh: string; nameEn: string }): string => (s.nameTh !== '' ? s.nameTh : s.nameEn);

interface DetailsForm {
    title: string;
    dueDate: string;
    deliveryAddress: string;
    language: DocLanguage;
    qty: Record<string, number | null>;
}

const formOf = (r: RfqDto): DetailsForm => ({
    title: r.title, dueDate: r.dueDate ?? '', deliveryAddress: r.deliveryAddress, language: r.language,
    qty: Object.fromEntries(r.lines.map(l => [l.id, l.qty])),
});

function patchOf(form: DetailsForm, r: RfqDto): PatchRfqRequest {
    const p: PatchRfqRequest = {};
    if (form.title.trim() !== r.title) p.title = form.title.trim();
    if (form.dueDate !== (r.dueDate ?? '')) p.dueDate = form.dueDate === '' ? null : form.dueDate;
    if (form.deliveryAddress.trim() !== r.deliveryAddress) p.deliveryAddress = form.deliveryAddress.trim();
    if (form.language !== r.language) p.language = form.language;
    const changed = r.lines.filter(l => form.qty[l.id] !== null && form.qty[l.id] !== l.qty);
    if (changed.length > 0) p.lines = changed.map(l => ({ id: l.id, qty: form.qty[l.id] ?? l.qty }));
    return p;
}

function DetailsCard({ rfq, editable }: { rfq: RfqDto; editable: boolean }) {
    const t = useTranslations('procurement.rfq');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchRfq(rfq.id);
    const [form, setForm] = useState<DetailsForm>(() => formOf(rfq));
    const serverKey = JSON.stringify(formOf(rfq));
    const [base, setBase] = useState(serverKey);
    // The details changed on the server (saved here, or by someone else): start again from them.
    if (base !== serverKey) {
        setBase(serverKey);
        setForm(formOf(rfq));
    }
    const body = patchOf(form, rfq);
    const dirty = Object.keys(body).length > 0;
    const set = (p: Partial<DetailsForm>) => setForm(f => ({ ...f, ...p }));
    const qtyInvalid = rfq.lines.some(l => (form.qty[l.id] ?? 0) <= 0);

    const save = async () => {
        try {
            await patch.mutateAsync(body);
            void message.success(t('details.saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const lineColumns: ColumnsType<RfqLineDto> = [
        { key: 'code', title: t('lines.columns.costCode'), render: (_, l) => l.costCode ?? '–' },
        { key: 'desc', title: t('lines.columns.desc'), render: (_, l) => <span className="break-words">{l.descTh !== '' ? l.descTh : l.descEn}</span> },
        {
            key: 'qty', title: t('lines.columns.qty'), align: 'right',
            render: (_, l) => (editable
                ? <div className="ml-auto flex min-w-[150px] items-center gap-2"><QtyInput value={form.qty[l.id] ?? null} status={(form.qty[l.id] ?? 0) > 0 ? undefined : 'error'}
                    onChange={v => set({ qty: { ...form.qty, [l.id]: v } })} /><span className="text-gray-500">{l.unit}</span></div>
                : <QtyText value={l.qty} unit={l.unit} />),
        },
    ];

    const row = (label: string, value: React.ReactNode) => (
        <div className="flex min-w-0 flex-col"><span className="text-[12px] text-gray-500">{label}</span><span className="break-words">{value}</span></div>
    );

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {editable ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('fields.title')}
                        <Input value={form.title} maxLength={200} onChange={e => set({ title: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.dueDate')}
                        <Input type="date" value={form.dueDate} onChange={e => set({ dueDate: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.language')}
                        <Select value={form.language} onChange={(language: DocLanguage) => set({ language })}
                            options={DOC_LANGUAGES.map(l => ({ value: l, label: t(`languages.${l}`) }))} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">
                        {t('fields.deliveryAddress')}
                        <Input.TextArea value={form.deliveryAddress} rows={2} maxLength={1000} onChange={e => set({ deliveryAddress: e.target.value })} />
                    </label>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {row(t('fields.dueDate'), <DateText value={rfq.dueDate} />)}
                    {row(t('fields.language'), t(`languages.${rfq.language}`))}
                    {row(t('fields.sentAt'), <DateText value={rfq.sentAt} style="dateTime" />)}
                    {row(t('fields.deliveryAddress'), rfq.deliveryAddress !== '' ? rfq.deliveryAddress : '–')}
                </div>
            )}
            <Table<RfqLineDto> size="small" rowKey="id" columns={lineColumns} dataSource={rfq.lines} pagination={false} scroll={{ x: 'max-content' }} />
            {editable && (
                <div className="flex justify-end">
                    <Button type="primary" disabled={!dirty || qtyInvalid || form.title.trim() === ''} loading={patch.isPending} onClick={() => { void save(); }}>
                        {t('details.save')}
                    </Button>
                </div>
            )}
        </div>
    );
}

function SuppliersCard({ rfq, canManage, workspaceId }: { rfq: RfqDto; canManage: boolean; workspaceId: string | undefined }) {
    const t = useTranslations('procurement.rfq');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const put = usePutRfqSuppliers(rfq.id);
    const [quoteFor, setQuoteFor] = useState<RfqSupplierDto | null>(null);
    const open = rfq.status === 'draft' || rfq.status === 'sent';
    const ids = rfq.suppliers.map(s => s.supplierId);

    const change = async (supplierIds: string[]) => {
        try {
            await put.mutateAsync({ supplierIds });
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const columns: ColumnsType<RfqSupplierDto> = [
        { key: 'name', title: t('suppliers.columns.name'), render: (_, s) => <span className="break-words font-medium">{supplierName(s)}</span> },
        { key: 'phone', title: t('suppliers.columns.contact'), render: (_, s) => <span className="break-words">{[s.phone, s.email].filter(x => x !== '').join(' · ') || '–'}</span> },
        { key: 'status', title: t('suppliers.columns.status'), render: (_, s) => <StatusTag enumName="rfqSupplierStatus" value={s.status} tones={{ quoted: 'success', declined: 'error' }} /> },
        {
            key: 'actions', title: '', align: 'right',
            render: (_, s) => (
                <div className="flex justify-end gap-2">
                    <Link href={`/print/rfq/${encodeURIComponent(rfq.id)}?supplier=${encodeURIComponent(s.supplierId)}`} target="_blank">
                        <Button size="small" icon={<PrinterOutlined />}>{t('suppliers.print')}</Button>
                    </Link>
                    {rfq.status === 'sent' && canManage && (
                        <Button size="small" type={s.status === 'invited' ? 'primary' : 'default'} onClick={() => setQuoteFor(s)}>
                            {s.status === 'quoted' ? t('suppliers.editQuote') : t('suppliers.enterQuote')}
                        </Button>
                    )}
                    {open && canManage && s.status !== 'quoted' && (
                        <Button size="small" danger loading={put.isPending} onClick={() => { void change(ids.filter(id => id !== s.supplierId)); }}>{t('suppliers.remove')}</Button>
                    )}
                </div>
            ),
        },
    ];

    return (
        <>
            {open && canManage && (
                <div className="mb-3 max-w-[420px]">
                    <SupplierPicker key={ids.length} workspaceId={workspaceId} allowClear={false} placeholder={t('suppliers.add')}
                        onChange={(id) => { if (id !== null && !ids.includes(id)) void change([...ids, id]); }} />
                </div>
            )}
            <Table<RfqSupplierDto> size="small" rowKey="supplierId" columns={columns} dataSource={rfq.suppliers} pagination={false}
                locale={{ emptyText: t('suppliers.empty') }} scroll={{ x: 'max-content' }} />
            {quoteFor !== null && <QuoteEntryDialog rfq={rfq} supplier={quoteFor} workspaceId={workspaceId} onClose={() => setQuoteFor(null)} />}
        </>
    );
}

function Editor({ rfq }: { rfq: RfqDto }) {
    const t = useTranslations('procurement.rfq');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const router = useRouter();
    const hub = useHubProject(rfq.projectId);
    const workspaceId = hub.data?.project.workspaceId;
    const ws = useErpWorkspace(workspaceId);
    const canManage = can(ws.role, 'procurement.manage');
    const send = useSendRfq(rfq.id);
    const cancel = useCancelRfq(rfq.id);
    const award = useAwardRfq(rfq.id, rfq.projectId);
    const quotedKey = rfq.quotes.map(q => `${q.supplierId}:${q.updatedAt}`).join('|');
    const showCompare = rfq.quotes.length > 0 && (rfq.status === 'sent' || rfq.status === 'awarded' || rfq.status === 'closed');
    const compare = useRfqCompare(rfq.id, showCompare, quotedKey);
    const awarded = rfq.suppliers.find(s => s.supplierId === rfq.awardedSupplierId);

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <SectionCard
                title={(
                    <span className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="min-w-0 break-words">{rfq.title !== '' ? rfq.title : (rfq.number ?? t('untitled'))}</span>
                        <DocumentNumberTag number={rfq.number} />
                        <StatusTag enumName="rfqStatus" value={rfq.status} tones={RFQ_STATUS_TONES} />
                    </span>
                )}
                extra={canManage && (
                    <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/print/rfq/${encodeURIComponent(rfq.id)}`} target="_blank"><Button icon={<PrinterOutlined />}>{t('print')}</Button></Link>
                        {(rfq.status === 'draft' || rfq.status === 'sent') && (
                            <ConfirmAction danger title={t('cancel.confirm')} onConfirm={async () => { await cancel.mutateAsync(); void message.success(t('cancel.done')); }}>
                                {t('cancel.button')}
                            </ConfirmAction>
                        )}
                        {rfq.status === 'draft' && (
                            <ConfirmAction type="primary" icon={<SendOutlined />} title={t('send.confirm')} content={t('send.hint')}
                                disabled={rfq.suppliers.length === 0 || rfq.lines.length === 0}
                                onConfirm={async () => { await send.mutateAsync(); void message.success(t('send.done')); }}>
                                {t('send.button')}
                            </ConfirmAction>
                        )}
                    </div>
                )}
            >
                <div className="flex flex-wrap items-center gap-2 text-[13px] text-gray-500">
                    <Link href={procurementHref(rfq.projectId)}>{t('backToList')}</Link>
                </div>
                {rfq.status === 'draft' && rfq.suppliers.length === 0 && <Alert className="!mt-3" type="info" showIcon title={t('needSuppliers')} />}
                {rfq.status === 'sent' && <Alert className="!mt-3" type="info" showIcon title={t('sentHint')} />}
                {(rfq.status === 'awarded' || rfq.status === 'closed') && (
                    <Alert className="!mt-3" type="success" showIcon
                        title={t('awardedBanner', { name: awarded !== undefined ? supplierName(awarded) : '–' })}
                        action={<Link href={procurementHref(rfq.projectId, 'orders')}><Button size="small">{t('openOrders')}</Button></Link>} />
                )}
            </SectionCard>

            <SectionCard title={t('details.title')}>
                <DetailsCard rfq={rfq} editable={rfq.canEdit && rfq.status === 'draft'} />
            </SectionCard>

            <SectionCard title={t('suppliers.title')}>
                <SuppliersCard rfq={rfq} canManage={canManage} workspaceId={workspaceId} />
            </SectionCard>

            {showCompare && (
                <SectionCard title={t('compare.title')}>
                    {compare.isLoading && <Skeleton active />}
                    {compare.isError && <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(compare.error)}`} />}
                    {compare.data !== undefined && (
                        <RfqCompareTable compare={compare.data} canAward={canManage && rfq.status === 'sent'}
                            onAward={async (supplierId) => {
                                const awarded = await award.mutateAsync({ supplierId });
                                void message.success(t('award.done'));
                                // The PO draft is made: open it.
                                router.push(orderHref(rfq.projectId, awarded.orderId));
                            }} />
                    )}
                </SectionCard>
            )}
        </div>
    );
}

export function RfqEditorPage({ rfqId }: { projectId: string; rfqId: string }) {
    const t = useTranslations('procurement.rfq');
    const toText = useErrorMessage();
    const q = useRfq(rfqId);
    if (q.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (q.data === undefined) return <Skeleton active />;
    return <Editor key={q.data.id} rfq={q.data} />;
}
