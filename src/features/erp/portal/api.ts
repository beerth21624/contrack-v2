import { type PortalDto, type SearchHit, portalDtoSchema, searchHitsDtoSchema } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { workspacePath } from '../shared/apiPaths';

export const portalApi = {
    get: (workspaceId: string): Promise<PortalDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'portal'), { schema: portalDtoSchema }),
    search: (workspaceId: string, q: string): Promise<SearchHit[]> =>
        apiClient.request('GET', `${workspacePath(workspaceId, 'search')}?${new URLSearchParams({ q }).toString()}`, { schema: searchHitsDtoSchema }),
};
