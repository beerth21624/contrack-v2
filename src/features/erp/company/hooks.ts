'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PutCompanyProfileRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { approvalKeys } from '../approvals/hooks';
import { companyApi } from './api';

export const companyKeys = {
    all: (ws: string) => ['workspaces', ws, 'company'] as const,
};

/** The company profile of a workspace (the defaults while nothing is saved). */
export function useCompanyProfile(workspaceId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: companyKeys.all(workspaceId ?? ''),
        queryFn: () => companyApi.get(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 30_000,
    });
}

export function usePutCompanyProfile(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: PutCompanyProfileRequest) => companyApi.put(workspaceId, body),
        onSuccess: data => {
            qc.setQueryData(companyKeys.all(workspaceId), data);
            void qc.invalidateQueries({ queryKey: approvalKeys.auditAll(workspaceId) });
        },
    });
}
