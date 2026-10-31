'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { BaselineStatusDto } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { useProjectStore } from '@/store/project-store';
import { hubKeys } from '../hub/hooks';
import { type CompareTarget, boqControlApi } from './api';

export const boqControlKeys = {
    versions: (projectId: string) => ['projects', projectId, 'boq-versions'] as const,
    version: (versionId: string) => ['boq-versions', versionId] as const,
    compare: (projectId: string, from: string, to: CompareTarget) => ['projects', projectId, 'boq-versions', 'compare', from, to] as const,
    baseline: (projectId: string) => ['projects', projectId, 'baseline'] as const,
    costCodes: (projectId: string) => ['projects', projectId, 'cost-codes'] as const,
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

/** Baseline state of a project (locked, the active baseline, history, why unlocking is refused). */
export function useBaseline(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: boqControlKeys.baseline(projectId ?? ''),
        queryFn: () => boqControlApi.baseline(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

/** Cost codes of a project (baseline → VO → manual); cost fields are null without `cost.read`. */
export function useCostCodes(projectId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: boqControlKeys.costCodes(projectId ?? ''),
        queryFn: () => boqControlApi.costCodes(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 30_000,
    });
}

/** After a lock / unlock: new state in the cache, versions and cost codes again, the open working copy follows. */
function useAfterBaselineChange(projectId: string) {
    const qc = useQueryClient();
    return (st: BaselineStatusDto) => {
        qc.setQueryData(boqControlKeys.baseline(projectId), st);
        void qc.invalidateQueries({ queryKey: boqControlKeys.versions(projectId) });
        void qc.invalidateQueries({ queryKey: boqControlKeys.costCodes(projectId) });
        void qc.invalidateQueries({ queryKey: hubKeys.detail(projectId) });
        const store = useProjectStore.getState();
        if (store.binding.kind === 'cloud' && store.binding.projectId === projectId) store.setCloudLocked(st.locked);
    };
}

/** Lock the BOQ as a baseline: a chosen version, or (none) a new revision of the current BOQ. */
export function useLockBaseline(projectId: string) {
    const after = useAfterBaselineChange(projectId);
    return useMutation({
        mutationFn: (versionId: string | undefined) => boqControlApi.lock(projectId, versionId === undefined ? {} : { versionId }),
        onSuccess: after,
    });
}

export function useUnlockBaseline(projectId: string) {
    const after = useAfterBaselineChange(projectId);
    return useMutation({ mutationFn: (reason: string) => boqControlApi.unlock(projectId, { reason }), onSuccess: after });
}
