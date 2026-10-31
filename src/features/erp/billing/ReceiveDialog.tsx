'use client';

// ─── Record a receipt for one invoice: cash + the WHT the customer withheld, slip, WHT certificate ───
import { useState } from 'react';
import { Alert, App, Button, Input, Modal, Select } from 'antd';
import { useTranslations } from 'next-intl';
import { RECEIPT_METHODS, type FileDto, type InvoiceDto, type ReceiptDto, type ReceiptMethod } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { FileAttachments } from '../shared/FileAttachments';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { useRecordReceipt, useVoidReceipt } from './hooks';
import { receiptPrintHref, round2 } from './status';

/** What is still due on an invoice (cash + WHT). */
export const invoiceOutstanding = (inv: Pick<InvoiceDto, 'payable' | 'whtExpected' | 'paidAmount'>): number =>
    Math.max(0, round2(inv.payable + inv.whtExpected - inv.paidAmount));

export function ReceiveDialog({ invoice, workspaceId, onClose }: { invoice: InvoiceDto; workspaceId: string | undefined; onClose: () => void }) {
    const t = useTranslations('billing');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const record = useRecordReceipt(workspaceId);
    const voidMutation = useVoidReceipt();
    const due = invoiceOutstanding(invoice);
    const totalDue = invoice.payable + invoice.whtExpected;
    // The share of WHT in what is left, in proportion to the invoice.
    const defaultWht = totalDue > 0 ? round2(due * invoice.whtExpected / totalDue) : 0;

    const [cash, setCash] = useState(round2(due - defaultWht));
    const [wht, setWht] = useState(defaultWht);
    const [method, setMethod] = useState<ReceiptMethod>('transfer');
    const [receiptDate, setReceiptDate] = useState('');
    const [bankRef, setBankRef] = useState('');
    const [certNo, setCertNo] = useState('');
    const [slips, setSlips] = useState<FileDto[]>([]);
    const [certFiles, setCertFiles] = useState<FileDto[]>([]);
    const [done, setDone] = useState<ReceiptDto | null>(null);
    const [voiding, setVoiding] = useState(false);

    const settled = round2(cash + wht);
    const invalid = settled <= 0 || settled > due + 0.005;

    const submit = async () => {
        try {
            const res = await record.mutateAsync({
                method,
                ...(receiptDate !== '' ? { receiptDate } : {}),
                ...(bankRef.trim() !== '' ? { bankRef: bankRef.trim() } : {}),
                allocations: [{ invoiceId: invoice.id, cash, wht }],
                ...(certNo.trim() !== '' ? { whtCertificateNo: certNo.trim() } : {}),
                ...(certFiles[0] !== undefined ? { whtCertificateFileId: certFiles[0].id } : {}),
                ...(slips.length > 0 ? { fileIds: slips.map(f => f.id) } : {}),
            });
            void message.success(t('receive.done', { number: res.number }));
            setDone(res);
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const voidReceipt = async (receipt: ReceiptDto) => {
        setVoiding(true);
        try {
            await voidMutation.mutateAsync({ id: receipt.id, body: { reason: t('receive.voidReason') } });
            void message.success(t('receive.voided'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setVoiding(false);
        }
    };

    if (done !== null) {
        return (
            <Modal open title={t('receive.title')} onCancel={onClose} destroyOnHidden
                footer={(
                    <div className="flex flex-wrap justify-end gap-2">
                        {done.canVoid && <Button danger loading={voiding} onClick={() => { void voidReceipt(done); }}>{t('receive.voidNow')}</Button>}
                        <Button href={receiptPrintHref(done.id)} target="_blank" rel="noopener noreferrer">{t('print.receipt')}</Button>
                        <Button type="primary" onClick={onClose}>{t('receive.close')}</Button>
                    </div>
                )}>
                <Alert type="success" showIcon title={t('receive.done', { number: done.number })} />
                <div className="mt-3 flex flex-col gap-1 text-[13px]">
                    <div>{t('receive.cash')}: <MoneyText value={done.cashAmount} /></div>
                    <div>{t('receive.wht')}: <MoneyText value={done.whtAmount} /></div>
                    {done.taxInvoices.map(ti => (
                        <div key={ti.id}>{t('receive.taxInvoice')}: <DocumentNumberTag number={ti.number} /></div>
                    ))}
                </div>
            </Modal>
        );
    }

    return (
        <Modal open title={t('receive.title')} onCancel={onClose} okText={t('receive.submit')} confirmLoading={record.isPending}
            okButtonProps={{ disabled: invalid || workspaceId === undefined }} onOk={() => { void submit(); }} destroyOnHidden width={640}>
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
                <DocumentNumberTag number={invoice.number} />
                <span>{t('receive.due')}: <MoneyText value={due} currency /></span>
                {invoice.whtExpected > 0 && <span className="text-gray-500">{t('receive.whtExpected')}: <MoneyText value={invoice.whtExpected} /></span>}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('receive.cash')}
                    <MoneyInput value={cash} onChange={x => setCash(x ?? 0)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('receive.wht')}
                    <MoneyInput value={wht} onChange={x => setWht(x ?? 0)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('receive.method')}
                    <Select value={method} onChange={setMethod} options={RECEIPT_METHODS.map(m => ({ value: m, label: te(`paymentMethod.${m}`) }))} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('receive.date')}
                    <Input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('receive.bankRef')}
                    <Input value={bankRef} maxLength={200} onChange={e => setBankRef(e.target.value)} />
                </label>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">{t('receive.certNo')}
                    <Input value={certNo} maxLength={100} onChange={e => setCertNo(e.target.value)} />
                </label>
            </div>
            {invalid && settled > 0 && <div className="mt-2 text-[13px] text-red-600">{t('receive.exceeds')}</div>}
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                    <div className="mb-1 text-[13px] text-gray-600">{t('receive.slip')}</div>
                    <FileAttachments purpose="payment_slip" workspaceId={workspaceId} value={slips} onChange={setSlips} maxCount={5} />
                </div>
                <div>
                    <div className="mb-1 text-[13px] text-gray-600">{t('receive.certFile')}</div>
                    <FileAttachments purpose="customer_wht_certificate" workspaceId={workspaceId} value={certFiles} onChange={setCertFiles} maxCount={1} />
                </div>
            </div>
        </Modal>
    );
}
