// ─── UI state of the cloud side: selected workspace, the open cloud project, its sync status and presence ───
import { create } from 'zustand';
import type { PresenceEntry, ProjectDto } from '@/shared/contract';
import type { SyncEngine, SyncStatus } from './sync/engine';

const WORKSPACE_KEY = 'contrack-workspace';

function readWorkspace(): string | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage.getItem(WORKSPACE_KEY);
    } catch {
        return null;
    }
}

interface CloudState {
    /** Workspace chosen in the switcher (null = the first one, normally the personal workspace). */
    workspaceId: string | null;
    /** The cloud project that is the working copy (null in guest mode). */
    project: ProjectDto | null;
    engine: SyncEngine | null;
    syncStatus: SyncStatus;
    /** Members on the open project (from realtime), including this user. */
    presence: PresenceEntry[];
    /** A cloud project is being opened (detail loading). */
    opening: boolean;
    selectWorkspace: (workspaceId: string | null) => void;
}

export const SAVED_STATUS: SyncStatus = { state: 'saved', count: 0 };

export const useCloud = create<CloudState>()((set) => ({
    workspaceId: readWorkspace(),
    project: null,
    engine: null,
    syncStatus: SAVED_STATUS,
    presence: [],
    opening: false,
    selectWorkspace: (workspaceId) => {
        try {
            if (workspaceId === null) localStorage.removeItem(WORKSPACE_KEY);
            else localStorage.setItem(WORKSPACE_KEY, workspaceId);
        } catch {
            // private mode: the choice lasts for this page only
        }
        set({ workspaceId });
    },
}));

/** Plain Thai text of a sync status. */
export function syncStatusText(s: SyncStatus): string {
    switch (s.state) {
        case 'saved': return 'บันทึกแล้ว';
        case 'saving': return 'กำลังบันทึก…';
        case 'pending': return `รอส่ง ${String(s.count)} รายการ`;
        case 'offline': return s.count > 0 ? `ออฟไลน์ · รอส่ง ${String(s.count)} รายการ` : 'ออฟไลน์';
    }
}
