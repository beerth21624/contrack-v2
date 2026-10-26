// ─── Route parameters of the bidding API → branded ids (a malformed id is a 404 like an unknown one) ───
import { parseId } from '../../../../shared/domain';
import { unwrap } from '../../../../shared/presentation/http';
import type { PackageId, ScInvitationId } from '../../shared/ids';

export const invitationIdParam = (raw: string): ScInvitationId => unwrap(parseId<'ScInvitationId'>(raw, 'Invitation'));
export const packageIdParam = (raw: string): PackageId => unwrap(parseId<'PackageId'>(raw, 'Package'));
