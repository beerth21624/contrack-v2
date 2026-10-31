import {
    type AddSignedScanRequest, type CloseMainContractRequest, type ContractGuaranteeDto, type CreateGuaranteeRequest,
    type CreateMainContractRequest, type MainContractDto, type PatchGuaranteeRequest, type PatchMainContractRequest,
    type ProjectMainContractDto, type PutContractMilestonesRequest, type SignMainContractRequest, type SignMainContractResponse,
    type TerminateMainContractRequest, contractGuaranteeDtoSchema, contractGuaranteeListDtoSchema, mainContractDtoSchema,
    projectMainContractDtoSchema, signMainContractResponseSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, projectPath } from '../shared/apiPaths';

export const contractsApi = {
    forProject: (projectId: string): Promise<ProjectMainContractDto> =>
        apiClient.request('GET', projectPath(projectId, 'main-contract'), { schema: projectMainContractDtoSchema }),
    create: (projectId: string, body: CreateMainContractRequest): Promise<MainContractDto> =>
        apiClient.request('POST', projectPath(projectId, 'main-contract'), { body, schema: mainContractDtoSchema }),
    get: (contractId: string): Promise<MainContractDto> =>
        apiClient.request('GET', apiPath('main-contracts', contractId), { schema: mainContractDtoSchema }),
    patch: (contractId: string, body: PatchMainContractRequest): Promise<MainContractDto> =>
        apiClient.request('PATCH', apiPath('main-contracts', contractId), { body, schema: mainContractDtoSchema }),
    putMilestones: (contractId: string, body: PutContractMilestonesRequest): Promise<MainContractDto> =>
        apiClient.request('PUT', apiPath('main-contracts', contractId, 'milestones'), { body, schema: mainContractDtoSchema }),
    sign: (contractId: string, body: SignMainContractRequest): Promise<SignMainContractResponse> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'sign'), { body, schema: signMainContractResponseSchema }),
    terminate: (contractId: string, body: TerminateMainContractRequest): Promise<MainContractDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'terminate'), { body, schema: mainContractDtoSchema }),
    cancel: (contractId: string): Promise<MainContractDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'cancel'), { body: {}, schema: mainContractDtoSchema }),
    close: (contractId: string, body: CloseMainContractRequest): Promise<MainContractDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'close'), { body, schema: mainContractDtoSchema }),
    addSignedScan: (contractId: string, body: AddSignedScanRequest): Promise<MainContractDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'signed-scan'), { body, schema: mainContractDtoSchema }),
    guarantees: (contractId: string): Promise<ContractGuaranteeDto[]> =>
        apiClient.request('GET', apiPath('main-contracts', contractId, 'guarantees'), { schema: contractGuaranteeListDtoSchema }),
    addGuarantee: (contractId: string, body: CreateGuaranteeRequest): Promise<ContractGuaranteeDto> =>
        apiClient.request('POST', apiPath('main-contracts', contractId, 'guarantees'), { body, schema: contractGuaranteeDtoSchema }),
    patchGuarantee: (guaranteeId: string, body: PatchGuaranteeRequest): Promise<ContractGuaranteeDto> =>
        apiClient.request('PATCH', apiPath('guarantees', guaranteeId), { body, schema: contractGuaranteeDtoSchema }),
};
