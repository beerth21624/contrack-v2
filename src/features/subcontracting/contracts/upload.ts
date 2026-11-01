'use client';

// ─── Upload one file (claim photo, signed contract scan): POST /api/files, multipart `file` + `purpose` → FileDto ───
// apiClient.request only sends JSON, so this posts the form itself with the same bearer token (refresh once on 401).
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, fileDtoSchema, type FileDto, type FilePurpose } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { ApiError, errorFromBody } from '@/features/cloud/api/errors';
import { scText, type ScT } from '../buyer/text';

/** The reason (in the UI language) a file cannot be uploaded, or null when it can. */
export function uploadProblem(file: { size: number; type: string }, t: ScT = scText()): string | null {
    if (file.size > MAX_FILE_BYTES) return t('contracts.upload.tooLarge', { mb: String(MAX_FILE_BYTES / 1024 / 1024) });
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type)) return t('contracts.upload.unsupportedType');
    return null;
}

async function post(file: File, purpose: FilePurpose, token: string | null): Promise<Response> {
    const form = new FormData();
    form.append('file', file);
    form.append('purpose', purpose);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token !== null) headers.Authorization = `Bearer ${token}`;
    try {
        return await fetch('/api/files', { method: 'POST', body: form, headers, credentials: 'same-origin' });
    } catch (e) {
        throw new ApiError(0, 'network_error', e instanceof Error ? e.message : 'network error');
    }
}

export async function uploadFile(file: File, purpose: FilePurpose): Promise<FileDto> {
    const problem = uploadProblem(file);
    if (problem !== null) throw new ApiError(422, 'validation_failed', problem);
    let res = await post(file, purpose, apiClient.accessToken);
    if (res.status === 401) {
        const auth = await apiClient.refresh();
        if (auth !== null) res = await post(file, purpose, auth.accessToken);
    }
    const text = await res.text().catch(() => '');
    let body: unknown = undefined;
    try {
        body = text === '' ? undefined : JSON.parse(text) as unknown;
    } catch {
        // not JSON: handled below
    }
    if (!res.ok) throw errorFromBody(res.status, body, `HTTP ${String(res.status)}`);
    const parsed = fileDtoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(res.status, 'invalid_response', 'response does not match the contract');
    return parsed.data;
}
