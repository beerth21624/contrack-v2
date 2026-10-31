import {
    type AddVariationEvidenceRequest, type ComputeVariationOrderRequest, type CreateVariationOrderRequest, type PatchVariationOrderRequest,
    type PutVariationOrderLinesRequest, type RecordVariationResponseRequest, type VariationOrderDto, type VariationOrderSummaryDto,
    variationOrderDtoSchema, variationOrderListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

const one = { schema: variationOrderDtoSchema };

export const variationsApi = {
    list: (projectId: string): Promise<VariationOrderSummaryDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'variations'), { schema: variationOrderListDtoSchema }),
    create: (projectId: string, body: CreateVariationOrderRequest): Promise<VariationOrderDto> =>
        apiClient.request('POST', projectPath(projectId, 'variations'), { body, ...one }),
    get: (variationId: string): Promise<VariationOrderDto> =>
        apiClient.request('GET', apiPath('variations', variationId), one),
    patch: (variationId: string, body: PatchVariationOrderRequest): Promise<VariationOrderDto> =>
        apiClient.request('PATCH', apiPath('variations', variationId), { body, ...one }),
    putLines: (variationId: string, body: PutVariationOrderLinesRequest): Promise<VariationOrderDto> =>
        apiClient.request('PUT', apiPath('variations', variationId, 'lines'), { body, ...one }),
    compute: (variationId: string, body: ComputeVariationOrderRequest): Promise<VariationOrderDto> =>
        apiClient.request('POST', apiPath('variations', variationId, 'compute'), { body, ...one }),
    addEvidence: (variationId: string, body: AddVariationEvidenceRequest): Promise<VariationOrderDto> =>
        apiClient.request('POST', apiPath('variations', variationId, 'evidence'), { body, ...one }),
    removeEvidence: (evidenceId: string): Promise<void> =>
        apiClient.request('DELETE', apiPath('variation-evidence', evidenceId)),
    submit: (variationId: string): Promise<VariationOrderDto> =>
        apiClient.request('POST', apiPath('variations', variationId, 'submit'), { body: {}, ...one }),
    recordResponse: (variationId: string, body: RecordVariationResponseRequest): Promise<VariationOrderDto> =>
        apiClient.request('POST', apiPath('variations', variationId, 'record-response'), { body, ...one }),
    withdraw: (variationId: string): Promise<VariationOrderDto> =>
        apiClient.request('POST', apiPath('variations', variationId, 'withdraw'), { body: {}, ...one }),
    cancel: (variationId: string): Promise<VariationOrderDto> =>
        apiClient.request('POST', apiPath('variations', variationId, 'cancel'), { body: {}, ...one }),
};
