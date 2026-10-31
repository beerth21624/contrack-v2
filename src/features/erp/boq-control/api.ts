import {
    type BaselineStatusDto, type CostCodeDto, type LockBaselineRequest, type UnlockBaselineRequest, baselineStatusDtoSchema,
    costCodeListDtoSchema,
    type BoqVersionCompareDto, type BoqVersionDetailDto, type BoqVersionDto, boqVersionCompareDtoSchema, boqVersionDetailDtoSchema,
    boqVersionListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

/** `live` = the project's current BOQ (computed by the server, not stored). */
export type CompareTarget = string;

export const boqControlApi = {
    list: (projectId: string): Promise<BoqVersionDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'boq-versions'), { schema: boqVersionListDtoSchema }),
    get: (versionId: string): Promise<BoqVersionDetailDto> =>
        apiClient.request('GET', apiPath('boq-versions', versionId), { schema: boqVersionDetailDtoSchema }),
    compare: (projectId: string, from: string, to: CompareTarget): Promise<BoqVersionCompareDto> => {
        const qs = new URLSearchParams({ from, to });
        return apiClient.request('GET', `${projectPath(projectId, 'boq-versions', 'compare')}?${qs.toString()}`, { schema: boqVersionCompareDtoSchema });
    },
    baseline: (projectId: string): Promise<BaselineStatusDto> =>
        apiClient.request('GET', projectPath(projectId, 'baseline'), { schema: baselineStatusDtoSchema }),
    lock: (projectId: string, body: Partial<LockBaselineRequest>): Promise<BaselineStatusDto> =>
        apiClient.request('POST', projectPath(projectId, 'baseline'), { body, schema: baselineStatusDtoSchema }),
    unlock: (projectId: string, body: UnlockBaselineRequest): Promise<BaselineStatusDto> =>
        apiClient.request('POST', projectPath(projectId, 'baseline', 'unlock'), { body, schema: baselineStatusDtoSchema }),
    costCodes: (projectId: string): Promise<CostCodeDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'cost-codes'), { schema: costCodeListDtoSchema }),
};
