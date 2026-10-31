import { type PriceReferenceItemDto, priceReferenceItemListDtoSchema } from '@/shared/contract';
import { apiClient } from '@/features/cloud/api/client';
import { workspacePath } from '../shared/apiPaths';

export const priceReferenceApi = {
    search: (workspaceId: string, p: { q: string; category?: string; limit?: number }): Promise<PriceReferenceItemDto[]> => {
        const qs = new URLSearchParams();
        if (p.q.trim() !== '') qs.set('q', p.q.trim());
        if (p.category !== undefined && p.category !== '') qs.set('category', p.category);
        if (p.limit !== undefined) qs.set('limit', String(p.limit));
        const query = qs.toString();
        return apiClient.request(
            'GET', `${workspacePath(workspaceId, 'price-reference', 'items')}${query === '' ? '' : `?${query}`}`,
            { schema: priceReferenceItemListDtoSchema },
        );
    },
};
