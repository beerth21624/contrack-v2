'use client';

import { useQueryClient } from '@tanstack/react-query';
import { portalKeys } from './hooks';

/** Reloads the portal after something it shows changed (e.g. a trial was started). */
export function usePortalRefresh(workspaceId: string): () => void {
    const qc = useQueryClient();
    return () => { void qc.invalidateQueries({ queryKey: portalKeys.home(workspaceId) }); };
}
