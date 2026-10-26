'use client';

// ─── Which crew (vendor workspace) the signed-in user works as, remembered in this browser ───
import { create } from 'zustand';

const KEY = 'contrack.vendor.workspace';

function read(): string | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage.getItem(KEY);
    } catch {
        return null;
    }
}

function write(id: string | null): void {
    try {
        if (id === null) window.localStorage.removeItem(KEY);
        else window.localStorage.setItem(KEY, id);
    } catch {
        // private mode / blocked storage: the choice lasts for this page only
    }
}

interface VendorWorkspaceState {
    selected: string | null;
    select: (workspaceId: string | null) => void;
}

export const useVendorWorkspaceStore = create<VendorWorkspaceState>()(set => ({
    selected: read(),
    select: (workspaceId) => {
        write(workspaceId);
        set({ selected: workspaceId });
    },
}));
