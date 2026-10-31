'use client';

// ─── Attachments of an ERP document: upload (POST /api/files with workspaceId) + the list with signed links ───
// Controlled: `value` is the FileDto list the page holds (from the module's DTO); `onChange` gets the new list after an
// upload or a removal. The module binds file ids to its row itself (the backend checks assertUploadedBy).
import { useRef, useState } from 'react';
import { App, Button, Upload } from 'antd';
import { DeleteOutlined, FileImageOutlined, FilePdfOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, type FileDto, type FilePurpose } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useFormat } from '@/i18n/useFormat';
import { uploadErpFile, uploadProblem } from './files';

const ACCEPT = ALLOWED_CONTENT_TYPES.join(',');

function FileIcon({ contentType }: { contentType: string }) {
    if (contentType === 'application/pdf') return <FilePdfOutlined className="text-red-500" />;
    if (contentType.startsWith('image/')) return <FileImageOutlined className="text-blue-500" />;
    return <PaperClipOutlined className="text-gray-500" />;
}

export function FileAttachments({ purpose, workspaceId, value, onChange, readOnly = false, maxCount, emptyText }: {
    purpose: FilePurpose;
    /** The workspace the files belong to (useErpWorkspace().workspaceId); upload is off while undefined. */
    workspaceId: string | undefined;
    value: readonly FileDto[];
    /** Omit (or readOnly) for a list without upload / remove. */
    onChange?: (files: FileDto[]) => void;
    readOnly?: boolean;
    maxCount?: number;
    emptyText?: string;
}) {
    const t = useTranslations('erp');
    const fmt = useFormat();
    const { message } = App.useApp();
    const toText = useErrorMessage();
    const [uploading, setUploading] = useState(0);
    // Several uploads may finish before the parent re-renders: append to the latest list, not to a stale `value`.
    const latest = useRef<readonly FileDto[]>(value);
    latest.current = value;
    // Uploads in flight, counted synchronously (antd calls beforeUpload for every file of a batch before a re-render).
    const inflight = useRef(0);

    const editable = !readOnly && onChange !== undefined;
    const full = maxCount !== undefined && value.length + uploading >= maxCount;

    const sizeText = (bytes: number) => (bytes < 1024 * 1024
        ? t('files.sizeKb', { size: fmt.number(Math.max(1, Math.ceil(bytes / 1024)), { max: 0 }) })
        : t('files.sizeMb', { size: fmt.number(bytes / 1024 / 1024, { max: 1 }) }));

    const upload = async (file: File) => {
        if (workspaceId === undefined || onChange === undefined) return;
        const problem = uploadProblem(file);
        if (problem !== null) {
            void message.error(problem === 'tooLarge'
                ? t('files.tooLarge', { mb: fmt.number(MAX_FILE_BYTES / 1024 / 1024, { max: 0 }) })
                : t('files.badType'));
            return;
        }
        if (maxCount !== undefined && latest.current.length + inflight.current >= maxCount) return;
        inflight.current += 1;
        setUploading(n => n + 1);
        try {
            const dto = await uploadErpFile(file, purpose, workspaceId);
            latest.current = [...latest.current, dto];
            onChange([...latest.current]);
            void message.success(t('files.uploaded', { name: dto.name }));
        } catch (e) {
            void message.error(toText(e));
        } finally {
            inflight.current -= 1;
            setUploading(n => n - 1);
        }
    };

    const remove = (id: string) => {
        if (onChange === undefined) return;
        latest.current = latest.current.filter(f => f.id !== id);
        onChange([...latest.current]);
    };

    return (
        <div className="flex flex-col gap-2 min-w-0">
            {value.length === 0 && uploading === 0 && (
                <div className="text-secondary text-gray-500">{emptyText ?? t('files.empty')}</div>
            )}
            {value.length > 0 && (
                <ul className="flex flex-col gap-1 m-0 p-0 list-none">
                    {value.map(f => (
                        <li key={f.id} className="flex items-center gap-2 min-w-0">
                            <FileIcon contentType={f.contentType} />
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="truncate min-w-0 flex-1">{f.name}</a>
                            <span className="text-secondary text-gray-500 tabular-nums whitespace-nowrap">{sizeText(f.size)}</span>
                            {editable && (
                                <Button
                                    size="small" type="text" danger icon={<DeleteOutlined />}
                                    aria-label={t('files.remove')} title={t('files.remove')}
                                    onClick={() => remove(f.id)}
                                />
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {editable && (
                <div className="flex flex-wrap items-center gap-2">
                    <Upload
                        accept={ACCEPT}
                        multiple={maxCount === undefined || maxCount > 1}
                        showUploadList={false}
                        disabled={workspaceId === undefined || full}
                        beforeUpload={(file) => {
                            // Uploaded here, not by antd; a batch larger than the room left uploads only what fits.
                            void upload(file);
                            return Upload.LIST_IGNORE;
                        }}
                    >
                        <Button icon={<UploadOutlined />} loading={uploading > 0} disabled={workspaceId === undefined || full}>
                            {uploading > 0 ? t('files.uploading') : t('files.upload')}
                        </Button>
                    </Upload>
                    {maxCount !== undefined && <span className="text-secondary text-gray-500">{t('files.limit', { count: maxCount })}</span>}
                </div>
            )}
        </div>
    );
}
