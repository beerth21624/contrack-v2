'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { HubProjectDetailDto, UpdateHubProjectRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { approvalKeys } from '../approvals/hooks';
import { type HubListParams, hubApi } from './api';

export const hubKeys = {
    all: (ws: string) => ['workspaces', ws, 'hub'] as const,
    list: (ws: string, p: HubListParams) =>
        ['workspaces', ws, 'hub', 'list', p.q ?? '', (p.status ?? []).join(','), p.customerId ?? '', p.type ?? '', p.archived === true] as const,
    summary: (ws: string) => ['workspaces', ws, 'hub', 'summary'] as const,
    detail: (projectId: string) => ['projects', projectId, 'hub'] as const,
};

/** The projects of a workspace with their hub fields and roll-ups. */
export function useHubProjects(workspaceId: string | undefined, params: HubListParams = {}) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: hubKeys.list(workspaceId ?? '', params),
        queryFn: () => hubApi.list(workspaceId ?? '', params),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 15_000,
    });
}

export function useHubSummary(workspaceId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: hubKeys.summary(workspaceId ?? ''),
        queryFn: () => hubApi.summary(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 15_000,
    });
}

export function useHubProject(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: hubKeys.detail(projectId ?? ''),
        queryFn: () => hubApi.get(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 15_000,
    });
}

function useAfterChange() {
    const qc = useQueryClient();
    return (d: HubProjectDetailDto) => {
        qc.setQueryData(hubKeys.detail(d.project.id), d);
        const ws = d.project.workspaceId;
        void qc.invalidateQueries({ queryKey: hubKeys.all(ws) });
        void qc.invalidateQueries({ queryKey: approvalKeys.auditAll(ws) });
    };
}

export function usePatchHubProject(projectId: string) {
    const after = useAfterChange();
    return useMutation({ mutationFn: (body: UpdateHubProjectRequest) => hubApi.patch(projectId, body), onSuccess: after });
}

/** Issues the next project code from the numbering service (409 when the project already has one). */
export function useAssignProjectCode() {
    const after = useAfterChange();
    return useMutation({ mutationFn: (projectId: string) => hubApi.assignCode(projectId), onSuccess: after });
}
