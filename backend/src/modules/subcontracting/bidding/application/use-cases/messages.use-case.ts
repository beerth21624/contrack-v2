// ─── Negotiation messages buyer ↔ one invitee (GET / POST on both sides) ───
// Buyer: GET sc.read, POST sc.packages.manage (may carry a target price). Vendor: GET vendor.read, POST vendor.bid.draft
// (+ the buyer's module on). Reading marks the other side's messages read. The other side is notified (sc.message).
import { Injectable } from '@nestjs/common';
import type { NegotiationMessageDto, SendMessageRequest } from '@contrack/contract';
import { Clock, IdGenerator, Notifier } from '../../../../../shared/application/ports';
import { DomainError, type Result, type UserId, err, ok } from '../../../../../shared/domain';
import { asMessageId, type ScInvitationId } from '../../../shared/ids';
import { type InvitationView, type PackageView, VendorDirectory } from '../../../shared/ports';
import { BiddingAccess } from '../bidding-access';
import { messageToDto } from '../bid-presenter';
import { MessageRepository, type MessageSide, type NegotiationMessage } from '../ports/message.repository';

export interface ListMessagesInput {
    userId: UserId;
    invitationId: ScInvitationId;
    side: MessageSide;
}

export interface SendMessageInput extends ListMessagesInput {
    body: SendMessageRequest;
}

const other = (side: MessageSide): MessageSide => (side === 'buyer' ? 'vendor' : 'buyer');

@Injectable()
export class ListMessagesUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly messages: MessageRepository,
        private readonly clock: Clock,
    ) {}

    async execute(input: ListMessagesInput): Promise<Result<NegotiationMessageDto[], DomainError>> {
        const granted = input.side === 'vendor'
            ? await this.access.vendorInvitation(input.userId, input.invitationId, ['vendor.read'])
            : await this.access.buyerInvitation(input.userId, input.invitationId, ['sc.read']);
        if (!granted.ok) return granted;
        await this.messages.markRead(input.invitationId, other(input.side), this.clock.now());
        return ok((await this.messages.list(input.invitationId)).map(messageToDto));
    }
}

@Injectable()
export class SendMessageUseCase {
    constructor(
        private readonly access: BiddingAccess,
        private readonly messages: MessageRepository,
        private readonly vendors: VendorDirectory,
        private readonly notifier: Notifier,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: SendMessageInput): Promise<Result<NegotiationMessageDto, DomainError>> {
        let invitation: InvitationView;
        let pkg: PackageView;
        if (input.side === 'vendor') {
            const granted = await this.access.vendorInvitation(input.userId, input.invitationId, ['vendor.bid.draft']);
            if (!granted.ok) return granted;
            ({ invitation, pkg } = granted.value);
            const on = await this.access.buyerModuleOn(pkg.buyerWorkspaceId);
            if (!on.ok) return on;
            if (input.body.targetTotal !== null) return err(DomainError.validation('Only the buyer sets a target price'));
        } else {
            const granted = await this.access.buyerInvitation(input.userId, input.invitationId, ['sc.packages.manage']);
            if (!granted.ok) return granted;
            ({ invitation, pkg } = granted.value);
        }
        if (pkg.status === 'draft' || pkg.status === 'cancelled' || pkg.status === 'closed' || invitation.status === 'withdrawn') {
            return err(DomainError.conflict('Messages are closed for this invitation', { reason: 'messages_closed' }));
        }

        const message: NegotiationMessage = {
            id: asMessageId(this.ids.newId()),
            buyerWorkspaceId: pkg.buyerWorkspaceId,
            packageId: pkg.id,
            invitationId: invitation.id,
            from: input.side,
            authorUserId: input.userId,
            text: input.body.text,
            targetTotal: input.body.targetTotal,
            at: this.clock.now(),
            readAt: null,
        };
        await this.messages.insert(message);

        if (input.side === 'buyer') {
            if (invitation.vendorWorkspaceId !== null) {
                await this.notifier.notify({
                    template: 'sc.message',
                    toWorkspaceIds: [invitation.vendorWorkspaceId],
                    payload: { fromName: pkg.buyerName, title: pkg.title, href: `/vendor/invitations/${invitation.id}` },
                });
            }
        } else {
            const vendorWs = invitation.vendorWorkspaceId;
            const card = vendorWs === null ? undefined : (await this.vendors.cards([vendorWs])).get(vendorWs);
            await this.notifier.notify({
                template: 'sc.message',
                toWorkspaceIds: [pkg.buyerWorkspaceId],
                payload: { fromName: card?.teamName ?? invitation.displayName, title: pkg.title, href: `/subcontracting/packages/${pkg.id}/leveling` },
            });
        }
        return ok(messageToDto(message));
    }
}
