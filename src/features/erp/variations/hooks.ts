'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    AddVariationEvidenceRequest, ComputeVariationOrderRequest, CreateVariationOrderRequest, PatchVariationOrderRequest,
    PutVariationOrderLinesRequest, RecordVariationResponseRequest, VariationOrderDto,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { boqControlKeys } from '../boq-control/hooks';
import { contractKeys } from '../contracts/hooks';
import { hubKeys } from '../hub/hooks';
import { variationsApi } from './api';

export const variationKeys = {
    list: (projectId: string) => ['projects', projectId, 'variations'] as const,
    one: (variationId: string) => ['variations', variationId] as const,
};

export function useVariations(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: variationKeys.list(projectId ?? ''),
        queryFn: () => variationsApi.list(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useVariation(variationId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: variationKeys.one(variationId ?? ''),
        queryFn: () => variationsApi.get(variationId ?? ''),
        enabled: signedIn && variationId !== undefined,
        staleTime: 0,
    });
}

/** Cache bookkeeping after a change: the VO itself, the list; `structural` also the project, contract, cost codes and approvals. */
export function useAfterVariationChange() {
    const qc = useQueryClient();
    return (v: VariationOrderDto, structural = false) => {
        qc.setQueryData(variationKeys.one(v.id), v);
        void qc.invalidateQueries({ queryKey: variationKeys.list(v.projectId) });
        if (structural) {
            void qc.invalidateQueries({ queryKey: hubKeys.detail(v.projectId) });
            void qc.invalidateQueries({ queryKey: contractKeys.forProject(v.projectId) });
            void qc.invalidateQueries({ queryKey: contractKeys.one(v.contractId) });
            void qc.invalidateQueries({ queryKey: boqControlKeys.costCodes(v.projectId) });
            void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'approvals' });
        }
    };
}

export function useCreateVariation(projectId: string) {
    const after = useAfterVariationChange();
    return useMutation({
        mutationFn: (body: CreateVariationOrderRequest) => variationsApi.create(projectId, body),
        onSuccess: v => after(v, true),
    });
}

export function usePatchVariation(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: (body: PatchVariationOrderRequest) => variationsApi.patch(variationId, body), onSuccess: v => after(v) });
}

export function usePutVariationLines(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: (body: PutVariationOrderLinesRequest) => variationsApi.putLines(variationId, body), onSuccess: v => after(v) });
}

export function useComputeVariation(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: (body: ComputeVariationOrderRequest) => variationsApi.compute(variationId, body), onSuccess: v => after(v) });
}

export function useAddVariationEvidence(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: (body: AddVariationEvidenceRequest) => variationsApi.addEvidence(variationId, body), onSuccess: v => after(v) });
}

export function useRemoveVariationEvidence(variationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (evidenceId: string) => variationsApi.removeEvidence(evidenceId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: variationKeys.one(variationId) }); },
    });
}

export function useSubmitVariation(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: () => variationsApi.submit(variationId), onSuccess: v => after(v, true) });
}

export function useRecordVariationResponse(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: (body: RecordVariationResponseRequest) => variationsApi.recordResponse(variationId, body), onSuccess: v => after(v, true) });
}

export function useWithdrawVariation(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: () => variationsApi.withdraw(variationId), onSuccess: v => after(v, true) });
}

export function useCancelVariation(variationId: string) {
    const after = useAfterVariationChange();
    return useMutation({ mutationFn: () => variationsApi.cancel(variationId), onSuccess: v => after(v, true) });
}
