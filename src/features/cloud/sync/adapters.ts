// ─── Browser adapters of the sync engine: localStorage queue, navigator.onLine, the zustand project store ───
import type { Project } from '@/domain/project';
import { useProjectStore } from '@/store/project-store';
import type { NetworkState, PersistedQueue, QueueStorage, SyncStore } from './engine';

const QUEUE_PREFIX = 'contrack-sync:';

export function queueKey(projectId: string): string {
    return `${QUEUE_PREFIX}${projectId}`;
}

function storage(): Storage | undefined {
    try {
        return typeof localStorage === 'undefined' ? undefined : localStorage;
    } catch {
        return undefined;
    }
}

/** The unsent edits of one cloud project, kept in localStorage so they survive a reload or a closed tab. */
export function localQueueStorage(projectId: string): QueueStorage {
    const key = queueKey(projectId);
    return {
        load: () => {
            try {
                const raw = storage()?.getItem(key);
                if (raw === null || raw === undefined) return null;
                const parsed = JSON.parse(raw) as Partial<PersistedQueue>;
                return parsed.pending && typeof parsed.pending === 'object' ? { pending: parsed.pending } : null;
            } catch {
                return null;
            }
        },
        save: (queue) => {
            try {
                if (Object.keys(queue.pending).length === 0) storage()?.removeItem(key);
                else storage()?.setItem(key, JSON.stringify(queue));
            } catch (e) {
                console.warn('could not save the sync queue', e);
            }
        },
    };
}

/** Number of unsent edits saved for a project (shown in the project list). */
export function savedPendingCount(projectId: string): number {
    return Object.keys(localQueueStorage(projectId).load()?.pending ?? {}).length;
}

export const browserNetwork: NetworkState = {
    isOnline: () => typeof navigator === 'undefined' || navigator.onLine,
    subscribe: (listener) => {
        if (typeof window === 'undefined') return () => undefined;
        const on = () => { listener(true); };
        const off = () => { listener(false); };
        window.addEventListener('online', on);
        window.addEventListener('offline', off);
        return () => {
            window.removeEventListener('online', on);
            window.removeEventListener('offline', off);
        };
    },
};

/**
 * The project store seen by the engine of one cloud project: only its working copy. Changes made while another
 * binding is active (the guest project, another cloud project) are never reported.
 */
export function projectStoreAdapter(projectId: string): SyncStore {
    const bound = () => {
        const b = useProjectStore.getState().binding;
        return b.kind === 'cloud' && b.projectId === projectId;
    };
    return {
        getProject: () => useProjectStore.getState().project,
        setProject: (project: Project) => {
            if (bound()) useProjectStore.getState().replaceProject(project);
        },
        subscribe: (listener) => useProjectStore.subscribe((s, prev) => {
            const sameProject = prev.binding.kind === 'cloud' && prev.binding.projectId === projectId;
            if (s.project !== prev.project && bound() && sameProject) listener(s.project);
        }),
    };
}
