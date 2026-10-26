import { Injectable } from '@nestjs/common';
import type { QuestionDto } from '@contrack/contract';
import { Clock, IdGenerator, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import { asQuestionId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { PackageQuestion } from '../../domain/entities/package-question.entity';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, QuestionRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { type InvitationVia, SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews, hasSubmitted } from '../services/sourcing-views.service';

/**
 * An invitee asks a question, through the link (public) or signed in (`vendor.bid.draft`). Before the deadline,
 * buyer module on, invitation still in the running. The buyer is told.
 */
@Injectable()
export class AskQuestionUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly questions: QuestionRepository,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: { via: InvitationVia; question: string }): Promise<Result<QuestionDto, DomainError>> {
        const found = await this.access.invitee(input.via, ['vendor.bid.draft']);
        if (!found.ok) return found;
        const { invitation, pkg } = found.value;
        const on = await this.access.sc.buyerModuleOn(pkg.buyerWorkspaceId);
        if (!on.ok) return on;
        const now = this.clock.now();
        const settled = pkg.settle(now, hasSubmitted(await this.invitations.listByPackage(pkg.id)));
        if (!pkg.acceptsResponses(now)) return err(pkg.isActive ? SourcingErrors.deadlinePassed() : SourcingErrors.finished());
        if (!invitation.isInRunning) return err(SourcingErrors.invitationClosed());
        const question = PackageQuestion.create({
            id: asQuestionId(this.ids.newId()), packageId: pkg.id, buyerWorkspaceId: pkg.buyerWorkspaceId,
            invitationId: invitation.id, question: input.question, now,
        });
        await this.uow.run(async () => {
            if (settled) await this.packages.update(pkg);
            await this.questions.insert(question);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, vendorWorkspaceId: invitation.vendorWorkspaceId, entity: 'invitation',
                entityId: invitation.id, action: 'question.asked', actorUserId: 'userId' in input.via ? input.via.userId : null,
                data: { questionId: question.id }, at: now,
            });
        });
        await this.notices.questionAsked(pkg);
        const [dto] = this.views.vendorQuestions([question], invitation.id);
        if (dto === undefined) throw new Error('question vanished');
        return ok(dto);
    }
}
