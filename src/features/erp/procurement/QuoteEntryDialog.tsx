'use client';

// ─── Type in the prices a supplier sent for an RFQ (or mark the supplier as declined) ───
// A line left without a price is "not offered". Prices typed with VAT are split by the server.
import { useState } from 'react';
import { App, Button, Input, InputNumber, Modal, Switch } from 'antd';
import { useTranslations } from 'next-intl';
import type { FileDto, PutRfqQuoteRequest, RfqDto, RfqSupplierDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { FileAttachments } from '../shared/FileAttachments';
import { MoneyInput } from '../shared/MoneyInput';
import { QtyText } from '../shared/QtyText';
import { usePutRfqQuote } from './hooks';

const nameOf = (s: RfqSupplierDto): string => (s.nameTh !== '' ? s.nameTh : s.nameEn);

export function QuoteEntryDialog({ rfq, supplier, workspaceId, onClose }: {
    rfq: RfqDto;
    supplier: RfqSupplierDto;
    workspaceId: string | undefined;
    onClose: () => void;
}) {
    const t = useTranslations('procurement.quote');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const put = usePutRfqQuote(rfq.id);
    const existing = rfq.quotes.find(q => q.supplierId === supplier.supplierId);
    const [quoteRef, setQuoteRef] = useState(existing?.quoteRef ?? '');
    const [quoteDate, setQuoteDate] = useState(existing?.quoteDate ?? '');
    const [validUntil, setValidUntil] = useState(existing?.validUntil ?? '');
    const [includeVat, setIncludeVat] = useState(existing?.pricesIncludeVat ?? false);
    const [deliveryDays, setDeliveryDays] = useState<number | null>(existing?.deliveryDays ?? null);
    const [paymentTermDays, setPaymentTermDays] = useState<number | null>(existing?.paymentTermDays ?? null);
    const [note, setNote] = useState(existing?.note ?? '');
    const [files, setFiles] = useState<FileDto[]>(existing?.files ?? []);
    const [prices, setPrices] = useState<Record<string, number | null>>(() => {
        const offered = new Map((existing?.lines ?? []).filter(l => l.available).map(l => [l.rfqLineId, l.unitPrice]));
        return Object.fromEntries(rfq.lines.map(l => [l.id, offered.get(l.id) ?? null]));
    });

    const priced = rfq.lines.filter(l => prices[l.id] !== null && prices[l.id] !== undefined);

    const save = async (body: PutRfqQuoteRequest, done: string) => {
        try {
            await put.mutateAsync({ supplierId: supplier.supplierId, body });
            void message.success(done);
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    const submit = () => save({
        pricesIncludeVat: includeVat,
        quoteRef: quoteRef.trim(),
        quoteDate: quoteDate === '' ? null : quoteDate,
        validUntil: validUntil === '' ? null : validUntil,
        deliveryDays,
        paymentTermDays,
        note: note.trim(),
        fileIds: files.map(f => f.id),
        lines: priced.map(l => ({ rfqLineId: l.id, unitPrice: prices[l.id] ?? 0, available: true })),
    }, t('saved'));

    return (
        <Modal open width={760} title={t('title', { name: nameOf(supplier) })} onCancel={onClose} destroyOnHidden
            footer={(
                <div className="flex flex-wrap justify-between gap-2">
                    <Button danger loading={put.isPending} disabled={existing !== undefined}
                        onClick={() => { void save({ declined: true, pricesIncludeVat: false, lines: [] }, t('declined')); }}>{t('decline')}</Button>
                    <div className="flex gap-2">
                        <Button onClick={onClose}>{t('cancel')}</Button>
                        <Button type="primary" loading={put.isPending} disabled={priced.length === 0} onClick={() => { void submit(); }}>{t('save')}</Button>
                    </div>
                </div>
            )}>
            <div className="flex min-w-0 flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.quoteRef')}
                        <Input value={quoteRef} maxLength={100} onChange={e => setQuoteRef(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.quoteDate')}
                        <Input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.validUntil')}
                        <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.deliveryDays')}
                        <InputNumber<number> className="!w-full" min={0} max={3650} precision={0} value={deliveryDays} onChange={setDeliveryDays} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.paymentTermDays')}
                        <InputNumber<number> className="!w-full" min={0} max={3650} precision={0} value={paymentTermDays} onChange={setPaymentTermDays} />
                    </label>
                    <label className="flex items-center gap-2 self-end pb-1 text-[13px] text-gray-600">
                        <Switch checked={includeVat} onChange={setIncludeVat} />
                        {t('fields.pricesIncludeVat')}
                    </label>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-[13px] font-medium text-gray-700">{t('lines.title')}</div>
                    <div className="text-[12px] text-gray-500">{t('lines.hint')}</div>
                    {rfq.lines.map(l => (
                        <div key={l.id} className="flex min-w-0 flex-col gap-2 rounded-card border border-gray-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0 break-words text-[13px]">
                                <div>{l.descTh !== '' ? l.descTh : l.descEn}</div>
                                <div className="text-[12px] text-gray-500"><QtyText value={l.qty} unit={l.unit} /></div>
                            </div>
                            <div className="sm:w-[180px]">
                                <MoneyInput value={prices[l.id] ?? null} placeholder={t('lines.notOffered')}
                                    onChange={v => setPrices(p => ({ ...p, [l.id]: v }))} />
                            </div>
                        </div>
                    ))}
                </div>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.note')}
                    <Input.TextArea value={note} rows={2} maxLength={4000} onChange={e => setNote(e.target.value)} />
                </label>
                <div className="flex flex-col gap-1">
                    <div className="text-[13px] font-medium text-gray-700">{t('files')}</div>
                    <FileAttachments purpose="supplier_quote" workspaceId={workspaceId} value={files} onChange={setFiles} maxCount={20} />
                </div>
            </div>
        </Modal>
    );
}
