import {
    type CreateQuotationRequest, type IssueQuotationVersionRequest, type NewQuotationVersionRequest, type PatchQuotationVersionInput,
    type QuotationCompareDto, type QuotationDto, type QuotationVersionDto, type RecordQuotationResponseRequest,
    quotationCompareDtoSchema, quotationDtoSchema, quotationListDtoSchema, quotationVersionDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

export const quotationsApi = {
    list: (projectId: string): Promise<QuotationDto[]> =>
        apiClient.request('GET', projectPath(projectId, 'quotations'), { schema: quotationListDtoSchema }),
    create: (projectId: string, body: CreateQuotationRequest): Promise<QuotationVersionDto> =>
        apiClient.request('POST', projectPath(projectId, 'quotations'), { body, schema: quotationVersionDtoSchema }),
    get: (quotationId: string): Promise<QuotationDto> =>
        apiClient.request('GET', apiPath('quotations', quotationId), { schema: quotationDtoSchema }),
    version: (versionId: string): Promise<QuotationVersionDto> =>
        apiClient.request('GET', apiPath('quotation-versions', versionId), { schema: quotationVersionDtoSchema }),
    patch: (versionId: string, body: PatchQuotationVersionInput): Promise<QuotationVersionDto> =>
        apiClient.request('PATCH', apiPath('quotation-versions', versionId), { body, schema: quotationVersionDtoSchema }),
    newVersion: (quotationId: string, body: Partial<NewQuotationVersionRequest>): Promise<QuotationVersionDto> =>
        apiClient.request('POST', apiPath('quotations', quotationId, 'versions'), { body, schema: quotationVersionDtoSchema }),
    issue: (versionId: string, body: IssueQuotationVersionRequest): Promise<QuotationVersionDto> =>
        apiClient.request('POST', apiPath('quotation-versions', versionId, 'issue'), { body, schema: quotationVersionDtoSchema }),
    cancel: (versionId: string): Promise<QuotationVersionDto> =>
        apiClient.request('POST', apiPath('quotation-versions', versionId, 'cancel'), { body: {}, schema: quotationVersionDtoSchema }),
    recordResponse: (versionId: string, body: RecordQuotationResponseRequest): Promise<QuotationVersionDto> =>
        apiClient.request('POST', apiPath('quotation-versions', versionId, 'record-response'), { body, schema: quotationVersionDtoSchema }),
    compare: (quotationId: string, from: string, to: string): Promise<QuotationCompareDto> => {
        const qs = new URLSearchParams({ from, to });
        return apiClient.request('GET', `${apiPath('quotations', quotationId, 'compare')}?${qs.toString()}`, { schema: quotationCompareDtoSchema });
    },
};
