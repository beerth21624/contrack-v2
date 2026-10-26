import { Injectable } from '@nestjs/common';
import type { QuestionDto } from '@contrack/contract';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import type { PackageId } from '../../../shared/ids';
import { InvitationRepository, QuestionRepository } from '../ports/sourcing.repositories';
import { SourcingAccess } from '../services/sourcing-access.service';
import { SourcingViews } from '../services/sourcing-views.service';

/** `sc.read`. Every question of the package with who asked (buyer view), oldest first. */
@Injectable()
export class ListQuestionsUseCase {
    constructor(
        private readonly access: SourcingAccess,
        private readonly questions: QuestionRepository,
        private readonly invitations: InvitationRepository,
        private readonly views: SourcingViews,
    ) {}

    async execute(input: { actorId: UserId; packageId: PackageId }): Promise<Result<QuestionDto[], DomainError>> {
        const found = await this.access.buyerPackage(input.actorId, input.packageId, ['sc.read']);
        if (!found.ok) return found;
        const invitations = await this.invitations.listByPackage(input.packageId);
        return ok((await this.questions.listByPackage(input.packageId)).map(q => this.views.buyerQuestion(q, invitations)));
    }
}
