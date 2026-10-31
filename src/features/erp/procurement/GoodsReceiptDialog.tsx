'use client';

// ─── Record a delivery against a PO: quantity received / rejected per line, condition, photos of the delivery note ───
// One form: the receipt is saved and confirmed together (the cost moves from committed to actual).
// Photos: `<input capture="environment">` opens the phone camera; the date taken comes from File.lastModified.
import { useRef, useState } from 'react';
import { App, Button, Input, Modal, Select } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import {
    ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, RECEIPT_CONDITIONS, type CreateGoodsReceiptRequest, type FileDto, type FilePurpose, type PurchaseOrderDto, type ReceiptCondition,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { QtyInput } from '../shared/QtyInput';
import { QtyText } from '../shared/QtyText';
import { uploadErpFile, uploadProblem } from '../shared/files';
import { useReceiveGoods } from './hooks';

interface Photo {
    file: FileDto;
    takenAt: string;
}

function PhotoField({ purpose, workspaceId, label, value, onChange }: {
    purpose: FilePurpose;
    workspaceId: string | undefined;
    label: string;
    value: readonly Photo[];
    onChange: (photos: readonly Photo[]) => void;
}) {
    const t = useTranslations('procurement.receipt');
    const tf = useTranslations('erp.files');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(0);
    const latest = useRef(value);
    latest.current = value;

    const add = async (files: FileList | null) => {
        if (files === null || workspaceId === undefined) return;
        for (const file of Array.from(files)) {
            const problem = uploadProblem(file);
            if (problem !== null) {
                void message.error(problem === 'tooLarge' ? tf('tooLarge', { mb: MAX_FILE_BYTES / 1024 / 1024 }) : tf('badType'));
                continue;
            }
            setBusy(n => n + 1);
            try {
                const dto = await uploadErpFile(file, purpose, workspaceId);
                latest.current = [...latest.current, { file: dto, takenAt: new Date(file.lastModified > 0 ? file.lastModified : Date.now()).toISOString() }];
                onChange(latest.current);
            } catch (e) {
                void message.error(toText(e));
            } finally {
                setBusy(n => n - 1);
            }
        }
        if (input.current !== null) input.current.value = '';
    };

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <div className="text-[13px] font-medium text-gray-700">{label}</div>
            {value.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {value.map(p => (
                        <li key={p.file.id} className="flex min-w-0 items-center gap-2 text-[13px]">
                            <a href={p.file.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate">{p.file.name}</a>
                            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('removePhoto')}
                                onClick={() => onChange(latest.current.filter(x => x.file.id !== p.file.id))} />
                        </li>
                    ))}
                </ul>
            )}
            <input ref={input} type="file" hidden multiple accept={ALLOWED_CONTENT_TYPES.filter(c => c.startsWith('image/')).join(',')} capture="environment"
                onChange={e => { void add(e.target.files); }} />
            <div>
                <Button icon={<CameraOutlined />} loading={busy > 0} disabled={workspaceId === undefined} onClick={() => input.current?.click()}>{t('takePhoto')}</Button>
            </div>
        </div>
    );
}

interface LineState {
    received: number | null;
    rejected: number | null;
    condition: ReceiptCondition | null;
    note: string;
}

const BLANK_LINE: LineState = { received: null, rejected: null, condition: null, note: '' };

export function GoodsReceiptDialog({ order, workspaceId, onClose }: { order: PurchaseOrderDto; workspaceId: string | undefined; onClose: () => void }) {
    const t = useTranslations('procurement.receipt');
    const te = useTranslations('enums.receiptCondition');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const receive = useReceiveGoods(order.id, order.projectId);
    const open = order.lines.filter(l => l.qty - l.receivedQty > 0);
    const [lines, setLines] = useState<Record<string, LineState>>(
        () => Object.fromEntries(open.map(l => [l.id, { received: l.qty - l.receivedQty, rejected: 0, condition: null, note: '' }])),
    );
    const [noteNo, setNoteNo] = useState('');
    const [date, setDate] = useState('');
    const [note, setNote] = useState('');
    const [deliveryPhotos, setDeliveryPhotos] = useState<readonly Photo[]>([]);
    const [goodsPhotos, setGoodsPhotos] = useState<readonly Photo[]>([]);

    const set = (id: string, p: Partial<LineState>) => setLines(s => ({ ...s, [id]: { ...(s[id] ?? BLANK_LINE), ...p } }));
    const entered = open.filter(l => (lines[l.id]?.received ?? 0) > 0 || (lines[l.id]?.rejected ?? 0) > 0);
    const over = open.some(l => (lines[l.id]?.received ?? 0) > l.qty - l.receivedQty + 1e-9);
    const valid = entered.length > 0 && !over;

    const submit = async () => {
        const body: CreateGoodsReceiptRequest = {
            ...(date !== '' ? { receivedDate: date } : {}),
            deliveryNoteNo: noteNo.trim(),
            note: note.trim(),
            photos: [
                ...deliveryPhotos.map(p => ({ fileId: p.file.id, takenAt: p.takenAt, caption: t('deliveryNote') })),
                ...goodsPhotos.map(p => ({ fileId: p.file.id, takenAt: p.takenAt, caption: '' })),
            ],
            lines: entered.map(l => {
                const s = lines[l.id] ?? BLANK_LINE;
                return {
                    orderLineId: l.id,
                    qtyReceived: s.received ?? 0,
                    qtyRejected: s.rejected ?? 0,
                    ...(s.condition !== null ? { condition: s.condition } : {}),
                    ...(s.note.trim() !== '' ? { note: s.note.trim() } : {}),
                };
            }),
        };
        try {
            await receive.mutateAsync(body);
            void message.success(t('done'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open width={760} title={t('title', { number: order.number ?? '' })} onCancel={onClose} destroyOnHidden
            okText={t('confirm')} okButtonProps={{ disabled: !valid }} confirmLoading={receive.isPending} onOk={() => { void submit(); }}>
            <div className="flex min-w-0 flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.deliveryNoteNo')}
                        <Input value={noteNo} maxLength={100} onChange={e => setNoteNo(e.target.value)} />
                    </label>
                    <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                        {t('fields.receivedDate')}
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </label>
                </div>
                <div className="flex flex-col gap-2">
                    {open.map(l => {
                        const s = lines[l.id] ?? BLANK_LINE;
                        const remaining = l.qty - l.receivedQty;
                        return (
                            <div key={l.id} className="flex min-w-0 flex-col gap-2 rounded-card border border-gray-200 p-3">
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                    <span className="min-w-0 break-words font-medium">{l.descTh !== '' ? l.descTh : l.descEn}</span>
                                    <span className="text-[12px] text-gray-500">
                                        {t('lines.remaining')} <QtyText value={remaining} unit={l.unit} />
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                    <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                                        {t('lines.received')}
                                        <QtyInput value={s.received} status={(s.received ?? 0) > remaining + 1e-9 ? 'error' : undefined} onChange={v => set(l.id, { received: v })} />
                                    </label>
                                    <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                                        {t('lines.rejected')}
                                        <QtyInput value={s.rejected} onChange={v => set(l.id, { rejected: v })} />
                                    </label>
                                    <label className="col-span-2 flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-1">
                                        {t('lines.condition')}
                                        <Select<ReceiptCondition | undefined> value={s.condition ?? undefined} allowClear placeholder={t('lines.conditionAuto')}
                                            options={RECEIPT_CONDITIONS.map(c => ({ value: c, label: te(c) }))}
                                            onChange={v => set(l.id, { condition: v ?? null })} />
                                    </label>
                                </div>
                                {((s.rejected ?? 0) > 0 || (s.condition !== null && s.condition !== 'ok')) && (
                                    <Input value={s.note} maxLength={1000} placeholder={t('lines.notePlaceholder')} onChange={e => set(l.id, { note: e.target.value })} />
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <PhotoField purpose="delivery_note_photo" workspaceId={workspaceId} label={t('photos.deliveryNote')} value={deliveryPhotos} onChange={setDeliveryPhotos} />
                    <PhotoField purpose="goods_photo" workspaceId={workspaceId} label={t('photos.goods')} value={goodsPhotos} onChange={setGoodsPhotos} />
                </div>
                <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                    {t('fields.note')}
                    <Input.TextArea value={note} rows={2} maxLength={4000} onChange={e => setNote(e.target.value)} />
                </label>
            </div>
        </Modal>
    );
}
