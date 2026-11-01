'use client';

// ─── /payables/bills/[billId]: a supplier bill — edit the draft, see the 3-way match, approve, void ───
import { useState } from 'react';
import { Alert, App, Button, Input, Select, Skeleton, Switch } from 'antd';
import { CheckOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { THAI_VAT_RATE } from '@/domain/money/tax';
import {
    COST_CATEGORIES, SUPPLIER_WHT_PRESETS, type CostCategory, type PatchSupplierBillRequest, type SupplierBillDto, type SupplierBillLineInput, type SupplierWhtPreset,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { ReasonDialog } from '../billing/ReasonDialog';
import { useHubProjects } from '../hub/hooks';
import { CostCodePicker } from '../shared/CostCodePicker';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { ErpPage } from '../shared/ErpPage';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { QtyInput } from '../shared/QtyInput';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { useApproveBill, usePatchBill, useSupplierBill, useVoidBill } from './hooks';
import { MatchTable } from './MatchTable';
import { BILL_STATUS_TONES, MATCH_TONES } from './status';

interface LineForm {
    key: string;
    orderLineId: string | null;
    costCodeId: string | null;
    category: CostCategory;
    desc: string;
    unit: string;
    qty: number | null;
    unitPrice: number;
}

interface Form {
    projectId: string | null;
    billDate: string;
    supplierInvoiceNo: string;
    supplierInvoiceDate: string;
    taxInvoiceNo: string;
    taxInvoiceDate: string;
    inputVatClaimable: boolean;
    dueDate: string;
    vatOn: boolean;
    vat: number;
    discount: number;
    whtPreset: SupplierWhtPreset;
    note: string;
    lines: LineForm[];
}

let seq = 0;
const newLine = (b: SupplierBillDto): LineForm => ({
    key: `n${++seq}`, orderLineId: null, costCodeId: null, category: b.kind === 'material' ? 'material' : 'other', desc: '', unit: '', qty: null, unitPrice: 0,
});

const formOf = (b: SupplierBillDto): Form => ({
    projectId: b.projectId,
    billDate: b.billDate,
    supplierInvoiceNo: b.supplierInvoiceNo,
    supplierInvoiceDate: b.supplierInvoiceDate ?? '',
    taxInvoiceNo: b.taxInvoiceNo,
    taxInvoiceDate: b.taxInvoiceDate ?? '',
    inputVatClaimable: b.inputVatClaimable,
    dueDate: b.dueDate,
    vatOn: b.vatRate > 0,
    vat: b.vat,
    discount: b.discount,
    whtPreset: b.whtPreset,
    note: b.note,
    lines: b.lines.map(l => ({
        key: l.id, orderLineId: l.orderLineId, costCodeId: l.costCodeId, category: l.category, desc: l.desc, unit: l.unit, qty: l.qty, unitPrice: l.unitPrice,
    })),
});

const lineInputs = (lines: readonly LineForm[]): SupplierBillLineInput[] =>
    lines.map(l => ({
        orderLineId: l.orderLineId, costCodeId: l.costCodeId, category: l.category, desc: l.desc.trim(), unit: l.unit.trim(), qty: l.qty ?? 0, unitPrice: l.unitPrice,
    }));

/** Only what the user changed: an untouched VAT amount stays as the server has it, and an edit to the lines or rate recomputes it. */
function patchBody(f: Form, b: SupplierBillDto, editLines: boolean, editProject: boolean): PatchSupplierBillRequest {
    const base = formOf(b);
    const o: PatchSupplierBillRequest = {};
    if (editProject && f.projectId !== base.projectId) o.projectId = f.projectId;
    if (f.billDate !== '' && f.billDate !== base.billDate) o.billDate = f.billDate;
    if (f.supplierInvoiceNo.trim() !== base.supplierInvoiceNo) o.supplierInvoiceNo = f.supplierInvoiceNo.trim();
    if (f.supplierInvoiceDate !== base.supplierInvoiceDate) o.supplierInvoiceDate = f.supplierInvoiceDate === '' ? null : f.supplierInvoiceDate;
    if (f.taxInvoiceNo.trim() !== base.taxInvoiceNo) o.taxInvoiceNo = f.taxInvoiceNo.trim();
    if (f.taxInvoiceDate !== base.taxInvoiceDate) o.taxInvoiceDate = f.taxInvoiceDate === '' ? null : f.taxInvoiceDate;
    if (f.inputVatClaimable !== base.inputVatClaimable) o.inputVatClaimable = f.inputVatClaimable;
    if (f.dueDate !== '' && f.dueDate !== base.dueDate) o.dueDate = f.dueDate;
    if (f.vatOn !== base.vatOn) o.vatRate = f.vatOn ? THAI_VAT_RATE : 0;
    if (f.vat !== base.vat && f.vatOn === base.vatOn) o.vat = f.vat;
    if (f.discount !== base.discount) o.discount = f.discount;
    if (f.whtPreset !== base.whtPreset) o.whtPreset = f.whtPreset;
    if (f.note !== base.note) o.note = f.note;
    if (editLines && JSON.stringify(lineInputs(f.lines)) !== JSON.stringify(lineInputs(base.lines))) o.lines = lineInputs(f.lines);
    return o;
}

function Totals({ bill }: { bill: SupplierBillDto }) {
    const t = useTranslations('payables.bill.totals');
    const row = (label: string, value: number, strong = false) => (
        <div className={`flex justify-between gap-6 ${strong ? 'text-[15px] font-semibold' : 'text-[13px] text-gray-600'}`}>
            <span>{label}</span><MoneyText value={value} />
        </div>
    );
    return (
        <div className="ml-auto flex w-full max-w-[340px] flex-col gap-1">
            {row(t('subtotal'), bill.subtotal)}
            {bill.discount > 0 && row(t('discount'), -bill.discount)}
            {row(t('vat'), bill.vat)}
            {row(t('total'), bill.total, true)}
            {bill.whtAmount > 0 && row(t('wht', { rate: Math.round(bill.whtRate * 10000) / 100 }), -bill.whtAmount)}
            {bill.retentionAmount > 0 && row(t('retention'), -bill.retentionAmount)}
            {row(t('payable'), bill.payable, true)}
            {bill.paidAmount > 0 && row(t('paid'), bill.paidAmount)}
        </div>
    );
}

function LinesEditor({ form, bill, set }: { form: Form; bill: SupplierBillDto; set: (p: Partial<Form>) => void }) {
    const t = useTranslations('payables.bill.lines');
    const tc = useTranslations('enums.costCategory');
    const setLine = (key: string, p: Partial<LineForm>) => set({ lines: form.lines.map(l => (l.key === key ? { ...l, ...p } : l)) });
    return (
        <div className="flex min-w-0 flex-col gap-3">
            {form.lines.length === 0 && <div className="text-gray-500">{t('empty')}</div>}
            {form.lines.map((l, i) => (
                <div key={l.key} className="grid grid-cols-1 gap-2 rounded border border-gray-200 p-3 sm:grid-cols-12">
                    <label className="flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-5">{t('desc')} ({i + 1})
                        <Input value={l.desc} maxLength={500} onChange={e => setLine(l.key, { desc: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-2">{t('qty')}
                        <QtyInput value={l.qty} onChange={v => setLine(l.key, { qty: v })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-2">{t('unit')}
                        <Input value={l.unit} maxLength={40} onChange={e => setLine(l.key, { unit: e.target.value })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-3">{t('unitPrice')}
                        <MoneyInput value={l.unitPrice} onChange={v => setLine(l.key, { unitPrice: v ?? 0 })} />
                    </label>
                    <label className="flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-3">{t('category')}
                        <Select<CostCategory> value={l.category} onChange={category => setLine(l.key, { category })}
                            options={COST_CATEGORIES.map(c => ({ value: c, label: tc(c) }))} />
                    </label>
                    <div className="flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-8">{t('costCode')}
                        {form.projectId !== null
                            ? <CostCodePicker projectId={form.projectId} value={l.costCodeId} onChange={id => setLine(l.key, { costCodeId: id })} />
                            : <span className="text-gray-400">{t('noProject')}</span>}
                    </div>
                    <div className="flex items-end justify-end sm:col-span-1">
                        <Button danger type="text" icon={<DeleteOutlined />} aria-label={t('remove')} onClick={() => set({ lines: form.lines.filter(x => x.key !== l.key) })} />
                    </div>
                </div>
            ))}
            <div><Button icon={<PlusOutlined />} onClick={() => set({ lines: [...form.lines, newLine(bill)] })}>{t('add')}</Button></div>
        </div>
    );
}

function DraftBody({ bill, workspaceId }: { bill: SupplierBillDto; workspaceId: string | undefined }) {
    const t = useTranslations('payables.bill');
    const tp = useTranslations('enums.whtPreset');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchBill(bill.id);
    const approve = useApproveBill(bill.id);
    const projects = useHubProjects(workspaceId);
    const [form, setForm] = useState<Form>(() => formOf(bill));
    const serverKey = JSON.stringify(formOf(bill));
    const [base, setBase] = useState(serverKey);
    if (base !== serverKey) {
        setBase(serverKey);
        setForm(formOf(bill));
    }
    const set = (p: Partial<Form>) => setForm(f => ({ ...f, ...p }));
    const typed = bill.kind === 'material' || bill.kind === 'service' || bill.kind === 'expense';
    const editProject = typed && bill.orderId === null;
    const body = patchBody(form, bill, typed, editProject);
    const dirty = Object.keys(body).length > 0;
    const valid = (!typed || form.lines.every(l => (l.qty ?? 0) > 0 && l.desc.trim() !== '')) && form.billDate !== '' && form.dueDate !== '';
    const needsNote = bill.matchStatus === 'exceptions' && form.note.trim() === '';

    const save = async (): Promise<SupplierBillDto> => patch.mutateAsync(body);
    const onSave = async () => {
        try {
            await save();
            void message.success(t('saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };
    const onApprove = async () => {
        try {
            if (dirty) await save();
            const done = await approve.mutateAsync({ note: form.note.trim() === '' ? undefined : form.note.trim() });
            void message.success(done.status === 'approved' ? t('approved') : t('submitted'));
        } catch (e) {
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
                    {editProject && label(t('fields.project'), (
                        <Select<string> allowClear showSearch={{ optionFilterProp: 'label' }} value={form.projectId ?? undefined} placeholder={t('fields.overhead')}
                            loading={projects.isLoading} onChange={(v: string | undefined) => set({ projectId: v ?? null, lines: form.lines.map(l => ({ ...l, costCodeId: null })) })}
                            options={(projects.data ?? []).map(p => ({ value: p.project.id, label: p.project.name }))} />
                    ), 'sm:col-span-2')}
                    {label(t('fields.billDate'), <Input type="date" value={form.billDate} onChange={e => set({ billDate: e.target.value })} />)}
                    {label(t('fields.dueDate'), <Input type="date" value={form.dueDate} onChange={e => set({ dueDate: e.target.value })} />)}
                    {label(t('fields.supplierInvoiceNo'), <Input value={form.supplierInvoiceNo} maxLength={100} onChange={e => set({ supplierInvoiceNo: e.target.value })} />)}
                    {label(t('fields.supplierInvoiceDate'), <Input type="date" value={form.supplierInvoiceDate} onChange={e => set({ supplierInvoiceDate: e.target.value })} />)}
                    {label(t('fields.taxInvoiceNo'), <Input value={form.taxInvoiceNo} maxLength={100} onChange={e => set({ taxInvoiceNo: e.target.value })} />)}
                    {label(t('fields.taxInvoiceDate'), <Input type="date" value={form.taxInvoiceDate} onChange={e => set({ taxInvoiceDate: e.target.value })} />)}
                    <div className="flex items-center gap-2 text-[13px] text-gray-600">
                        <Switch checked={form.inputVatClaimable} onChange={inputVatClaimable => set({ inputVatClaimable })} /> {t('fields.inputVatClaimable')}
                    </div>
                    <div className="flex items-center gap-2 text-[13px] text-gray-600">
                        <Switch checked={form.vatOn} onChange={vatOn => set({ vatOn })} /> {t('fields.vatOn')}
                    </div>
                    {typed && label(t('fields.discount'), <MoneyInput value={form.discount} onChange={v => set({ discount: v ?? 0 })} />)}
                    {label(t('fields.vat'), <MoneyInput value={form.vat} disabled={form.vatOn !== (bill.vatRate > 0)} onChange={v => set({ vat: v ?? 0 })} />)}
                    {label(t('fields.whtPreset'), (
                        <Select<SupplierWhtPreset> value={form.whtPreset} onChange={whtPreset => set({ whtPreset })}
                            options={SUPPLIER_WHT_PRESETS.map(p => ({ value: p, label: tp(p) }))} />
                    ))}
                    {label(t('fields.note'), <Input.TextArea value={form.note} rows={3} maxLength={4000} onChange={e => set({ note: e.target.value })} />, 'sm:col-span-2')}
                </div>
            </SectionCard>
            {typed ? (
                <SectionCard title={t('lines.title')}>
                    <div className="flex min-w-0 flex-col gap-4">
                        <LinesEditor form={form} bill={bill} set={set} />
                    </div>
                </SectionCard>
            ) : null}
            <SectionCard title={t('match.title')} extra={<StatusTag enumName="billMatchStatus" value={bill.matchStatus} tones={MATCH_TONES} />}>
                <div className="flex min-w-0 flex-col gap-4">
                    {dirty && <Alert type="info" showIcon title={t('match.saveToRefresh')} />}
                    {bill.matchStatus === 'exceptions' && <Alert type={needsNote ? 'warning' : 'info'} showIcon title={needsNote ? t('match.noteRequired') : t('match.exceptionsHint')} />}
                    <MatchTable lines={bill.lines} showMatch={bill.orderId !== null} />
                    <Totals bill={bill} />
                </div>
            </SectionCard>
            <div className="flex flex-wrap justify-end gap-2">
                {bill.canEdit && (
                    <Button icon={<SaveOutlined />} disabled={!dirty || !valid} loading={patch.isPending && !approve.isPending} onClick={() => { void onSave(); }}>{t('save')}</Button>
                )}
                {bill.canApprove && (
                    <Button type="primary" icon={<CheckOutlined />} disabled={!valid} loading={approve.isPending} onClick={() => { void onApprove(); }}>{t('approve')}</Button>
                )}
            </div>
        </>
    );
}

function ReadBody({ bill }: { bill: SupplierBillDto }) {
    const t = useTranslations('payables.bill');
    const tp = useTranslations('enums.whtPreset');
    const row = (label: string, value: React.ReactNode) => (
        <div className="flex min-w-0 flex-col"><span className="text-[12px] text-gray-500">{label}</span><span className="break-words">{value}</span></div>
    );
    const dash = (v: string): string => (v === '' ? '–' : v);
    return (
        <>
            <SectionCard title={t('details.title')}>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {row(t('fields.billDate'), <DateText value={bill.billDate} />)}
                    {row(t('fields.dueDate'), <DateText value={bill.dueDate} />)}
                    {row(t('fields.supplierInvoiceNo'), dash(bill.supplierInvoiceNo))}
                    {row(t('fields.supplierInvoiceDate'), <DateText value={bill.supplierInvoiceDate} />)}
                    {row(t('fields.taxInvoiceNo'), dash(bill.taxInvoiceNo))}
                    {row(t('fields.taxInvoiceDate'), <DateText value={bill.taxInvoiceDate} />)}
                    {row(t('fields.inputVatClaimable'), bill.inputVatClaimable ? t('yes') : t('no'))}
                    {row(t('fields.whtPreset'), tp(bill.whtPreset))}
                    {bill.orderNumber !== null && row(t('fields.order'), bill.orderNumber)}
                    {bill.note !== '' && <div className="sm:col-span-2 lg:col-span-4">{row(t('fields.note'), <span className="whitespace-pre-wrap">{bill.note}</span>)}</div>}
                    {bill.voidReason !== '' && <div className="sm:col-span-2 lg:col-span-4">{row(t('fields.voidReason'), <span className="whitespace-pre-wrap">{bill.voidReason}</span>)}</div>}
                </div>
            </SectionCard>
            <SectionCard title={t('match.title')} extra={<StatusTag enumName="billMatchStatus" value={bill.matchStatus} tones={MATCH_TONES} />}>
                <div className="flex min-w-0 flex-col gap-4">
                    <MatchTable lines={bill.lines} showMatch={bill.orderId !== null} />
                    <Totals bill={bill} />
                </div>
            </SectionCard>
        </>
    );
}

function Editor({ bill }: { bill: SupplierBillDto }) {
    const t = useTranslations('payables.bill');
    const { message } = App.useApp();
    const [voiding, setVoiding] = useState(false);
    const ws = useErpWorkspace(bill.workspaceId);
    const voidBill = useVoidBill(bill.id);
    return (
        <ErpPage
            title={(
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words">{t('title')}</span>
                    <DocumentNumberTag number={bill.number} />
                    <StatusTag enumName="supplierBillStatus" value={bill.status} tones={BILL_STATUS_TONES} />
                </span>
            )}
            subtitle={(
                <span>
                    {bill.supplierName !== '' ? bill.supplierName : t('labourBill')} · <StatusTag enumName="supplierBillKind" value={bill.kind} />
                </span>
            )}
            breadcrumb={[{ label: t('breadcrumb'), href: '/payables' }, { label: bill.number ?? t('title') }]}
            extra={bill.canVoid ? <Button danger onClick={() => setVoiding(true)}>{t('void.button')}</Button> : undefined}
        >
            {bill.status === 'pending_approval' && <Alert type="info" showIcon title={t('pendingHint')} />}
            {bill.status === 'draft' && bill.canEdit ? <DraftBody bill={bill} workspaceId={ws.workspaceId} /> : <ReadBody bill={bill} />}
            {voiding && (
                <ReasonDialog danger title={t('void.title')} hint={t('void.hint')} okText={t('void.ok')} onClose={() => setVoiding(false)}
                    onSubmit={async reason => { await voidBill.mutateAsync({ reason }); void message.success(t('void.done')); }} />
            )}
        </ErpPage>
    );
}

export function BillPage({ billId }: { billId: string }) {
    const t = useTranslations('payables.bill');
    const toText = useErrorMessage();
    const q = useSupplierBill(billId);
    if (q.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (q.data === undefined) return <Skeleton active />;
    // A fresh editor per status: a draft that became approved / pending leaves its form behind.
    return <Editor key={`${q.data.id}:${q.data.status}`} bill={q.data} />;
}
