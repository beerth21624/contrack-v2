// ─── The TanStack Query client (one per browser tab; a fresh one per server render) ───
import { QueryClient } from '@tanstack/react-query';
import { isApiError, isRetryable } from '../api/errors';

export function makeQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30_000,
                // Only retry what may work a moment later (no connection, server busy), never 403/404/….
                retry: (failures, error) => failures < 2 && isRetryable(error) && !(isApiError(error) && error.status === 401),
                refetchOnWindowFocus: true,
            },
            mutations: { retry: false },
        },
    });
}

let browserClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
    if (typeof window === 'undefined') return makeQueryClient();
    browserClient ??= makeQueryClient();
    return browserClient;
}
