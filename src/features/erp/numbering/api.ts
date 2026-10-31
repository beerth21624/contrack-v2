import {
    type DocType, type NumberingSeriesDto, type PutNumberingSeriesRequest, numberingSeriesDtoSchema, numberingSeriesListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { workspacePath } from '../shared/apiPaths';

export const numberingApi = {
    list: (workspaceId: string): Promise<NumberingSeriesDto[]> =>
        apiClient.request('GET', workspacePath(workspaceId, 'numbering'), { schema: numberingSeriesListDtoSchema }),
    put: (workspaceId: string, docType: DocType, body: PutNumberingSeriesRequest): Promise<NumberingSeriesDto> =>
        apiClient.request('PUT', workspacePath(workspaceId, 'numbering', docType), { body, schema: numberingSeriesDtoSchema }),
};
