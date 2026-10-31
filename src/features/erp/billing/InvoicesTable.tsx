'use client';

// ─── Invoices, tax invoices and credit notes of a project, with the actions on each ───
import { useState } from 'react';
import { App, Button, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslations } from 'next-intl';
import { can, type InvoiceDto, type Role } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { ConfirmAction } from '../shared/ConfirmAction';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { SectionCard } from '../shared/SectionCard';
import { StatusTag } from '../shared/StatusTag';
import { ReasonDialog } from './ReasonDialog';
import { ReceiveDialog } from './ReceiveDialog';
import { useCreateCreditNote, useIssueInvoice, useIssueTaxInvoice, useProjectInvoices, useVoidInvoice } from './hooks';
import { INVOICE_STATUS_TONES, invoicePrintHref, isReceivableKind } from './status';

type Dialog = { kind: 'receive' | 'void' | 'credit'; invoice: InvoiceDto } | null;

export function InvoicesTable({ projectId, workspaceId, role }: { projectId: string; workspaceId: string | undefined; role: Role | undefined }) {
    const t = useTranslations('billing');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const q = useProjectInvoices(projectId);
    const issue = useIssueInvoice();
    const voidInv = useVoidInvoice();
    const taxInvoice = useIssueTaxInvoice();
    const creditNote = useCreateCreditNote();
    const [dialog, setDialog] = useState<Dialog>(null);
    const [creditAmount, setCreditAmount] = useState(0);
    const canManage = can(role, 'billing.manage');
    const canReceive = can(role, 'billing.receive');

    const columns: ColumnsType<InvoiceDto> = [
        { key: 'number', title: t('fields.number'), render: (_, i) => <DocumentNumberTag number={i.number} /> },
        { key: 'kind', title: t('fields.kind'), render: (_, i) => te(`invoiceKind.${i.kind}`) },
        { key: 'status', title: t('fields.status'), render: (_, i) => <StatusTag enumName="invoiceStatus" value={i.status} tones={INVOICE_STATUS_TONES} /> },
        { key: 'issue', title: t('fields.issueDate'), render: (_, i) => <DateText value={i.issueDate} /> },
        { key: 'due', title: t('fields.dueDate'), render: (_, i) => (isReceivableKind(i.kind) ? <DateText value={i.dueDate} /> : '–') },
        { key: 'net', title: t('fields.net'), align: 'right', render: (_, i) => <MoneyText value={i.net} /> },
        { key: 'vat', title: t('fields.vat'), align: 'right', render: (_, i) => <MoneyText value={i.vat} /> },
        { key: 'payable', title: t('fields.payable'), align: 'right', render: (_, i) => (isReceivableKind(i.kind) ? <MoneyText value={i.payable} /> : '–') },
        { key: 'paid', title: t('fields.paid'), align: 'right', render: (_, i) => (isReceivableKind(i.kind) ? <MoneyText value={i.paidAmount} /> : '–') },
        {
            key: 'actions', title: '',
            render: (_, i) => {
                const receivable = isReceivableKind(i.kind);
                const open = i.status === 'issued' || i.status === 'partially_paid';
                return (
                    <div className="flex flex-wrap gap-1">
                        <Button size="small" href={invoicePrintHref(i.id)} target="_blank" rel="noopener noreferrer">{t('print.print')}</Button>
                        {canManage && i.status === 'draft' && (
                            <ConfirmAction size="small" type="primary" title={t('invoices.issueConfirm')}
                                onConfirm={async () => { await issue.mutateAsync({ id: i.id, body: {} }); void message.success(t('invoices.issued')); }}>
                                {t('invoices.issue')}
                            </ConfirmAction>
                        )}
                        {canReceive && receivable && open && (
                            <Button size="small" type="primary" onClick={() => setDialog({ kind: 'receive', invoice: i })}>{t('invoices.receive')}</Button>
                        )}
                        {canReceive && receivable && open && i.source !== 'retention_release' && (
                            <ConfirmAction size="small" title={t('invoices.taxInvoiceConfirm')}
                                onConfirm={async () => { await taxInvoice.mutateAsync({ id: i.id, body: {} }); void message.success(t('invoices.taxInvoiceDone')); }}>
                                {t('invoices.taxInvoice')}
                            </ConfirmAction>
                        )}
                        {canReceive && i.kind === 'tax_invoice' && i.status === 'issued' && (
                            <Button size="small" onClick={() => { setCreditAmount(0); setDialog({ kind: 'credit', invoice: i }); }}>{t('invoices.creditNote')}</Button>
                        )}
                        {canManage && receivable && i.status === 'issued' && (
                            <Button size="small" danger onClick={() => setDialog({ kind: 'void', invoice: i })}>{t('invoices.void')}</Button>
                        )}
                    </div>
                );
            },
        },
    ];

    return (
        <SectionCard title={t('invoices.title')}>
            {q.isError && <div className="mb-2 text-red-600">{t('loadFailed')}: {toText(q.error)}</div>}
            <Table<InvoiceDto> size="small" rowKey="id" columns={columns} dataSource={q.data ?? []} loading={q.isLoading} pagination={false}
                scroll={{ x: 'max-content' }} locale={{ emptyText: t('invoices.empty') }} />
            {dialog?.kind === 'receive' && <ReceiveDialog invoice={dialog.invoice} workspaceId={workspaceId} onClose={() => setDialog(null)} />}
            {dialog?.kind === 'void' && (
                <ReasonDialog danger title={t('invoices.voidTitle')} hint={t('invoices.voidHint')} okText={t('invoices.void')} onClose={() => setDialog(null)}
                    onSubmit={async reason => { await voidInv.mutateAsync({ id: dialog.invoice.id, body: { reason } }); void message.success(t('invoices.voided')); }} />
            )}
            {dialog?.kind === 'credit' && (
                <ReasonDialog title={t('invoices.creditTitle')} hint={t('invoices.creditHint')} okText={t('invoices.creditNote')} onClose={() => setDialog(null)}
                    extraValid={creditAmount > 0}
                    extra={(
                        <label className="mb-3 flex flex-col gap-1 text-[13px] text-gray-600">{t('invoices.creditAmount')}
                            <MoneyInput value={creditAmount} onChange={x => setCreditAmount(x ?? 0)} />
                        </label>
                    )}
                    onSubmit={async reason => { await creditNote.mutateAsync({ id: dialog.invoice.id, body: { amount: creditAmount, reason } }); void message.success(t('invoices.creditDone')); }} />
            )}
        </SectionCard>
    );
}
