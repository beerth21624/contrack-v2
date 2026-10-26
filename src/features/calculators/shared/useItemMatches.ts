'use client';

// ─── AI catalogue matching for free text in pick-lists: the hook ───
// Batches every unmatched row text of the page into one request (600 ms after typing stops, at once on blur and
// on first render of a loaded project), remembers answers in the module-level store so a text is never asked
// twice, aborts a request the next edit made stale, and stays silent when the module is off, the user is
// signed out, or the request fails (404 `module_disabled` is remembered for the workspace).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Catalogue, PickRow } from '@/domain/calculators/shared/pick-list';
import { api } from '@/features/cloud/api/routes';
import { isApiError } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { useModuleEnabled } from '@/features/modules/modules';
import {
    MATCH_LIMITS, catalogueTexts, itemMatchStore, rememberResponse, unmatchedTexts, type ItemSuggestion, type MatchStore,
} from './itemMatch';

export const ITEM_MATCH_DEBOUNCE_MS = 600;

export interface ItemMatches {
    /** The suggestion for a row's item text, or undefined (nothing to show). */
    suggestionFor: (text: string) => ItemSuggestion | undefined;
    /** "ไม่ใช่": remembered for the session, never asked again. */
    decline: (text: string) => void;
    /** Ask now (on blur) instead of waiting for the debounce. */
    flush: () => void;
}

export function useItemMatches(rows: readonly PickRow[], catalogue: Catalogue, store: MatchStore = itemMatchStore): ItemMatches {
    const signedIn = useSession(s => s.status === 'signed-in');
    const { enabled, workspaceId } = useModuleEnabled('ai-assist');
    // Bumped when the store learns something, so rows re-render with their suggestions.
    const [, setVersion] = useState(0);
    const bump = useCallback(() => setVersion(v => v + 1), []);

    const pending = store.pending(unmatchedTexts(rows, catalogue));
    const pendingKey = pending.join('\n');
    const active = signedIn && enabled && workspaceId !== undefined && !store.isDisabled(workspaceId) && pending.length > 0;

    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const controller = useRef<AbortController | null>(null);
    const firstRun = useRef(true);
    // What the next request should ask, kept in a ref so `flush` can run it without stale closures.
    const ask = useRef<(() => void) | null>(null);

    useEffect(() => {
        ask.current = null;
        // `active` carries workspaceId !== undefined (TS narrows through the const alias).
        if (!active) return;
        const inputs = pending.slice(0, MATCH_LIMITS.inputs);
        const wsId = workspaceId;

        const send = () => {
            ask.current = null;
            controller.current?.abort();
            const ac = new AbortController();
            controller.current = ac;
            api.ai.matchItems(wsId, { catalogue: catalogueTexts(catalogue), inputs }, ac.signal)
                .then(res => {
                    if (ac.signal.aborted) return;
                    rememberResponse(store, inputs, res.matches);
                    bump();
                })
                .catch((e: unknown) => {
                    if (ac.signal.aborted) return;
                    if (isApiError(e) && e.status === 404 && e.code === 'module_disabled') { store.markDisabled(wsId); bump(); }
                    // Anything else: silently nothing (no toast, no console noise).
                });
        };
        ask.current = send;
        // A loaded project asks at once; typing waits until it stops.
        const delay = firstRun.current ? 0 : ITEM_MATCH_DEBOUNCE_MS;
        firstRun.current = false;
        timer.current = setTimeout(send, delay);
        return () => {
            if (timer.current !== null) clearTimeout(timer.current);
            timer.current = null;
            // The rows changed under an in-flight request: its answer is for a stale list.
            controller.current?.abort();
            controller.current = null;
        };
        // `pending` is derived from `pendingKey`; `catalogue` is a module constant per page.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active, workspaceId, pendingKey, store, bump]);

    const flush = useCallback(() => {
        if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
        ask.current?.();
    }, []);

    const decline = useCallback((text: string) => { store.decline(text); bump(); }, [store, bump]);
    const suggestionFor = useCallback((text: string) => store.suggestionFor(catalogue, text), [store, catalogue]);

    return { suggestionFor, decline, flush };
}
