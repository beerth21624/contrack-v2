'use client';
/* eslint-disable @next/next/no-img-element -- signed evidence links shown as thumbnails */

// ─── Evidence of a VO: photos / documents (uploaded with purpose `variation_evidence`, then bound) and notes ───
import { useState } from 'react';
import { App, Button, Input, Popconfirm, Upload } from 'antd';
import { CameraOutlined, DeleteOutlined, FileTextOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, type VariationOrderDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { uploadErpFile, uploadProblem } from '../shared/files';
import { useAddVariationEvidence, useRemoveVariationEvidence } from './hooks';

const ACCEPT = ALLOWED_CONTENT_TYPES.join(',');

export function EvidencePanel({ dto, workspaceId, editable }: { dto: VariationOrderDto; workspaceId: string | undefined; editable: boolean }) {
    const t = useTranslations('variations');
    const tErp = useTranslations('erp');
    const te = useTranslations('enums');
    const fmt = useFormat();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const add = useAddVariationEvidence(dto.id);
    const remove = useRemoveVariationEvidence(dto.id);
    const [note, setNote] = useState('');
    const [uploading, setUploading] = useState(0);

    const upload = async (file: File) => {
        if (workspaceId === undefined) return;
        const problem = uploadProblem(file);
        if (problem !== null) {
            void message.error(problem === 'tooLarge'
                ? tErp('files.tooLarge', { mb: fmt.number(MAX_FILE_BYTES / 1024 / 1024, { max: 0 }) })
                : tErp('files.badType'));
            return;
        }
        setUploading(n => n + 1);
        try {
            const f = await uploadErpFile(file, 'variation_evidence', workspaceId);
            await add.mutateAsync({
                kind: f.contentType.startsWith('image/') ? 'photo' : 'document', fileId: f.id,
                ...(file.lastModified > 0 ? { takenAt: new Date(file.lastModified).toISOString() } : {}),
            });
            void message.success(tErp('files.uploaded', { name: f.name }));
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setUploading(n => n - 1);
        }
    };

    const addNote = async () => {
        try {
            await add.mutateAsync({ kind: 'note', note: note.trim() });
            setNote('');
        } catch (e) {
            void message.error(toText(e));
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {dto.evidence.length === 0 && <div className="text-[13px] text-gray-500">{t('evidence.empty')}</div>}
            {dto.evidence.length > 0 && (
                <ul className="m-0 grid list-none grid-cols-1 gap-2 p-0 sm:grid-cols-2">
                    {dto.evidence.map(e => (
                        <li key={e.id} className="flex min-w-0 gap-2 rounded border border-gray-200 p-2">
                            <div className="shrink-0">
                                {e.file?.contentType.startsWith('image/') === true ? (
                                    <a href={e.file.url} target="_blank" rel="noopener noreferrer">
                                        <img src={e.file.url} alt={e.file.name} className="h-16 w-16 rounded object-cover" />
                                    </a>
                                ) : (
                                    <span className="flex h-16 w-16 items-center justify-center rounded bg-gray-50 text-xl text-gray-400">
                                        {e.kind === 'note' ? <FileTextOutlined /> : <PaperClipOutlined />}
                                    </span>
                                )}
                            </div>
                            <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-[13px]">
                                <span className="font-medium">{te(`variationEvidenceKind.${e.kind}`)}</span>
                                {e.file !== null && (
                                    <a href={e.file.url} target="_blank" rel="noopener noreferrer" className="truncate">{e.file.name}</a>
                                )}
                                {e.note !== '' && <span className="whitespace-pre-line break-words">{e.note}</span>}
                                <span className="text-[12px] text-gray-500">{fmt.dateTime(e.takenAt ?? e.createdAt)}</span>
                            </div>
                            {editable && (
                                <Popconfirm title={t('evidence.removeConfirm')} onConfirm={() => remove.mutateAsync(e.id).catch((x: unknown) => { void message.error(toText(x)); })}>
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('evidence.remove')} title={t('evidence.remove')} />
                                </Popconfirm>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {editable && (
                <div className="flex min-w-0 flex-col gap-2">
                    <Upload accept={ACCEPT} multiple showUploadList={false} disabled={workspaceId === undefined}
                        beforeUpload={(file) => { void upload(file); return Upload.LIST_IGNORE; }}>
                        <Button icon={<CameraOutlined />} loading={uploading > 0} disabled={workspaceId === undefined}>
                            {uploading > 0 ? tErp('files.uploading') : t('evidence.upload')}
                        </Button>
                    </Upload>
                    <Input.TextArea rows={2} maxLength={4000} value={note} onChange={e => setNote(e.target.value)} placeholder={t('evidence.notePlaceholder')} />
                    <div>
                        <Button disabled={note.trim() === ''} loading={add.isPending && uploading === 0} onClick={() => { void addNote(); }}>
                            {t('evidence.addNote')}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
