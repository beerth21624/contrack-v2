// ─── In-memory adapters of the sourcing repositories (unit tests, e2e, PERSISTENCE=memory) ───
// Rows are stored as deep copies of the entity props, so a caller never mutates stored state by accident.
import type { PackageStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain/ids';
import type { PackageId, PortfolioItemId, QuestionId, ScInvitationId, VendorListEntryId } from '../../../shared/ids';
import {
    InvitationRepository, QuestionRepository, VendorListRepository, VendorProfileRepository, WorkPackageRepository,
} from '../../application/ports/sourcing.repositories';
import { PackageQuestion, type PackageQuestionProps } from '../../domain/entities/package-question.entity';
import { PortfolioItem, type PortfolioItemProps } from '../../domain/entities/portfolio-item.entity';
import { ScInvitation, type ScInvitationProps } from '../../domain/entities/sc-invitation.entity';
import { VendorListEntry, type VendorListEntryProps } from '../../domain/entities/vendor-list-entry.entity';
import { VendorProfile, type VendorProfileProps } from '../../domain/entities/vendor-profile.entity';
import { WorkPackage, type WorkPackageProps } from '../../domain/entities/work-package.entity';

const clone = <T>(v: T): T => structuredClone(v);

export class InMemoryVendorProfileRepository extends VendorProfileRepository {
    readonly rows = new Map<WorkspaceId, VendorProfileProps>();
    readonly portfolio = new Map<PortfolioItemId, PortfolioItemProps>();

    find(workspaceId: WorkspaceId): Promise<VendorProfile | undefined> {
        const row = this.rows.get(workspaceId);
        return Promise.resolve(row === undefined ? undefined : VendorProfile.rehydrate(clone(row)));
    }

    findMany(workspaceIds: readonly WorkspaceId[]): Promise<VendorProfile[]> {
        const ids = new Set(workspaceIds);
        return Promise.resolve([...this.rows.values()].filter(r => ids.has(r.workspaceId)).map(r => VendorProfile.rehydrate(clone(r))));
    }

    findByPhone(phone: string): Promise<VendorProfile | undefined> {
        if (phone === '') return Promise.resolve(undefined);
        const row = [...this.rows.values()].filter(r => r.phone === phone).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
        return Promise.resolve(row === undefined ? undefined : VendorProfile.rehydrate(clone(row)));
    }

    save(profile: VendorProfile): Promise<void> {
        this.rows.set(profile.workspaceId, profile.toProps());
        return Promise.resolve();
    }

    listPortfolio(workspaceId: WorkspaceId): Promise<PortfolioItem[]> {
        return Promise.resolve([...this.portfolio.values()].filter(p => p.vendorWorkspaceId === workspaceId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map(p => PortfolioItem.rehydrate(clone(p))));
    }

    findPortfolioItem(id: PortfolioItemId): Promise<PortfolioItem | undefined> {
        const row = this.portfolio.get(id);
        return Promise.resolve(row === undefined ? undefined : PortfolioItem.rehydrate(clone(row)));
    }

    insertPortfolioItem(item: PortfolioItem): Promise<void> {
        this.portfolio.set(item.id, item.toProps());
        return Promise.resolve();
    }

    deletePortfolioItem(workspaceId: WorkspaceId, id: PortfolioItemId): Promise<void> {
        if (this.portfolio.get(id)?.vendorWorkspaceId === workspaceId) this.portfolio.delete(id);
        return Promise.resolve();
    }
}

export class InMemoryVendorListRepository extends VendorListRepository {
    readonly rows = new Map<VendorListEntryId, VendorListEntryProps>();

    private all(): VendorListEntry[] {
        return [...this.rows.values()].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
            .map(r => VendorListEntry.rehydrate(clone(r)));
    }

    list(buyerWorkspaceId: WorkspaceId): Promise<VendorListEntry[]> {
        return Promise.resolve(this.all().filter(e => e.buyerWorkspaceId === buyerWorkspaceId));
    }

    findById(id: VendorListEntryId): Promise<VendorListEntry | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? undefined : VendorListEntry.rehydrate(clone(row)));
    }

    findMany(ids: readonly VendorListEntryId[]): Promise<VendorListEntry[]> {
        const set = new Set(ids);
        return Promise.resolve(this.all().filter(e => set.has(e.id)));
    }

    findByPhone(buyerWorkspaceId: WorkspaceId, phone: string): Promise<VendorListEntry | undefined> {
        return Promise.resolve(this.all().find(e => e.buyerWorkspaceId === buyerWorkspaceId && e.phone === phone));
    }

    findAllByPhone(phone: string): Promise<VendorListEntry[]> {
        return Promise.resolve(this.all().filter(e => e.phone === phone));
    }

    findLinked(buyerWorkspaceId: WorkspaceId, vendorWorkspaceId: WorkspaceId): Promise<VendorListEntry | undefined> {
        return Promise.resolve(this.all().find(e => e.buyerWorkspaceId === buyerWorkspaceId && e.vendorWorkspaceId === vendorWorkspaceId));
    }

    insert(entry: VendorListEntry): Promise<void> {
        const duplicate = [...this.rows.values()].some(r => r.buyerWorkspaceId === entry.buyerWorkspaceId && r.phone === entry.phone);
        if (duplicate) return Promise.reject(new Error('sc_vendor_list_entries_phone_key'));
        this.rows.set(entry.id, entry.toProps());
        return Promise.resolve();
    }

    update(entry: VendorListEntry): Promise<void> {
        if (this.rows.get(entry.id)?.buyerWorkspaceId === entry.buyerWorkspaceId) this.rows.set(entry.id, entry.toProps());
        return Promise.resolve();
    }

    delete(buyerWorkspaceId: WorkspaceId, id: VendorListEntryId): Promise<void> {
        if (this.rows.get(id)?.buyerWorkspaceId === buyerWorkspaceId) this.rows.delete(id);
        return Promise.resolve();
    }
}

export class InMemoryWorkPackageRepository extends WorkPackageRepository {
    readonly rows = new Map<PackageId, WorkPackageProps>();

    findById(id: PackageId): Promise<WorkPackage | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? undefined : WorkPackage.rehydrate(clone(row)));
    }

    /** No concurrent transactions in memory: a plain read. */
    lockById(id: PackageId): Promise<WorkPackage | undefined> {
        return this.findById(id);
    }

    listByProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<WorkPackage[]> {
        return Promise.resolve([...this.rows.values()]
            .filter(r => r.buyerWorkspaceId === buyerWorkspaceId && r.projectId === projectId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
            .map(r => WorkPackage.rehydrate(clone(r))));
    }

    listOpenDueBy(before: Date): Promise<WorkPackage[]> {
        return Promise.resolve([...this.rows.values()]
            .filter(r => r.status === 'open' && r.bidDeadline.getTime() <= before.getTime())
            .map(r => WorkPackage.rehydrate(clone(r))));
    }

    insert(pkg: WorkPackage): Promise<void> {
        this.rows.set(pkg.id, pkg.toProps());
        return Promise.resolve();
    }

    update(pkg: WorkPackage): Promise<void> {
        if (this.rows.get(pkg.id)?.buyerWorkspaceId === pkg.buyerWorkspaceId) this.rows.set(pkg.id, pkg.toProps());
        return Promise.resolve();
    }

    updateIfStatus(pkg: WorkPackage, expected: PackageStatus): Promise<boolean> {
        const row = this.rows.get(pkg.id);
        if (row?.buyerWorkspaceId !== pkg.buyerWorkspaceId || row.status !== expected) return Promise.resolve(false);
        this.rows.set(pkg.id, pkg.toProps());
        return Promise.resolve(true);
    }

    delete(buyerWorkspaceId: WorkspaceId, id: PackageId): Promise<void> {
        if (this.rows.get(id)?.buyerWorkspaceId === buyerWorkspaceId) this.rows.delete(id);
        return Promise.resolve();
    }
}

export class InMemoryInvitationRepository extends InvitationRepository {
    readonly rows = new Map<ScInvitationId, ScInvitationProps>();
    readonly tokens = new Map<string, ScInvitationId>();

    private all(): ScInvitation[] {
        return [...this.rows.values()].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime() || a.id.localeCompare(b.id))
            .map(r => ScInvitation.rehydrate(clone(r)));
    }

    findById(id: ScInvitationId): Promise<ScInvitation | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? undefined : ScInvitation.rehydrate(clone(row)));
    }

    lockById(id: ScInvitationId): Promise<ScInvitation | undefined> {
        return this.findById(id);
    }

    findByTokenHash(tokenHash: string): Promise<ScInvitation | undefined> {
        const id = this.tokens.get(tokenHash);
        return id === undefined ? Promise.resolve(undefined) : this.findById(id);
    }

    listByPackage(packageId: PackageId): Promise<ScInvitation[]> {
        return Promise.resolve(this.all().filter(i => i.packageId === packageId));
    }

    lockByPackage(packageId: PackageId): Promise<ScInvitation[]> {
        return this.listByPackage(packageId);
    }

    listByPackages(packageIds: readonly PackageId[]): Promise<ScInvitation[]> {
        const set = new Set(packageIds);
        return Promise.resolve(this.all().filter(i => set.has(i.packageId)));
    }

    listByVendor(vendorWorkspaceId: WorkspaceId): Promise<ScInvitation[]> {
        return Promise.resolve(this.all().filter(i => i.vendorWorkspaceId === vendorWorkspaceId));
    }

    listByEntries(entryIds: readonly VendorListEntryId[]): Promise<ScInvitation[]> {
        const set = new Set(entryIds);
        return Promise.resolve(this.all().filter(i => set.has(i.props.vendorListEntryId)));
    }

    insert(invitation: ScInvitation, tokenHash: string): Promise<void> {
        this.rows.set(invitation.id, invitation.toProps());
        this.tokens.set(tokenHash, invitation.id);
        return Promise.resolve();
    }

    update(invitation: ScInvitation): Promise<void> {
        if (this.rows.has(invitation.id)) this.rows.set(invitation.id, invitation.toProps());
        return Promise.resolve();
    }

    addToken(invitationId: ScInvitationId, tokenHash: string): Promise<void> {
        this.tokens.set(tokenHash, invitationId);
        return Promise.resolve();
    }

    replaceTokens(invitationId: ScInvitationId, tokenHash: string): Promise<void> {
        for (const [hash, id] of this.tokens) if (id === invitationId) this.tokens.delete(hash);
        this.tokens.set(tokenHash, invitationId);
        return Promise.resolve();
    }
}

export class InMemoryQuestionRepository extends QuestionRepository {
    readonly rows = new Map<QuestionId, PackageQuestionProps>();

    listByPackage(packageId: PackageId): Promise<PackageQuestion[]> {
        return Promise.resolve([...this.rows.values()].filter(r => r.packageId === packageId)
            .sort((a, b) => a.askedAt.getTime() - b.askedAt.getTime() || a.id.localeCompare(b.id))
            .map(r => PackageQuestion.rehydrate(clone(r))));
    }

    findById(id: QuestionId): Promise<PackageQuestion | undefined> {
        const row = this.rows.get(id);
        return Promise.resolve(row === undefined ? undefined : PackageQuestion.rehydrate(clone(row)));
    }

    insert(question: PackageQuestion): Promise<void> {
        this.rows.set(question.id, question.toProps());
        return Promise.resolve();
    }

    update(question: PackageQuestion): Promise<void> {
        if (this.rows.has(question.id)) this.rows.set(question.id, question.toProps());
        return Promise.resolve();
    }
}
