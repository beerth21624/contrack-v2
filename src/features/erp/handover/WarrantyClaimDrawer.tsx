'use client';
/* eslint-disable @next/next/no-img-element -- signed claim photos shown as thumbnails */

// ─── One warranty claim: open a new one, or read it and move it along (assign, start, resolve, close, reject) ───
import { useState } from 'react';
import { App, Button, Descriptions, Drawer, Input, Modal, Select } from 'antd';
import { useTranslations } from 'next-intl';
import {
    WARRANTY_CLAIM_CHANNELS, WARRANTY_CLAIM_SEVERITIES, type FileDto, type WarrantyClaimChannel, type WarrantyClaimDto, type WarrantyClaimSeverity,
} from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useMembers } from '@/features/cloud/query/hooks';
import { DateText } from '../shared/DateText';
import { FileAttachments } from '../shared/FileAttachments';
import { MoneyInput } from '../shared/MoneyInput';
import { MoneyText } from '../shared/MoneyText';
import { StatusTag } from '../shared/StatusTag';
import { SupplierPicker } from '../shared/SupplierPicker';
import { useCreateWarrantyClaim, useWarrantyClaimAction } from './hooks';
import { CLAIM_STATUS_TONES, SEVERITY_TONES, todayBangkok } from './status';

const label = 'flex flex-col gap-1 text-[13px] text-gray-600';

function NewClaim({ projectId, workspaceId, onDone }: { projectId: string; workspaceId: string | undefined; onDone: () => void }) {
    const t = useTranslations('handover');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const create = useCreateWarrantyClaim(projectId);
    const [reportedDate, setReportedDate] = useState(todayBangkok());
    const [reportedByName, setReportedByName] = useState('');
    const [channel, setChannel] = useState<WarrantyClaimChannel>('phone');
    const [severity, setSeverity] = useState<WarrantyClaimSeverity>('medium');
    const [description, setDescription] = useState('');
    const [location, setLocation] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [photos, setPhotos] = useState<FileDto[]>([]);

    const submit = async () => {
        try {
            await create.mutateAsync({
                ...(reportedDate !== '' ? { reportedDate } : {}),
                reportedByName: reportedByName.trim(), channel, severity, description: description.trim(), location: location.trim(),
                ...(dueDate !== '' ? { dueDate } : {}),
                photos: photos.map(f => ({ fileId: f.id, takenAt: null, caption: '' })),
            });
            void message.success(t('claims.created'));
            onDone();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-3">
            <label className={label}>{t('claims.fields.description')}
                <Input.TextArea rows={4} maxLength={5000} value={description} onChange={e => setDescription(e.target.value)} />
            </label>
            <label className={label}>{t('claims.fields.location')}
                <Input maxLength={500} value={location} onChange={e => setLocation(e.target.value)} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className={label}>{t('claims.fields.reportedDate')}
                    <Input type="date" value={reportedDate} onChange={e => setReportedDate(e.target.value)} />
                </label>
                <label className={label}>{t('claims.fields.reportedByName')}
                    <Input maxLength={200} value={reportedByName} onChange={e => setReportedByName(e.target.value)} />
                </label>
                <label className={label}>{t('claims.fields.channel')}
                    <Select value={channel} onChange={setChannel} options={WARRANTY_CLAIM_CHANNELS.map(c => ({ value: c, label: te(`warrantyClaimChannel.${c}`) }))} />
                </label>
                <label className={label}>{t('claims.fields.severity')}
                    <Select value={severity} onChange={setSeverity} options={WARRANTY_CLAIM_SEVERITIES.map(c => ({ value: c, label: te(`warrantyClaimSeverity.${c}`) }))} />
                </label>
                <label className={label}>{t('claims.fields.dueDate')}
                    <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </label>
            </div>
            <div className={label}>{t('claims.fields.photos')}
                <FileAttachments purpose="warranty_photo" workspaceId={workspaceId} value={photos} onChange={setPhotos} maxCount={30} emptyText={t('claims.noPhotos')} />
            </div>
            <div>
                <Button type="primary" loading={create.isPending} disabled={description.trim() === ''} onClick={() => { void submit(); }}>{t('claims.create.submit')}</Button>
            </div>
        </div>
    );
}

type Dialog = 'assign' | 'resolve' | 'close' | 'reject' | null;

function ActionDialog({ projectId, claim, kind, workspaceId, onClose }: {
    projectId: string; claim: WarrantyClaimDto; kind: Exclude<Dialog, null>; workspaceId: string | undefined; onClose: () => void;
}) {
    const t = useTranslations('handover');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const act = useWarrantyClaimAction(projectId);
    const members = useMembers(workspaceId);
    const [userId, setUserId] = useState<string | null>(claim.assigneeUserId);
    const [supplierId, setSupplierId] = useState<string | null>(claim.assigneeSupplierId);
    const [dueDate, setDueDate] = useState(claim.dueDate ?? '');
    const [note, setNote] = useState(claim.resolutionNote);
    const [cost, setCost] = useState<number>(claim.costAmount);

    const valid = kind !== 'assign' || userId !== null || supplierId !== null;
    const submit = async () => {
        try {
            if (kind === 'assign') {
                await act.mutateAsync({ action: 'assign', claimId: claim.id, body: { assigneeUserId: userId, assigneeSupplierId: supplierId, dueDate: dueDate === '' ? null : dueDate } });
            } else if (kind === 'reject') {
                await act.mutateAsync({ action: 'reject', claimId: claim.id, body: { resolutionNote: note.trim() } });
            } else {
                await act.mutateAsync({ action: kind, claimId: claim.id, body: { resolutionNote: note.trim(), costAmount: cost } });
            }
            onClose();
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <Modal open title={t(`claims.dialog.${kind}`)} okText={t(`claims.actions.${kind}`)} okButtonProps={{ disabled: !valid, danger: kind === 'reject' }}
            confirmLoading={act.isPending} onCancel={onClose} onOk={() => { void submit(); }} destroyOnHidden>
            <div className="flex flex-col gap-3">
                {kind === 'assign' ? (
                    <>
                        <label className={label}>{t('claims.fields.assigneeUser')}
                            <Select allowClear showSearch={{ optionFilterProp: 'label' }} value={userId ?? undefined} onChange={(v?: string) => setUserId(v ?? null)} loading={members.isLoading}
                                options={(members.data ?? []).map(m => ({ value: m.userId, label: m.displayName !== '' ? m.displayName : m.email }))} />
                        </label>
                        <div className={label}>{t('claims.fields.assigneeSupplier')}
                            <SupplierPicker value={supplierId} onChange={id => setSupplierId(id)} workspaceId={workspaceId} allowCreate={false} />
                        </div>
                        <label className={label}>{t('claims.fields.dueDate')}
                            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                        </label>
                        {!valid && <div className="text-[13px] text-red-600">{t('claims.assigneeRequired')}</div>}
                    </>
                ) : (
                    <>
                        <label className={label}>{t('claims.fields.resolutionNote')}
                            <Input.TextArea rows={3} maxLength={5000} value={note} onChange={e => setNote(e.target.value)} />
                        </label>
                        {kind !== 'reject' && (
                            <label className={label}>{t('claims.fields.costAmount')}
                                <MoneyInput value={cost} onChange={v => setCost(v ?? 0)} />
                                {kind === 'close' && <span className="text-[12px] text-gray-500">{t('claims.costHint')}</span>}
                            </label>
                        )}
                    </>
                )}
            </div>
        </Modal>
    );
}

function ClaimView({ projectId, claim, workspaceId }: { projectId: string; claim: WarrantyClaimDto; workspaceId: string | undefined }) {
    const t = useTranslations('handover');
    const te = useTranslations('enums');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const act = useWarrantyClaimAction(projectId);
    const [dialog, setDialog] = useState<Dialog>(null);

    const start = async () => {
        try {
            await act.mutateAsync({ action: 'start', claimId: claim.id });
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <StatusTag enumName="warrantyClaimStatus" value={claim.status} tones={CLAIM_STATUS_TONES} />
                <StatusTag enumName="warrantyClaimSeverity" value={claim.severity} tones={SEVERITY_TONES} />
            </div>
            <div className="whitespace-pre-line break-words">{claim.description}</div>
            <Descriptions size="small" column={1} bordered items={[
                { key: 'loc', label: t('claims.fields.location'), children: claim.location !== '' ? claim.location : '–' },
                { key: 'date', label: t('claims.fields.reportedDate'), children: <DateText value={claim.reportedDate} /> },
                { key: 'by', label: t('claims.fields.reportedByName'), children: claim.reportedByName !== '' ? claim.reportedByName : '–' },
                { key: 'ch', label: t('claims.fields.channel'), children: te(`warrantyClaimChannel.${claim.channel}`) },
                { key: 'as', label: t('claims.fields.assignee'), children: claim.assigneeName !== '' ? claim.assigneeName : '–' },
                { key: 'due', label: t('claims.fields.dueDate'), children: <DateText value={claim.dueDate} /> },
                { key: 'res', label: t('claims.fields.resolutionNote'), children: claim.resolutionNote !== '' ? <span className="whitespace-pre-line">{claim.resolutionNote}</span> : '–' },
                { key: 'resAt', label: t('claims.fields.resolvedAt'), children: <DateText value={claim.resolvedAt} /> },
                { key: 'closedAt', label: t('claims.fields.closedAt'), children: <DateText value={claim.closedAt} /> },
                { key: 'cost', label: t('claims.fields.costAmount'), children: claim.costAmount > 0 ? <MoneyText value={claim.costAmount} /> : '–' },
            ]} />
            <div>
                <div className="mb-1 text-[13px] text-gray-600">{t('claims.fields.photos')}</div>
                {claim.photos.length === 0 ? <div className="text-[13px] text-gray-500">{t('claims.noPhotos')}</div> : (
                    <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0 sm:grid-cols-3">
                        {claim.photos.map(p => (
                            <li key={p.fileId} className="min-w-0">
                                {p.file !== null && (
                                    <a href={p.file.url} target="_blank" rel="noopener noreferrer">
                                        {p.file.contentType.startsWith('image/')
                                            ? <img src={p.file.url} alt={p.caption !== '' ? p.caption : p.file.name} className="h-24 w-full rounded object-cover" />
                                            : <span className="block truncate">{p.file.name}</span>}
                                    </a>
                                )}
                                {p.caption !== '' && <div className="truncate text-[12px] text-gray-500">{p.caption}</div>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {claim.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                    {claim.actions.includes('assign') && (
                        <Button type={claim.status === 'open' ? 'primary' : 'default'} onClick={() => setDialog('assign')}>
                            {claim.status === 'open' ? t('claims.actions.assign') : t('claims.actions.reassign')}
                        </Button>
                    )}
                    {claim.actions.includes('start') && <Button type="primary" loading={act.isPending} onClick={() => { void start(); }}>{t('claims.actions.start')}</Button>}
                    {claim.actions.includes('resolve') && <Button type="primary" onClick={() => setDialog('resolve')}>{t('claims.actions.resolve')}</Button>}
                    {claim.actions.includes('close') && <Button type="primary" onClick={() => setDialog('close')}>{t('claims.actions.close')}</Button>}
                    {claim.actions.includes('reject') && <Button danger onClick={() => setDialog('reject')}>{t('claims.actions.reject')}</Button>}
                </div>
            )}
            {dialog !== null && <ActionDialog projectId={projectId} claim={claim} kind={dialog} workspaceId={workspaceId} onClose={() => setDialog(null)} />}
        </div>
    );
}

/** `claim` = the claim to read; `creating` = the form for a new one. Closed when neither. */
export function WarrantyClaimDrawer({ projectId, workspaceId, claim, creating, onClose }: {
    projectId: string;
    workspaceId: string | undefined;
    claim: WarrantyClaimDto | null;
    creating: boolean;
    onClose: () => void;
}) {
    const t = useTranslations('handover');
    return (
        <Drawer
            open={creating || claim !== null} onClose={onClose} size="large" destroyOnHidden
            title={creating ? t('claims.create.title') : t('claims.detailTitle', { number: claim?.number ?? '' })}
        >
            {creating && <NewClaim projectId={projectId} workspaceId={workspaceId} onDone={onClose} />}
            {!creating && claim !== null && <ClaimView projectId={projectId} claim={claim} workspaceId={workspaceId} />}
        </Drawer>
    );
}
