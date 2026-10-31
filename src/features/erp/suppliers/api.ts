import {
    type CreateSupplierInput, type CreateSupplierRatingInput, type ImportScSuppliersDto, type PatchSupplierInput, type SupplierDto,
    type SupplierKind, type SupplierRatedDto, type SupplierRatingDto, type TradeId,
    importScSuppliersDtoSchema, supplierDtoSchema, supplierListDtoSchema, supplierRatedDtoSchema, supplierRatingListDtoSchema,
} from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { apiPath, workspacePath } from '../shared/apiPaths';

export interface SupplierListParams {
    q?: string;
    kind?: SupplierKind;
    trade?: TradeId;
    archived?: boolean;
}

export const suppliersApi = {
    list: (workspaceId: string, p: SupplierListParams): Promise<SupplierDto[]> => {
        const qs = new URLSearchParams();
        if (p.q !== undefined && p.q.trim() !== '') qs.set('q', p.q.trim());
        if (p.kind !== undefined) qs.set('kind', p.kind);
        if (p.trade !== undefined) qs.set('trade', p.trade);
        if (p.archived === true) qs.set('archived', 'true');
        const query = qs.toString();
        return apiClient.request('GET', `${workspacePath(workspaceId, 'suppliers')}${query === '' ? '' : `?${query}`}`, { schema: supplierListDtoSchema });
    },
    get: (supplierId: string): Promise<SupplierDto> =>
        apiClient.request('GET', apiPath('suppliers', supplierId), { schema: supplierDtoSchema }),
    create: (workspaceId: string, body: CreateSupplierInput): Promise<SupplierDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'suppliers'), { body, schema: supplierDtoSchema }),
    patch: (supplierId: string, body: PatchSupplierInput): Promise<SupplierDto> =>
        apiClient.request('PATCH', apiPath('suppliers', supplierId), { body, schema: supplierDtoSchema }),
    archive: (supplierId: string): Promise<SupplierDto> =>
        apiClient.request('POST', apiPath('suppliers', supplierId, 'archive'), { schema: supplierDtoSchema }),
    restore: (supplierId: string): Promise<SupplierDto> =>
        apiClient.request('POST', apiPath('suppliers', supplierId, 'restore'), { schema: supplierDtoSchema }),
    importSc: (workspaceId: string): Promise<ImportScSuppliersDto> =>
        apiClient.request('POST', workspacePath(workspaceId, 'suppliers', 'import-sc'), { schema: importScSuppliersDtoSchema }),
    ratings: (supplierId: string): Promise<SupplierRatingDto[]> =>
        apiClient.request('GET', apiPath('suppliers', supplierId, 'ratings'), { schema: supplierRatingListDtoSchema }),
    rate: (supplierId: string, body: CreateSupplierRatingInput): Promise<SupplierRatedDto> =>
        apiClient.request('POST', apiPath('suppliers', supplierId, 'ratings'), { body, schema: supplierRatedDtoSchema }),
};
