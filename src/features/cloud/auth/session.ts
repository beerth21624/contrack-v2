// ─── Who is signed in (memory only; the refresh cookie is what survives a reload) ───
import { create } from 'zustand';
import type { UserDto } from '@/shared/contract';
import { apiClient } from '../api/client';
import { api } from '../api/routes';
import { useCloud } from '../state';

export type SessionStatus = 'unknown' | 'guest' | 'signed-in';

interface SessionState {
    /** unknown = still asking the server on app start (the UI does not wait for it: guest mode works meanwhile). */
    status: SessionStatus;
    user: UserDto | null;
    accessToken: string | null;
}

export const useSession = create<SessionState>()(() => ({ status: 'unknown', user: null, accessToken: null }));

apiClient.onAuthChange(auth => {
    const userId = auth?.user.id ?? null;
    // Another user (or none): their own remembered workspace choice.
    if (userId !== (useSession.getState().user?.id ?? null)) useCloud.getState().loadWorkspaceFor(userId);
    useSession.setState(auth
        ? { status: 'signed-in', user: auth.user, accessToken: auth.accessToken }
        : { status: 'guest', user: null, accessToken: null });
});

let bootstrapped: Promise<void> | null = null;

/**
 * On app start: a valid refresh cookie signs the user in; anything else (no cookie, offline, no backend) = guest.
 * A browser that surely has no cookie is a guest without asking: a guest is not an error (no 401 in the console).
 */
export function bootstrapSession(): Promise<void> {
    bootstrapped ??= (apiClient.mayHaveSession ? api.auth.refresh() : Promise.resolve(null)).then(auth => {
        if (!auth && useSession.getState().status === 'unknown') useSession.setState({ status: 'guest' });
    });
    return bootstrapped;
}

export function initials(name: string): string {
    // "ช่างประเสริฐ (ถอดแบบ)": a note in brackets is not part of the name (it gave "ช(").
    const bare = name.replace(/\([^)]*\)/g, ' ').trim();
    const words = (bare === '' ? name.trim() : bare).split(/\s+/).filter(w => w !== '');
    const first = words[0] ?? '?';
    const second = words[1];
    return (second === undefined ? first.slice(0, 2) : `${first.slice(0, 1)}${second.slice(0, 1)}`).toUpperCase();
}
