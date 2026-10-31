'use client';

// ─── A purchase request in a dialog: short site form (items, quantity, date needed) or the review of a saved one ───
// New: save a draft, or submit at once. A saved draft: edit the lines, then submit (budget warnings need a reason).
// Anything else (waiting for approval, approved, …) is read-only with the budget warnings and "cancel request".
import { useState } from 'react';
import { App, Button, Input, Modal, Skeleton } from 'antd';
import { DeleteOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { can, type CostCodeDto, type PurchaseRequestDto, type PurchaseRequestLineInput } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useHubProject } from '../hub/hooks';
import { ConfirmAction } from '../shared/ConfirmAction';
import { CostCodePicker } from '../shared/CostCodePicker';
import { DateText } from '../shared/DateText';
import { DocumentNumberTag } from '../shared/DocumentNumberTag';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { QtyInput } from '../shared/QtyInput';
import { QtyText } from '../shared/QtyText';
import { StatusTag } from '../shared/StatusTag';
import { useErpWorkspace } from '../shared/useErpWorkspace';
import { procurementApi } from './api';
import { BudgetWarnings } from './BudgetWarnings';
import { useAfterRequestChange, useCancelPurchaseRequest, usePurchaseRequest } from './hooks';
import { REQUEST_STATUS_TONES } from './status';

interface LineForm {
    key: string;
    costCodeId: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qty: number | null;
    estUnitPrice: number;
    note: string;
}

let lineSeq = 0;
const blankLine = (): LineForm => ({ key: `n${++lineSeq}`, costCodeId: null, descTh: '', descEn: '', unit: '', qty: null, estUnitPrice: 0, note: '' });

const linesOf = (r: PurchaseRequestDto | undefined): LineForm[] =>
    r === undefined || r.lines.length === 0
        ? [blankLine()]
        : r.lines.map(l => ({
            key: l.id, costCodeId: l.costCodeId, descTh: l.descTh, descEn: l.descEn, unit: l.unit, qty: l.qty, estUnitPrice: l.estUnitPrice, note: l.note,
        }));

const lineValid = (l: LineForm): boolean => (l.qty ?? 0) > 0 && (l.costCodeId !== null || l.descTh.trim() !== '');

function toInputs(lines: readonly LineForm[]): PurchaseRequestLineInput[] {
    return lines.map(l => ({
        costCodeId: l.costCodeId,
        descTh: l.descTh.trim(),
        descEn: l.descEn.trim(),
        unit: l.unit.trim(),
        qty: l.qty ?? 0,
        estUnitPrice: l.estUnitPrice,
        note: l.note.trim(),
    }));
}

function LineEditor({ projectId, line, canRemove, onChange, onRemove }: {
    projectId: string;
    line: LineForm;
    canRemove: boolean;
    onChange: (p: Partial<LineForm>) => void;
    onRemove: () => void;
}) {
    const t = useTranslations('procurement.editor');
    const fromCode = (id: string | null, code: CostCodeDto | undefined) => {
        if (id === null || code === undefined) { onChange({ costCodeId: null }); return; }
        onChange({
            costCodeId: id,
            ...(line.descTh.trim() === '' ? { descTh: code.descTh, descEn: code.descEn } : {}),
            ...(line.unit.trim() === '' ? { unit: code.unit } : {}),
            ...(line.estUnitPrice === 0 && code.baselineMatUnit !== null ? { estUnitPrice: code.baselineMatUnit } : {}),
        });
    };
    return (
        <div className="flex min-w-0 flex-col gap-2 rounded-card border border-gray-200 p-3">
            <div className="flex items-start gap-2">
                <Input value={line.descTh} maxLength={500} placeholder={t('lines.descPlaceholder')} aria-label={t('lines.desc')}
                    status={line.costCodeId === null && line.descTh.trim() === '' ? 'error' : undefined} onChange={e => onChange({ descTh: e.target.value })} />
                {canRemove && <Button type="text" danger icon={<DeleteOutlined />} aria-label={t('lines.remove')} onClick={onRemove} />}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                    {t('lines.qty')}
                    <QtyInput value={line.qty} status={(line.qty ?? 0) > 0 ? undefined : 'error'} onChange={v => onChange({ qty: v })} />
                </label>
                <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                    {t('lines.unit')}
                    <Input value={line.unit} maxLength={40} onChange={e => onChange({ unit: e.target.value })} />
                </label>
                <label className="col-span-2 flex flex-col gap-1 text-[12px] text-gray-500 sm:col-span-1">
                    {t('lines.estUnitPrice')}
                    <MoneyInput value={line.estUnitPrice} onChange={v => onChange({ estUnitPrice: v ?? 0 })} />
                </label>
            </div>
            <label className="flex flex-col gap-1 text-[12px] text-gray-500">
                {t('lines.costCode')}
                <CostCodePicker projectId={projectId} value={line.costCodeId} onChange={fromCode} />
            </label>
        </div>
    );
}

function ReadOnlyBody({ request }: { request: PurchaseRequestDto }) {
    const t = useTranslations('procurement.editor');
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
                <div className="flex flex-col"><span className="text-gray-500">{t('fields.number')}</span><DocumentNumberTag number={request.number} /></div>
                <div className="flex flex-col"><span className="text-gray-500">{t('fields.status')}</span>
                    <span><StatusTag enumName="purchaseRequestStatus" value={request.status} tones={REQUEST_STATUS_TONES} /></span></div>
                <div className="flex flex-col"><span className="text-gray-500">{t('fields.requiredDate')}</span><DateText value={request.requiredDate} /></div>
                <div className="flex flex-col"><span className="text-gray-500">{t('fields.estTotal')}</span><MoneyText value={request.estTotal} className="font-semibold" /></div>
            </div>
            {request.note !== '' && <div className="break-words text-[13px]">{request.note}</div>}
            <BudgetWarnings warnings={request.budgetWarnings} reason={request.overrideReason} readOnly />
            <div className="flex flex-col gap-2">
                {request.lines.map(l => (
                    <div key={l.id} className="flex min-w-0 items-start justify-between gap-3 rounded-card border border-gray-200 p-3 text-[13px]">
                        <div className="min-w-0 break-words">
                            <div>{l.descTh !== '' ? l.descTh : l.descEn}</div>
                            {l.costCode !== null && <div className="text-[12px] text-gray-500">{l.costCode}</div>}
                        </div>
                        <div className="shrink-0 text-right">
                            <QtyText value={l.qty} unit={l.unit} />
                            <div className="text-[12px] text-gray-500"><MoneyText value={l.estAmount} /></div>
                            {l.orderedQty > 0 && <div className="text-[12px] text-gray-500">{t('lines.ordered')} <QtyText value={l.orderedQty} unit={l.unit} /></div>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function EditBody({ projectId, request, onCreated, onClose }: {
    projectId: string;
    request: PurchaseRequestDto | undefined;
    onCreated: (id: string) => void;
    onClose: () => void;
}) {
    const t = useTranslations('procurement.editor');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const after = useAfterRequestChange();
    const [lines, setLines] = useState<LineForm[]>(() => linesOf(request));
    const [requiredDate, setRequiredDate] = useState(request?.requiredDate ?? '');
    const [note, setNote] = useState(request?.note ?? '');
    const [reason, setReason] = useState(request?.overrideReason ?? '');
    const [busy, setBusy] = useState<'save' | 'submit' | null>(null);

    const valid = lines.length > 0 && lines.every(lineValid);
    const set = (key: string, p: Partial<LineForm>) => setLines(ls => ls.map(l => (l.key === key ? { ...l, ...p } : l)));

    /** Create the request, or write the form into the saved draft. */
    const save = async (): Promise<PurchaseRequestDto> => {
        const r = request === undefined
            ? await procurementApi.createRequest(projectId, {
                source: 'site', requiredDate: requiredDate === '' ? null : requiredDate, note: note.trim(), lines: toInputs(lines),
            })
            : await procurementApi.patchRequest(request.id, {
                requiredDate: requiredDate === '' ? null : requiredDate, note: note.trim(), overrideReason: reason.trim(), lines: toInputs(lines),
            });
        after(r);
        return r;
    };

    const run = async (mode: 'save' | 'submit') => {
        setBusy(mode);
        let saved: PurchaseRequestDto | undefined;
        try {
            saved = await save();
            if (mode === 'save') {
                void message.success(t('saved'));
                onClose();
                return;
            }
            const done = await procurementApi.submitRequest(saved.id, { overrideReason: reason.trim() });
            after(done, true);
            void message.success(done.status === 'approved' ? t('submittedApproved') : t('submitted'));
            onClose();
        } catch (e) {
            void message.error(toText(e));
            // A new request that was created but not submitted (budget warnings): carry on with it as a saved draft.
            if (request === undefined && saved !== undefined) onCreated(saved.id);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <label className="flex flex-col gap-1 text-[13px] text-gray-600 sm:max-w-[240px]">
                {t('fields.requiredDate')}
                <Input type="date" value={requiredDate} onChange={e => setRequiredDate(e.target.value)} />
            </label>
            <div className="flex flex-col gap-2">
                <div className="text-[13px] font-medium text-gray-700">{t('lines.title')}</div>
                {lines.map(l => (
                    <LineEditor key={l.key} projectId={projectId} line={l} canRemove={lines.length > 1}
                        onChange={p => set(l.key, p)} onRemove={() => setLines(ls => ls.filter(x => x.key !== l.key))} />
                ))}
                <div><Button icon={<PlusOutlined />} onClick={() => setLines(ls => [...ls, blankLine()])}>{t('lines.add')}</Button></div>
            </div>
            <label className="flex flex-col gap-1 text-[13px] text-gray-600">
                {t('fields.note')}
                <Input.TextArea value={note} rows={2} maxLength={4000} onChange={e => setNote(e.target.value)} />
            </label>
            {request !== undefined && <BudgetWarnings warnings={request.budgetWarnings} reason={reason} onReasonChange={setReason} />}
            <div className="flex flex-wrap justify-end gap-2">
                <Button onClick={onClose}>{t('close')}</Button>
                <Button disabled={!valid || busy === 'submit'} loading={busy === 'save'} onClick={() => { void run('save'); }}>{t('saveDraft')}</Button>
                <Button type="primary" icon={<SendOutlined />} disabled={!valid || busy === 'save'} loading={busy === 'submit'}
                    onClick={() => { void run('submit'); }}>{t('submit')}</Button>
            </div>
        </div>
    );
}

function CancelButton({ request, onDone }: { request: PurchaseRequestDto; onDone: () => void }) {
    const t = useTranslations('procurement.editor');
    const cancel = useCancelPurchaseRequest(request.id);
    return (
        <ConfirmAction danger title={t('cancelConfirm')} onConfirm={async () => { await cancel.mutateAsync(); onDone(); }}>
            {t('cancel')}
        </ConfirmAction>
    );
}

/** `requestId` undefined = a new request; `onCreated` hands the id of a request created but not submitted yet. */
export function PurchaseRequestEditor({ projectId, requestId, onCreated, onClose }: {
    projectId: string;
    requestId: string | undefined;
    onCreated: (id: string) => void;
    onClose: () => void;
}) {
    const t = useTranslations('procurement.editor');
    const detail = usePurchaseRequest(requestId);
    const hub = useHubProject(projectId);
    const ws = useErpWorkspace(hub.data?.project.workspaceId);
    const request = detail.data;
    const editable = requestId === undefined || (request !== undefined && request.canEdit && request.status === 'draft');
    const mayCancel = request !== undefined && can(ws.role, 'procurement.request')
        && (request.status === 'draft' || request.status === 'pending_approval' || request.status === 'approved');

    return (
        <Modal open width={720} title={requestId === undefined ? t('newTitle') : (request?.number ?? t('draftTitle'))} footer={null}
            onCancel={onClose} destroyOnHidden>
            {requestId !== undefined && detail.isLoading && <Skeleton active />}
            {requestId !== undefined && detail.isError && <div className="text-red-600">{t('loadFailed')}</div>}
            {editable && (requestId === undefined || request !== undefined) && (
                <EditBody key={requestId ?? 'new'} projectId={projectId} request={request} onCreated={onCreated} onClose={onClose} />
            )}
            {!editable && request !== undefined && (
                <div className="flex flex-col gap-3">
                    <ReadOnlyBody request={request} />
                    <div className="flex flex-wrap justify-end gap-2">
                        {mayCancel && <CancelButton request={request} onDone={onClose} />}
                        <Button onClick={onClose}>{t('close')}</Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
