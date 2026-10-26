// ─── Route parameters of the projects API → branded ids / checked keys (or the API error) ───
import { docKeySchema, levelIdSchema } from '@contrack/contract';
import {
    DomainError, type ProjectId, type RevisionId, type WorkspaceId, err, ok, parseId, type Result,
} from '../../../shared/domain';
import { unwrap } from '../../../shared/presentation/http';

export const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
export const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
export const revisionIdParam = (raw: string): RevisionId => unwrap(parseId<'RevisionId'>(raw, 'Revision'));

/**
 * Express already URL-decodes params; a key that still contains an escape (`calc%3Afooting` sent double-encoded)
 * is decoded once more. Keys never contain `%`, so this cannot change a valid key.
 */
function decodeParam(raw: string): string | undefined {
    if (!raw.includes('%')) return raw;
    try {
        return decodeURIComponent(raw);
    } catch {
        return undefined;
    }
}

/** `:docKey`, checked with the contract's docKeySchema. A bad key is a 422 like an unknown one. */
export function parseDocKeyParam(raw: string): Result<string, DomainError> {
    const decoded = decodeParam(raw);
    if (decoded === undefined || !docKeySchema.safeParse(decoded).success) {
        return err(DomainError.unprocessable(`"${raw}" is not a document key`, { docKey: raw }));
    }
    return ok(decoded);
}

/** `:levelId`, checked with the contract's levelIdSchema (whether the level exists is checked by the use case). */
export function parseLevelIdParam(raw: string): Result<string, DomainError> {
    const decoded = decodeParam(raw);
    if (decoded === undefined || !levelIdSchema.safeParse(decoded).success) {
        return err(DomainError.unprocessable(`"${raw}" is not a level id`, { levelId: raw }));
    }
    return ok(decoded);
}

export const docKeyParam = (raw: string): string => unwrap(parseDocKeyParam(raw));
export const levelIdParam = (raw: string): string => unwrap(parseLevelIdParam(raw));
