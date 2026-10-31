'use client';

// ─── Site photos: `<input capture="environment">` opens the phone camera; the date taken comes from File.lastModified ───
import { useRef, useState } from 'react';
import { App, Button, Input } from 'antd';
import { CameraOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES } from '@/shared/contract';
import { useErrorMessage } from '@/features/cloud/api/error-message';
import { uploadErpFile, uploadProblem } from '../shared/files';
import { DateText } from '../shared/DateText';
import { type PhotoRow, nextKey } from './form';

export function PhotoGrid({ rows, workspaceId, disabled, onChange }: {
    rows: readonly PhotoRow[];
    workspaceId: string | undefined;
    disabled: boolean;
    onChange: (rows: PhotoRow[]) => void;
}) {
    const t = useTranslations('siteDiary.photos');
    const tf = useTranslations('erp.files');
    const toText = useErrorMessage();
    const { message } = App.useApp();
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(0);
    const latest = useRef(rows);
    latest.current = rows;

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
                const dto = await uploadErpFile(file, 'site_photo', workspaceId);
                latest.current = [...latest.current, {
                    key: nextKey(), fileId: dto.id, url: dto.url, name: dto.name, caption: '', costCodeId: null,
                    takenAt: new Date(file.lastModified > 0 ? file.lastModified : Date.now()).toISOString(),
                }];
                onChange([...latest.current]);
            } catch (e) {
                void message.error(toText(e));
            } finally {
                setBusy(n => n - 1);
            }
        }
        if (input.current !== null) input.current.value = '';
    };

    const set = (key: string, patch: Partial<PhotoRow>) => onChange(rows.map(r => (r.key === key ? { ...r, ...patch } : r)));

    return (
        <div className="flex flex-col gap-3">
            {rows.length === 0 && <div className="text-[13px] text-gray-500">{t('empty')}</div>}
            {rows.length > 0 && (
                <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map(p => (
                        <li key={p.key} className="flex min-w-0 flex-col gap-2 rounded-lg border border-gray-200 p-2">
                            {p.url !== '' ? (
                                <a href={p.url} target="_blank" rel="noopener noreferrer">
                                    {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
                                    <img src={p.url} alt={p.caption !== '' ? p.caption : p.name} className="h-40 w-full rounded object-cover" />
                                </a>
                            ) : (
                                <div className="flex h-40 items-center justify-center rounded bg-gray-100 text-[13px] text-gray-500">{p.name}</div>
                            )}
                            <Input value={p.caption} disabled={disabled} maxLength={500} placeholder={t('caption')} onChange={e => set(p.key, { caption: e.target.value })} />
                            <div className="flex items-center justify-between gap-2 text-[12px] text-gray-500">
                                <DateText value={p.takenAt} style="dateTime" />
                                <Button size="small" danger type="text" icon={<DeleteOutlined />} disabled={disabled} aria-label={t('remove')}
                                    onClick={() => onChange(rows.filter(x => x.key !== p.key))} />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <input ref={input} type="file" hidden multiple accept={ALLOWED_CONTENT_TYPES.filter(c => c.startsWith('image/')).join(',')} capture="environment"
                onChange={e => { void add(e.target.files); }} />
            <div>
                <Button icon={<CameraOutlined />} loading={busy > 0} disabled={disabled || workspaceId === undefined} onClick={() => input.current?.click()}>{t('add')}</Button>
            </div>
        </div>
    );
}
