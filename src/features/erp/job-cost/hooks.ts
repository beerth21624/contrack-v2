'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JobCostReportDto, PutCashSettingsRequest, PutJobCostForecastRequest } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { jobCostApi } from './api';

export const jobCostKeys = {
    report: (projectId: string) => ['projects', projectId, 'job-cost'] as const,
    ledger: (projectId: string, costCodeId: string | undefined) => ['projects', projectId, 'job-cost-ledger', costCodeId ?? 'all'] as const,
    projectCash: (projectId: string, weeks: number, pastWeeks: number) => ['projects', projectId, 'cash-flow', weeks, pastWeeks] as const,
    companyCash: (workspaceId: string, weeks: number, pastWeeks: number) => ['workspaces', workspaceId, 'cash-flow', weeks, pastWeeks] as const,
    settings: (workspaceId: string) => ['workspaces', workspaceId, 'cash-settings'] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

/** Opening the report writes on the server (alerts), so it is asked again every time the page opens. */
export function useJobCostReport(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: jobCostKeys.report(projectId ?? ''),
        queryFn: () => jobCostApi.report(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useJobCostLedger(projectId: string, costCodeId: string | undefined, enabled: boolean) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: jobCostKeys.ledger(projectId, costCodeId),
        queryFn: () => jobCostApi.ledger(projectId, costCodeId),
        enabled: signedIn && enabled,
        staleTime: 0,
    });
}

export function usePutForecast(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { costCodeId: string; body: PutJobCostForecastRequest }) => jobCostApi.putForecast(projectId, v.costCodeId, v.body),
        onSuccess: (data: JobCostReportDto) => {
            qc.setQueryData(jobCostKeys.report(projectId), data);
        },
    });
}

export function useProjectCashFlow(projectId: string | undefined, weeks: number, pastWeeks: number) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: jobCostKeys.projectCash(projectId ?? '', weeks, pastWeeks),
        queryFn: () => jobCostApi.projectCash(projectId ?? '', weeks, pastWeeks),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useCompanyCashFlow(workspaceId: string | undefined, weeks: number, pastWeeks: number) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: jobCostKeys.companyCash(workspaceId ?? '', weeks, pastWeeks),
        queryFn: () => jobCostApi.companyCash(workspaceId ?? '', weeks, pastWeeks),
        enabled: signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function usePutCashSettings(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: PutCashSettingsRequest) => jobCostApi.putSettings(workspaceId, body),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'cash-flow'] });
            void qc.invalidateQueries({ queryKey: jobCostKeys.settings(workspaceId) });
        },
    });
}
