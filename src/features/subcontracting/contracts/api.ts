'use client';

// ─── Contracts (C3) HTTP routes + TanStack Query hooks of the buyer screens ───
// Paths: docs/marketplace/API-module1.md "Contracts (C3)". Keys start with ['sc', 'contracts', …] so one invalidation
// of a contract refreshes its header, claims, variations and retention together.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
    claimDtoSchema, contractDocumentDtoSchema, procurementReportDtoSchema, retentionEntryDtoSchema,
    subcontractDtoSchema, subcontractSummaryDtoSchema, subcontractingSettingsDtoSchema, tradeChecklistsDtoSchema,
    variationDtoSchema, workspaceRetentionDtoSchema,
    type ApproveClaimRequest, type InspectClaimRequest, type PayClaimRequest, type ProposeVariationRequest,
    type PutSubcontractingSettingsRequest, type RatingRequest, type RejectClaimRequest, type RequestClaimRequest,
    type RetentionMoveRequest, type SubcontractDto,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { useSession } from '@/features/cloud/auth/session';
import { isModuleDisabled } from './logic';

const seg = (s: string) => encodeURIComponent(s);
const sub = (id: string) => `/subcontracting/subcontracts/${seg(id)}`;

export const contractsApi = {
    list: (projectId: string) =>
        apiClient.request('GET', `/projects/${seg(projectId)}/subcontracting/subcontracts`, { schema: z.array(subcontractSummaryDtoSchema) }),
    get: (id: string) => apiClient.request('GET', sub(id), { schema: subcontractDtoSchema }),
    document: (id: string) => apiClient.request('GET', `${sub(id)}/document`, { schema: contractDocumentDtoSchema }),
    putDocument: (id: string, html: string) =>
        apiClient.request('PUT', `${sub(id)}/document`, { body: { html }, schema: contractDocumentDtoSchema }),
    cancel: (id: string, reason: string) => apiClient.request('POST', `${sub(id)}/cancel`, { body: { reason }, schema: subcontractDtoSchema }),
    terminate: (id: string, reason: string) => apiClient.request('POST', `${sub(id)}/terminate`, { body: { reason }, schema: subcontractDtoSchema }),
    complete: (id: string) => apiClient.request('POST', `${sub(id)}/complete`, { schema: subcontractDtoSchema }),
    close: (id: string) => apiClient.request('POST', `${sub(id)}/close`, { schema: subcontractDtoSchema }),
    signedScan: (id: string, fileId: string) =>
        apiClient.request('POST', `${sub(id)}/signed-scan`, { body: { fileId }, schema: subcontractDtoSchema }),
    variations: (id: string) => apiClient.request('GET', `${sub(id)}/variations`, { schema: z.array(variationDtoSchema) }),
    proposeVariation: (id: string, body: ProposeVariationRequest) =>
        apiClient.request('POST', `${sub(id)}/variations`, { body, schema: variationDtoSchema }),
    respondVariation: (variationId: string, accept: boolean) =>
        apiClient.request('POST', `/subcontracting/variations/${seg(variationId)}/respond`, { body: { accept }, schema: variationDtoSchema }),
    claims: (id: string) => apiClient.request('GET', `${sub(id)}/claims`, { schema: z.array(claimDtoSchema) }),
    requestClaim: (id: string, body: RequestClaimRequest) =>
        apiClient.request('POST', `${sub(id)}/claims`, { body, schema: claimDtoSchema }),
    inspect: (claimId: string, body: InspectClaimRequest) =>
        apiClient.request('POST', `/subcontracting/claims/${seg(claimId)}/inspect`, { body, schema: claimDtoSchema }),
    approve: (claimId: string, body: ApproveClaimRequest) =>
        apiClient.request('POST', `/subcontracting/claims/${seg(claimId)}/approve`, { body, schema: claimDtoSchema }),
    pay: (claimId: string, body: PayClaimRequest) =>
        apiClient.request('POST', `/subcontracting/claims/${seg(claimId)}/pay`, { body, schema: claimDtoSchema }),
    reject: (claimId: string, body: RejectClaimRequest) =>
        apiClient.request('POST', `/subcontracting/claims/${seg(claimId)}/reject`, { body, schema: claimDtoSchema }),
    retention: (id: string) => apiClient.request('GET', `${sub(id)}/retention`, { schema: z.array(retentionEntryDtoSchema) }),
    release: (id: string, body: RetentionMoveRequest) =>
        apiClient.request('POST', `${sub(id)}/retention/release`, { body, schema: retentionEntryDtoSchema }),
    forfeit: (id: string, body: RetentionMoveRequest) =>
        apiClient.request('POST', `${sub(id)}/retention/forfeit`, { body, schema: retentionEntryDtoSchema }),
    rate: (id: string, body: RatingRequest) => apiClient.request('POST', `${sub(id)}/ratings`, { body }),
    checklists: () => apiClient.request('GET', '/subcontracting/checklists', { schema: tradeChecklistsDtoSchema }),
    settings: (ws: string) =>
        apiClient.request('GET', `/workspaces/${seg(ws)}/subcontracting/settings`, { schema: subcontractingSettingsDtoSchema }),
    putSettings: (ws: string, body: PutSubcontractingSettingsRequest) =>
        apiClient.request('PUT', `/workspaces/${seg(ws)}/subcontracting/settings`, { body, schema: subcontractingSettingsDtoSchema }),
    workspaceRetention: (ws: string) =>
        apiClient.request('GET', `/workspaces/${seg(ws)}/subcontracting/retention`, { schema: workspaceRetentionDtoSchema }),
    report: (projectId: string) =>
        apiClient.request('GET', `/projects/${seg(projectId)}/subcontracting/report`, { schema: procurementReportDtoSchema }),
};

export const scKeys = {
    all: ['sc', 'contracts'] as const,
    list: (projectId: string) => ['sc', 'contracts', 'list', projectId] as const,
    one: (id: string) => ['sc', 'contracts', 'one', id] as const,
    document: (id: string) => ['sc', 'contracts', 'one', id, 'document'] as const,
    claims: (id: string) => ['sc', 'contracts', 'one', id, 'claims'] as const,
    variations: (id: string) => ['sc', 'contracts', 'one', id, 'variations'] as const,
    retention: (id: string) => ['sc', 'contracts', 'one', id, 'retention'] as const,
    checklists: ['sc', 'contracts', 'checklists'] as const,
    /** Same key as the buyer screens (buyer/api.ts scKeys.settings): one cache entry per workspace, saved = refreshed everywhere. */
    settings: (ws: string) => ['sc', 'settings', ws] as const,
    workspaceRetention: (ws: string) => ['sc', 'contracts', 'workspace-retention', ws] as const,
    report: (projectId: string) => ['sc', 'contracts', 'report', projectId] as const,
};

const useSignedIn = () => useSession(s => s.status === 'signed-in');

/** The contract page keeps itself fresh: both sides act on the same contract. */
/** Polls every 30 s, and stops while the server says the module is off (404 module_disabled). */
const LIVE = {
    refetchInterval: (q: { state: { error: unknown } }) => (isModuleDisabled(q.state.error) ? false : 30_000),
    refetchOnWindowFocus: true,
} as const;

export function useSubcontracts(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.list(projectId ?? '-'),
        queryFn: () => contractsApi.list(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        ...LIVE,
    });
}

export function useSubcontract(id: string) {
    const signedIn = useSignedIn();
    return useQuery({ queryKey: scKeys.one(id), queryFn: () => contractsApi.get(id), enabled: signedIn, ...LIVE });
}

export function useContractDocument(id: string, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({ queryKey: scKeys.document(id), queryFn: () => contractsApi.document(id), enabled: signedIn && enabled });
}

export function useClaims(id: string, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({ queryKey: scKeys.claims(id), queryFn: () => contractsApi.claims(id), enabled: signedIn && enabled, ...LIVE });
}

export function useVariations(id: string, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({ queryKey: scKeys.variations(id), queryFn: () => contractsApi.variations(id), enabled: signedIn && enabled, ...LIVE });
}

export function useRetentionEntries(id: string, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({ queryKey: scKeys.retention(id), queryFn: () => contractsApi.retention(id), enabled: signedIn && enabled });
}

export function useChecklists(enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({ queryKey: scKeys.checklists, queryFn: () => contractsApi.checklists(), enabled: signedIn && enabled, staleTime: Infinity });
}

export function useScSettings(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.settings(workspaceId ?? '-'),
        queryFn: () => contractsApi.settings(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 5 * 60_000,
    });
}

export function useWorkspaceRetention(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.workspaceRetention(workspaceId ?? '-'),
        queryFn: () => contractsApi.workspaceRetention(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
    });
}

export function useProcurementReport(projectId: string | undefined, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.report(projectId ?? '-'),
        queryFn: () => contractsApi.report(projectId ?? ''),
        enabled: signedIn && enabled && projectId !== undefined,
    });
}

/**
 * A mutation on one contract: on success the contract (and everything under it) and the lists refetch.
 * When the server returns the SubcontractDto, it goes straight into the cache.
 */
export function useContractMutation<V, R>(id: string, fn: (vars: V) => Promise<R>) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: fn,
        onSuccess: (result) => {
            const parsed = subcontractDtoSchema.safeParse(result);
            if (parsed.success) qc.setQueryData<SubcontractDto>(scKeys.one(id), parsed.data);
            void qc.invalidateQueries({ queryKey: scKeys.one(id) });
            void qc.invalidateQueries({ queryKey: ['sc', 'contracts', 'list'] });
            void qc.invalidateQueries({ queryKey: ['sc', 'contracts', 'workspace-retention'] });
            void qc.invalidateQueries({ queryKey: ['sc', 'contracts', 'report'] });
            // The sourcing screens read to-dos and package states (awarded → closed) from the same facts.
            void qc.invalidateQueries({ queryKey: ['sc', 'overview'] });
            void qc.invalidateQueries({ queryKey: ['sc', 'packages'] });
        },
    });
}

/** Saves the module settings; every screen reading them (buyer and contracts) shares scKeys.settings. */
export function usePutScSettings(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: PutSubcontractingSettingsRequest) => contractsApi.putSettings(workspaceId, body),
        onSuccess: (s) => {
            qc.setQueryData(scKeys.settings(workspaceId), s);
            void qc.invalidateQueries({ queryKey: scKeys.settings(workspaceId) });
        },
    });
}
