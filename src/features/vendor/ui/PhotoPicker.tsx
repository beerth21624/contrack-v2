'use client';

// ─── Add photos from the phone camera / gallery: shrunk, uploaded one by one, shown as thumbnails ───
// Only the photo types the server takes (JPG, PNG, WEBP, HEIC); anything else gets a clear message and is not sent.
import { useRef, useState } from 'react';
import { App, Button, Image } from 'antd';
import { CameraOutlined, CloseOutlined } from '@ant-design/icons';
import type { FileDto, FilePurpose } from '@/shared/contract';
import { uploadFile } from '../api';
import { PHOTO_CONTENT_TYPES, photoProblem, uploadErrorText } from '../images';

export function PhotoPicker({ photos, max, purpose, onAdd, onRemove, label = 'เพิ่มรูป', disabled = false }: {
    photos: readonly FileDto[];
    max: number;
    purpose: FilePurpose;
    onAdd: (file: FileDto) => void;
    onRemove: (id: string) => void;
    label?: string;
    disabled?: boolean;
}) {
    const { message } = App.useApp();
    const input = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(0);
    const room = max - photos.length - uploading;

    const onPick = async (list: FileList | null) => {
        const picked = Array.from(list ?? []);
        if (input.current !== null) input.current.value = '';
        const refused = picked.map(photoProblem).filter((p): p is string => p !== null);
        if (refused.length > 0) void message.warning(refused.length === 1 ? refused[0] : `${refused[0]} (และอีก ${String(refused.length - 1)} ไฟล์)`);
        const files = picked.filter(f => photoProblem(f) === null).slice(0, Math.max(0, room));
        if (files.length === 0) return;
        setUploading(n => n + files.length);
        for (const f of files) {
            try {
                onAdd(await uploadFile(f, purpose));
            } catch (e) {
                void message.error(`อัปโหลดรูปไม่สำเร็จ: ${uploadErrorText(e)}`);
            } finally {
                setUploading(n => n - 1);
            }
        }
    };

    return (
        <div>
            {photos.length > 0 && (
                <Image.PreviewGroup>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        {photos.map(p => (
                            <div key={p.id} className="relative">
                                <Image src={p.url} alt={p.name} width="100%" height={96} style={{ objectFit: 'cover', borderRadius: 6 }} />
                                {!disabled && (
                                    <Button size="small" shape="circle" aria-label="เอารูปออก" icon={<CloseOutlined />}
                                        className="!absolute top-1 right-1" onClick={() => onRemove(p.id)} />
                                )}
                            </div>
                        ))}
                    </div>
                </Image.PreviewGroup>
            )}
            <input ref={input} type="file" accept={PHOTO_CONTENT_TYPES.join(',')} multiple hidden onChange={e => { void onPick(e.target.files); }} />
            <Button block size="large" icon={<CameraOutlined />} loading={uploading > 0} disabled={disabled || room <= 0}
                onClick={() => input.current?.click()}>
                {uploading > 0 ? 'กำลังอัปโหลด…' : room <= 0 ? `ครบ ${String(max)} รูปแล้ว` : label}
            </Button>
        </div>
    );
}
