import {
    type HubProjectDetailDto, type HubProjectDto, type HubProjectStatus, type HubSummaryDto, type ProjectType,
    type UpdateHubProjectRequest, hubProjectDetailDtoSchema, hubProjectListDtoSchema, hubSummaryDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { projectPath, workspacePath } from '../shared/apiPaths';

export interface HubListParams {
    q?: string;
    status?: readonly HubProjectStatus[];
    customerId?: string;
    type?: ProjectType;
    archived?: boolean;
}

export const hubApi = {
    list: (workspaceId: string, p: HubListParams): Promise<HubProjectDto[]> => {
        const qs = new URLSearchParams();
        if (p.q !== undefined && p.q.trim() !== '') qs.set('q', p.q.trim());
        if (p.status !== undefined && p.status.length > 0) qs.set('status', p.status.join(','));
        if (p.customerId !== undefined) qs.set('customerId', p.customerId);
        if (p.type !== undefined) qs.set('type', p.type);
        if (p.archived === true) qs.set('archived', 'true');
        const query = qs.toString();
        return apiClient.request('GET', `${workspacePath(workspaceId, 'hub', 'projects')}${query === '' ? '' : `?${query}`}`, { schema: hubProjectListDtoSchema });
    },
    summary: (workspaceId: string): Promise<HubSummaryDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'hub', 'summary'), { schema: hubSummaryDtoSchema }),
    get: (projectId: string): Promise<HubProjectDetailDto> =>
        apiClient.request('GET', projectPath(projectId, 'hub'), { schema: hubProjectDetailDtoSchema }),
    patch: (projectId: string, body: UpdateHubProjectRequest): Promise<HubProjectDetailDto> =>
        apiClient.request('PATCH', projectPath(projectId, 'hub'), { body, schema: hubProjectDetailDtoSchema }),
    assignCode: (projectId: string): Promise<HubProjectDetailDto> =>
        apiClient.request('POST', projectPath(projectId, 'hub', 'code'), { schema: hubProjectDetailDtoSchema }),
};
