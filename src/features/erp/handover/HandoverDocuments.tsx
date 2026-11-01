'use client';

// ─── Documents handed over with the work (as-built drawings, manuals, warranty cards, test reports) ───
import { useState } from 'react';
import { App, Button, Popconfirm, Select, Upload } from 'antd';
import { DeleteOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { ALLOWED_CONTENT_TYPES, HANDOVER_DOCUMENT_KINDS, MAX_FILE_BYTES, type HandoverDocumentKind, type HandoverDto } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { uploadErpFile, uploadProblem } from '../shared/files';
import { useAddHandoverDocument, usePatchHandover } from './hooks';

const ACCEPT = ALLOWED_CONTENT_TYPES.join(',');

export function HandoverDocuments({ projectId, dto, workspaceId }: { projectId: string; dto: HandoverDto; workspaceId: string | undefined }) {
    const t = useTranslations('handover');
    const tErp = useTranslations('erp');
    const te = useTranslations('enums');
    const fmt = useFormat();
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const add = useAddHandoverDocument(projectId, dto.id);
    const patch = usePatchHandover(projectId, dto.id);
    const [kind, setKind] = useState<HandoverDocumentKind>('as_built');
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
            const f = await uploadErpFile(file, kind === 'as_built' ? 'as_built' : 'handover_document', workspaceId);
            await add.mutateAsync({ kind, fileId: f.id, title: f.name });
            void message.success(tErp('files.uploaded', { name: f.name }));
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setUploading(n => n - 1);
        }
    };

    return (
        <div className="flex min-w-0 flex-col gap-3">
            {dto.documents.length === 0 && <div className="text-[13px] text-gray-500">{t('documents.empty')}</div>}
            {dto.documents.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                    {dto.documents.map(d => (
                        <li key={d.id} className="flex min-w-0 items-center gap-2">
                            <PaperClipOutlined className="text-gray-500" />
                            <span className="whitespace-nowrap text-[12px] text-gray-500">{te(`handoverDocumentKind.${d.kind}`)}</span>
                            {d.file !== null ? (
                                <a href={d.file.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate">{d.title !== '' ? d.title : d.file.name}</a>
                            ) : (
                                <span className="min-w-0 flex-1 truncate text-gray-400">{d.title}</span>
                            )}
                            {dto.canEdit && (
                                <Popconfirm title={t('documents.removeConfirm')} onConfirm={() => patch.mutateAsync({ removeDocumentIds: [d.id] }).catch((x: unknown) => { void message.error(toText(x)); })}>
                                    <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={t('documents.remove')} title={t('documents.remove')} />
                                </Popconfirm>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {dto.canAddDocuments && (
                <div className="flex flex-wrap items-center gap-2">
                    <Select<HandoverDocumentKind> className="min-w-40" value={kind} onChange={setKind}
                        options={HANDOVER_DOCUMENT_KINDS.map(k => ({ value: k, label: te(`handoverDocumentKind.${k}`) }))} />
                    <Upload accept={ACCEPT} multiple showUploadList={false} disabled={workspaceId === undefined}
                        beforeUpload={(file) => { void upload(file); return Upload.LIST_IGNORE; }}>
                        <Button icon={<UploadOutlined />} loading={uploading > 0} disabled={workspaceId === undefined}>
                            {uploading > 0 ? tErp('files.uploading') : t('documents.upload')}
                        </Button>
                    </Upload>
                </div>
            )}
        </div>
    );
}
