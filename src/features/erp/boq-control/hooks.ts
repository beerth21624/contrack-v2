'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/cloud/auth/session';
import { type CompareTarget, boqControlApi } from './api';

export const boqControlKeys = {
    versions: (projectId: string) => ['projects', projectId, 'boq-versions'] as const,
    version: (versionId: string) => ['boq-versions', versionId] as const,
    compare: (projectId: string, from: string, to: CompareTarget) => ['projects', projectId, 'boq-versions', 'compare', from, to] as const,
};

/** Versions of a project, newest first (the server backfills older revisions on the first read). */
export function useBoqVersions(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: boqControlKeys.versions(projectId ?? ''),
        queryFn: () => boqControlApi.list(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        // A revision made on the BOQ page adds a version: always ask again when the page opens.
        staleTime: 0,
    });
}

export function useBoqVersion(versionId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: boqControlKeys.version(versionId ?? ''),
        queryFn: () => boqControlApi.get(versionId ?? ''),
        enabled: signedIn && versionId !== undefined,
        // A version never changes.
        staleTime: Infinity,
    });
}

export function useBoqCompare(projectId: string, from: string | undefined, to: CompareTarget | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: boqControlKeys.compare(projectId, from ?? '', to ?? ''),
        queryFn: () => boqControlApi.compare(projectId, from ?? '', to ?? 'live'),
        enabled: signedIn && from !== undefined && to !== undefined && from !== to,
        // Versions are frozen; the live side is recomputed each time the page asks again.
        staleTime: to === 'live' ? 0 : Infinity,
    });
}
