'use client';

// ─── TanStack Query hooks of the buyer screens (no realtime yet: package / leveling poll every 30 s) ───
import { useMutation, useQueries, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import type {
    AddendumRequest, AnswerQuestionRequest, AwardRequest, CancelRequest, CreateInvitationsRequest, CreatePackageRequest,
    CreateVendorListEntryRequest, ExtendDeadlineRequest, ImportVendorListRequest, ManualBidRequest, ProjectDto, Role,
    SendMessageRequest, UpdatePackageRequest, UpdateVendorListEntryRequest,
} from '@/shared/contract';
import { computeProject } from '@/domain/project';
import { useSession } from '@/features/cloud/auth/session';
import { useCurrentWorkspace } from '@/features/cloud/query/hooks';
import { useCloud } from '@/features/cloud/state';
import { useProjectStore } from '@/store/project-store';
import { isModuleDisabled } from '../contracts/logic';
import { scApi, scKeys, type VendorListQuery } from './api';

/** Polls every 30 s, and stops while the server says the module is off (404 module_disabled). */
const POLL = {
    refetchInterval: (q: { state: { error: unknown } }) => (isModuleDisabled(q.state.error) ? false : 30_000),
    refetchOnWindowFocus: true,
} as const;
const useSignedIn = () => useSession(s => s.status === 'signed-in');

// ── context: the open cloud project, the workspace and the role ──

export interface BuyerContext {
    /** The open cloud project (null when none is open). */
    project: ProjectDto | null;
    /** Workspace of the open project, else the current workspace. */
    workspaceId: string | undefined;
    role: Role | undefined;
}

export function useBuyerContext(): BuyerContext {
    const project = useCloud(s => s.project);
    const binding = useProjectStore(s => s.binding);
    const current = useCurrentWorkspace().workspace;
    const open = project !== null && binding.kind === 'cloud' && binding.projectId === project.id ? project : null;
    if (open !== null && binding.kind === 'cloud') return { project: open, workspaceId: open.workspaceId, role: binding.role };
    return { project: null, workspaceId: current?.id, role: current?.role };
}

/** Live BOQ + plan of the working copy (the open cloud project), computed once per change. */
export function useLiveProjectResult() {
    const project = useProjectStore(s => s.project);
    return useMemo(() => computeProject(project), [project]);
}

// ── reads ──

/** Module settings of a workspace: one hook and one cache key (scKeys.settings) for the buyer and contract screens. */
export { useScSettings } from '../contracts/api';

export function useVendorList(ws: string | undefined, query: VendorListQuery = {}) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.vendorList(ws ?? '-', query),
        queryFn: () => scApi.vendorList(ws ?? '', query),
        enabled: signedIn && ws !== undefined,
    });
}

export function useOverview(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.overview(projectId ?? '-'),
        queryFn: () => scApi.overview(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        ...POLL,
    });
}

export function usePackages(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.packages(projectId ?? '-'),
        queryFn: () => scApi.packages(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        ...POLL,
    });
}

export function usePackage(id: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.package(id ?? '-'),
        queryFn: () => scApi.package(id ?? ''),
        enabled: signedIn && id !== undefined,
        ...POLL,
    });
}

/** Details of several packages (e.g. to know which BOQ rows other live packages already hold). */
export function usePackageDetails(ids: readonly string[]) {
    const signedIn = useSignedIn();
    return useQueries({
        queries: ids.map(id => ({
            queryKey: scKeys.package(id),
            queryFn: () => scApi.package(id),
            enabled: signedIn,
            staleTime: 60_000,
        })),
    });
}

export function useInvitations(packageId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.invitations(packageId ?? '-'),
        queryFn: () => scApi.invitations(packageId ?? ''),
        enabled: signedIn && packageId !== undefined,
        ...POLL,
    });
}

export function useQuestions(packageId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.questions(packageId ?? '-'),
        queryFn: () => scApi.questions(packageId ?? ''),
        enabled: signedIn && packageId !== undefined,
        ...POLL,
    });
}

export function useLeveling(packageId: string | undefined, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.leveling(packageId ?? '-'),
        queryFn: () => scApi.leveling(packageId ?? ''),
        enabled: signedIn && enabled && packageId !== undefined,
        ...POLL,
    });
}

export function useBids(packageId: string | undefined, enabled = true) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.bids(packageId ?? '-'),
        queryFn: () => scApi.bids(packageId ?? ''),
        enabled: signedIn && enabled && packageId !== undefined,
        ...POLL,
    });
}

export function useMessages(invitationId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: scKeys.messages(invitationId ?? '-'),
        queryFn: () => scApi.messages(invitationId ?? ''),
        enabled: signedIn && invitationId !== undefined,
        refetchInterval: (q: { state: { error: unknown } }) => (isModuleDisabled(q.state.error) ? false : 15_000),
        refetchOnWindowFocus: true,
    });
}

// ── writes ──

/** Everything that shows a package: its detail, its sub-resources and the project lists / overview. */
function invalidatePackage(qc: QueryClient, packageId: string) {
    void qc.invalidateQueries({ queryKey: scKeys.package(packageId) });
    invalidateProjectViews(qc);
}

/** Package lists (['sc', 'packages', projectId]) and overviews (['sc', 'overview', projectId]) of every project. */
export function invalidateProjectViews(qc: QueryClient) {
    void qc.invalidateQueries({ queryKey: ['sc', 'packages'] });
    void qc.invalidateQueries({ queryKey: ['sc', 'overview'] });
}

export function useCreateVendor(ws: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateVendorListEntryRequest) => scApi.createVendor(ws, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.vendorLists(ws) }); },
    });
}

export function useUpdateVendor(ws: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ entryId, body }: { entryId: string; body: UpdateVendorListEntryRequest }) => scApi.updateVendor(entryId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.vendorLists(ws) }); },
    });
}

export function useDeleteVendor(ws: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (entryId: string) => scApi.deleteVendor(entryId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.vendorLists(ws) }); },
    });
}

export function useImportVendors(ws: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: ImportVendorListRequest) => scApi.importVendors(ws, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.vendorLists(ws) }); },
    });
}

export function useCreatePackage(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreatePackageRequest) => scApi.createPackage(projectId, body),
        onSuccess: (pkg) => {
            qc.setQueryData(scKeys.package(pkg.id), pkg);
            void qc.invalidateQueries({ queryKey: scKeys.packages(projectId) });
            void qc.invalidateQueries({ queryKey: scKeys.overview(projectId) });
        },
    });
}

export function useUpdatePackage(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: UpdatePackageRequest) => scApi.updatePackage(packageId, body),
        onSuccess: (pkg) => { qc.setQueryData(scKeys.package(pkg.id), pkg); invalidatePackage(qc, packageId); },
    });
}

export function useDeletePackage() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (packageId: string) => scApi.deletePackage(packageId),
        onSuccess: (_v, packageId) => {
            qc.removeQueries({ queryKey: scKeys.package(packageId) });
            invalidateProjectViews(qc);
        },
    });
}

export function useAttachFile(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => scApi.attachFile(packageId, fileId),
        onSuccess: (pkg) => { qc.setQueryData(scKeys.package(pkg.id), pkg); },
    });
}

export function useDetachFile(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (fileId: string) => scApi.detachFile(packageId, fileId),
        onSuccess: (pkg) => { qc.setQueryData(scKeys.package(pkg.id), pkg); },
    });
}

export function useAddendum(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AddendumRequest) => scApi.addendum(packageId, body),
        onSuccess: (pkg) => { qc.setQueryData(scKeys.package(pkg.id), pkg); invalidatePackage(qc, packageId); },
    });
}

export function useExtendDeadline(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: ExtendDeadlineRequest) => scApi.extend(packageId, body),
        onSuccess: (pkg) => { qc.setQueryData(scKeys.package(pkg.id), pkg); invalidatePackage(qc, packageId); },
    });
}

export function useCancelPackage(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CancelRequest) => scApi.cancel(packageId, body),
        onSuccess: (pkg) => { qc.setQueryData(scKeys.package(pkg.id), pkg); invalidatePackage(qc, packageId); },
    });
}

export function useInvite(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateInvitationsRequest) => scApi.invite(packageId, body),
        onSuccess: () => { invalidatePackage(qc, packageId); },
    });
}

export function useResendInvitation(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (invitationId: string) => scApi.resend(invitationId),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.invitations(packageId) }); },
    });
}

export function useWithdrawInvitation(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (invitationId: string) => scApi.withdraw(invitationId),
        onSuccess: () => { invalidatePackage(qc, packageId); },
    });
}

export function useAnswerQuestion(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ questionId, body }: { questionId: string; body: AnswerQuestionRequest }) => scApi.answer(questionId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.questions(packageId) }); },
    });
}

export function useManualBid(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ invitationId, body }: { invitationId: string; body: ManualBidRequest }) => scApi.manualBid(invitationId, body),
        onSuccess: () => { invalidatePackage(qc, packageId); },
    });
}

export function useSendMessage(invitationId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: SendMessageRequest) => scApi.sendMessage(invitationId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: scKeys.messages(invitationId) }); },
    });
}

export function useAward(packageId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: AwardRequest) => scApi.award(packageId, body),
        onSuccess: () => {
            invalidatePackage(qc, packageId);
            // The new contracts show up in the contracts list (contracts/api.ts scKeys.list prefix).
            void qc.invalidateQueries({ queryKey: ['sc', 'contracts', 'list'] });
        },
    });
}
