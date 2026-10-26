// ─── Route params / small request bodies of the sourcing routes ───
// Schemas that are not (yet) in the shared contract live here; see the work-stream report.
import { z } from 'zod';
import { tradeIdSchema, uuidSchema } from '@contrack/contract';
import { type ProjectId, type WorkspaceId, parseId } from '../../../../shared/domain/ids';
import { unwrap } from '../../../../shared/presentation/http';
import type { PackageId, PortfolioItemId, QuestionId, ScInvitationId, VendorListEntryId } from '../../shared/ids';

export const workspaceParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
export const projectParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));
export const packageParam = (raw: string): PackageId => unwrap(parseId<'PackageId'>(raw, 'Package'));
export const invitationParam = (raw: string): ScInvitationId => unwrap(parseId<'ScInvitationId'>(raw, 'Invitation'));
export const entryParam = (raw: string): VendorListEntryId => unwrap(parseId<'VendorListEntryId'>(raw, 'Vendor-list entry'));
export const questionParam = (raw: string): QuestionId => unwrap(parseId<'QuestionId'>(raw, 'Question'));
export const portfolioParam = (raw: string): PortfolioItemId => unwrap(parseId<'PortfolioItemId'>(raw, 'Portfolio item'));

/** GET /workspaces/:ws/vendor-list?trade=&q=&hidden=true|false (omitted: all; false: visible only; true: hidden only). */
export const vendorListQuerySchema = z.object({
    trade: tradeIdSchema.optional(),
    q: z.string().trim().max(120).optional(),
    hidden: z.enum(['true', 'false']).optional(),
});
export type VendorListQuery = z.infer<typeof vendorListQuerySchema>;

/** ?workspaceId= of the vendor routes. */
export const vendorWorkspaceQuerySchema = z.object({ workspaceId: uuidSchema });

/** POST /subcontracting/packages/:id/files */
export const attachPackageFileRequestSchema = z.object({ fileId: uuidSchema });
export type AttachPackageFileRequest = z.infer<typeof attachPackageFileRequestSchema>;

/** POST /vendor/claim-invitation */
export const claimInvitationRequestSchema = z.object({ token: z.string().min(16).max(256), workspaceId: uuidSchema });
export type ClaimInvitationRequest = z.infer<typeof claimInvitationRequestSchema>;
