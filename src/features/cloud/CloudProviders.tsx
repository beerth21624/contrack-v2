'use client';

import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from './query/client';

/** TanStack Query for the whole app (server state: me, workspaces, projects, revisions, …). */
export function CloudProviders({ children }: { children: ReactNode }) {
    const queryClient = getQueryClient();
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
