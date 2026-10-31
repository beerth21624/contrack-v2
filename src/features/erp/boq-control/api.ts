import {
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
};
