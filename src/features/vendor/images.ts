// ─── Photos are shrunk on the phone before upload (max 1600 px on the long side, JPEG 0.8) ───
import { ALLOWED_CONTENT_TYPES } from '@/shared/contract';
import { isApiError, thaiErrorMessage } from '@/features/cloud/api/errors';

/** Photo types the server takes (ALLOWED_CONTENT_TYPES without PDF): the picker's `accept` and its check. */
export const PHOTO_CONTENT_TYPES: readonly string[] = ALLOWED_CONTENT_TYPES.filter(t => t.startsWith('image/'));

/** Shown when the server refuses an upload (422): what it takes. */
export const UPLOAD_REFUSED_TEXT = 'ไฟล์นี้ใช้ไม่ได้ (รองรับ JPG, PNG, WEBP, HEIC, PDF)';

/**
 * Thai reason a picked file cannot be sent as a photo, or null when it can. Pure. Size is not checked here: photos are
 * shrunk before upload (the server still refuses anything over MAX_FILE_BYTES).
 */
export function photoProblem(file: { name: string; type: string }): string | null {
    if (!PHOTO_CONTENT_TYPES.includes(file.type)) return `${file.name}: ใช้ได้เฉพาะรูป JPG, PNG, WEBP หรือ HEIC`;
    return null;
}
/** Message for a failed upload: a 422 means the file itself is refused. Pure. */
export function uploadErrorText(e: unknown): string {
    return isApiError(e) && e.status === 422 ? UPLOAD_REFUSED_TEXT : thaiErrorMessage(e);
}

export const PHOTO_MAX_SIDE = 1600;
export const PHOTO_QUALITY = 0.8;

/** Size that fits inside max × max keeping the aspect ratio (never enlarges). Pure. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
    if (width <= 0 || height <= 0) return { width: 0, height: 0 };
    const scale = Math.min(1, max / Math.max(width, height));
    return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** "IMG_0012.HEIC" → "IMG_0012.jpg". Pure. */
export function jpegName(name: string): string {
    const base = name.replace(/\.[^./\\]+$/, '');
    return `${base === '' ? 'photo' : base}.jpg`;
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
    if (typeof createImageBitmap === 'function') {
        const bmp = await createImageBitmap(file);
        return { source: bmp, width: bmp.width, height: bmp.height, close: () => { bmp.close(); } };
    }
    const url = URL.createObjectURL(file);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => { URL.revokeObjectURL(url); } };
    } catch (e) {
        URL.revokeObjectURL(url);
        throw e;
    }
}

/**
 * A smaller JPEG copy of a photo for upload. Anything that is not an image, or cannot be decoded by this browser
 * (e.g. HEIC on most Android/desktop browsers), is returned unchanged.
 */
export async function downscaleImage(file: File, max = PHOTO_MAX_SIDE, quality = PHOTO_QUALITY): Promise<File> {
    if (!file.type.startsWith('image/') || typeof document === 'undefined') return file;
    let decoded: Awaited<ReturnType<typeof decode>>;
    try {
        decoded = await decode(file);
    } catch {
        return file;
    }
    try {
        const size = fitWithin(decoded.width, decoded.height, max);
        if (size.width === 0) return file;
        const canvas = document.createElement('canvas');
        canvas.width = size.width;
        canvas.height = size.height;
        const ctx = canvas.getContext('2d');
        if (ctx === null) return file;
        ctx.drawImage(decoded.source, 0, 0, size.width, size.height);
        const blob = await new Promise<Blob | null>(resolve => { canvas.toBlob(resolve, 'image/jpeg', quality); });
        if (blob === null) return file;
        // Already small and already JPEG: keep the original bytes when the copy is not smaller.
        if (file.type === 'image/jpeg' && blob.size >= file.size) return file;
        return new File([blob], jpegName(file.name), { type: 'image/jpeg', lastModified: file.lastModified });
    } finally {
        decoded.close();
    }
}
