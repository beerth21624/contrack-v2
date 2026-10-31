'use client';

// ─── Workspace rate-card library (คลังอัตราค่าแรงของบริษัท): typed routes + TanStack Query hooks ───
// Backend: GET/POST /workspaces/:workspaceId/rate-cards, PATCH/DELETE …/rate-cards/:rateCardId (backend/API.md).
// Rates are whole baht per day. A project copies the rates of the card it picks (snapshot), so changing or archiving a
// card never changes a project by itself.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
    can, rateCardConflictDetailsSchema, rateCardDtoSchema, type CreateRateCardRequest, type RateCardConflictDetails,
    type RateCardDto, type Role, type UpdateRateCardRequest,
} from '@/shared/contract';
import { useSession } from '../auth/session';
import { apiClient, type ApiClient } from './client';
import { isApiError } from './errors';

const seg = (s: string) => encodeURIComponent(s);
const base = (workspaceId: string) => `/workspaces/${seg(workspaceId)}/rate-cards`;

export function createRateCardsApi(client: ApiClient) {
    return {
        /** Active cards, oldest first. */
        list: (workspaceId: string): Promise<RateCardDto[]> =>
            client.request('GET', base(workspaceId), { schema: z.array(rateCardDtoSchema) }),
        create: (workspaceId: string, body: CreateRateCardRequest): Promise<RateCardDto> =>
            client.request('POST', base(workspaceId), { body, schema: rateCardDtoSchema }),
        update: (workspaceId: string, rateCardId: string, body: UpdateRateCardRequest): Promise<RateCardDto> =>
            client.request('PATCH', `${base(workspaceId)}/${seg(rateCardId)}`, { body, schema: rateCardDtoSchema }),
        /** Soft delete; archiving an archived card again succeeds. */
        archive: (workspaceId: string, rateCardId: string): Promise<void> =>
            client.request('DELETE', `${base(workspaceId)}/${seg(rateCardId)}`),
    };
}

export type RateCardsApi = ReturnType<typeof createRateCardsApi>;
export const rateCardsApi: RateCardsApi = createRateCardsApi(apiClient);

/** Query key, under the workspace's key (`['workspaces', id]`), so dropping a workspace's queries drops this too. */
export const rateCardsKey = (workspaceId: string) => ['workspaces', workspaceId, 'rateCards'] as const;

/** What a role may do with the library (mirrors the server's matrix; the server always decides). */
export function rateCardAbilities(role: Role | undefined): { read: boolean; create: boolean; edit: boolean; archive: boolean } {
    return {
        read: can(role, 'rateCards.read'),
        create: can(role, 'rateCards.create'),
        edit: can(role, 'rateCards.edit'),
        archive: can(role, 'rateCards.archive'),
    };
}

/**
 * Why a create / update was refused with 409: the name is used by another active card (`name_taken`) or the workspace
 * already keeps 50 active cards (`limit_reached`). undefined for any other error.
 */
export function rateCardConflict(error: unknown): RateCardConflictDetails | undefined {
    if (!isApiError(error) || error.code !== 'conflict') return undefined;
    const parsed = rateCardConflictDetailsSchema.safeParse(error.details);
    return parsed.success ? parsed.data : undefined;
}

/** Thai message for a refused rate-card write (falls back to undefined so callers can use thaiErrorMessage). */
export function rateCardConflictMessage(error: unknown): string | undefined {
    const conflict = rateCardConflict(error);
    if (conflict === undefined) return undefined;
    return conflict.reason === 'name_taken'
        ? `มีชุดค่าแรงชื่อ "${conflict.name}" อยู่แล้ว ตั้งชื่ออื่น`
        : `เก็บชุดค่าแรงได้สูงสุด ${conflict.limit} ชุด เก็บถาวรชุดที่ไม่ใช้ก่อน`;
}

const useSignedIn = () => useSession(s => s.status === 'signed-in');

const sortCards = (cards: RateCardDto[]): RateCardDto[] =>
    [...cards].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));

/** The workspace's active rate cards (oldest first). Disabled until signed in and a workspace is known. */
export function useRateCards(workspaceId: string | undefined) {
    const signedIn = useSignedIn();
    return useQuery({
        queryKey: rateCardsKey(workspaceId ?? '-'),
        queryFn: () => rateCardsApi.list(workspaceId ?? ''),
        enabled: signedIn && workspaceId !== undefined,
    });
}

export function useCreateRateCard(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (body: CreateRateCardRequest) => rateCardsApi.create(workspaceId, body),
        onSuccess: (card) => {
            qc.setQueryData<RateCardDto[]>(rateCardsKey(workspaceId), old =>
                old === undefined ? undefined : sortCards([...old.filter(c => c.id !== card.id), card]));
            void qc.invalidateQueries({ queryKey: rateCardsKey(workspaceId) });
        },
    });
}

export function useUpdateRateCard(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ rateCardId, ...body }: { rateCardId: string } & UpdateRateCardRequest) =>
            rateCardsApi.update(workspaceId, rateCardId, body),
        onSuccess: (card) => {
            qc.setQueryData<RateCardDto[]>(rateCardsKey(workspaceId), old => old?.map(c => (c.id === card.id ? card : c)));
            void qc.invalidateQueries({ queryKey: rateCardsKey(workspaceId) });
        },
    });
}

/** Archive (soft delete) a card by id. */
export function useArchiveRateCard(workspaceId: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (rateCardId: string) => rateCardsApi.archive(workspaceId, rateCardId),
        onSuccess: (_v, rateCardId) => {
            qc.setQueryData<RateCardDto[]>(rateCardsKey(workspaceId), old => old?.filter(c => c.id !== rateCardId));
            void qc.invalidateQueries({ queryKey: rateCardsKey(workspaceId) });
        },
    });
}
