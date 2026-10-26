// ─── Every backend route the crew (vendor) screens call (docs/marketplace/API-module1.md), and their query keys ───
import { z } from 'zod';
import {
    bidDtoSchema, claimDtoSchema, contractDocumentDtoSchema, fileDtoSchema, guestPackageDtoSchema, meResponseSchema,
    myBidStateDtoSchema, myVendorsDtoSchema, negotiationMessageDtoSchema, notificationListDtoSchema,
    phoneAuthResponseSchema, phoneStatusResponseSchema, portfolioItemDtoSchema, questionDtoSchema,
    retentionEntryDtoSchema, subcontractDtoSchema, subcontractSummaryDtoSchema, variationDtoSchema,
    vendorInboxDtoSchema, vendorProfileDtoSchema,
    type AcceptSubcontractRequest, type AskQuestionRequest, type BidDto, type ClaimDto, type ContractDocumentDto,
    type CreatePortfolioItemRequest, type DeclineRequest, type FileDto, type FilePurpose, type GuestPackageDto,
    type MarkNotificationsReadRequest, type MeResponse, type MyBidStateDto, type MyVendorsDto, type NegotiationMessageDto,
    type NotificationListDto, type PhoneAuthResponse, type PhoneStatusResponse, type PortfolioItemDto,
    type ProposeVariationRequest, type PutVendorProfileRequest, type QuestionDto, type RatingRequest,
    type RequestChangeRequest, type RequestClaimRequest, type RequestOtpRequest, type RespondVariationRequest,
    type RetentionEntryDto, type SaveBidDraftRequest, type SendMessageRequest, type SubcontractDto,
    type SubcontractSummaryDto, type SubmitBidRequest, type VariationDto, type VendorInboxDto, type VendorProfileDto,
    type VerifyOtpRequest,
} from '@/shared/contract';
import { apiClient, type ApiClient } from '@/features/cloud/api/client';
import { ApiError, errorFromBody, isApiError } from '@/features/cloud/api/errors';
import { downscaleImage } from './images';

const seg = (s: string) => encodeURIComponent(s);

/** Query keys of the vendor screens (all under ['vendor', …] so one invalidation refreshes everything). */
export const vk = {
    all: ['vendor'] as const,
    account: ['vendor', 'account'] as const,
    guest: (token: string) => ['vendor', 'guest', token] as const,
    me: ['vendor', 'me'] as const,
    profile: (workspaceId: string) => ['vendor', 'profile', workspaceId] as const,
    inbox: (workspaceId: string) => ['vendor', 'inbox', workspaceId] as const,
    subcontracts: (workspaceId: string) => ['vendor', 'subcontracts', workspaceId] as const,
    invitation: (id: string) => ['vendor', 'invitation', id] as const,
    bid: (id: string) => ['vendor', 'invitation', id, 'bid'] as const,
    messages: (id: string) => ['vendor', 'invitation', id, 'messages'] as const,
    contract: (id: string) => ['vendor', 'contract', id] as const,
    document: (id: string) => ['vendor', 'contract', id, 'document'] as const,
    claims: (id: string) => ['vendor', 'contract', id, 'claims'] as const,
    variations: (id: string) => ['vendor', 'contract', id, 'variations'] as const,
    retention: (id: string) => ['vendor', 'contract', id, 'retention'] as const,
    /** Shared with the contractor bell (src/features/notifications): marking read in one updates the other. */
    notifications: ['notifications'] as const,
};

/** The server said the subcontracting module is off (404 module_disabled), not that the thing does not exist. */
export function isModuleDisabled(e: unknown): boolean {
    return isApiError(e) && e.code === 'module_disabled';
}

/** null for a 404 (e.g. no profile yet), the value otherwise. */
async function orNull<T>(p: Promise<T>): Promise<T | null> {
    try {
        return await p;
    } catch (e) {
        if (isApiError(e) && e.status === 404 && e.code === 'not_found') return null;
        throw e;
    }
}

export function createVendorApi(client: ApiClient) {
    return {
        account: (): Promise<MeResponse> => client.request('GET', '/me', { schema: meResponseSchema }),

        guest: {
            get: (token: string): Promise<GuestPackageDto> =>
                client.request('GET', `/s/${seg(token)}`, { schema: guestPackageDtoSchema, auth: false }),
            decline: (token: string, body: DeclineRequest): Promise<void> =>
                client.request('POST', `/s/${seg(token)}/decline`, { body, auth: false }),
            ask: (token: string, body: AskQuestionRequest): Promise<QuestionDto> =>
                client.request('POST', `/s/${seg(token)}/questions`, { body, schema: questionDtoSchema, auth: false }),
        },

        otp: {
            check: (body: RequestOtpRequest): Promise<PhoneStatusResponse> =>
                client.request('POST', '/auth/otp/check', { body, schema: phoneStatusResponseSchema, auth: false }),
            request: (body: RequestOtpRequest): Promise<void> =>
                client.request('POST', '/auth/otp/request', { body, auth: false }),
            /** Signs in (stores the session like login does). */
            verify: async (body: VerifyOtpRequest): Promise<PhoneAuthResponse> => {
                const auth = await client.request('POST', '/auth/otp/verify', { body, schema: phoneAuthResponseSchema, auth: false });
                client.setAuth(auth);
                return auth;
            },
        },

        claimInvitation: (token: string, workspaceId: string): Promise<GuestPackageDto> =>
            client.request('POST', '/vendor/claim-invitation', { body: { token, workspaceId }, schema: guestPackageDtoSchema }),

        me: (): Promise<MyVendorsDto> => client.request('GET', '/vendor/me', { schema: myVendorsDtoSchema }),
        profile: (workspaceId: string): Promise<VendorProfileDto | null> =>
            orNull(client.request('GET', '/vendor/profile', { schema: vendorProfileDtoSchema, query: { workspaceId } })),
        putProfile: (body: PutVendorProfileRequest): Promise<VendorProfileDto> =>
            client.request('PUT', '/vendor/profile', { body, schema: vendorProfileDtoSchema }),
        addPortfolio: (workspaceId: string, body: CreatePortfolioItemRequest): Promise<PortfolioItemDto> =>
            client.request('POST', '/vendor/portfolio', { body, schema: portfolioItemDtoSchema, query: { workspaceId } }),
        deletePortfolio: (id: string): Promise<void> => client.request('DELETE', `/vendor/portfolio/${seg(id)}`),

        inbox: (workspaceId: string): Promise<VendorInboxDto> =>
            client.request('GET', '/vendor/inbox', { schema: vendorInboxDtoSchema, query: { workspaceId } }),
        subcontracts: (workspaceId: string): Promise<SubcontractSummaryDto[]> =>
            client.request('GET', '/vendor/subcontracts', { schema: z.array(subcontractSummaryDtoSchema), query: { workspaceId } }),

        invitation: {
            get: (id: string): Promise<GuestPackageDto> =>
                client.request('GET', `/vendor/invitations/${seg(id)}`, { schema: guestPackageDtoSchema }),
            decline: (id: string, body: DeclineRequest): Promise<void> =>
                client.request('POST', `/vendor/invitations/${seg(id)}/decline`, { body }),
            ask: (id: string, body: AskQuestionRequest): Promise<QuestionDto> =>
                client.request('POST', `/vendor/invitations/${seg(id)}/questions`, { body, schema: questionDtoSchema }),
            bid: (id: string): Promise<MyBidStateDto> =>
                client.request('GET', `/vendor/invitations/${seg(id)}/bid`, { schema: myBidStateDtoSchema }),
            saveDraft: (id: string, body: SaveBidDraftRequest): Promise<BidDto> =>
                client.request('PUT', `/vendor/invitations/${seg(id)}/bid-draft`, { body, schema: bidDtoSchema }),
            submit: (id: string, body: SubmitBidRequest): Promise<BidDto> =>
                client.request('POST', `/vendor/invitations/${seg(id)}/bid`, { body, schema: bidDtoSchema }),
            withdraw: (id: string): Promise<void> => client.request('POST', `/vendor/invitations/${seg(id)}/bid/withdraw`),
            messages: (id: string): Promise<NegotiationMessageDto[]> =>
                client.request('GET', `/vendor/invitations/${seg(id)}/messages`, { schema: z.array(negotiationMessageDtoSchema) }),
            send: (id: string, body: SendMessageRequest): Promise<NegotiationMessageDto> =>
                client.request('POST', `/vendor/invitations/${seg(id)}/messages`, { body, schema: negotiationMessageDtoSchema }),
        },

        contract: {
            get: (id: string): Promise<SubcontractDto> =>
                client.request('GET', `/subcontracting/subcontracts/${seg(id)}`, { schema: subcontractDtoSchema }),
            document: (id: string): Promise<ContractDocumentDto> =>
                client.request('GET', `/subcontracting/subcontracts/${seg(id)}/document`, { schema: contractDocumentDtoSchema }),
            accept: (id: string, body: AcceptSubcontractRequest): Promise<SubcontractDto> =>
                client.request('POST', `/subcontracting/subcontracts/${seg(id)}/accept`, { body, schema: subcontractDtoSchema }),
            requestChange: (id: string, body: RequestChangeRequest): Promise<SubcontractDto> =>
                client.request('POST', `/subcontracting/subcontracts/${seg(id)}/request-change`, { body, schema: subcontractDtoSchema }),
            variations: (id: string): Promise<VariationDto[]> =>
                client.request('GET', `/subcontracting/subcontracts/${seg(id)}/variations`, { schema: z.array(variationDtoSchema) }),
            proposeVariation: (id: string, body: ProposeVariationRequest): Promise<VariationDto> =>
                client.request('POST', `/subcontracting/subcontracts/${seg(id)}/variations`, { body, schema: variationDtoSchema }),
            respondVariation: (variationId: string, body: RespondVariationRequest): Promise<VariationDto> =>
                client.request('POST', `/subcontracting/variations/${seg(variationId)}/respond`, { body, schema: variationDtoSchema }),
            claims: (id: string): Promise<ClaimDto[]> =>
                client.request('GET', `/subcontracting/subcontracts/${seg(id)}/claims`, { schema: z.array(claimDtoSchema) }),
            requestClaim: (id: string, body: RequestClaimRequest): Promise<ClaimDto> =>
                client.request('POST', `/subcontracting/subcontracts/${seg(id)}/claims`, { body, schema: claimDtoSchema }),
            retention: (id: string): Promise<RetentionEntryDto[]> =>
                client.request('GET', `/subcontracting/subcontracts/${seg(id)}/retention`, { schema: z.array(retentionEntryDtoSchema) }),
            rate: (id: string, body: RatingRequest): Promise<void> =>
                client.request('POST', `/subcontracting/subcontracts/${seg(id)}/ratings`, { body }),
        },

        notifications: {
            list: (limit = 30): Promise<NotificationListDto> =>
                client.request('GET', '/notifications', { schema: notificationListDtoSchema, query: { limit } }),
            markRead: (body: MarkNotificationsReadRequest): Promise<void> =>
                client.request('POST', '/notifications/read', { body }),
        },
    };
}

export type VendorApi = ReturnType<typeof createVendorApi>;

export const vendorApi: VendorApi = createVendorApi(apiClient);

// ── File upload (multipart: the JSON client cannot send it) ──

async function postFile(file: File, purpose: FilePurpose, token: string | null): Promise<Response> {
    const form = new FormData();
    form.append('purpose', purpose);
    form.append('file', file, file.name);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token !== null) headers.Authorization = `Bearer ${token}`;
    try {
        return await fetch('/api/files', { method: 'POST', body: form, headers, credentials: 'same-origin' });
    } catch (e) {
        throw new ApiError(0, 'network_error', e instanceof Error ? e.message : 'network error');
    }
}

/** Uploads one file (photos shrunk first) → FileDto. Refreshes the session once on a 401, like every other call. */
export async function uploadFile(file: File, purpose: FilePurpose, client: ApiClient = apiClient): Promise<FileDto> {
    const toSend = await downscaleImage(file);
    let res = await postFile(toSend, purpose, client.accessToken);
    if (res.status === 401) {
        const auth = await client.refresh();
        if (auth !== null) res = await postFile(toSend, purpose, auth.accessToken);
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
