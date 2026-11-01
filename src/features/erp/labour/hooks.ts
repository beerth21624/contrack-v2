'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    ApproveTimesheetsRequest, CreateWageAdvanceRequest, PatchWageAdvanceRequest, PayPayPeriodRequest, PutTimesheetDayRequest,
} from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { labourApi } from './api';

export const labourKeys = {
    day: (projectId: string, date: string) => ['projects', projectId, 'timesheets', date] as const,
    days: (projectId: string) => ['projects', projectId, 'timesheets'] as const,
    periods: (workspaceId: string, year: number | undefined) => ['workspaces', workspaceId, 'pay-periods', year ?? 'all'] as const,
    periodsAll: (workspaceId: string) => ['workspaces', workspaceId, 'pay-periods'] as const,
    period: (periodId: string) => ['pay-periods', periodId] as const,
    advances: (workspaceId: string) => ['workspaces', workspaceId, 'wage-advances'] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

export function useTimesheetDay(projectId: string | undefined, date: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: labourKeys.day(projectId ?? '', date ?? ''),
        queryFn: () => labourApi.getDay(projectId ?? '', date ?? ''),
        enabled: signedIn && projectId !== undefined && date !== undefined,
        staleTime: 0,
    });
}

/** The days of a week (or any list of dates), one query each, in the order given. */
export function useTimesheetDays(projectId: string | undefined, dates: readonly string[]) {
    const signedIn = useSignedIn();
    return useQueries({
        queries: dates.map(date => ({
            queryKey: labourKeys.day(projectId ?? '', date),
            queryFn: () => labourApi.getDay(projectId ?? '', date),
            enabled: signedIn && projectId !== undefined,
            staleTime: 0,
        })),
    });
}

export function usePutTimesheetDay(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { date: string; body: PutTimesheetDayRequest }) => labourApi.putDay(projectId, v.date, v.body),
        onSuccess: (_d, v) => {
            void qc.invalidateQueries({ queryKey: labourKeys.day(projectId, v.date) });
            void qc.invalidateQueries({ queryKey: ['workspaces'], predicate: q => q.queryKey[2] === 'pay-periods' });
        },
    });
}

export function useApproveTimesheets(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: ApproveTimesheetsRequest) => labourApi.approve(projectId, body),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: labourKeys.days(projectId) });
            void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'pay-periods' || q.queryKey[2] === 'approvals' || q.queryKey[2] === 'portal') });
            void qc.invalidateQueries({ queryKey: ['approvals'] });
        },
    });
}

export function usePayPeriods(workspaceId: string | undefined, year?: number) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: labourKeys.periods(workspaceId ?? '', year),
        queryFn: () => labourApi.listPeriods(workspaceId ?? '', year),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function usePayPeriod(periodId: string | null | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: labourKeys.period(periodId ?? ''),
        queryFn: () => labourApi.getPeriod(periodId ?? ''),
        enabled: signedIn && periodId !== null && periodId !== undefined,
        staleTime: 0,
    });
}

/** build / approve / pay of a period: every list and the period itself refetch (the answer is the new period). */
export function usePeriodAction(workspaceId: string, periodKey: string) {
    const qc = useQueryClient();
    const done = () => {
        void qc.invalidateQueries({ queryKey: labourKeys.periodsAll(workspaceId) });
        void qc.invalidateQueries({ queryKey: ['pay-periods'] });
        void qc.invalidateQueries({ queryKey: labourKeys.advances(workspaceId) });
        void qc.invalidateQueries({ queryKey: ['approvals'] });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'portal' || q.queryKey[2] === 'hub') });
    };
    return {
        build: useMutation({ mutationFn: () => labourApi.build(workspaceId, periodKey), onSuccess: done }),
        approve: useMutation({ mutationFn: () => labourApi.approvePeriod(workspaceId, periodKey), onSuccess: done }),
        pay: useMutation({ mutationFn: (body: PayPayPeriodRequest) => labourApi.pay(workspaceId, periodKey, body), onSuccess: done }),
    };
}

export function useWageAdvances(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: labourKeys.advances(workspaceId ?? ''),
        queryFn: () => labourApi.listAdvances(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function useCreateWageAdvance(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateWageAdvanceRequest) => labourApi.createAdvance(workspaceId, body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: labourKeys.advances(workspaceId) }); },
    });
}

export function usePatchWageAdvance(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { advanceId: string; body: PatchWageAdvanceRequest }) => labourApi.patchAdvance(v.advanceId, v.body),
        onSuccess: () => { void qc.invalidateQueries({ queryKey: labourKeys.advances(workspaceId) }); },
    });
}
