'use client';

// ─── Business modules on/off in the web app (docs/marketplace/README.md §1) ───
// Every menu entry, route and button of a business module asks `useModuleEnabled` first. When the platform or the
// current workspace switched the module off, the app looks exactly like plain BOQ estimation.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    type ModuleId, type PutWorkspaceModuleRequest, type WorkspaceModuleDto, platformModulesDtoSchema,
    workspaceModuleDtoSchema, workspaceModulesDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { useSession } from '@/features/cloud/auth/session';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { useProjectStore } from '@/store/project-store';

const seg = (s: string) => encodeURIComponent(s);

export const modulesApi = {
    platform: () => apiClient.request('GET', '/platform/modules', { schema: platformModulesDtoSchema, auth: false }),
    ofWorkspace: (workspaceId: string) =>
        apiClient.request('GET', `/workspaces/${seg(workspaceId)}/modules`, { schema: workspaceModulesDtoSchema }),
    put: (workspaceId: string, module: ModuleId, body: PutWorkspaceModuleRequest): Promise<WorkspaceModuleDto> =>
        apiClient.request('PUT', `/workspaces/${seg(workspaceId)}/modules/${seg(module)}`, { body, schema: workspaceModuleDtoSchema }),
};

export const moduleKeys = {
    platform: ['platform', 'modules'] as const,
    workspace: (workspaceId: string) => ['workspaces', workspaceId, 'modules'] as const,
};

/** What this server offers at all (public; [] when the backend cannot be reached). */
export function usePlatformModules() {
    return useQuery({
        queryKey: moduleKeys.platform,
        queryFn: async () => (await modulesApi.platform()).modules,
        staleTime: 5 * 60_000,
        retry: 1,
    });
}

export function useWorkspaceModules(workspaceId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    // A server that offers no module (plain BOQ) is never asked about workspace switches.
    const offered = (usePlatformModules().data?.length ?? 0) > 0;
    return useQuery({
        queryKey: moduleKeys.workspace(workspaceId ?? ''),
        queryFn: () => modulesApi.ofWorkspace(workspaceId ?? ''),
        enabled: signedIn && offered && workspaceId !== undefined,
        staleTime: 60_000,
    });
}

/** The module is on for `workspaceId` (default: the current workspace). false while unknown (nothing flashes in). */
export function useModuleEnabled(module: ModuleId, workspaceId?: string): { enabled: boolean; loading: boolean; workspaceId: string | undefined } {
    // Same workspace as the menu and the buyer pages: the open cloud project's, else the one chosen in the switcher.
    const open = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.workspaceId : undefined));
    const current = useCurrentWorkspace().workspace?.id;
    const ws = workspaceId ?? open ?? current;
    const q = useWorkspaceModules(ws);
    const row = q.data?.find(m => m.module === module);
    return { enabled: row?.enabled === true, loading: q.isLoading, workspaceId: ws };
}

/** The platform offers the module (vendor side: crews do not switch modules on, the buyer does). */
export function usePlatformModuleEnabled(module: ModuleId): { enabled: boolean; loading: boolean } {
    const q = usePlatformModules();
    return { enabled: q.data?.includes(module) === true, loading: q.isLoading };
}

export function usePutWorkspaceModule(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ module, body }: { module: ModuleId; body: PutWorkspaceModuleRequest }) => modulesApi.put(workspaceId, module, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: moduleKeys.workspace(workspaceId) }); },
    });
}
