// ─── Branded ids: a UserId can never be passed where a WorkspaceId is expected ───
import { type Result, err, ok } from './result';
import { DomainError } from './domain-error';

declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type UserId = Brand<string, 'UserId'>;
export type WorkspaceId = Brand<string, 'WorkspaceId'>;
export type ProjectId = Brand<string, 'ProjectId'>;
export type RevisionId = Brand<string, 'RevisionId'>;
export type InvitationId = Brand<string, 'InvitationId'>;
export type RefreshTokenId = Brand<string, 'RefreshTokenId'>;
export type RateCardId = Brand<string, 'RateCardId'>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
    return UUID.test(value);
}

/** Parses an id from outside (URL, token, database) into its branded type. */
export function parseId<B extends string>(value: string, what: string): Result<Brand<string, B>, DomainError> {
    return isUuid(value) ? ok(value.toLowerCase() as Brand<string, B>) : err(DomainError.notFound(what));
}

export const asUserId = (v: string): UserId => v as UserId;
export const asWorkspaceId = (v: string): WorkspaceId => v as WorkspaceId;
export const asProjectId = (v: string): ProjectId => v as ProjectId;
export const asRevisionId = (v: string): RevisionId => v as RevisionId;
export const asInvitationId = (v: string): InvitationId => v as InvitationId;
export const asRefreshTokenId = (v: string): RefreshTokenId => v as RefreshTokenId;
export const asRateCardId = (v: string): RateCardId => v as RateCardId;
