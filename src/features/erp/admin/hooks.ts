'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ModuleId, PutEntitlementRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { moduleKeys, usePlatformModules } from '@/features/modules/modules';
import { adminApi } from './api';

export const adminKeys = {
    status: ['platform', 'admin', 'status'] as const,
    workspaces: (q: string, limit: number) => ['platform', 'admin', 'workspaces', q, limit] as const,
    allWorkspaces: ['platform', 'admin', 'workspaces'] as const,
};

/** Whether the signed-in user is a platform admin: false for everybody else and while unknown. */
export function usePlatformAdminStatus(): { admin: boolean; loading: boolean } {
    const signedIn = useSession(s => s.status === 'signed-in');
    const userId = useSession(s => s.user?.id);
    // A server that offers no module (plain BOQ) has nothing to grant: the admin area is never asked about.
    const platform = usePlatformModules();
    const offered = (platform.data?.length ?? 0) > 0;
    const q = useQuery({
        queryKey: [...adminKeys.status, userId],
        queryFn: async () => (await adminApi.status()).admin,
        enabled: signedIn && offered,
        staleTime: 5 * 60_000,
        retry: false,
    });
    return { admin: q.data === true, loading: signedIn && (platform.isLoading || q.isLoading) };
}

export function useAdminWorkspaces(q: string, limit: number, enabled: boolean) {
    return useQuery({
        queryKey: adminKeys.workspaces(q, limit),
        queryFn: () => adminApi.workspaces({ q, limit }),
        enabled,
        staleTime: 15_000,
    });
}

/** Sets one entitlement; refreshes the admin list and the workspace's own module list. */
export function useSetEntitlement() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { workspaceId: string; module: ModuleId; body: PutEntitlementRequest }) =>
            adminApi.putEntitlement(v.workspaceId, v.module, v.body),
        onSuccess: (_row, v) => Promise.all([
            qc.invalidateQueries({ queryKey: adminKeys.allWorkspaces }),
            qc.invalidateQueries({ queryKey: moduleKeys.workspace(v.workspaceId) }),
        ]),
    });
}
