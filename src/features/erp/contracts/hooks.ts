'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    AddSignedScanRequest, CloseMainContractRequest, CreateGuaranteeRequest, CreateMainContractRequest, MainContractDto,
    PatchGuaranteeRequest, PatchMainContractRequest, PutContractMilestonesRequest, SignMainContractRequest, TerminateMainContractRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { useProjectStore } from '@/store/project-store';
import { boqControlKeys } from '../boq-control/hooks';
import { hubKeys } from '../hub/hooks';
import { contractsApi } from './api';

export const contractKeys = {
    forProject: (projectId: string) => ['projects', projectId, 'main-contract'] as const,
    one: (contractId: string) => ['main-contracts', contractId] as const,
    guarantees: (contractId: string) => ['main-contracts', contractId, 'guarantees'] as const,
};

/** The effective contract of a project (null = none yet) and the ended ones. */
export function useProjectContract(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: contractKeys.forProject(projectId ?? ''),
        queryFn: () => contractsApi.forProject(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

/** One contract by id (the print page). */
export function useContract(contractId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: contractKeys.one(contractId ?? ''),
        queryFn: () => contractsApi.get(contractId ?? ''),
        enabled: signedIn && contractId !== undefined,
        staleTime: 0,
        gcTime: 0,
    });
}

export function useContractGuarantees(contractId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: contractKeys.guarantees(contractId ?? ''),
        queryFn: () => contractsApi.guarantees(contractId ?? ''),
        enabled: signedIn && contractId !== undefined,
        staleTime: 0,
    });
}

/** The contract changed: refresh the project's contract, the single copy and the hub roll-up. */
function useAfterContractChange() {
    const qc = useQueryClient();
    return (c: MainContractDto) => {
        void qc.invalidateQueries({ queryKey: contractKeys.forProject(c.projectId) });
        qc.setQueryData(contractKeys.one(c.id), c);
        void qc.invalidateQueries({ queryKey: hubKeys.detail(c.projectId) });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && q.queryKey[2] === 'hub' });
    };
}

export function useCreateContract(projectId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: (body: CreateMainContractRequest) => contractsApi.create(projectId, body), onSuccess: after });
}

export function usePatchContract(contractId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: (body: PatchMainContractRequest) => contractsApi.patch(contractId, body), onSuccess: after });
}

export function usePutContractMilestones(contractId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: (body: PutContractMilestonesRequest) => contractsApi.putMilestones(contractId, body), onSuccess: after });
}

/** Signing locks the BOQ baseline (when it was not locked) and moves the project to in_progress. */
export function useSignContract(contractId: string, projectId: string) {
    const after = useAfterContractChange();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: SignMainContractRequest) => contractsApi.sign(contractId, body),
        onSuccess: res => {
            after(res.contract);
            void qc.invalidateQueries({ queryKey: boqControlKeys.baseline(projectId) });
            void qc.invalidateQueries({ queryKey: boqControlKeys.versions(projectId) });
            void qc.invalidateQueries({ queryKey: boqControlKeys.costCodes(projectId) });
            const store = useProjectStore.getState();
            if (store.binding.kind === 'cloud' && store.binding.projectId === projectId) store.setCloudLocked(true);
        },
    });
}

export function useTerminateContract(contractId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: (body: TerminateMainContractRequest) => contractsApi.terminate(contractId, body), onSuccess: after });
}

export function useCancelContract(contractId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: () => contractsApi.cancel(contractId), onSuccess: after });
}

export function useCloseContract(contractId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: (body: CloseMainContractRequest) => contractsApi.close(contractId, body), onSuccess: after });
}

export function useAddSignedScan(contractId: string) {
    const after = useAfterContractChange();
    return useMutation({ mutationFn: (body: AddSignedScanRequest) => contractsApi.addSignedScan(contractId, body), onSuccess: after });
}

export function useAddGuarantee(contractId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateGuaranteeRequest) => contractsApi.addGuarantee(contractId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: contractKeys.guarantees(contractId) }); },
    });
}

export function usePatchGuarantee(contractId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { id: string; body: PatchGuaranteeRequest }) => contractsApi.patchGuarantee(v.id, v.body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: contractKeys.guarantees(contractId) }); },
    });
}
