'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/features/cloud/auth/session';
import { priceReferenceApi } from './api';

export const priceReferenceKeys = {
    search: (ws: string, q: string) => ['workspaces', ws, 'price-reference', q] as const,
};

/** Items matching `q` (the picker debounces it). */
export function usePriceReferenceSearch(workspaceId: string | undefined, q: string, enabled = true) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: priceReferenceKeys.search(workspaceId ?? '', q),
        queryFn: () => priceReferenceApi.search(workspaceId ?? '', { q, limit: 50 }),
        enabled: enabled && signedIn && workspaceId !== undefined,
        staleTime: 5 * 60_000,
    });
}
