'use client';

import { useQuery } from '@tanstack/react-query';
import type { TaxReportKind } from '@/shared/contract';
import { useSession } from '@/features/cloud/auth/session';
import { taxReportsApi } from './api';

export const taxReportsKeys = {
    all: ['tax-reports'] as const,
    report: (workspaceId: string, kind: TaxReportKind, month: string) => ['tax-reports', 'report', workspaceId, kind, month] as const,
    summary: (workspaceId: string, month: string) => ['tax-reports', 'summary', workspaceId, month] as const,
};

export function useTaxReport(workspaceId: string | undefined, kind: TaxReportKind, month: string, enabled = true) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: taxReportsKeys.report(workspaceId ?? '', kind, month),
        queryFn: () => taxReportsApi.report(workspaceId ?? '', kind, month),
        enabled: enabled && signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}

export function useTaxSummary(workspaceId: string | undefined, month: string, enabled = true) {
    const signedIn = useSession(s => s.status === 'signed-in');
    return useQuery({
        queryKey: taxReportsKeys.summary(workspaceId ?? '', month),
        queryFn: () => taxReportsApi.summary(workspaceId ?? '', month),
        enabled: enabled && signedIn && workspaceId !== undefined,
        staleTime: 0,
    });
}
