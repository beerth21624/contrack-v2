'use client';

// ─── Business modules on/off in the web app (docs/marketplace/README.md §1) ───
// Every menu entry, route and button of a business module asks `useModuleEnabled` (= `active`, all four layers) first. When the platform or the
// current workspace switched the module off, the app looks exactly like plain BOQ estimation.
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    type ModuleId, type PutWorkspaceModuleRequest, type StartTrialResponse, type WorkspaceModuleDto, platformModulesDtoSchema,
    startTrialResponseSchema, workspaceModuleDtoSchema, workspaceModulesDtoSchema,
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
    startTrial: (workspaceId: string, module: ModuleId): Promise<StartTrialResponse> =>
        apiClient.request('POST', `/workspaces/${seg(workspaceId)}/modules/${seg(module)}/trial`, { schema: startTrialResponseSchema }),
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

/** The workspace the menu and the pages of a module follow: `workspaceId`, else the open cloud project's, else the switcher's. */
function useModuleWorkspaceId(workspaceId?: string): string | undefined {
    const open = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.workspaceId : undefined));
    const current = useCurrentWorkspace().workspace?.id;
    return workspaceId ?? open ?? current;
}

/** The module is active for `workspaceId` (default: the current workspace): all four layers agree. false while unknown (nothing flashes in). */
export function useModuleEnabled(module: ModuleId, workspaceId?: string): { enabled: boolean; loading: boolean; workspaceId: string | undefined } {
    const ws = useModuleWorkspaceId(workspaceId);
    const q = useWorkspaceModules(ws);
    const row = q.data?.find(m => m.module === module);
    return { enabled: row?.active === true, loading: q.isLoading, workspaceId: ws };
}

/** The workspace's state of one module (entitlement, trial, missing dependencies); `state` is undefined while unknown. */
export function useModuleState(module: ModuleId, workspaceId?: string): { state: WorkspaceModuleDto | undefined; loading: boolean; workspaceId: string | undefined } {
    const ws = useModuleWorkspaceId(workspaceId);
    const q = useWorkspaceModules(ws);
    return { state: q.data?.find(m => m.module === module), loading: q.isLoading, workspaceId: ws };
}

/** Every active module of `workspaceId` (default: the current workspace); empty while loading. */
export function useActiveModules(workspaceId?: string): ReadonlySet<ModuleId> {
    const ws = useModuleWorkspaceId(workspaceId);
    const { data } = useWorkspaceModules(ws);
    return useMemo(() => new Set<ModuleId>((data ?? []).filter(m => m.active).map(m => m.module)), [data]);
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

/** Starts the 30-day trial of a module (and of the dependencies without a grant); the answer carries every module, so no reload. */
export function useStartTrial(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (module: ModuleId) => modulesApi.startTrial(workspaceId, module),
        onSuccess: (res) => { qc.setQueryData(moduleKeys.workspace(workspaceId), res.modules); },
    });
}
