'use client';

// ─── useDevMode: server permission (DEV_MODE) × this browser's toggle ───
// `active` is what UI code checks: true only when the server allows dev mode AND the user switched it on.
// The toggle is remembered per browser (localStorage, every access in try/catch); default off.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { loadDevModeAllowed } from './config';

const STORAGE_KEY = 'contrack-dev-mode';

interface State { allowed: boolean; enabled: boolean }

let state: State = { allowed: false, enabled: readStored() };
const listeners = new Set<() => void>();
let loading = false;

function readStored(): boolean {
    try { return typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

function writeStored(on: boolean): void {
    try {
        if (on) window.localStorage.setItem(STORAGE_KEY, '1');
        else window.localStorage.removeItem(STORAGE_KEY);
    } catch { /* private window / blocked storage: the toggle lasts for this page only */ }
}

function set(next: Partial<State>): void {
    state = { ...state, ...next };
    listeners.forEach(l => l());
}

function subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
}

const SERVER_STATE: State = { allowed: false, enabled: false };

export interface DevMode {
    /** The server allows dev mode (DEV_MODE=true). */
    allowed: boolean;
    /** This browser's toggle. */
    enabled: boolean;
    /** allowed && enabled — show dev-mode UI only when this is true. */
    active: boolean;
    setEnabled: (on: boolean) => void;
}

export function useDevMode(): DevMode {
    const s = useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
    useEffect(() => {
        if (loading) return;
        loading = true;
        void loadDevModeAllowed().then(allowed => set({ allowed, enabled: readStored() }));
    }, []);
    const setEnabled = useCallback((on: boolean) => { writeStored(on); set({ enabled: on }); }, []);
    return { allowed: s.allowed, enabled: s.enabled, active: s.allowed && s.enabled, setEnabled };
}
