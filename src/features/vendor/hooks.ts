'use client';

// ─── TanStack Query hooks of the vendor screens (keys under ['vendor', …]) ───
// Every hook waits for the platform flag of the module: while the platform has subcontracting off the crew app shows
// one calm page (VendorShell) and asks the server nothing, and polling stops.
import { useQuery } from '@tanstack/react-query';
import type { MyVendorsDto } from '@/shared/contract';
import { isApiError, isRetryable } from '@/features/cloud/api/errors';
import { useSession } from '@/features/cloud/auth/session';
import { usePlatformModuleEnabled } from '@/features/modules/modules';
import { isModuleDisabled, vendorApi, vk } from './api';
import { useVendorWorkspaceStore } from './workspace-store';

/** Inbox and contract pages poll (the buyer acts on the other side). */
export const POLL_MS = 30_000;

/** Same limit as the contractor bell (src/features/notifications), so both read one cache entry under ['notifications']. */
export const NOTIFICATIONS_LIMIT = 20;

export const useSignedIn = () => useSession(s => s.status === 'signed-in');

/** The platform offers subcontracting (false while unknown: nothing is fetched before it is known). */
export const usePlatformOn = () => usePlatformModuleEnabled('subcontracting').enabled;

/** The client default (retry only what may work a moment later), and never a 404 module_disabled. */
const retry = (failures: number, error: Error) =>
    !isModuleDisabled(error) && failures < 2 && isRetryable(error) && !(isApiError(error) && error.status === 401);

/** Poll every `ms`, except after the server said the module is off. */
const poll = (ms: number) => (q: { state: { error: unknown } }) => (isModuleDisabled(q.state.error) ? false : ms);

/** Signed in and the platform has the module on. */
function useLive(): boolean {
    const signedIn = useSignedIn();
    const on = usePlatformOn();
    return signedIn && on;
}

export function useAccount() {
    const enabled = useLive();
    return useQuery({ queryKey: vk.account, queryFn: () => vendorApi.account(), enabled, retry });
}

export function useGuestPackage(token: string | null) {
    const on = usePlatformOn();
    return useQuery({
        queryKey: vk.guest(token ?? ''),
        queryFn: () => vendorApi.guest.get(token ?? ''),
        enabled: on && token !== null && token !== '',
        retry: false,
    });
}

export function useMyVendors() {
    const enabled = useLive();
    return useQuery({ queryKey: vk.me, queryFn: () => vendorApi.me(), enabled, retry });
}

export interface VendorWorkspace {
    /** The crew the user works as (the remembered choice, else the first). undefined while loading or when none. */
    current: MyVendorsDto[number] | undefined;
    all: MyVendorsDto;
    isLoading: boolean;
    /** The list could not be loaded. */
    error: Error | null;
    /** Loaded and the user has no crew profile at all. */
    none: boolean;
    select: (workspaceId: string) => void;
}

export function useVendorWorkspace(): VendorWorkspace {
    const q = useMyVendors();
    const selected = useVendorWorkspaceStore(s => s.selected);
    const select = useVendorWorkspaceStore(s => s.select);
    const all = q.data ?? [];
    const current = all.find(v => v.workspaceId === selected) ?? all[0];
    return { current, all, isLoading: q.isPending && q.fetchStatus !== 'idle', none: q.isSuccess && all.length === 0, error: q.error, select };
}

export function useProfile(workspaceId: string | undefined) {
    const on = usePlatformOn();
    return useQuery({
        queryKey: vk.profile(workspaceId ?? ''),
        queryFn: () => vendorApi.profile(workspaceId ?? ''),
        enabled: on && workspaceId !== undefined,
        retry,
    });
}

export function useInbox(workspaceId: string | undefined) {
    const on = usePlatformOn();
    return useQuery({
        queryKey: vk.inbox(workspaceId ?? ''),
        queryFn: () => vendorApi.inbox(workspaceId ?? ''),
        enabled: on && workspaceId !== undefined,
        refetchInterval: poll(POLL_MS),
        retry,
    });
}

export function useMySubcontracts(workspaceId: string | undefined) {
    const on = usePlatformOn();
    return useQuery({
        queryKey: vk.subcontracts(workspaceId ?? ''),
        queryFn: () => vendorApi.subcontracts(workspaceId ?? ''),
        enabled: on && workspaceId !== undefined,
        refetchInterval: poll(POLL_MS),
        retry,
    });
}

export function useInvitation(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.invitation(id), queryFn: () => vendorApi.invitation.get(id), enabled, refetchInterval: poll(POLL_MS), retry });
}

export function useBidState(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.bid(id), queryFn: () => vendorApi.invitation.bid(id), enabled, refetchOnWindowFocus: false, retry });
}

export function useMessages(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.messages(id), queryFn: () => vendorApi.invitation.messages(id), enabled, refetchInterval: poll(POLL_MS), retry });
}

export function useSubcontract(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.contract(id), queryFn: () => vendorApi.contract.get(id), enabled, refetchInterval: poll(POLL_MS), retry });
}

export function useContractDocument(id: string, enabled: boolean) {
    const live = useLive();
    return useQuery({ queryKey: vk.document(id), queryFn: () => vendorApi.contract.document(id), enabled: live && enabled, retry });
}

export function useClaims(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.claims(id), queryFn: () => vendorApi.contract.claims(id), enabled, refetchInterval: poll(POLL_MS), retry });
}

export function useVariations(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.variations(id), queryFn: () => vendorApi.contract.variations(id), enabled, refetchInterval: poll(POLL_MS), retry });
}

export function useRetentionEntries(id: string) {
    const enabled = useLive();
    return useQuery({ queryKey: vk.retention(id), queryFn: () => vendorApi.contract.retention(id), enabled, retry });
}

/** The bell: same key and request as the contractor bell, so marking read in either updates both. */
export function useNotifications() {
    const enabled = useLive();
    return useQuery({
        queryKey: vk.notifications,
        queryFn: () => vendorApi.notifications.list(NOTIFICATIONS_LIMIT),
        enabled,
        refetchInterval: poll(60_000),
        retry,
    });
}
