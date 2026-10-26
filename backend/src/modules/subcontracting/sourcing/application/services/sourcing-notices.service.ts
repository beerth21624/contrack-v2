// ─── Notifications of the sourcing work stream (docs/marketplace/API-module1.md "Notifications") ───
// Always called after the transaction committed. Vendors are reached in-app through their workspace once linked, and
// by SMS (`toPhone`) for invitations / addenda sent through a channel other than "copy the link".
import { Injectable } from '@nestjs/common';
import {
    AppLinks, type NotificationRequest, type NotificationTemplate, Notifier, WorkspaceDirectory,
} from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import type { PackageId, ScInvitationId } from '../../../shared/ids';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { formatThaiDateTime } from './thai-format';

export const buyerPackageHref = (id: PackageId): string => `/subcontracting/packages/${id}`;
export const vendorInvitationHref = (id: ScInvitationId): string => `/vendor/invitations/${id}`;
export const guestPath = (token: string): string => `/s/${token}`;

@Injectable()
export class SourcingNotices {
    constructor(private readonly notifier: Notifier, private readonly links: AppLinks, private readonly workspaces: WorkspaceDirectory) {}

    async workspaceName(id: WorkspaceId): Promise<string> {
        return (await this.workspaces.names([id])).get(id) ?? '';
    }

    /** Absolute link of a raw token (only known right after it was made). */
    guestUrl(token: string): string {
        return this.links.url(guestPath(token));
    }

    /**
     * A linked crew is told in-app (and by the platform's own SMS to its members) with the signed-in route only; an
     * invitee without an account gets the raw link by SMS (`toPhone`) when the buyer chose a channel other than
     * "copy the link". The raw /s/<token> link never goes into an in-app payload.
     */
    async invitation(pkg: WorkPackage, buyerName: string, invitation: ScInvitation, token: string): Promise<void> {
        await this.toInvitee('sc.invitation', invitation, token, {
            buyerName, title: pkg.props.title, deadline: formatThaiDateTime(pkg.props.bidDeadline), href: vendorInvitationHref(invitation.id),
        });
    }

    /** `token`: a fresh link for an invitee reached by SMS without an account (see `smsLinkNeeded`). */
    async addendum(pkg: WorkPackage, buyerName: string, invitation: ScInvitation, token: string | undefined): Promise<void> {
        await this.toInvitee('sc.addendum', invitation, token, { buyerName, title: pkg.props.title, href: vendorInvitationHref(invitation.id) });
    }

    /** The invitee is reached by an SMS that carries the raw link (no account yet, channel other than "copy the link"). */
    static smsLinkNeeded(inv: ScInvitation): boolean {
        return inv.vendorWorkspaceId === null && inv.props.channel !== 'link';
    }

    async questionAsked(pkg: WorkPackage): Promise<void> {
        await this.toBuyer(pkg, 'sc.question_asked', { title: pkg.props.title, href: buyerPackageHref(pkg.id) });
    }

    async questionAnswered(pkg: WorkPackage, invitees: readonly ScInvitation[]): Promise<void> {
        for (const inv of invitees) {
            await this.toVendor('sc.question_answered', inv, { title: pkg.props.title, href: vendorInvitationHref(inv.id) });
        }
    }

    async declined(pkg: WorkPackage, vendorName: string, reason: string): Promise<void> {
        await this.toBuyer(pkg, 'sc.declined', { vendorName, title: pkg.props.title, reason, href: buyerPackageHref(pkg.id) });
    }

    async cancelled(pkg: WorkPackage, buyerName: string, invitees: readonly ScInvitation[], reason: string): Promise<void> {
        for (const inv of invitees) {
            await this.toVendor('sc.package_cancelled', inv, {
                buyerName, title: pkg.props.title, reason, href: vendorInvitationHref(inv.id),
            });
        }
    }

    async deadlineSoon(pkg: WorkPackage, invitation: ScInvitation): Promise<void> {
        await this.toVendor('sc.deadline_soon', invitation, {
            title: pkg.props.title, deadline: formatThaiDateTime(pkg.props.bidDeadline), href: vendorInvitationHref(invitation.id),
        });
    }

    private async toBuyer(pkg: WorkPackage, template: NotificationTemplate, payload: NotificationRequest['payload']): Promise<void> {
        await this.notifier.notify({ template, toWorkspaceIds: [pkg.buyerWorkspaceId], payload });
    }

    /** In-app to the linked crew (payload without any raw link); nothing when the invitee has no account yet. */
    private async toVendor(template: NotificationTemplate, inv: ScInvitation, payload: NotificationRequest['payload']): Promise<void> {
        const vendorWs = inv.vendorWorkspaceId;
        if (vendorWs === null) return;
        await this.notifier.notify({ template, payload, toWorkspaceIds: [vendorWs] });
    }

    /** Linked → in-app (signed-in route); else SMS with the raw link when one was made for it. */
    private async toInvitee(
        template: NotificationTemplate, inv: ScInvitation, token: string | undefined, payload: NotificationRequest['payload'],
    ): Promise<void> {
        if (inv.vendorWorkspaceId !== null) {
            await this.toVendor(template, inv, payload);
            return;
        }
        if (token === undefined || !SourcingNotices.smsLinkNeeded(inv)) return;
        await this.notifier.notify({ template, toPhone: inv.props.phone, payload: { ...payload, url: this.guestUrl(token) } });
    }
}
