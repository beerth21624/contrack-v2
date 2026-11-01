// ─── UI state of the cloud side: selected workspace, the open cloud project, its sync status and presence ───
import { create } from 'zustand';
import type { PresenceEntry, ProjectDto } from '@/shared/contract';
import type { SyncEngine, SyncStatus } from './sync/engine';

/** localStorage: the workspace each user last chose in a switcher (per user, so a shared browser keeps both). */
const workspaceKey = (userId: string) => `contrack-workspace:${userId}`;

/** The workspace this user last chose explicitly (null = never, or no storage). */
export function readRememberedWorkspace(userId: string): string | null {
    try {
        return typeof localStorage === 'undefined' ? null : localStorage.getItem(workspaceKey(userId));
    } catch {
        return null;
    }
}

interface CloudState {
    /**
     * Workspace the signed-in user last chose explicitly (switcher, new workspace, accepted invitation), remembered per
     * user. null = nothing chosen: the open project's workspace, else the first one (normally the personal workspace).
     */
    workspaceId: string | null;
    /** The cloud project that is the working copy (null in guest mode). */
    project: ProjectDto | null;
    engine: SyncEngine | null;
    syncStatus: SyncStatus;
    /** Members on the open project (from realtime), including this user. */
    presence: PresenceEntry[];
    /** A cloud project is being opened (detail loading). */
    opening: boolean;
    /** An explicit choice of the user (remembered for `userId`). */
    selectWorkspace: (workspaceId: string | null) => void;
    /** Signed-in user changed: load what that user chose last. */
    loadWorkspaceFor: (userId: string | null) => void;
}

let currentUser: string | null = null;

export const SAVED_STATUS: SyncStatus = { state: 'saved', count: 0 };

export const useCloud = create<CloudState>()((set) => ({
    workspaceId: null,
    project: null,
    engine: null,
    syncStatus: SAVED_STATUS,
    presence: [],
    opening: false,
    selectWorkspace: (workspaceId) => {
        if (currentUser !== null) {
            try {
                if (workspaceId === null) localStorage.removeItem(workspaceKey(currentUser));
                else localStorage.setItem(workspaceKey(currentUser), workspaceId);
            } catch {
                // private mode: the choice lasts for this page only
            }
        }
        set({ workspaceId });
    },
    loadWorkspaceFor: (userId) => {
        currentUser = userId;
        set({ workspaceId: userId === null ? null : readRememberedWorkspace(userId) });
    },
}));
