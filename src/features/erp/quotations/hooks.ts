'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    CreateQuotationRequest, IssueQuotationVersionRequest, NewQuotationVersionRequest, PatchQuotationVersionInput, QuotationVersionDto,
    RecordQuotationResponseRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { hubKeys } from '../hub/hooks';
import { quotationsApi } from './api';

export const quotationKeys = {
    list: (projectId: string) => ['projects', projectId, 'quotations'] as const,
    one: (quotationId: string) => ['quotations', quotationId] as const,
    version: (versionId: string) => ['quotation-versions', versionId] as const,
    compare: (quotationId: string, from: string, to: string) => ['quotations', quotationId, 'compare', from, to] as const,
};

export function useQuotations(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: quotationKeys.list(projectId ?? ''),
        queryFn: () => quotationsApi.list(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useQuotation(quotationId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: quotationKeys.one(quotationId ?? ''),
        queryFn: () => quotationsApi.get(quotationId ?? ''),
        enabled: signedIn && quotationId !== undefined,
        staleTime: 0,
    });
}

export function useQuotationVersion(versionId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: quotationKeys.version(versionId ?? ''),
        queryFn: () => quotationsApi.version(versionId ?? ''),
        enabled: signedIn && versionId !== undefined,
        staleTime: 0,
        // The editor starts from what it is given: never from an older copy kept in the cache.
        gcTime: 0,
    });
}

export function useQuotationCompare(quotationId: string, from: string | undefined, to: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: quotationKeys.compare(quotationId, from ?? '', to ?? ''),
        queryFn: () => quotationsApi.compare(quotationId, from ?? '', to ?? ''),
        enabled: signedIn && from !== undefined && to !== undefined && from !== to,
        staleTime: 0,
    });
}

/** Cache bookkeeping after a change of a version: the version itself, its quotation, the list, the project (status) and approvals. */
function useAfterVersionChange() {
    const qc = useQueryClient();
    return (v: QuotationVersionDto, opts: { structural: boolean }) => {
        qc.setQueryData(quotationKeys.version(v.id), v);
        if (opts.structural) {
            void qc.invalidateQueries({ queryKey: quotationKeys.one(v.quotationId) });
            void qc.invalidateQueries({ queryKey: quotationKeys.list(v.projectId) });
            void qc.invalidateQueries({ queryKey: hubKeys.detail(v.projectId) });
            void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'approvals' });
        }
    };
}

export function useCreateQuotation(projectId: string) {
    const after = useAfterVersionChange();
    return useMutation({
        mutationFn: (body: CreateQuotationRequest) => quotationsApi.create(projectId, body),
        onSuccess: v => after(v, { structural: true }),
    });
}

/** Autosave of a draft: only the version in the cache changes (the editor keeps its own state). */
export function usePatchQuotationVersion(versionId: string) {
    const after = useAfterVersionChange();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: PatchQuotationVersionInput) => quotationsApi.patch(versionId, body),
        onSuccess: v => {
            after(v, { structural: false });
            // The title shows in the list and the header.
            void qc.invalidateQueries({ queryKey: quotationKeys.one(v.quotationId) });
            void qc.invalidateQueries({ queryKey: quotationKeys.list(v.projectId) });
        },
    });
}

export function useNewQuotationVersion(quotationId: string) {
    const after = useAfterVersionChange();
    return useMutation({
        mutationFn: (body: Partial<NewQuotationVersionRequest>) => quotationsApi.newVersion(quotationId, body),
        onSuccess: v => after(v, { structural: true }),
    });
}

export function useIssueQuotationVersion(versionId: string) {
    const after = useAfterVersionChange();
    return useMutation({
        mutationFn: (body: IssueQuotationVersionRequest) => quotationsApi.issue(versionId, body),
        onSuccess: v => after(v, { structural: true }),
    });
}

export function useCancelQuotationVersion(versionId: string) {
    const after = useAfterVersionChange();
    return useMutation({
        mutationFn: () => quotationsApi.cancel(versionId),
        onSuccess: v => after(v, { structural: true }),
    });
}

export function useRecordQuotationResponse(versionId: string) {
    const after = useAfterVersionChange();
    return useMutation({
        mutationFn: (body: RecordQuotationResponseRequest) => quotationsApi.recordResponse(versionId, body),
        onSuccess: v => after(v, { structural: true }),
    });
}
