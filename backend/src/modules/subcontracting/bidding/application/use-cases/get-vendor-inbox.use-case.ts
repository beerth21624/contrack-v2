// ─── GET /vendor/inbox?workspaceId=: the crew's invitations with what to do next (plan §5.4) ───
import { Injectable } from '@nestjs/common';
import type { InboxInvitationDto, VendorInboxDto } from '@contrack/contract';
import { type DomainError, type Result, type UserId, type WorkspaceId, ok } from '../../../../../shared/domain';
import { type InvitationView, PackageDirectory, type PackageView } from '../../../shared/ports';
import { ScAccess } from '../../../shared/sc-access';
import { BidRepository } from '../ports/bid.repository';
import { MessageRepository } from '../ports/message.repository';

export interface GetVendorInboxInput {
    userId: UserId;
    workspaceId: WorkspaceId;
}

function outcomeOf(invitation: InvitationView, pkg: PackageView): InboxInvitationDto['outcome'] {
    if (invitation.status === 'won') return 'won';
    if (invitation.status === 'lost') return 'lost';
    if (pkg.status === 'cancelled') return 'cancelled';
    if (invitation.status === 'closed' && (pkg.status === 'awarded' || pkg.status === 'closed')) return 'lost';
    return 'pending';
}

@Injectable()
export class GetVendorInboxUseCase {
    constructor(
        private readonly sc: ScAccess,
        private readonly packages: PackageDirectory,
        private readonly bids: BidRepository,
        private readonly messages: MessageRepository,
    ) {}

    async execute(input: GetVendorInboxInput): Promise<Result<VendorInboxDto, DomainError>> {
        const role = await this.sc.vendor(input.userId, input.workspaceId, ['vendor.read']);
        if (!role.ok) return role;
        // A buyer's withdrawn invitation disappears from the crew's list (its link stops working too).
        const invitations = (await this.packages.listInvitationsOfVendor(input.workspaceId))
            .filter(i => i.vendorWorkspaceId === input.workspaceId && i.status !== 'withdrawn');
        const ids = invitations.map(i => i.id);
        const [drafts, latest, unread] = await Promise.all([
            this.bids.withDraft(ids), this.bids.latestSubmitted(ids), this.messages.unreadCounts(ids, 'buyer'),
        ]);
        const packages = new Map<string, PackageView>();
        for (const packageId of new Set(invitations.map(i => i.packageId))) {
            const pkg = await this.packages.findPackage(packageId);
            if (pkg !== undefined) packages.set(packageId, pkg);
        }

        const out: InboxInvitationDto[] = [];
        for (const i of invitations) {
            const pkg = packages.get(i.packageId);
            if (pkg === undefined || pkg.status === 'draft') continue;
            out.push({
                invitationId: i.id,
                packageId: pkg.id,
                buyerName: pkg.buyerName,
                title: pkg.title,
                trade: pkg.trade,
                province: pkg.location.province,
                bidDeadline: pkg.bidDeadline.toISOString(),
                status: i.status,
                packageStatus: pkg.status,
                hasDraft: drafts.has(i.id),
                latestBidTotal: latest.get(i.id)?.total ?? null,
                outcome: outcomeOf(i, pkg),
                unreadMessages: unread.get(i.id) ?? 0,
                receivedAt: i.sentAt.toISOString(),
            });
        }
        out.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
        return ok({ invitations: out });
    }
}
