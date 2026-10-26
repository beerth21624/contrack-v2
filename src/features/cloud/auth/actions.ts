// ─── Sign out: leave the cloud project (guest project comes back), revoke the session, forget server data ───
import type { QueryClient } from '@tanstack/react-query';
import { api } from '../api/routes';
import { closeCloudProject } from '../projects/controller';

export async function signOut(queryClient: QueryClient): Promise<void> {
    await closeCloudProject();
    try {
        await api.auth.logout();
    } catch (e) {
        // Signed out in this tab anyway (the client dropped the token); the server forgets the cookie when it expires.
        console.warn('logout request failed', e);
    }
    queryClient.clear();
}
