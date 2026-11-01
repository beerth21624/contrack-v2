import {
    type CloseoutDto, type FinalizeCloseoutRequest, type PatchCloseoutRequest, closeoutDtoSchema,
} from '@/shared/contract';
import {
    type AcceptHandoverRequest, type AddHandoverDocumentRequest, type AssignWarrantyClaimRequest, type CloseWarrantyClaimRequest,
    type CreateHandoverRequest, type CreateWarrantyClaimRequest, type HandoverDto, type InspectHandoverRequest,
    type PatchHandoverRequest, type PatchWarrantyClaimRequest, type ProjectHandoverDto, type ProjectWarrantyDto,
    type RejectHandoverRequest, type RejectWarrantyClaimRequest, type ResolveWarrantyClaimRequest, type ScheduleHandoverRequest,
    type WarrantyClaimDto, type WarrantyClaimListDto, type WarrantyClaimStatus,
    handoverDtoSchema, projectHandoverDtoSchema, projectWarrantyDtoSchema, warrantyClaimDtoSchema, warrantyClaimListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

const hand = { schema: handoverDtoSchema };
const claim = { schema: warrantyClaimDtoSchema };

export const handoverApi = {
    forProject: (projectId: string): Promise<ProjectHandoverDto> =>
        apiClient.request('GET', projectPath(projectId, 'handover'), { schema: projectHandoverDtoSchema }),
    create: (projectId: string, body: CreateHandoverRequest): Promise<HandoverDto> =>
        apiClient.request('POST', projectPath(projectId, 'handover'), { body, ...hand }),
    patch: (handoverId: string, body: PatchHandoverRequest): Promise<HandoverDto> =>
        apiClient.request('PATCH', apiPath('handovers', handoverId), { body, ...hand }),
    schedule: (handoverId: string, body: ScheduleHandoverRequest): Promise<HandoverDto> =>
        apiClient.request('POST', apiPath('handovers', handoverId, 'schedule'), { body, ...hand }),
    inspect: (handoverId: string, body: InspectHandoverRequest): Promise<HandoverDto> =>
        apiClient.request('POST', apiPath('handovers', handoverId, 'inspect'), { body, ...hand }),
    accept: (handoverId: string, body: AcceptHandoverRequest): Promise<HandoverDto> =>
        apiClient.request('POST', apiPath('handovers', handoverId, 'accept'), { body, ...hand }),
    reject: (handoverId: string, body: RejectHandoverRequest): Promise<HandoverDto> =>
        apiClient.request('POST', apiPath('handovers', handoverId, 'reject'), { body, ...hand }),
    addDocument: (handoverId: string, body: AddHandoverDocumentRequest): Promise<HandoverDto> =>
        apiClient.request('POST', apiPath('handovers', handoverId, 'documents'), { body, ...hand }),

    warranty: (projectId: string): Promise<ProjectWarrantyDto> =>
        apiClient.request('GET', projectPath(projectId, 'warranty'), { schema: projectWarrantyDtoSchema }),
    claims: (projectId: string, status?: WarrantyClaimStatus): Promise<WarrantyClaimListDto> =>
        apiClient.request('GET', projectPath(projectId, 'warranty-claims'), {
            schema: warrantyClaimListDtoSchema, ...(status !== undefined ? { query: { status } } : {}),
        }),
    createClaim: (projectId: string, body: CreateWarrantyClaimRequest): Promise<WarrantyClaimDto> =>
        apiClient.request('POST', projectPath(projectId, 'warranty-claims'), { body, ...claim }),
    patchClaim: (claimId: string, body: PatchWarrantyClaimRequest): Promise<WarrantyClaimDto> =>
        apiClient.request('PATCH', apiPath('warranty-claims', claimId), { body, ...claim }),
    assign: (claimId: string, body: AssignWarrantyClaimRequest): Promise<WarrantyClaimDto> =>
        apiClient.request('POST', apiPath('warranty-claims', claimId, 'assign'), { body, ...claim }),
    start: (claimId: string): Promise<WarrantyClaimDto> =>
        apiClient.request('POST', apiPath('warranty-claims', claimId, 'start'), { body: {}, ...claim }),
    resolve: (claimId: string, body: ResolveWarrantyClaimRequest): Promise<WarrantyClaimDto> =>
        apiClient.request('POST', apiPath('warranty-claims', claimId, 'resolve'), { body, ...claim }),
    close: (claimId: string, body: CloseWarrantyClaimRequest): Promise<WarrantyClaimDto> =>
        apiClient.request('POST', apiPath('warranty-claims', claimId, 'close'), { body, ...claim }),
    rejectClaim: (claimId: string, body: RejectWarrantyClaimRequest): Promise<WarrantyClaimDto> =>
        apiClient.request('POST', apiPath('warranty-claims', claimId, 'reject'), { body, ...claim }),

    closeout: (projectId: string): Promise<CloseoutDto> =>
        apiClient.request('GET', projectPath(projectId, 'closeout'), { schema: closeoutDtoSchema }),
    patchCloseout: (projectId: string, body: PatchCloseoutRequest): Promise<CloseoutDto> =>
        apiClient.request('PATCH', projectPath(projectId, 'closeout'), { body, schema: closeoutDtoSchema }),
    finalizeCloseout: (projectId: string, body: FinalizeCloseoutRequest): Promise<CloseoutDto> =>
        apiClient.request('POST', projectPath(projectId, 'closeout', 'finalize'), { body, schema: closeoutDtoSchema }),
};
