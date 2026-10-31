'use client';

// ─── The workspace an ERP screen works in: id, the caller's role, member count, solo (approvals auto-skip) ───
import type { Role } from '@/shared/contract';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';

export interface ErpWorkspace {
    /** undefined while the workspaces load, or for a guest. */
    workspaceId: string | undefined;
    role: Role | undefined;
    memberCount: number;
    /** One member only: approvals are skipped automatically (docs/erp/01-architecture.md §6.3). */
    isSolo: boolean;
    loading: boolean;
}

/**
 * The workspace chosen in the switcher (the same one `ModuleGate` and the menu follow), or `workspaceId` when a page
 * knows it (a project page: the project's workspace). Role and member count come from the workspace list (`GET /me`).
 */
export function useErpWorkspace(workspaceId?: string): ErpWorkspace {
    const { workspace: current, workspaces, isLoading } = useCurrentWorkspace();
    const workspace = workspaceId === undefined ? current : workspaces.find(w => w.id === workspaceId);
    const memberCount = workspace?.memberCount ?? 0;
    return {
        workspaceId: workspace?.id ?? workspaceId,
        role: workspace?.role,
        memberCount,
        isSolo: workspace !== undefined && memberCount <= 1,
        loading: isLoading,
    };
}
