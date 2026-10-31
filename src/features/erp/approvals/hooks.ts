'use client';

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ApprovalStatus, ApprovalSubject, DecideApprovalRequest, PutApprovalPolicyRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { approvalsApi } from './api';

const PAGE = 25;

export const approvalKeys = {
    all: (ws: string) => ['workspaces', ws, 'approvals'] as const,
    list: (ws: string, mine: boolean, status: ApprovalStatus | undefined) => ['workspaces', ws, 'approvals', 'list', mine, status ?? 'all'] as const,
    policies: (ws: string) => ['workspaces', ws, 'approval-policies'] as const,
    audit: (ws: string, entityType: string | undefined, entityId: string | undefined) => ['workspaces', ws, 'audit', entityType ?? '', entityId ?? ''] as const,
    auditAll: (ws: string) => ['workspaces', ws, 'audit'] as const,
};

/** Approval requests, newest first, paged by `nextBefore`. `mine`: pending ones the caller may decide. */
export function useApprovalList(workspaceId: string | undefined, opts: { mine: boolean; status?: ApprovalStatus }) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useInfiniteQuery({
        queryKey: approvalKeys.list(workspaceId ?? '', opts.mine, opts.status),
        queryFn: ({ pageParam }) => approvalsApi.list(workspaceId ?? '', {
            mine: opts.mine ? 'true' : undefined, status: opts.status, before: pageParam, limit: PAGE,
        }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: last => last.nextBefore ?? undefined,
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 15_000,
    });
}

/** Number of requests waiting for the caller (first page; for badges). */
export function usePendingApprovalCount(workspaceId: string | undefined, enabled = true): number {
    const signedIn = useSession(s => s.status === 'signed-in');
    const q = useQuery({
        queryKey: [...approvalKeys.all(workspaceId ?? ''), 'pending-count'],
        queryFn: () => approvalsApi.list(workspaceId ?? '', { mine: 'true', limit: 50 }),
        enabled: enabled && signedIn && workspaceId !== undefined,
        staleTime: 30_000,
        refetchInterval: 60_000,
        retry: false,
    });
    return q.data?.items.length ?? 0;
}

export function useDecideApproval(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { requestId: string } & DecideApprovalRequest) =>
            approvalsApi.decide(v.requestId, { decision: v.decision, note: v.note }),
        // Even a failed decision may mean the request changed meanwhile: always refresh.
        onSettled: () => Promise.all([
            qc.invalidateQueries({ queryKey: approvalKeys.all(workspaceId) }),
            qc.invalidateQueries({ queryKey: approvalKeys.auditAll(workspaceId) }),
        ]),
    });
}

export function useApprovalPolicies(workspaceId: string | undefined) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: approvalKeys.policies(workspaceId ?? ''),
        queryFn: () => approvalsApi.policies(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 30_000,
    });
}

export function usePutApprovalPolicy(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { subject: ApprovalSubject; body: PutApprovalPolicyRequest }) => approvalsApi.putPolicy(workspaceId, v.subject, v.body),
        onSuccess: () => Promise.all([
            qc.invalidateQueries({ queryKey: approvalKeys.policies(workspaceId) }),
            qc.invalidateQueries({ queryKey: approvalKeys.auditAll(workspaceId) }),
        ]),
    });
}

/** Audit events of one entity (or the whole workspace), newest first; `enabled` false when the caller lacks `audit.read`. */
export function useAuditEvents(workspaceId: string | undefined, entity: { entityType?: string; entityId?: string }, enabled: boolean) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useInfiniteQuery({
        queryKey: approvalKeys.audit(workspaceId ?? '', entity.entityType, entity.entityId),
        queryFn: ({ pageParam }) => approvalsApi.audit(workspaceId ?? '', { ...entity, before: pageParam, limit: 20 }),
        initialPageParam: undefined as string | undefined,
        getNextPageParam: last => last.nextBefore ?? undefined,
        enabled: enabled && signedIn && workspaceId !== undefined,
        staleTime: 15_000,
        retry: false,
    });
}
