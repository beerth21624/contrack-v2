// ─── Finds the package / invitation a request is about and checks the caller through ScAccess ───
// Buyer side: member of the package's workspace with the permissions (not a member → not_found). Vendor side: member
// of the invitation's vendor workspace, or the holder of a valid link (public routes).
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { Clock } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { Permission } from '../../../../../shared/domain/permissions';
import { sha256 } from '../../../../../shared/infrastructure/crypto';
import type { PackageId, ScInvitationId } from '../../../shared/ids';
import { ScAccess } from '../../../shared/sc-access';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';

export interface BuyerPackageAccess {
    pkg: WorkPackage;
    role: Role;
    /** May read estimates and bid totals (sc.readPrices, widened by settings for viewers). */
    prices: boolean;
}

/** How a vendor reaches an invitation: the secret link (public) or as a signed-in crew member. */
export type InvitationVia = { token: string } | { userId: UserId; invitationId: ScInvitationId };

export interface InvitationAccess {
    invitation: ScInvitation;
    pkg: WorkPackage;
}

@Injectable()
export class SourcingAccess {
    constructor(
        readonly sc: ScAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly clock: Clock,
    ) {}

    async prices(role: Role, workspaceId: WorkspaceId): Promise<boolean> {
        return this.sc.allowed(role, 'sc.readPrices', workspaceId);
    }

    async buyerPackage(userId: UserId, id: PackageId, permissions: Permission[]): Promise<Result<BuyerPackageAccess, DomainError>> {
        const pkg = await this.packages.findById(id);
        if (pkg === undefined) return err(SourcingErrors.packageNotFound());
        const role = await this.sc.buyer(userId, pkg.buyerWorkspaceId, permissions, 'Package');
        if (!role.ok) return role;
        return ok({ pkg, role: role.value, prices: await this.prices(role.value, pkg.buyerWorkspaceId) });
    }

    async buyerInvitation(userId: UserId, id: ScInvitationId, permissions: Permission[]): Promise<Result<InvitationAccess & { prices: boolean }, DomainError>> {
        const invitation = await this.invitations.findById(id);
        if (invitation === undefined) return err(SourcingErrors.invitationNotFound());
        const role = await this.sc.buyer(userId, invitation.props.buyerWorkspaceId, permissions, 'Invitation');
        if (!role.ok) return role;
        const pkg = await this.packages.findById(invitation.packageId);
        if (pkg === undefined) return err(SourcingErrors.invitationNotFound());
        return ok({ invitation, pkg, prices: await this.prices(role.value, pkg.buyerWorkspaceId) });
    }

    /** Public link: module offered by the platform, link known, not withdrawn, not expired. */
    async byToken(token: string): Promise<Result<InvitationAccess, DomainError>> {
        const on = this.sc.platformOn();
        if (!on.ok) return on;
        const invitation = await this.invitations.findByTokenHash(sha256(token));
        if (invitation?.linkValid(this.clock.now()) !== true) return err(SourcingErrors.invitationInvalid());
        const pkg = await this.packages.findById(invitation.packageId);
        if (pkg === undefined) return err(SourcingErrors.invitationInvalid());
        return ok({ invitation, pkg });
    }

    /** Signed-in crew member of the invitation's vendor workspace with the permissions. Withdrawn → not_found. */
    async vendorInvitation(userId: UserId, id: ScInvitationId, permissions: Permission[]): Promise<Result<InvitationAccess, DomainError>> {
        const invitation = await this.invitations.findById(id);
        const vendorWs = invitation?.vendorWorkspaceId ?? null;
        if (invitation === undefined || vendorWs === null || invitation.status === 'withdrawn') return err(SourcingErrors.invitationNotFound());
        const role = await this.sc.vendor(userId, vendorWs, permissions, 'Invitation');
        if (!role.ok) return role;
        const pkg = await this.packages.findById(invitation.packageId);
        if (pkg === undefined) return err(SourcingErrors.invitationNotFound());
        return ok({ invitation, pkg });
    }

    /**
     * Inside `uow.run`, before any write: the package row locked and re-read (a concurrent award / cancel / sweep has
     * either committed — and is seen here — or waits). Gone meanwhile → not_found.
     */
    async lockPackage(id: PackageId): Promise<Result<WorkPackage, DomainError>> {
        const pkg = await this.packages.lockById(id);
        return pkg === undefined ? err(SourcingErrors.packageNotFound()) : ok(pkg);
    }

    /** Either way in; the crew member needs the permissions in the vendor workspace. */
    async invitee(via: InvitationVia, permissions: Permission[]): Promise<Result<InvitationAccess, DomainError>> {
        return 'token' in via ? this.byToken(via.token) : this.vendorInvitation(via.userId, via.invitationId, permissions);
    }
}
