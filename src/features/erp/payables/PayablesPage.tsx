'use client';

// ─── /payables: what to pay (due), supplier bills, payment runs ───
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Alert, App, Button, Input, Modal, Select, Skeleton, Table, Tabs } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    AP_PAYMENT_METHODS, PAYMENT_RUN_STATUSES, can, type ApPaymentMethod, type PaymentRunStatus, type PaymentRunSummaryDto, type SupplierBillStatus,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProjects } from '../hub/hooks';
import { DateText } from '../shared/DateText';
import { EmptyState } from '../shared/EmptyState';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { SupplierPicker } from '../shared/SupplierPicker';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { BillsTable } from './BillsTable';
import { DueList } from './DueList';
import { useCreateBill, useCreateRun, usePaymentRuns, useSupplierBills } from './hooks';
import { RUN_STATUS_TONES, billHref, runHref } from './status';

const today = (): string => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

type BillPreset = 'open' | 'approved' | 'draft' | 'pending' | 'paid' | 'all';
const BILL_PRESETS: Record<BillPreset, readonly SupplierBillStatus[]> = {
    open: ['approved', 'scheduled'],
    approved: ['approved'],
    draft: ['draft'],
    pending: ['pending_approval'],
    paid: ['paid'],
    all: [],
};

function NewBillDialog({ workspaceId, onClose }: { workspaceId: string; onClose: () => void }) {
    const t = useTranslations('payables.bills.new');
    const tk = useTranslations('enums.supplierBillKind');
    const toText = useErrorMessage();
    const router = useRouter();
    const { message } = App.useApp();
    const create = useCreateBill(workspaceId);
    const projects = useHubProjects(workspaceId);
    const [kind, setKind] = useState<'material' | 'service' | 'expense'>('service');
    const [supplierId, setSupplierId] = useState<string | null>(null);
    const [projectId, setProjectId] = useState<string | null>(null);
    const submit = async () => {
        if (supplierId === null) return;
        try {
            const b = await create.mutateAsync({ kind, supplierId, projectId, lines: [] });
            router.push(billHref(b.id));
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open title={t('title')} okText={t('ok')} okButtonProps={{ disabled: supplierId === null }} confirmLoading={create.isPending}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('kind')}
                    <Select value={kind} onChange={setKind} options={(['service', 'material', 'expense'] as const).map(k => ({ value: k, label: tk(k) }))} />
                </label>
                <div className="flex flex-col gap-1 text-[13px] text-gray-600">{t('supplier')}
                    <SupplierPicker value={supplierId} workspaceId={workspaceId} allowClear={false} onChange={id => setSupplierId(id)} />
                </div>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('project')}
                    <Select<string> allowClear showSearch={{ optionFilterProp: 'label' }} value={projectId ?? undefined} placeholder={t('overhead')} loading={projects.isLoading}
                        onChange={(v: string | undefined) => setProjectId(v ?? null)} options={(projects.data ?? []).map(p => ({ value: p.project.id, label: p.project.name }))} />
                </label>
            </div>
        </Modal>
    );
}

function NewRunDialog({ workspaceId, billIds, onClose }: { workspaceId: string; billIds: string[]; onClose: () => void }) {
    const t = useTranslations('payables.runs.new');
    const tm = useTranslations('enums.apPaymentMethod');
    const toText = useErrorMessage();
    const router = useRouter();
    const { message } = App.useApp();
    const create = useCreateRun(workspaceId);
    const [payDate, setPayDate] = useState(today());
    const [method, setMethod] = useState<ApPaymentMethod>('transfer');
    const [note, setNote] = useState('');
    const submit = async () => {
        try {
            const r = await create.mutateAsync({ billIds, payDate, method, note: note.trim() });
            router.push(runHref(r.id));
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open title={t('title', { count: billIds.length })} okText={t('ok')} okButtonProps={{ disabled: payDate === '' }} confirmLoading={create.isPending}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('payDate')}
                    <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('method')}
                    <Select value={method} onChange={setMethod} options={AP_PAYMENT_METHODS.map(m => ({ value: m, label: tm(m) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('note')}
                    <Input.TextArea rows={2} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}

function BillsTab({ workspaceId, canManage }: { workspaceId: string | undefined; canManage: boolean }) {
    const t = useTranslations('payables.bills');
    const toText = useErrorMessage();
    const [preset, setPreset] = useState<BillPreset>('open');
    const [creating, setCreating] = useState(false);
    const [selected, setSelected] = useState<string[]>([]);
    const [running, setRunning] = useState(false);
    const list = useSupplierBills(workspaceId, { status: BILL_PRESETS[preset].length > 0 ? [...BILL_PRESETS[preset]] : undefined });
    const rows = list.data ?? [];
    const selectable = canManage && (preset === 'open' || preset === 'approved');
    return (
        <SectionCard
            extra={(
                <div className="flex flex-wrap items-center gap-2">
                    <Select<BillPreset> value={preset} onChange={p => { setPreset(p); setSelected([]); }} className="min-w-[180px]"
                        options={(Object.keys(BILL_PRESETS) as BillPreset[]).map(k => ({ value: k, label: t(`filters.${k}`) }))} />
                    {selectable && (
                        <Button disabled={selected.length === 0} onClick={() => setRunning(true)}>{t('createRun', { count: selected.length })}</Button>
                    )}
                    {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>{t('new.button')}</Button>}
                </div>
            )}
        >
            {list.isError ? (
                <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`} action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
            ) : list.isLoading || workspaceId === undefined ? <Skeleton active /> : rows.length === 0 ? (
                <EmptyState title={t('empty.title')} hint={t('empty.hint')} />
            ) : (
                <BillsTable bills={rows} selection={selectable ? {
                    selectedRowKeys: selected,
                    onChange: keys => setSelected(keys as string[]),
                    getCheckboxProps: b => ({ disabled: b.status !== 'approved' || b.payable - b.paidAmount <= 0 }),
                } : undefined} />
            )}
            {creating && workspaceId !== undefined && <NewBillDialog workspaceId={workspaceId} onClose={() => setCreating(false)} />}
            {running && workspaceId !== undefined && <NewRunDialog workspaceId={workspaceId} billIds={selected} onClose={() => setRunning(false)} />}
        </SectionCard>
    );
}

function RunsTab({ workspaceId }: { workspaceId: string | undefined }) {
    const t = useTranslations('payables.runs');
    const toText = useErrorMessage();
    const [status, setStatus] = useState<PaymentRunStatus | 'all'>('all');
    const list = usePaymentRuns(workspaceId, status === 'all' ? [] : [status]);
    const rows = list.data ?? [];
    const columns: ColumnsType<PaymentRunSummaryDto> = [
        { key: 'date', title: t('columns.payDate'), render: (_, r) => <Link href={runHref(r.id)} className="font-medium"><DateText value={r.payDate} /></Link> },
        { key: 'status', title: t('columns.status'), render: (_, r) => <StatusTag enumName="paymentRunStatus" value={r.status} tones={RUN_STATUS_TONES} /> },
        { key: 'method', title: t('columns.method'), render: (_, r) => <StatusTag enumName="apPaymentMethod" value={r.method} /> },
        { key: 'count', title: t('columns.bills'), align: 'right', render: (_, r) => r.billCount },
        { key: 'wht', title: t('columns.wht'), align: 'right', render: (_, r) => <MoneyText value={r.totalWht} /> },
        { key: 'cash', title: t('columns.cash'), align: 'right', render: (_, r) => <MoneyText value={r.totalCash} className="font-semibold" /> },
    ];
    return (
        <SectionCard
            extra={(
                <Select<PaymentRunStatus | 'all'> value={status} onChange={setStatus} className="min-w-[180px]"
                    options={[{ value: 'all', label: t('filters.all') }, ...PAYMENT_RUN_STATUSES.map(s => ({ value: s, label: t(`filters.${s}`) }))]} />
            )}
        >
            {list.isError ? (
                <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(list.error)}`} action={<Button size="small" onClick={() => { void list.refetch(); }}>{t('retry')}</Button>} />
            ) : list.isLoading || workspaceId === undefined ? <Skeleton active /> : rows.length === 0 ? (
                <EmptyState title={t('empty.title')} hint={t('empty.hint')} />
            ) : (
                <Table<PaymentRunSummaryDto> size="small" rowKey="id" columns={columns} dataSource={rows}
                    pagination={rows.length > 20 ? { pageSize: 20, showSizeChanger: false } : false} scroll={{ x: 'max-content' }} />
            )}
        </SectionCard>
    );
}

export function PayablesPage() {
    const t = useTranslations('payables');
    const ws = useErpWorkspace();
    const canManage = can(ws.role, 'payables.manage');
    return (
        <ErpPage title={t('title')} subtitle={t('subtitle')}>
            <Tabs
                defaultActiveKey="due"
                items={[
                    { key: 'due', label: t('tabs.due'), children: <DueList workspaceId={ws.workspaceId} canManage={canManage} /> },
                    { key: 'bills', label: t('tabs.bills'), children: <BillsTab workspaceId={ws.workspaceId} canManage={canManage} /> },
                    { key: 'runs', label: t('tabs.runs'), children: <RunsTab workspaceId={ws.workspaceId} /> },
                ]}
            />
        </ErpPage>
    );
}
