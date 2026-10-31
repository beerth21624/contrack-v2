import {
    type CreateCustomerInput, type CustomerDto, type PatchCustomerRequest, customerDtoSchema, customerListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, workspacePath } from '../shared/apiPaths';

export interface CustomerListParams {
    q?: string;
    kind?: CustomerDto['kind'];
    archived?: boolean;
}

export const customersApi = {
    list: (workspaceId: string, p: CustomerListParams): Promise<CustomerDto[]> => {
        const qs = new URLSearchParams();
        if (p.q !== undefined && p.q.trim() !== '') qs.set('q', p.q.trim());
        if (p.kind !== undefined) qs.set('kind', p.kind);
        if (p.archived === true) qs.set('archived', 'true');
        const query = qs.toString();
        return apiClient.request('GET', `${workspacePath(workspaceId, 'customers')}${query === '' ? '' : `?${query}`}`, { schema: customerListDtoSchema });
    },
    get: (customerId: string): Promise<CustomerDto> =>
        apiClient.request('GET', apiPath('customers', customerId), { schema: customerDtoSchema }),
    create: (workspaceId: string, body: CreateCustomerInput): Promise<CustomerDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'customers'), { body, schema: customerDtoSchema }),
    patch: (customerId: string, body: PatchCustomerRequest): Promise<CustomerDto> =>
        apiClient.request('PATCH', apiPath('customers', customerId), { body, schema: customerDtoSchema }),
    archive: (customerId: string): Promise<CustomerDto> =>
        apiClient.request('POST', apiPath('customers', customerId, 'archive'), { schema: customerDtoSchema }),
    restore: (customerId: string): Promise<CustomerDto> =>
        apiClient.request('POST', apiPath('customers', customerId, 'restore'), { schema: customerDtoSchema }),
};
