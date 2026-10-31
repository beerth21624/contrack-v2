import { type CompanyProfileDto, type PutCompanyProfileRequest, companyProfileDtoSchema } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { workspacePath } from '../shared/apiPaths';

export const companyApi = {
    get: (workspaceId: string): Promise<CompanyProfileDto> =>
        apiClient.request('GET', workspacePath(workspaceId, 'company'), { schema: companyProfileDtoSchema }),
    put: (workspaceId: string, body: PutCompanyProfileRequest): Promise<CompanyProfileDto> =>
        apiClient.request('PUT', workspacePath(workspaceId, 'company'), { body, schema: companyProfileDtoSchema }),
};
