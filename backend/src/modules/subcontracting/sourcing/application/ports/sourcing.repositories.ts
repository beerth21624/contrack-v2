// ─── Repositories of the sourcing work stream (abstract classes = ports AND Nest DI tokens) ───
// Every call joins the UnitOfWork transaction when made inside `uow.run`. Lookups by id are unscoped where the caller
// only has the id (routes like /subcontracting/packages/:id); the use case then checks access to the owner workspace.
import type { PackageStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain/ids';
import type { PackageId, PortfolioItemId, QuestionId, ScInvitationId, VendorListEntryId } from '../../../shared/ids';
import type { PackageQuestion } from '../../domain/entities/package-question.entity';
import type { PortfolioItem } from '../../domain/entities/portfolio-item.entity';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import type { VendorProfile } from '../../domain/entities/vendor-profile.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';

export abstract class VendorProfileRepository {
    abstract find(workspaceId: WorkspaceId): Promise<VendorProfile | undefined>;
    abstract findMany(workspaceIds: readonly WorkspaceId[]): Promise<VendorProfile[]>;
    /** Oldest profile with this verified phone (E.164). */
    abstract findByPhone(phone: string): Promise<VendorProfile | undefined>;
    /** Insert or update. */
    abstract save(profile: VendorProfile): Promise<void>;
    abstract listPortfolio(workspaceId: WorkspaceId): Promise<PortfolioItem[]>;
    abstract findPortfolioItem(id: PortfolioItemId): Promise<PortfolioItem | undefined>;
    abstract insertPortfolioItem(item: PortfolioItem): Promise<void>;
    abstract deletePortfolioItem(workspaceId: WorkspaceId, id: PortfolioItemId): Promise<void>;
}

export abstract class VendorListRepository {
    /** Oldest first. */
    abstract list(buyerWorkspaceId: WorkspaceId): Promise<VendorListEntry[]>;
    abstract findById(id: VendorListEntryId): Promise<VendorListEntry | undefined>;
    abstract findMany(ids: readonly VendorListEntryId[]): Promise<VendorListEntry[]>;
    abstract findByPhone(buyerWorkspaceId: WorkspaceId, phone: string): Promise<VendorListEntry | undefined>;
    /** Entries with this phone in every buyer workspace (linking after a phone sign-in). */
    abstract findAllByPhone(phone: string): Promise<VendorListEntry[]>;
    abstract findLinked(buyerWorkspaceId: WorkspaceId, vendorWorkspaceId: WorkspaceId): Promise<VendorListEntry | undefined>;
    abstract insert(entry: VendorListEntry): Promise<void>;
    abstract update(entry: VendorListEntry): Promise<void>;
    abstract delete(buyerWorkspaceId: WorkspaceId, id: VendorListEntryId): Promise<void>;
}

export abstract class WorkPackageRepository {
    /** With every version and file id. */
    abstract findById(id: PackageId): Promise<WorkPackage | undefined>;
    /**
     * findById with the package row locked until the current UnitOfWork ends (`SELECT … FOR UPDATE`). Call it FIRST
     * inside `uow.run` and re-check the state on what it returns before writing: a concurrent award / cancel / sweep
     * waits for the lock, then sees the committed state.
     */
    abstract lockById(id: PackageId): Promise<WorkPackage | undefined>;
    /** Newest first. */
    abstract listByProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<WorkPackage[]>;
    /** Every package with status `open` whose bid deadline is at or before `before` (sweep, all workspaces). */
    abstract listOpenDueBy(before: Date): Promise<WorkPackage[]>;
    abstract insert(pkg: WorkPackage): Promise<void>;
    /** Persists every field, new versions, the version-1 lines of a draft and the file list. */
    abstract update(pkg: WorkPackage): Promise<void>;
    /** `update` only while the stored status is still `expected`; false (nothing written) otherwise. */
    abstract updateIfStatus(pkg: WorkPackage, expected: PackageStatus): Promise<boolean>;
    abstract delete(buyerWorkspaceId: WorkspaceId, id: PackageId): Promise<void>;
}

export abstract class InvitationRepository {
    abstract findById(id: ScInvitationId): Promise<ScInvitation | undefined>;
    /** findById with the row locked until the current UnitOfWork ends (`SELECT … FOR UPDATE`). */
    abstract lockById(id: ScInvitationId): Promise<ScInvitation | undefined>;
    /** The invitation a link token (its SHA-256) belongs to. */
    abstract findByTokenHash(tokenHash: string): Promise<ScInvitation | undefined>;
    /** Oldest first. */
    abstract listByPackage(packageId: PackageId): Promise<ScInvitation[]>;
    /** listByPackage with the rows locked until the current UnitOfWork ends (lock the package row first). */
    abstract lockByPackage(packageId: PackageId): Promise<ScInvitation[]>;
    abstract listByPackages(packageIds: readonly PackageId[]): Promise<ScInvitation[]>;
    abstract listByVendor(vendorWorkspaceId: WorkspaceId): Promise<ScInvitation[]>;
    abstract listByEntries(entryIds: readonly VendorListEntryId[]): Promise<ScInvitation[]>;
    abstract insert(invitation: ScInvitation, tokenHash: string): Promise<void>;
    abstract update(invitation: ScInvitation): Promise<void>;
    /** Another link for the same invitation (addendum by SMS); earlier links keep working. */
    abstract addToken(invitationId: ScInvitationId, tokenHash: string, at: Date): Promise<void>;
    /** Resend: every earlier link of the invitation stops working; only this one is valid. */
    abstract replaceTokens(invitationId: ScInvitationId, tokenHash: string, at: Date): Promise<void>;
}

export abstract class QuestionRepository {
    /** Oldest first. */
    abstract listByPackage(packageId: PackageId): Promise<PackageQuestion[]>;
    abstract findById(id: QuestionId): Promise<PackageQuestion | undefined>;
    abstract insert(question: PackageQuestion): Promise<void>;
    abstract update(question: PackageQuestion): Promise<void>;
}
