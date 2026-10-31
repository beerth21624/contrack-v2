'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSupplierInput, CreateSupplierRatingInput, PatchSupplierInput, SupplierDto } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { approvalKeys } from '../approvals/hooks';
import { type SupplierListParams, suppliersApi } from './api';

export const supplierKeys = {
    all: (ws: string) => ['workspaces', ws, 'suppliers'] as const,
    list: (ws: string, p: SupplierListParams) =>
        ['workspaces', ws, 'suppliers', 'list', p.q ?? '', p.kind ?? '', p.trade ?? '', p.archived === true] as const,
    detail: (id: string) => ['suppliers', id] as const,
    ratings: (id: string) => ['suppliers', id, 'ratings'] as const,
};

/** Suppliers of a workspace (active ones unless `archived`). */
export function useSuppliers(workspaceId: string | undefined, params: SupplierListParams = {}) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: supplierKeys.list(workspaceId ?? '', params),
        queryFn: () => suppliersApi.list(workspaceId ?? '', params),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 15_000,
    });
}

export function useSupplier(supplierId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: supplierKeys.detail(supplierId ?? ''),
        queryFn: () => suppliersApi.get(supplierId ?? ''),
        enabled: signedIn && supplierId !== undefined,
        staleTime: 15_000,
    });
}

export function useSupplierRatings(supplierId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: supplierKeys.ratings(supplierId ?? ''),
        queryFn: () => suppliersApi.ratings(supplierId ?? ''),
        enabled: signedIn && supplierId !== undefined,
        staleTime: 15_000,
    });
}

function useAfterChange(workspaceId: string | undefined) {
    const qc = useQueryClient();
    return (s: SupplierDto) => {
        qc.setQueryData(supplierKeys.detail(s.id), s);
        const ws = workspaceId ?? s.workspaceId;
        void qc.invalidateQueries({ queryKey: supplierKeys.all(ws) });
        void qc.invalidateQueries({ queryKey: approvalKeys.auditAll(ws) });
    };
}

export function useCreateSupplier(workspaceId: string) {
    const after = useAfterChange(workspaceId);
    return useMutation({ mutationFn: (body: CreateSupplierInput) => suppliersApi.create(workspaceId, body), onSuccess: after });
}

export function usePatchSupplier(supplierId: string) {
    const after = useAfterChange(undefined);
    return useMutation({ mutationFn: (body: PatchSupplierInput) => suppliersApi.patch(supplierId, body), onSuccess: after });
}

export function useSetSupplierArchived(supplierId: string) {
    const after = useAfterChange(undefined);
    return useMutation({
        mutationFn: (archived: boolean) => (archived ? suppliersApi.archive(supplierId) : suppliersApi.restore(supplierId)),
        onSuccess: after,
    });
}

export function useImportScSuppliers(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => suppliersApi.importSc(workspaceId),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: supplierKeys.all(workspaceId) });
            void qc.invalidateQueries({ queryKey: approvalKeys.auditAll(workspaceId) });
        },
    });
}

export function useRateSupplier(supplierId: string) {
    const after = useAfterChange(undefined);
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateSupplierRatingInput) => suppliersApi.rate(supplierId, body),
        onSuccess: r => {
            after(r.supplier);
            void qc.invalidateQueries({ queryKey: supplierKeys.ratings(supplierId) });
        },
    });
}
