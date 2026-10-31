import {
    type AdminEntitlementDto, type AdminWorkspaceListQuery, type ModuleId, type PlatformAdminStatusDto, type PutEntitlementRequest,
    adminEntitlementDtoSchema, adminWorkspacesDtoSchema, platformAdminStatusDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath } from '../shared/apiPaths';

/** Platform admin endpoints (PLATFORM_ADMIN_EMAILS); everything but `status` answers 404 to other users. */
export const adminApi = {
    status: (): Promise<PlatformAdminStatusDto> =>
        apiClient.request('GET', apiPath('platform', 'admin', 'status'), { schema: platformAdminStatusDtoSchema }),
    workspaces: (query: Pick<AdminWorkspaceListQuery, 'q' | 'limit'>) => {
        const params = new URLSearchParams();
        if (query.q !== undefined && query.q !== '') params.set('q', query.q);
        params.set('limit', String(query.limit));
        return apiClient.request('GET', `${apiPath('platform', 'admin', 'workspaces')}?${params.toString()}`, { schema: adminWorkspacesDtoSchema });
    },
    putEntitlement: (workspaceId: string, module: ModuleId, body: PutEntitlementRequest): Promise<AdminEntitlementDto> =>
        apiClient.request('PUT', apiPath('platform', 'admin', 'workspaces', workspaceId, 'entitlements', module), {
            body, schema: adminEntitlementDtoSchema,
        }),
};
