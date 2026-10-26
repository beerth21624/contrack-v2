'use client';

// ─── The current time for countdowns, shared by every component (one timer), stepped to keep re-renders rare ───
import { useSyncExternalStore } from 'react';

const listeners = new Set<() => void>();
let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (timer === null) {
        now = Date.now();
        timer = setInterval(() => {
            now = Date.now();
            for (const l of listeners) l();
        }, 1000);
    }
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && timer !== null) {
            clearInterval(timer);
            timer = null;
        }
    };
}

/**
 * Milliseconds since epoch, rounded down to `stepMs` (the component re-renders only when that value changes).
 * 0 while rendering on the server / hydrating: treat 0 as "not known yet".
 */
export function useNow(stepMs = 30_000): number {
    return useSyncExternalStore(
        subscribe,
        () => {
            if (now === 0) now = Date.now();
            return Math.floor(now / stepMs) * stepMs;
        },
        () => 0,
    );
}
