// ─── Links vendor-list entries and invitations to the vendor workspace of a crew (phone match / claimed link) ───
// Runs inside the caller's transaction; contracts hears about every invitation that got linked (subcontracts awarded
// before the crew signed up get its workspace too). An invitation is linked only to a crew whose verified phone is
// the invited phone, never moved from one crew to another, and never once withdrawn.
import { Injectable } from '@nestjs/common';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { ScInvitationId } from '../../../shared/ids';
import { ScActivityLog, VendorLinkListener } from '../../../shared/ports';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { VendorListEntry } from '../../domain/entities/vendor-list-entry.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, VendorListRepository, VendorProfileRepository } from '../ports/sourcing.repositories';

export interface LinkOutcome {
    /** The invitation as stored now (re-read under a row lock). */
    invitation: ScInvitation;
    /** False when it already was linked to this crew. */
    linked: boolean;
}

@Injectable()
export class VendorLinker {
    constructor(
        private readonly profiles: VendorProfileRepository,
        private readonly entries: VendorListRepository,
        private readonly invitations: InvitationRepository,
        private readonly listener: VendorLinkListener,
        private readonly activity: ScActivityLog,
    ) {}

    /** Workspace of the crew that signed up with this phone, or null. */
    async vendorOfPhone(phone: string): Promise<WorkspaceId | null> {
        return (await this.profiles.findByPhone(phone))?.workspaceId ?? null;
    }

    /** Every unlinked entry with this phone (any buyer) and the unlinked invitations of those entries sent to it. */
    async linkPhone(phone: string, vendorWorkspaceId: WorkspaceId, actor: UserId | null, now: Date): Promise<ScInvitation[]> {
        const linkedEntries: VendorListEntry[] = [];
        for (const entry of await this.entries.findAllByPhone(phone)) {
            if (!entry.linkTo(vendorWorkspaceId, now)) continue;
            await this.entries.update(entry);
            linkedEntries.push(entry);
            await this.activity.record({
                buyerWorkspaceId: entry.buyerWorkspaceId, vendorWorkspaceId, entity: 'vendor', entityId: entry.id,
                action: 'vendor_list.linked', actorUserId: actor, at: now,
            });
        }
        const out: ScInvitation[] = [];
        for (const inv of await this.invitations.listByEntries(linkedEntries.map(e => e.id))) {
            if (inv.vendorWorkspaceId !== null || inv.props.phone !== phone) continue;
            const res = await this.linkInvitation(inv.id, vendorWorkspaceId, phone, actor, now);
            if (res.ok && res.value.linked) out.push(res.value.invitation);
        }
        return out;
    }

    /**
     * Links one invitation to the crew whose verified phone is `verifiedPhone` (row locked, state re-checked).
     * ok(linked: false) when already linked to this crew; withdrawn / gone → not_found; linked to another crew →
     * conflict; another phone was invited → conflict { reason: 'phone_mismatch' }.
     */
    async linkInvitation(
        id: ScInvitationId, vendorWorkspaceId: WorkspaceId, verifiedPhone: string, actor: UserId | null, now: Date,
    ): Promise<Result<LinkOutcome, DomainError>> {
        const inv = await this.invitations.lockById(id);
        if (inv === undefined || inv.status === 'withdrawn') return err(SourcingErrors.invitationNotFound());
        if (inv.vendorWorkspaceId === vendorWorkspaceId) return ok({ invitation: inv, linked: false });
        if (inv.vendorWorkspaceId !== null) return err(SourcingErrors.linkedElsewhere());
        if (verifiedPhone === '' || inv.props.phone !== verifiedPhone) return err(SourcingErrors.phoneMismatch());
        const changed = inv.linkTo(vendorWorkspaceId);
        if (!changed.ok) return changed;
        await this.invitations.update(inv);
        await this.activity.record({
            buyerWorkspaceId: inv.props.buyerWorkspaceId, vendorWorkspaceId, entity: 'invitation', entityId: inv.id,
            action: 'invitation.linked', actorUserId: actor, at: now,
        });
        await this.listener.onInvitationLinked(inv.id, vendorWorkspaceId);
        return ok({ invitation: inv, linked: true });
    }
}
