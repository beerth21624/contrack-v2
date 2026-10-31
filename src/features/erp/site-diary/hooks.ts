'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PatchSiteIssueRequest, PutSiteReportRequest, SiteIssueStatus } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { hubKeys } from '../hub/hooks';
import { boqControlKeys } from '../boq-control/hooks';
import { siteDiaryApi } from './api';

export const siteDiaryKeys = {
    all: (projectId: string) => ['projects', projectId, 'site-diary'] as const,
    list: (projectId: string, from: string, to: string) => ['projects', projectId, 'site-diary', 'list', from, to] as const,
    report: (projectId: string, date: string) => ['projects', projectId, 'site-diary', 'day', date] as const,
    progress: (projectId: string) => ['projects', projectId, 'site-diary', 'progress'] as const,
    issues: (projectId: string, status: string) => ['projects', projectId, 'site-issues', status] as const,
};

function useSignedIn(): boolean {
    return useSession(s => s.status === 'signed-in');
}

export function useSiteReports(projectId: string | undefined, from?: string, to?: string) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: siteDiaryKeys.list(projectId ?? '', from ?? '', to ?? ''),
        queryFn: () => siteDiaryApi.list(projectId ?? '', from, to),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useSiteReport(projectId: string | undefined, date: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: siteDiaryKeys.report(projectId ?? '', date ?? ''),
        queryFn: () => siteDiaryApi.get(projectId ?? '', date ?? ''),
        enabled: signedIn && projectId !== undefined && date !== undefined,
        staleTime: 0,
    });
}

export function useSiteProgress(projectId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: siteDiaryKeys.progress(projectId ?? ''),
        queryFn: () => siteDiaryApi.progress(projectId ?? ''),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

export function useSiteIssues(projectId: string | undefined, status?: SiteIssueStatus) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: siteDiaryKeys.issues(projectId ?? '', status ?? 'all'),
        queryFn: () => siteDiaryApi.issues(projectId ?? '', status),
        enabled: signedIn && projectId !== undefined,
        staleTime: 0,
    });
}

/** Saving, submitting or reopening a report moves the reports list, the S-curve, issues, cost-code progress and the hub card. */
function useAfterReportChange(projectId: string, date: string) {
    const qc = useQueryClient();
    return () => {
        void qc.invalidateQueries({ queryKey: siteDiaryKeys.all(projectId) });
        void qc.invalidateQueries({ queryKey: ['projects', projectId, 'site-issues'] });
        void qc.invalidateQueries({ queryKey: siteDiaryKeys.report(projectId, date) });
        void qc.invalidateQueries({ queryKey: boqControlKeys.costCodes(projectId) });
        void qc.invalidateQueries({ queryKey: hubKeys.detail(projectId) });
        void qc.invalidateQueries({ predicate: q => q.queryKey[0] === 'workspaces' && (q.queryKey[2] === 'hub' || q.queryKey[2] === 'portal') });
    };
}

export function useSaveSiteReport(projectId: string, date: string) {
    const after = useAfterReportChange(projectId, date);
    return useMutation({ mutationFn: (body: PutSiteReportRequest) => siteDiaryApi.put(projectId, date, body), onSuccess: after });
}

export function useSubmitSiteReport(projectId: string, date: string) {
    const after = useAfterReportChange(projectId, date);
    return useMutation({ mutationFn: () => siteDiaryApi.submit(projectId, date), onSuccess: after });
}

export function useReopenSiteReport(projectId: string, date: string) {
    const after = useAfterReportChange(projectId, date);
    return useMutation({ mutationFn: () => siteDiaryApi.reopen(projectId, date), onSuccess: after });
}

export function usePatchSiteIssue(projectId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (v: { issueId: string; body: PatchSiteIssueRequest }) => siteDiaryApi.patchIssue(v.issueId, v.body),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ['projects', projectId, 'site-issues'] });
            void qc.invalidateQueries({ queryKey: siteDiaryKeys.all(projectId) });
        },
    });
}
