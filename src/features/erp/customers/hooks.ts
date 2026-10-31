'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateCustomerInput, CustomerDto, PatchCustomerRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { approvalKeys } from '../approvals/hooks';
import { type CustomerListParams, customersApi } from './api';

export const customerKeys = {
    all: (ws: string) => ['workspaces', ws, 'customers'] as const,
    list: (ws: string, p: CustomerListParams) => ['workspaces', ws, 'customers', 'list', p.q ?? '', p.kind ?? '', p.archived === true] as const,
    detail: (id: string) => ['customers', id] as const,
};

/** Customers of a workspace (active ones unless `archived`). */
export function useCustomers(workspaceId: string | undefined, params: CustomerListParams = {}) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: customerKeys.list(workspaceId ?? '', params),
        queryFn: () => customersApi.list(workspaceId ?? '', params),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 15_000,
    });
}

export function useCustomer(customerId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: customerKeys.detail(customerId ?? ''),
        queryFn: () => customersApi.get(customerId ?? ''),
        enabled: signedIn && customerId !== undefined,
        staleTime: 15_000,
    });
}

function useAfterChange(workspaceId: string | undefined) {
    const qc = useQueryClient();
    return (c: CustomerDto) => {
        qc.setQueryData(customerKeys.detail(c.id), c);
        const ws = workspaceId ?? c.workspaceId;
        void qc.invalidateQueries({ queryKey: customerKeys.all(ws) });
        void qc.invalidateQueries({ queryKey: approvalKeys.auditAll(ws) });
    };
}

export function useCreateCustomer(workspaceId: string) {
    const after = useAfterChange(workspaceId);
    return useMutation({ mutationFn: (body: CreateCustomerInput) => customersApi.create(workspaceId, body), onSuccess: after });
}

export function usePatchCustomer(customerId: string) {
    const after = useAfterChange(undefined);
    return useMutation({ mutationFn: (body: PatchCustomerRequest) => customersApi.patch(customerId, body), onSuccess: after });
}

export function useSetCustomerArchived(customerId: string) {
    const after = useAfterChange(undefined);
    return useMutation({
        mutationFn: (archived: boolean) => (archived ? customersApi.archive(customerId) : customersApi.restore(customerId)),
        onSuccess: after,
    });
}
