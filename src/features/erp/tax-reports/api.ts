import {
    type TaxReportDto, type TaxReportKind, type TaxReportSummaryDto, taxReportDtoSchema, taxReportSummaryDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { workspacePath } from '../shared/apiPaths';

export const taxReportsApi = {
    report: (workspaceId: string, kind: TaxReportKind, month: string): Promise<TaxReportDto> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'tax-reports', kind)}?month=${encodeURIComponent(month)}`, { schema: taxReportDtoSchema }),
    summary: (workspaceId: string, month: string): Promise<TaxReportSummaryDto> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'tax-reports', 'summary')}?month=${encodeURIComponent(month)}`, { schema: taxReportSummaryDtoSchema }),
};
