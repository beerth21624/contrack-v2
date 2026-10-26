// ─── Who may act on an invitation / package of the bidding stream (always through ScAccess) ───
// Vendor side: the invitation must be linked to a vendor workspace and the caller must hold the permissions in it;
// anything else is not_found (a crew never learns that another crew's invitation exists).
// Buyer side: the package's buyer workspace (ScAccess.buyer: member → module on → permission).
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { DomainError, type Result, type UserId, type WorkspaceId, err, ok } from '../../../../shared/domain';
import type { Permission } from '../../../../shared/domain/permissions';
import type { PackageId, ScInvitationId } from '../../shared/ids';
import { type InvitationView, PackageDirectory, type PackageView } from '../../shared/ports';
import { ScAccess } from '../../shared/sc-access';

export interface VendorInvitationAccess {
    invitation: InvitationView & { vendorWorkspaceId: WorkspaceId };
    pkg: PackageView;
    role: Role;
}

export interface BuyerInvitationAccess {
    invitation: InvitationView;
    pkg: PackageView;
    role: Role;
}

export interface BuyerPackageAccess {
    pkg: PackageView;
    role: Role;
}

@Injectable()
export class BiddingAccess {
    constructor(private readonly sc: ScAccess, private readonly packages: PackageDirectory) {}

    async vendorInvitation(userId: UserId, invitationId: ScInvitationId, permissions: Permission[]): Promise<Result<VendorInvitationAccess, DomainError>> {
        const invitation = await this.packages.findInvitation(invitationId);
        const vendorWorkspaceId = invitation?.vendorWorkspaceId ?? null;
        if (invitation === undefined || vendorWorkspaceId === null) return err(DomainError.notFound('Invitation'));
        const role = await this.sc.vendor(userId, vendorWorkspaceId, permissions, 'Invitation');
        if (!role.ok) return role;
        const pkg = await this.packages.findPackage(invitation.packageId);
        if (pkg === undefined) return err(DomainError.notFound('Invitation'));
        return ok({ invitation: { ...invitation, vendorWorkspaceId }, pkg, role: role.value });
    }

    async buyerInvitation(userId: UserId, invitationId: ScInvitationId, permissions: Permission[]): Promise<Result<BuyerInvitationAccess, DomainError>> {
        const invitation = await this.packages.findInvitation(invitationId);
        if (invitation === undefined) return err(DomainError.notFound('Invitation'));
        const pkg = await this.packages.findPackage(invitation.packageId);
        if (pkg === undefined) return err(DomainError.notFound('Invitation'));
        const role = await this.sc.buyer(userId, pkg.buyerWorkspaceId, permissions, 'Invitation');
        if (!role.ok) return role;
        return ok({ invitation, pkg, role: role.value });
    }

    async buyerPackage(userId: UserId, packageId: PackageId, permissions: Permission[]): Promise<Result<BuyerPackageAccess, DomainError>> {
        const pkg = await this.packages.findPackage(packageId);
        if (pkg === undefined) return err(DomainError.notFound('Package'));
        const role = await this.sc.buyer(userId, pkg.buyerWorkspaceId, permissions, 'Package');
        if (!role.ok) return role;
        return ok({ pkg, role: role.value });
    }

    /** Vendor writes on a buyer's package need the buyer's module on. */
    buyerModuleOn(buyerWorkspaceId: WorkspaceId): Promise<Result<undefined, DomainError>> {
        return this.sc.buyerModuleOn(buyerWorkspaceId);
    }
}
