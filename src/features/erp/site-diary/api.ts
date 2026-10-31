import {
    type PatchSiteIssueRequest, type PutSiteReportRequest, type SiteIssueDto, type SiteIssueStatus, type SiteProgressDto, type SiteReportDto,
    type SiteReportSummaryDto, patchSiteIssueRequestSchema, siteIssueDtoSchema, siteIssueListDtoSchema, siteProgressDtoSchema, siteReportDtoSchema,
    siteReportListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

const report = { schema: siteReportDtoSchema };

export const siteDiaryApi = {
    list: (projectId: string, from?: string, to?: string): Promise<SiteReportSummaryDto[]> => {
        const q = new URLSearchParams();
        if (from !== undefined) q.set('from', from);
        if (to !== undefined) q.set('to', to);
        const qs = q.toString();
        return apiClient.request('GET', `${projectPath(projectId, 'site-diary')}${qs === '' ? '' : `?${qs}`}`, { schema: siteReportListDtoSchema })
            .then(r => r.items);
    },
    get: (projectId: string, date: string): Promise<SiteReportDto> =>
        apiClient.request('GET', projectPath(projectId, 'site-diary', date), report),
    put: (projectId: string, date: string, body: PutSiteReportRequest): Promise<SiteReportDto> =>
        apiClient.request('PUT', projectPath(projectId, 'site-diary', date), { body, ...report }),
    submit: (projectId: string, date: string): Promise<SiteReportDto> =>
        apiClient.request('POST', projectPath(projectId, 'site-diary', date, 'submit'), { body: {}, ...report }),
    reopen: (projectId: string, date: string): Promise<SiteReportDto> =>
        apiClient.request('POST', projectPath(projectId, 'site-diary', date, 'reopen'), { body: {}, ...report }),
    progress: (projectId: string): Promise<SiteProgressDto> =>
        apiClient.request('GET', projectPath(projectId, 'site-diary', 'progress'), { schema: siteProgressDtoSchema }),
    issues: (projectId: string, status?: SiteIssueStatus): Promise<SiteIssueDto[]> =>
        apiClient.request('GET', `${projectPath(projectId, 'site-issues')}${status === undefined ? '' : `?status=${status}`}`, { schema: siteIssueListDtoSchema })
            .then(r => r.items),
    patchIssue: (issueId: string, body: PatchSiteIssueRequest): Promise<SiteIssueDto> =>
        apiClient.request('PATCH', apiPath('site-issues', issueId), { body: patchSiteIssueRequestSchema.parse(body), schema: siteIssueDtoSchema }),
};
