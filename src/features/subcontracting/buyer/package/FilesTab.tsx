'use client';

// ─── ไฟล์: drawings / specs attached to the package (add while not decided; remove only while draft) ───
import { useTranslations } from 'next-intl';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { useRef, useState } from 'react';
import { App, Button, Empty, Popconfirm } from 'antd';
import { DeleteOutlined, PaperClipOutlined, UploadOutlined } from '@ant-design/icons';
import { ALLOWED_CONTENT_TYPES, type BuyerPackageDto, MAX_FILE_BYTES } from '@/shared/contract';

import { uploadFile } from '../api';
import { useAttachFile, useDetachFile } from '../hooks';
import { fmtDateTime } from '../format';

function sizeText(bytes: number): string {
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${String(Math.max(1, Math.round(bytes / 1024)))} KB`;
}

export function FilesTab({ pkg, canManage }: { pkg: BuyerPackageDto; canManage: boolean }) {
    const t = useTranslations('subcontracting');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const input = useRef<HTMLInputElement>(null);
    const attach = useAttachFile(pkg.id);
    const detach = useDetachFile(pkg.id);
    const [uploading, setUploading] = useState(false);
    const canAdd = canManage && pkg.status !== 'awarded' && pkg.status !== 'closed' && pkg.status !== 'cancelled';
    const canRemove = canManage && pkg.status === 'draft';

    const onPick = async (files: FileList | null) => {
        const list = files === null ? [] : [...files];
        if (input.current !== null) input.current.value = '';
        if (list.length === 0) return;
        setUploading(true);
        try {
            for (const f of list) {
                if (f.size > MAX_FILE_BYTES) {
                    void message.error(t('buyer.filesTab.isLargerThanMb', { name: f.name, value: MAX_FILE_BYTES / 1024 / 1024 }));
                    continue;
                }
                if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(f.type)) {
                    void message.error(t('buyer.filesTab.onlyPdfAndImagesCan', { name: f.name }));
                    continue;
                }
                const dto = await uploadFile(f, 'package_attachment');
                await attach.mutateAsync(dto.id);
            }
        } catch (e) {
            void message.error(toText(e));
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            {canAdd && (
                <div className="flex items-center gap-3">
                    <input ref={input} type="file" multiple hidden accept={ALLOWED_CONTENT_TYPES.join(',')}
                        onChange={e => { void onPick(e.target.files); }} />
                    <Button icon={<UploadOutlined />} loading={uploading} onClick={() => input.current?.click()}>{t('buyer.filesTab.attachFiles')}</Button>
                    <span className="text-secondary text-gray-500">{t('buyer.filesTab.drawingsSpecsSitePhotosPdf')}</span>
                </div>
            )}
            {pkg.files.length === 0 ? (
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('buyer.filesTab.noAttachmentsYet')} />
            ) : (
                <ul className="m-0 p-0 list-none flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-card">
                    {pkg.files.map(f => (
                        <li key={f.id} className="flex items-center gap-3 px-3 py-2">
                            <PaperClipOutlined className="text-gray-400" />
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-0 truncate text-gray-900 hover:text-orange-600">{f.name}</a>
                            <span className="text-caption text-gray-500 whitespace-nowrap">{sizeText(f.size)} · {fmtDateTime(f.createdAt)}</span>
                            {canRemove && (
                                <Popconfirm title={t('buyer.filesTab.removeThisFile')} okText={t('buyer.filesTab.remove')} cancelText={t('buyer.filesTab.cancel')} okButtonProps={{ danger: true }}
                                    onConfirm={() => detach.mutate(f.id, { onError: (e) => { void message.error(toText(e)); } })}>
                                    <Button size="small" type="text" icon={<DeleteOutlined />} aria-label={t('buyer.filesTab.removeFile')} />
                                </Popconfirm>
                            )}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
