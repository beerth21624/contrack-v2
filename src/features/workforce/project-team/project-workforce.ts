'use client';

// ─── The open project's side of the workforce module, gated so guest projects never ask the server ───
// The planning header ("ทีมงาน" step), the crew calendar and its print call these on every project. For a guest
// project (or a cloud project while the module is off) they return "off" / undefined without any request, so those
// pages behave exactly as before the module existed.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Role } from '@/shared/contract';
import { buildTaskCrewMap, type TaskCrewMap } from '@/domain/workforce';
import { useSession } from '@/features/cloud/auth/session';
import { assignmentsKey, crewsKey, useWorkforceState, workforceApi } from '@/features/cloud/api/workforce';
import { useProjectStore } from '@/store/project-store';

export interface OpenCloudProject { workspaceId: string; projectId: string; role: Role }

/** Name shown for a crew the workspace no longer lists (archived). */
export const UNKNOWN_CREW_NAME = 'ทีมที่เก็บถาวรแล้ว';

/** Where the company's crews and people are managed. */
export const WORKSPACE_CREWS_HREF = '/workspace/crews';

/** The open cloud project (workspace, project, the user's role); undefined for the guest project. */
export function useOpenCloudProject(): OpenCloudProject | undefined {
    const workspaceId = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.workspaceId : undefined));
    const projectId = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.projectId : undefined));
    const role = useProjectStore(s => (s.binding.kind === 'cloud' ? s.binding.role : undefined));
    return useMemo(
        () => (workspaceId === undefined || projectId === undefined || role === undefined ? undefined : { workspaceId, projectId, role }),
        [workspaceId, projectId, role],
    );
}

/**
 * Whether the module applies to the open project: 'off' for a guest project or when the server does not offer it,
 * 'loading' while a cloud project waits for the answer, 'on' otherwise. Asks the server only for a cloud project.
 */
export function useProjectWorkforceState(): 'off' | 'loading' | 'on' {
    const cloud = useOpenCloudProject();
    const state = useWorkforceState(cloud?.workspaceId);
    return cloud === undefined ? 'off' : state;
}

/**
 * Crew names per task of the open project, for the crew calendar (screen and print). undefined — and nothing asked —
 * for a guest project or while the module is off; undefined too while loading and when no crew is assigned, so the
 * calendar stays exactly as it is without crews.
 */
export function useProjectTaskCrews(): TaskCrewMap | undefined {
    const cloud = useOpenCloudProject();
    const on = useProjectWorkforceState() === 'on';
    const signedIn = useSession(s => s.status === 'signed-in');
    const workspaceId = cloud?.workspaceId ?? '-';
    const filter = useMemo(() => ({ projectId: cloud?.projectId }), [cloud?.projectId]);
    const enabled = on && signedIn && cloud !== undefined;
    const assignments = useQuery({
        queryKey: assignmentsKey(workspaceId, filter),
        queryFn: () => workforceApi.listAssignments(workspaceId, filter),
        enabled,
    });
    const any = (assignments.data?.length ?? 0) > 0;
    const crews = useQuery({
        queryKey: crewsKey(workspaceId),
        queryFn: () => workforceApi.listCrews(workspaceId),
        enabled: enabled && any,
    });
    return useMemo(() => {
        if (!enabled || assignments.data === undefined || assignments.data.length === 0 || crews.data === undefined) return undefined;
        const names = new Map(crews.data.map(c => [c.id, c.name]));
        return buildTaskCrewMap(assignments.data, id => names.get(id), UNKNOWN_CREW_NAME);
    }, [enabled, assignments.data, crews.data]);
}
