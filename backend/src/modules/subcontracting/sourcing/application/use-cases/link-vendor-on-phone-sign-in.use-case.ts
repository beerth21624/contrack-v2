import { Injectable } from '@nestjs/common';
import { Clock, type PhoneSignInEvent, UnitOfWork, WorkspaceDirectory } from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import { sha256 } from '../../../../../shared/infrastructure/crypto';
import { VendorProfile } from '../../domain/entities/vendor-profile.entity';
import { InvitationRepository, VendorProfileRepository } from '../ports/sourcing.repositories';
import { VendorLinker } from '../services/vendor-linker.service';

/**
 * After a phone sign-in (inside identity's transaction): the vendor profile on the user's personal workspace is
 * reused or, with a team name, created (L0); every vendor-list entry with that phone in any buyer workspace — and
 * their invitations sent to that phone — is linked to it, and so is the invitation of the link the user came from
 * (when still valid and sent to this very phone).
 * Contracts hears about every linked invitation. Returns the vendor workspace (null without a profile).
 */
@Injectable()
export class LinkVendorOnPhoneSignInUseCase {
    constructor(
        private readonly profiles: VendorProfileRepository,
        private readonly invitations: InvitationRepository,
        private readonly workspaces: WorkspaceDirectory,
        private readonly linker: VendorLinker,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(event: PhoneSignInEvent): Promise<{ vendorWorkspaceId: WorkspaceId | null }> {
        const personal = await this.workspaces.personalWorkspaceOf(event.userId);
        if (personal === undefined) return { vendorWorkspaceId: null };
        return this.uow.run(async () => {
            const now = this.clock.now();
            let profile = await this.profiles.find(personal);
            const teamName = event.teamName?.trim() ?? '';
            if (profile === undefined) {
                if (teamName === '') return { vendorWorkspaceId: null };
                profile = VendorProfile.create({ workspaceId: personal, teamName, contactName: event.displayName, phone: event.phone, now });
                await this.profiles.save(profile);
            } else if (profile.props.phone !== event.phone) {
                profile.setPhone(event.phone, now);
                await this.profiles.save(profile);
            }
            const vendorWs = profile.workspaceId;
            await this.linker.linkPhone(event.phone, vendorWs, event.userId, now);
            if (event.invitationToken !== undefined) {
                const inv = await this.invitations.findByTokenHash(sha256(event.invitationToken));
                // Only when the verified phone is the invited one (else the crew asks the buyer to invite its number);
                // a refusal never fails the sign-in.
                if (inv?.linkValid(now) === true) await this.linker.linkInvitation(inv.id, vendorWs, event.phone, event.userId, now);
            }
            return { vendorWorkspaceId: vendorWs };
        });
    }
}
