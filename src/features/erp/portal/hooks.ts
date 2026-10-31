'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/cloud/auth/session';
import { portalApi } from './api';

export const portalKeys = {
    all: (ws: string) => ['workspaces', ws, 'portal'] as const,
    home: (ws: string) => ['workspaces', ws, 'portal', 'home'] as const,
    search: (ws: string, q: string) => ['workspaces', ws, 'portal', 'search', q] as const,
};

export function usePortal(workspaceId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: portalKeys.home(workspaceId ?? ''),
        queryFn: () => portalApi.get(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 30_000,
    });
}

/** `q` is already trimmed and debounced by the caller; empty = no request. */
export function useGlobalSearch(workspaceId: string | undefined, q: string) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: portalKeys.search(workspaceId ?? '', q),
        queryFn: () => portalApi.search(workspaceId ?? '', q),
        enabled: signedIn && workspaceId !== undefined && q !== '',
        staleTime: 10_000,
    });
}
