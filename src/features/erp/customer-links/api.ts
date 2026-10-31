// ─── Customer links: the team's routes (signed in) and the public routes (no session, `auth: false`) ───
import {
    type CreateCustomerLinkRequest, type CreateCustomerLinkResponse, type CustomerLinkDto, type CustomerLinkSubject, type CustomerLinkViewDto,
    type RespondRequestInput, createCustomerLinkResponseSchema, customerLinkDtoSchema, customerLinkListDtoSchema, customerLinkViewDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, workspacePath } from '../shared/apiPaths';

export const customerLinksApi = {
    create: (workspaceId: string, body: CreateCustomerLinkRequest): Promise<CreateCustomerLinkResponse> =>
        apiClient.request('POST', workspacePath(workspaceId, 'customer-links'), { body, schema: createCustomerLinkResponseSchema }),
    list: (workspaceId: string, subjectType: CustomerLinkSubject, subjectId: string): Promise<CustomerLinkDto[]> =>
        apiClient.request('GET', workspacePath(workspaceId, 'customer-links'), {
            query: { subjectType, subjectId }, schema: customerLinkListDtoSchema,
        }),
    revoke: (linkId: string): Promise<CustomerLinkDto> =>
        apiClient.request('POST', apiPath('customer-links', linkId, 'revoke'), { schema: customerLinkDtoSchema }),
};

/** The customer's page: never sends a token and never asks /auth/refresh. */
export const publicLinksApi = {
    view: (token: string): Promise<CustomerLinkViewDto> =>
        apiClient.request('GET', apiPath('public', 'links', token), { schema: customerLinkViewDtoSchema, auth: false }),
    respond: (token: string, body: RespondRequestInput): Promise<CustomerLinkViewDto> =>
        apiClient.request('POST', apiPath('public', 'links', token, 'respond'), { body, schema: customerLinkViewDtoSchema, auth: false }),
};

export const customerLinkKeys = {
    all: ['customer-links'] as const,
    subject: (workspaceId: string, subjectType: CustomerLinkSubject, subjectId: string) =>
        ['customer-links', workspaceId, subjectType, subjectId] as const,
    publicView: (token: string) => ['public-link', token] as const,
};
