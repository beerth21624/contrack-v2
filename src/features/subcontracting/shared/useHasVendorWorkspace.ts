'use client';

// ─── Whether the signed-in user runs a subcontractor crew (has a vendor profile): shows "งานรับเหมาช่วง" in the menu ───
import { useQuery } from '@tanstack/react-query';
import { myVendorsDtoSchema } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { useSession } from '@/features/cloud/auth/session';
import { usePlatformModuleEnabled } from '@/features/modules/modules';

export function useHasVendorWorkspace(): boolean {
    const signedIn = useSession(s => s.status === 'signed-in');
    const platform = usePlatformModuleEnabled('subcontracting').enabled;
    const q = useQuery({
        queryKey: ['vendor', 'me'],
        queryFn: () => apiClient.request('GET', '/vendor/me', { schema: myVendorsDtoSchema }),
        enabled: signedIn && platform,
        staleTime: 5 * 60_000,
        retry: false,
    });
    return (q.data?.length ?? 0) > 0;
}
