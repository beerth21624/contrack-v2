'use client';

// ─── /payables/runs/[runId]: a payment run — payees, bills, approve, pay (→ vouchers + 50 ทวิ), cancel ───
import { useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Input, Modal, Select, Skeleton, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckOutlined, DeleteOutlined, PrinterOutlined, SaveOutlined, WalletOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { AP_PAYMENT_METHODS, type ApPaymentMethod, type ApPaymentSummaryDto, type PaymentRunDto, type PaymentRunGroupDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { ErpPage } from '../shared/ErpPage';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { BillsTable } from './BillsTable';
import { useApproveRun, useCancelRun, usePatchRun, usePayRun, usePaymentRun } from './hooks';
import { RUN_STATUS_TONES, paymentVoucherPrintHref, whtCertificatePrintHref } from './status';

function PayDialog({ run, onClose }: { run: PaymentRunDto; onClose: () => void }) {
    const t = useTranslations('payables.run.pay');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const pay = usePayRun(run.id);
    const [payDate, setPayDate] = useState(run.payDate);
    const [bankRef, setBankRef] = useState('');
    const submit = async () => {
        try {
            await pay.mutateAsync({ payDate, bankRef: bankRef.trim() });
            void message.success(t('done'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <Modal open title={t('title')} okText={t('ok')} okButtonProps={{ disabled: payDate === '' }} confirmLoading={pay.isPending}
            onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                <Alert type="info" showIcon title={t('summary', { count: run.groups.length })} description={<span><MoneyText value={run.totalCash} currency /></span>} />
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('payDate')}
                    <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('bankRef')}
                    <Input value={bankRef} maxLength={120} onChange={e => setBankRef(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}

function DraftSettings({ run }: { run: PaymentRunDto }) {
    const t = useTranslations('payables.run.settings');
    const tm = useTranslations('enums.apPaymentMethod');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchRun(run.id);
    const [payDate, setPayDate] = useState(run.payDate);
    const [method, setMethod] = useState<ApPaymentMethod>(run.method);
    const [note, setNote] = useState(run.note);
    const dirty = payDate !== run.payDate || method !== run.method || note !== run.note;
    const save = async () => {
        try {
            await patch.mutateAsync({ payDate, method, note });
            void message.success(t('saved'));
        } catch (e) {
            void message.error(toText(e));
        }
    };
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('payDate')}
                <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('method')}
                <Select value={method} onChange={setMethod} options={AP_PAYMENT_METHODS.map(m => ({ value: m, label: tm(m) }))} />
            </label>
            <label className="flex flex-col gap-1 text-[13px] text-gray-600 sm:col-span-2">{t('note')}
                <Input.TextArea rows={2} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <div className="sm:col-span-2"><Button icon={<SaveOutlined />} disabled={!dirty || payDate === ''} loading={patch.isPending} onClick={() => { void save(); }}>{t('save')}</Button></div>
        </div>
    );
}

function Payments({ payments }: { payments: readonly ApPaymentSummaryDto[] }) {
    const t = useTranslations('payables.run.payments');
    const columns: ColumnsType<ApPaymentSummaryDto> = [
        { key: 'number', title: t('number'), render: (_, p) => <span className="font-mono">{p.number}</span> },
        { key: 'payee', title: t('payee'), render: (_, p) => <span className="break-words">{p.payeeName}</span> },
        { key: 'wht', title: t('wht'), align: 'right', render: (_, p) => <MoneyText value={p.whtAmount} /> },
        { key: 'cash', title: t('cash'), align: 'right', render: (_, p) => <MoneyText value={p.cashAmount} className="font-semibold" /> },
        {
            key: 'print', title: '', align: 'right',
            render: (_, p) => (
                <div className="flex flex-wrap justify-end gap-2">
                    <Link href={paymentVoucherPrintHref(p.id)} target="_blank"><Button size="small" icon={<PrinterOutlined />}>{t('voucher')}</Button></Link>
                    {p.whtCertificateId !== null && (
                        <Link href={whtCertificatePrintHref(p.whtCertificateId)} target="_blank">
                            <Button size="small" icon={<PrinterOutlined />}>{t('certificate')}{p.whtCertificateNumber !== null ? ` ${p.whtCertificateNumber}` : ''}</Button>
                        </Link>
                    )}
                </div>
            ),
        },
    ];
    return <Table<ApPaymentSummaryDto> size="small" rowKey="id" columns={columns} dataSource={[...payments]} pagination={false} scroll={{ x: 'max-content' }} />;
}

function Editor({ run }: { run: PaymentRunDto }) {
    const t = useTranslations('payables.run');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const patch = usePatchRun(run.id);
    const approve = useApproveRun(run.id);
    const cancel = useCancelRun(run.id);
    const [paying, setPaying] = useState(false);

    const groupColumns: ColumnsType<PaymentRunGroupDto> = [
        { key: 'payee', title: t('groups.payee'), render: (_, g) => <span className="break-words">{g.payeeName}</span> },
        { key: 'bills', title: t('groups.bills'), align: 'right', render: (_, g) => g.billIds.length },
        { key: 'wht', title: t('groups.wht'), align: 'right', render: (_, g) => <MoneyText value={g.wht} /> },
        { key: 'cash', title: t('groups.cash'), align: 'right', render: (_, g) => <MoneyText value={g.cash} className="font-semibold" /> },
    ];

    const onApprove = async () => {
        try {
            const r = await approve.mutateAsync();
            void message.success(r.status === 'approved' ? t('approved') : t('submitted'));
        } catch (e) {
            void message.error(toText(e));
        }
    };
    const removeBill = async (billId: string) => {
        try {
            await patch.mutateAsync({ billIds: run.billIds.filter(id => id !== billId) });
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <ErpPage
            title={(
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="min-w-0 break-words">{t('title')}</span>
                    <StatusTag enumName="paymentRunStatus" value={run.status} tones={RUN_STATUS_TONES} />
                </span>
            )}
            subtitle={<span><DateText value={run.payDate} /> · <StatusTag enumName="apPaymentMethod" value={run.method} /></span>}
            breadcrumb={[{ label: t('breadcrumb'), href: '/payables' }, { label: t('title') }]}
            extra={(
                <>
                    {run.canCancel && (
                        <ConfirmAction danger title={t('cancel.confirm')} content={t('cancel.hint')}
                            onConfirm={async () => { await cancel.mutateAsync({}); void message.success(t('cancel.done')); }}>{t('cancel.button')}</ConfirmAction>
                    )}
                    {run.canApprove && (
                        <Button type="primary" icon={<CheckOutlined />} loading={approve.isPending} disabled={run.billCount === 0} onClick={() => { void onApprove(); }}>{t('approve')}</Button>
                    )}
                    {run.canPay && <Button type="primary" icon={<WalletOutlined />} onClick={() => setPaying(true)}>{t('pay.button')}</Button>}
                </>
            )}
        >
            {run.status === 'pending_approval' && <Alert type="info" showIcon title={t('pendingHint')} />}
            {run.status === 'cancelled' && <Alert type="warning" showIcon title={t('cancelledHint')} />}
            <SectionCard title={t('totals.title')}>
                <div className="flex flex-wrap gap-8">
                    <div className="flex flex-col"><span className="text-[12px] text-gray-500">{t('totals.bills')}</span><span className="text-[20px] font-semibold">{run.billCount}</span></div>
                    <div className="flex flex-col"><span className="text-[12px] text-gray-500">{t('totals.wht')}</span><MoneyText value={run.totalWht} className="text-[20px] font-semibold" /></div>
                    <div className="flex flex-col"><span className="text-[12px] text-gray-500">{t('totals.cash')}</span><MoneyText value={run.totalCash} className="text-[20px] font-semibold" /></div>
                </div>
                {run.note !== '' && run.status !== 'draft' && <div className="mt-3 whitespace-pre-wrap text-[13px] text-gray-600">{run.note}</div>}
            </SectionCard>
            {run.status === 'draft' && run.canEdit && (
                <SectionCard title={t('settings.title')}><DraftSettings run={run} /></SectionCard>
            )}
            {run.status === 'paid' && run.payments.length > 0 && (
                <SectionCard title={t('payments.title')}><Payments payments={run.payments} /></SectionCard>
            )}
            <SectionCard title={t('groups.title')}>
                <Table<PaymentRunGroupDto> size="small" rowKey={g => `${g.supplierId ?? 'labour'}:${g.billIds.join(',')}`} columns={groupColumns} dataSource={run.groups}
                    pagination={false} scroll={{ x: 'max-content' }} />
            </SectionCard>
            <SectionCard title={t('bills.title')}>
                <BillsTable bills={run.bills} actions={run.status === 'draft' && run.canEdit ? (b => (
                    <Button size="small" danger type="text" icon={<DeleteOutlined />} aria-label={t('bills.remove')} loading={patch.isPending}
                        disabled={run.bills.length <= 1} onClick={() => { void removeBill(b.id); }} />
                )) : undefined} />
            </SectionCard>
            {paying && <PayDialog run={run} onClose={() => setPaying(false)} />}
        </ErpPage>
    );
}

export function PaymentRunPage({ runId }: { runId: string }) {
    const t = useTranslations('payables.run');
    const toText = useErrorMessage();
    const q = usePaymentRun(runId);
    if (q.isError) {
        return (
            <Alert type="error" showIcon title={`${t('loadFailed')}: ${toText(q.error)}`}
                action={<Button size="small" onClick={() => { void q.refetch(); }}>{t('retry')}</Button>} />
        );
    }
    if (q.data === undefined) return <Skeleton active />;
    return <Editor key={`${q.data.id}:${q.data.status}`} run={q.data} />;
}
