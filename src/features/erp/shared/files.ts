'use client';

// ─── ERP upload: POST /api/files (multipart `file`, `purpose`, `workspaceId`) → FileDto (docs/erp/01-architecture.md §9) ───
// apiClient.request only sends JSON, so this posts the form itself with the shared bearer token (refresh once on 401).
// The module then binds the returned id to its row (the backend checks assertUploadedBy).
import { ALLOWED_CONTENT_TYPES, MAX_FILE_BYTES, fileDtoSchema, type FileDto, type FilePurpose } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { ApiError, errorFromBody } from '@/features/cloud/api/errors';

export type UploadProblem = 'tooLarge' | 'badType';

/** Why a file cannot be uploaded (translate with `erp.files.<problem>`), or null when it can. */
export function uploadProblem(file: { size: number; type: string }): UploadProblem | null {
    if (file.size > MAX_FILE_BYTES) return 'tooLarge';
    if (!(ALLOWED_CONTENT_TYPES as readonly string[]).includes(file.type.toLowerCase())) return 'badType';
    return null;
}

async function post(file: File, purpose: FilePurpose, workspaceId: string, token: string | null): Promise<Response> {
    const form = new FormData();
    form.append('purpose', purpose);
    form.append('workspaceId', workspaceId);
    form.append('file', file);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token !== null) headers.Authorization = `Bearer ${token}`;
    try {
        return await fetch('/api/files', { method: 'POST', body: form, headers, credentials: 'same-origin' });
    } catch (e) {
        throw new ApiError(0, 'network_error', e instanceof Error ? e.message : 'network error');
    }
}

/** Uploads one file for `workspaceId`; throws ApiError (show it with useErrorMessage). Check `uploadProblem` first. */
export async function uploadErpFile(file: File, purpose: FilePurpose, workspaceId: string): Promise<FileDto> {
    let res = await post(file, purpose, workspaceId, apiClient.accessToken);
    if (res.status === 401) {
        const auth = await apiClient.refresh();
        if (auth !== null) res = await post(file, purpose, workspaceId, auth.accessToken);
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
