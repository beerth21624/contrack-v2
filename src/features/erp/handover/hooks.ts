'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type {
    AcceptHandoverRequest, AddHandoverDocumentRequest, AssignWarrantyClaimRequest, CloseWarrantyClaimRequest, CreateHandoverRequest,
    CreateWarrantyClaimRequest, InspectHandoverRequest, PatchHandoverRequest, PatchWarrantyClaimRequest, RejectHandoverRequest,
    RejectWarrantyClaimRequest, ResolveWarrantyClaimRequest, ScheduleHandoverRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { handoverApi } from './api';

export const handoverKeys = {
    forProject: (projectId: string) => ['projects', projectId, 'handover'] as const,
    warranty: (projectId: string) => ['projects', projectId, 'warranty'] as const,
    claims: (projectId: string) => ['projects', projectId, 'warranty-claims'] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

export function useProjectHandover(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: handoverKeys.forProject(projectId ?? ''),
        queryFn: () => handoverApi.forProject(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useProjectWarranty(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: handoverKeys.warranty(projectId ?? ''),
        queryFn: () => handoverApi.warranty(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useWarrantyClaims(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: handoverKeys.claims(projectId ?? ''),
        queryFn: () => handoverApi.claims(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

/** Anything of the project may have moved (status, contract, billing milestones, cost): refresh all of it. */
function refreshProject(qc: QueryClient, projectId: string): void {
    void qc.invalidateQueries({ queryKey: ['projects', projectId] });
    void qc.invalidateQueries({ queryKey: ['main-contracts'] });
    void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'hub' });
}

/** A handover mutation: `projectId` is the page's project. */
function useHandoverMutation<V>(projectId: string, fn: (v: V) => Promise<unknown>) {
    const qc = useQueryClient();
    return useMutation({ mutationFn: fn, onSuccess: () => { refreshProject(qc, projectId); } });
}

export function useCreateHandover(projectId: string) {
    return useHandoverMutation(projectId, (body: CreateHandoverRequest) => handoverApi.create(projectId, body));
}
export function usePatchHandover(projectId: string, handoverId: string) {
    return useHandoverMutation(projectId, (body: PatchHandoverRequest) => handoverApi.patch(handoverId, body));
}
export function useScheduleHandover(projectId: string, handoverId: string) {
    return useHandoverMutation(projectId, (body: ScheduleHandoverRequest) => handoverApi.schedule(handoverId, body));
}
export function useInspectHandover(projectId: string, handoverId: string) {
    return useHandoverMutation(projectId, (body: InspectHandoverRequest) => handoverApi.inspect(handoverId, body));
}
export function useAcceptHandover(projectId: string, handoverId: string) {
    return useHandoverMutation(projectId, (body: AcceptHandoverRequest) => handoverApi.accept(handoverId, body));
}
export function useRejectHandover(projectId: string, handoverId: string) {
    return useHandoverMutation(projectId, (body: RejectHandoverRequest) => handoverApi.reject(handoverId, body));
}
export function useAddHandoverDocument(projectId: string, handoverId: string) {
    return useHandoverMutation(projectId, (body: AddHandoverDocumentRequest) => handoverApi.addDocument(handoverId, body));
}

export function useCreateWarrantyClaim(projectId: string) {
    return useHandoverMutation(projectId, (body: CreateWarrantyClaimRequest) => handoverApi.createClaim(projectId, body));
}
export function usePatchWarrantyClaim(projectId: string) {
    return useHandoverMutation(projectId, (v: { claimId: string; body: PatchWarrantyClaimRequest }) => handoverApi.patchClaim(v.claimId, v.body));
}

export type ClaimActionInput =
    | { action: 'assign'; claimId: string; body: AssignWarrantyClaimRequest }
    | { action: 'start'; claimId: string }
    | { action: 'resolve'; claimId: string; body: ResolveWarrantyClaimRequest }
    | { action: 'close'; claimId: string; body: CloseWarrantyClaimRequest }
    | { action: 'reject'; claimId: string; body: RejectWarrantyClaimRequest };

export function useWarrantyClaimAction(projectId: string) {
    return useHandoverMutation(projectId, (v: ClaimActionInput) => {
        switch (v.action) {
            case 'assign': return handoverApi.assign(v.claimId, v.body);
            case 'start': return handoverApi.start(v.claimId);
            case 'resolve': return handoverApi.resolve(v.claimId, v.body);
            case 'close': return handoverApi.close(v.claimId, v.body);
            case 'reject': return handoverApi.rejectClaim(v.claimId, v.body);
        }
    });
}
