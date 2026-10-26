// ─── Buyer side of จ้างช่วง: typed calls to the backend (paths: docs/marketplace/API-module1.md) ───
// Sourcing (C1), bidding (C2) buyer rows, the overview + settings the buyer screens read (C3) and file upload (B1).
import { z } from 'zod';
import {
    type AddendumRequest, type AnswerQuestionRequest, type AwardRequest, type CancelRequest, type CreateInvitationsRequest,
    type CreatePackageRequest, type CreateVendorListEntryRequest, type ExtendDeadlineRequest, type FileDto, type FilePurpose,
    type ImportVendorListRequest, type ManualBidRequest, type SendMessageRequest, type TradeId, type UpdatePackageRequest,
    type UpdateVendorListEntryRequest,
    awardResponseSchema, bidDtoSchema, buyerPackageDtoSchema, createInvitationsResponseSchema, fileDtoSchema,
    importVendorListResponseSchema, levelingDtoSchema, negotiationMessageDtoSchema, packageSummaryDtoSchema,
    procurementOverviewDtoSchema, questionDtoSchema, resendInvitationResponseSchema, scInvitationDtoSchema,
    vendorCardDtoSchema, vendorListEntryDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { ApiError, errorFromBody } from '@/features/cloud/api/errors';

const seg = (s: string) => encodeURIComponent(s);
const P = (id: string) => `/subcontracting/packages/${seg(id)}`;
const I = (id: string) => `/subcontracting/invitations/${seg(id)}`;

export interface VendorListQuery {
    trade?: TradeId;
    q?: string;
    hidden?: boolean;
}

export const scApi = {
    // ── vendor list (ทะเบียนทีมช่าง) ──
    vendorList: (ws: string, query: VendorListQuery = {}) =>
        apiClient.request('GET', `/workspaces/${seg(ws)}/vendor-list`, {
            schema: z.array(vendorListEntryDtoSchema),
            query: {
                trade: query.trade,
                q: query.q === undefined || query.q.trim() === '' ? undefined : query.q.trim(),
                hidden: query.hidden === undefined ? undefined : String(query.hidden),
            },
        }),
    createVendor: (ws: string, body: CreateVendorListEntryRequest) =>
        apiClient.request('POST', `/workspaces/${seg(ws)}/vendor-list`, { body, schema: vendorListEntryDtoSchema }),
    importVendors: (ws: string, body: ImportVendorListRequest) =>
        apiClient.request('POST', `/workspaces/${seg(ws)}/vendor-list/import`, { body, schema: importVendorListResponseSchema }),
    updateVendor: (entryId: string, body: UpdateVendorListEntryRequest) =>
        apiClient.request('PATCH', `/subcontracting/vendor-list/${seg(entryId)}`, { body, schema: vendorListEntryDtoSchema }),
    deleteVendor: (entryId: string) => apiClient.request('DELETE', `/subcontracting/vendor-list/${seg(entryId)}`),
    vendorCard: (ws: string, vendorWs: string) =>
        apiClient.request('GET', `/workspaces/${seg(ws)}/vendors/${seg(vendorWs)}/card`, { schema: vendorCardDtoSchema }),

    // ── packages ──
    packages: (projectId: string) =>
        apiClient.request('GET', `/projects/${seg(projectId)}/subcontracting/packages`, { schema: z.array(packageSummaryDtoSchema) }),
    createPackage: (projectId: string, body: CreatePackageRequest) =>
        apiClient.request('POST', `/projects/${seg(projectId)}/subcontracting/packages`, { body, schema: buyerPackageDtoSchema }),
    package: (id: string) => apiClient.request('GET', P(id), { schema: buyerPackageDtoSchema }),
    updatePackage: (id: string, body: UpdatePackageRequest) => apiClient.request('PATCH', P(id), { body, schema: buyerPackageDtoSchema }),
    deletePackage: (id: string) => apiClient.request('DELETE', P(id)),
    attachFile: (id: string, fileId: string) =>
        apiClient.request('POST', `${P(id)}/files`, { body: { fileId }, schema: buyerPackageDtoSchema }),
    detachFile: (id: string, fileId: string) =>
        apiClient.request('DELETE', `${P(id)}/files/${seg(fileId)}`, { schema: buyerPackageDtoSchema }),
    addendum: (id: string, body: AddendumRequest) => apiClient.request('POST', `${P(id)}/addendum`, { body, schema: buyerPackageDtoSchema }),
    extend: (id: string, body: ExtendDeadlineRequest) => apiClient.request('POST', `${P(id)}/extend`, { body, schema: buyerPackageDtoSchema }),
    cancel: (id: string, body: CancelRequest) => apiClient.request('POST', `${P(id)}/cancel`, { body, schema: buyerPackageDtoSchema }),

    // ── invitations ──
    invitations: (id: string) => apiClient.request('GET', `${P(id)}/invitations`, { schema: z.array(scInvitationDtoSchema) }),
    invite: (id: string, body: CreateInvitationsRequest) =>
        apiClient.request('POST', `${P(id)}/invitations`, { body, schema: createInvitationsResponseSchema }),
    resend: (invitationId: string) => apiClient.request('POST', `${I(invitationId)}/resend`, { schema: resendInvitationResponseSchema }),
    withdraw: (invitationId: string) => apiClient.request('POST', `${I(invitationId)}/withdraw`, { schema: scInvitationDtoSchema }),

    // ── questions ──
    questions: (id: string) => apiClient.request('GET', `${P(id)}/questions`, { schema: z.array(questionDtoSchema) }),
    answer: (questionId: string, body: AnswerQuestionRequest) =>
        apiClient.request('POST', `/subcontracting/questions/${seg(questionId)}/answer`, { body, schema: questionDtoSchema }),

    // ── bids, leveling, negotiation, award ──
    bids: (id: string) => apiClient.request('GET', `${P(id)}/bids`, { schema: z.array(bidDtoSchema) }),
    leveling: (id: string) => apiClient.request('GET', `${P(id)}/leveling`, { schema: levelingDtoSchema }),
    manualBid: (invitationId: string, body: ManualBidRequest) =>
        apiClient.request('POST', `${I(invitationId)}/manual-bid`, { body, schema: bidDtoSchema }),
    messages: (invitationId: string) =>
        apiClient.request('GET', `${I(invitationId)}/messages`, { schema: z.array(negotiationMessageDtoSchema) }),
    sendMessage: (invitationId: string, body: SendMessageRequest) =>
        apiClient.request('POST', `${I(invitationId)}/messages`, { body, schema: negotiationMessageDtoSchema }),
    award: (id: string, body: AwardRequest) => apiClient.request('POST', `${P(id)}/award`, { body, schema: awardResponseSchema }),

    // ── read from the contracts stream (C3) ──
    overview: (projectId: string) =>
        apiClient.request('GET', `/projects/${seg(projectId)}/subcontracting/overview`, { schema: procurementOverviewDtoSchema }),
};

/**
 * POST /api/files (multipart: `file`, `purpose`) with the bearer token of the shared client. apiClient only sends
 * JSON, so this is a plain fetch; on a 401 it refreshes the session once and retries, like apiClient does.
 */
export async function uploadFile(file: File, purpose: FilePurpose): Promise<FileDto> {
    const send = (token: string | null) => {
        const form = new FormData();
        form.append('file', file);
        form.append('purpose', purpose);
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (token !== null) headers.Authorization = `Bearer ${token}`;
        return fetch('/api/files', { method: 'POST', body: form, headers, credentials: 'same-origin' });
    };
    let res: Response;
    try {
        res = await send(apiClient.accessToken);
        if (res.status === 401) {
            const auth = await apiClient.refresh();
            if (auth !== null) res = await send(auth.accessToken);
        }
    } catch (e) {
        throw new ApiError(0, 'network_error', e instanceof Error ? e.message : 'network error');
    }
    const text = await res.text().catch(() => '');
    let body: unknown = undefined;
    try {
        body = text === '' ? undefined : JSON.parse(text) as unknown;
    } catch {
        body = undefined;
    }
    if (!res.ok) throw errorFromBody(res.status, body, `HTTP ${String(res.status)}`);
    const parsed = fileDtoSchema.safeParse(body);
    if (!parsed.success) throw new ApiError(res.status, 'invalid_response', 'response does not match the contract');
    return parsed.data;
}

/** Query keys of the buyer screens (all under 'sc', so one invalidation can refresh everything of the module). */
export const scKeys = {
    all: ['sc'] as const,
    vendorLists: (ws: string) => ['sc', 'vendor-list', ws] as const,
    vendorList: (ws: string, query: VendorListQuery) => ['sc', 'vendor-list', ws, query] as const,
    vendorCard: (ws: string, vendorWs: string) => ['sc', 'vendor-card', ws, vendorWs] as const,
    /** Packages of a project (D2 invalidates the ['sc', 'packages'] and ['sc', 'overview'] prefixes after contract changes). */
    packages: (projectId: string) => ['sc', 'packages', projectId] as const,
    overview: (projectId: string) => ['sc', 'overview', projectId] as const,
    package: (id: string) => ['sc', 'packages', id] as const,
    invitations: (id: string) => ['sc', 'packages', id, 'invitations'] as const,
    questions: (id: string) => ['sc', 'packages', id, 'questions'] as const,
    bids: (id: string) => ['sc', 'packages', id, 'bids'] as const,
    leveling: (id: string) => ['sc', 'packages', id, 'leveling'] as const,
    messages: (invitationId: string) => ['sc', 'invitations', invitationId, 'messages'] as const,
    settings: (ws: string) => ['sc', 'settings', ws] as const,
};
