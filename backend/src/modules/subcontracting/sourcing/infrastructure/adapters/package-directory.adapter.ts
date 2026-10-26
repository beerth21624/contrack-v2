// ─── PackageDirectory (shared port) for bidding and contracts: package / invitation reads and their state changes ───
// Writes join the caller's UnitOfWork (repositories use the transaction executor); activity is recorded with them.
import { Injectable } from '@nestjs/common';
import type { PackageStatus } from '@contrack/contract';
import { Clock, WorkspaceDirectory } from '../../../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain/ids';
import type { SnapshotLine } from '@contrack/domain/subcontracting';
import type { PackageId, ScInvitationId } from '../../../shared/ids';
import { type InvitationView, PackageDirectory, type PackageView, ScActivityLog } from '../../../shared/ports';
import { InvitationRepository, WorkPackageRepository } from '../../application/ports/sourcing.repositories';
import { hasSubmitted } from '../../application/services/sourcing-views.service';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';

/** Stored statuses an award may start from (an open package past its deadline is effectively reviewing). */
const AWARDABLE: readonly PackageStatus[] = ['open', 'reviewing', 'expired'];

function invitationView(inv: ScInvitation): InvitationView {
    const i = inv.props;
    return {
        id: i.id, packageId: i.packageId, buyerWorkspaceId: i.buyerWorkspaceId, vendorListEntryId: i.vendorListEntryId,
        vendorWorkspaceId: i.vendorWorkspaceId, displayName: i.displayName, phone: i.phone, channel: i.channel, status: i.status,
        sentAt: i.sentAt, viewedAt: i.viewedAt,
    };
}

@Injectable()
export class SourcingPackageDirectory extends PackageDirectory {
    constructor(
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly workspaces: WorkspaceDirectory,
        private readonly activity: ScActivityLog,
        private readonly clock: Clock,
    ) {
        super();
    }

    private async view(pkg: WorkPackage, buyerName?: string): Promise<PackageView> {
        const p = pkg.props;
        const name = buyerName ?? (await this.workspaces.names([p.buyerWorkspaceId])).get(p.buyerWorkspaceId) ?? '';
        const invitations = await this.invitations.listByPackage(pkg.id);
        return {
            id: p.id, buyerWorkspaceId: p.buyerWorkspaceId, buyerName: name, projectId: p.projectId, projectName: p.projectName,
            title: p.title, trade: p.trade, status: pkg.effectiveStatus(this.clock.now(), hasSubmitted(invitations)),
            version: pkg.version, sourcingMode: p.sourcingMode, pricingMode: p.pricingMode, supplyMode: p.supplyMode,
            description: p.description, terms: structuredClone(p.terms), schedule: { ...p.schedule },
            installments: p.installments.map(i => ({ ...i })), location: { ...p.location }, hideOwnerIdentity: p.hideOwnerIdentity,
            bidDeadline: p.bidDeadline, priceValidUntil: p.priceValidUntil, estimateTotal: p.estimateTotal,
            lines: structuredClone(pkg.lines), createdBy: p.createdBy, sentAt: p.sentAt, awardedAt: p.awardedAt,
        };
    }

    async findPackage(id: PackageId): Promise<PackageView | undefined> {
        const pkg = await this.packages.findById(id);
        return pkg === undefined ? undefined : this.view(pkg);
    }

    async linesOfVersion(id: PackageId, version: number): Promise<SnapshotLine[] | undefined> {
        return (await this.packages.findById(id))?.versionLines(version);
    }

    async findInvitation(id: ScInvitationId): Promise<InvitationView | undefined> {
        const inv = await this.invitations.findById(id);
        return inv === undefined ? undefined : invitationView(inv);
    }

    async listInvitations(packageId: PackageId): Promise<InvitationView[]> {
        return (await this.invitations.listByPackage(packageId)).map(invitationView);
    }

    async listPackagesOfProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<PackageView[]> {
        const pkgs = await this.packages.listByProject(buyerWorkspaceId, projectId);
        const name = (await this.workspaces.names([buyerWorkspaceId])).get(buyerWorkspaceId) ?? '';
        return Promise.all(pkgs.map(p => this.view(p, name)));
    }

    async listInvitationsOfVendor(vendorWorkspaceId: WorkspaceId): Promise<InvitationView[]> {
        return (await this.invitations.listByVendor(vendorWorkspaceId)).map(invitationView);
    }

    async markSubmitted(invitationId: ScInvitationId, at: Date): Promise<void> {
        const inv = await this.invitations.lockById(invitationId);
        if (inv === undefined) return;
        inv.markSubmitted(at);
        await this.invitations.update(inv);
    }

    async markBidWithdrawn(invitationId: ScInvitationId): Promise<void> {
        const inv = await this.invitations.lockById(invitationId);
        if (inv === undefined) return;
        inv.markBidWithdrawn();
        await this.invitations.update(inv);
    }

    async markAwarded(packageId: PackageId, winners: readonly ScInvitationId[], at: Date): Promise<boolean> {
        const pkg = await this.packages.lockById(packageId);
        if (pkg === undefined || !AWARDABLE.includes(pkg.status)) return false;
        const from = pkg.status;
        pkg.markAwarded(at);
        if (!(await this.packages.updateIfStatus(pkg, from))) return false;
        const won = new Set(winners);
        for (const inv of await this.invitations.lockByPackage(packageId)) {
            inv.settleAward(won.has(inv.id));
            await this.invitations.update(inv);
        }
        await this.activity.record({
            buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.awarded',
            actorUserId: null, data: { from, winners: [...winners] }, at,
        });
        return true;
    }

    /** Locks the package; only an awarded package goes back to reviewing. */
    async reopenAfterCancel(packageId: PackageId, at: Date): Promise<void> {
        const pkg = await this.packages.lockById(packageId);
        if (pkg?.status !== 'awarded') return;
        pkg.reopenAfterCancel(at);
        await this.packages.update(pkg);
        for (const inv of await this.invitations.lockByPackage(packageId)) {
            inv.reopenAward();
            await this.invitations.update(inv);
        }
        await this.activity.record({
            buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.reopened',
            actorUserId: null, data: { from: 'awarded', to: 'reviewing' }, at,
        });
    }

    /** Locks the package; a closed or cancelled package stays as it is. */
    async markClosed(packageId: PackageId, at: Date): Promise<void> {
        const pkg = await this.packages.lockById(packageId);
        if (pkg === undefined || pkg.status === 'closed' || pkg.status === 'cancelled') return;
        const from = pkg.status;
        pkg.markClosed(at);
        await this.packages.update(pkg);
        await this.activity.record({
            buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'package.closed',
            actorUserId: null, data: { from, to: 'closed' }, at,
        });
    }
}
