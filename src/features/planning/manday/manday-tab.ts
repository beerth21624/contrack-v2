'use client';

// ─── The Man-Day page tab (แผนคน-วัน | อัตราค่าแรง), remembered in this browser ───
// localStorage is a per-viewer convenience: it may be missing or throw (private window, blocked site data), so every
// access is guarded and the page falls back to the plan tab. The server render (and hydration) always shows the plan
// tab; useSyncExternalStore switches to the saved tab right after, without a setState in an effect.
import { useCallback, useSyncExternalStore } from 'react';

export type ManDayTab = 'plan' | 'rates';
export const MANDAY_TAB_KEY = 'contrack-manday-tab';

/** A stored value → a tab (anything unknown → the plan tab). */
export const parseManDayTab = (stored: string | null | undefined): ManDayTab => (stored === 'rates' ? 'rates' : 'plan');

const listeners = new Set<() => void>();
/** The last tab chosen in this page session, used when localStorage can't be written. */
let memory: ManDayTab | null = null;

function read(): ManDayTab {
    if (memory !== null) return memory;
    try {
        return parseManDayTab(window.localStorage.getItem(MANDAY_TAB_KEY));
    } catch {
        return 'plan';
    }
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
        if (e.key !== MANDAY_TAB_KEY) return;
        memory = null;
        listener();
    };
    window.addEventListener('storage', onStorage);
    return () => {
        listeners.delete(listener);
        window.removeEventListener('storage', onStorage);
    };
}

export function useManDayTab(): [ManDayTab, (tab: ManDayTab) => void] {
    const tab = useSyncExternalStore(subscribe, read, () => 'plan' as const);
    const setTab = useCallback((next: ManDayTab) => {
        memory = next;
        try {
            window.localStorage.setItem(MANDAY_TAB_KEY, next);
        } catch {
            // Not saved: the tab still switches for this page session.
        }
        for (const l of listeners) l();
    }, []);
    return [tab, setTab];
}
