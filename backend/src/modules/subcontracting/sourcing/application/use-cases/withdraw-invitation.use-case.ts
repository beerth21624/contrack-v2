import { Injectable } from '@nestjs/common';
import type { ScInvitationDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { ScInvitationId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/**
 * `sc.packages.manage`, before award. Sent / viewed / declined invitations only (a crew with a bid in withdraws it
 * itself); the link stops working.
 */
@Injectable()
export class WithdrawInvitationUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; invitationId: ScInvitationId }): Promise<Result<ScInvitationDto, DomainError>> {
        const found = await this.access.buyerInvitation(input.actorId, input.invitationId, ['sc.packages.manage']);
        if (!found.ok) return found;
        const { invitation, pkg, prices } = found.value;
        if (!pkg.isActive) return err(SourcingErrors.finished());
        const now = this.clock.now();
        const from = invitation.status;
        const withdrawn = invitation.withdraw(now);
        if (!withdrawn.ok) return withdrawn;
        await this.uow.run(async () => {
            await this.invitations.update(invitation);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'invitation',
                entityId: invitation.id, action: 'invitation.withdrawn', actorUserId: input.actorId, data: { from }, at: now,
            });
        });
        const [dto] = await this.views.invitationDtos(pkg, [invitation], prices);
        if (dto === undefined) throw new Error('invitation vanished');
        return ok(dto);
    }
}
