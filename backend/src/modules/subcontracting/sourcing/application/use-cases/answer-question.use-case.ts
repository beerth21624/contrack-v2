import { Injectable } from '@nestjs/common';
import type { QuestionDto } from '@contrack/contract';
import { Clock, UnitOfWork } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../../shared/domain/result';
import type { QuestionId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { SourcingErrors } from '../../domain/sourcing.errors';
import { InvitationRepository, QuestionRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { SourcingViews } from '../services/sourcing-views.service';

/**
 * `sc.packages.manage`. Answers (or re-answers) a question; the answer is visible to every invitee without the
 * asker's name, and every invitee still in the running is told.
 */
@Injectable()
export class AnswerQuestionUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly questions: QuestionRepository,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: { actorId: UserId; questionId: QuestionId; answer: string }): Promise<Result<QuestionDto, DomainError>> {
        const question = await this.questions.findById(input.questionId);
        if (question === undefined) return err(SourcingErrors.questionNotFound());
        const found = await this.access.buyerPackage(input.actorId, question.packageId, ['sc.packages.manage']);
        if (!found.ok) return found.error.code === 'not_found' ? err(SourcingErrors.questionNotFound()) : found;
        const { pkg } = found.value;
        const now = this.clock.now();
        question.answerWith(input.answer, input.actorId, now);
        await this.uow.run(async () => {
            await this.questions.update(question);
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: 'question.answered',
                actorUserId: input.actorId, data: { questionId: question.id }, at: now,
            });
        });
        const invitations = await this.invitations.listByPackage(pkg.id);
        await this.notices.questionAnswered(pkg, invitations.filter(i => i.isInRunning));
        return ok(this.views.buyerQuestion(question, invitations));
    }
}
