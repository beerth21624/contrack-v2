'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DocType, PutNumberingSeriesRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { approvalKeys } from '../approvals/hooks';
import { numberingApi } from './api';

export const numberingKeys = {
    all: (ws: string) => ['workspaces', ws, 'numbering'] as const,
};

/** Every document type's series with the next number (a preview: nothing is reserved). */
export function useNumberingSeries(workspaceId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: numberingKeys.all(workspaceId ?? ''),
        queryFn: () => numberingApi.list(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 15_000,
    });
}

export function usePutNumberingSeries(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { docType: DocType; body: PutNumberingSeriesRequest }) => numberingApi.put(workspaceId, v.docType, v.body),
        // A refused change (409 period_has_documents) may mean numbers were issued meanwhile: always refresh.
        onSettled: () => Promise.all([
            qc.invalidateQueries({ queryKey: numberingKeys.all(workspaceId) }),
            qc.invalidateQueries({ queryKey: approvalKeys.auditAll(workspaceId) }),
        ]),
    });
}
