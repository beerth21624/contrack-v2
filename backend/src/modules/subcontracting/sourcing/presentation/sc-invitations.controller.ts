import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
    type AnswerQuestionRequest, type CreateInvitationsRequest, type CreateInvitationsResponse, type QuestionDto,
    type ResendInvitationResponse, type ScInvitationDto, answerQuestionRequestSchema, createInvitationsRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { AnswerQuestionUseCase } from '../application/use-cases/answer-question.use-case';
import { CreateInvitationsUseCase } from '../application/use-cases/create-invitations.use-case';
import { ListInvitationsUseCase } from '../application/use-cases/list-invitations.use-case';
import { ListQuestionsUseCase } from '../application/use-cases/list-questions.use-case';
import { ResendInvitationUseCase } from '../application/use-cases/resend-invitation.use-case';
import { WithdrawInvitationUseCase } from '../application/use-cases/withdraw-invitation.use-case';
import { invitationParam, packageParam, questionParam } from './sourcing-params';

/** Invitations and Q&A of a package (buyer side). */
@Controller()
export class ScInvitationsController {
    constructor(
        private readonly listInvitations: ListInvitationsUseCase,
        private readonly createInvitations: CreateInvitationsUseCase,
        private readonly resendInvitation: ResendInvitationUseCase,
        private readonly withdrawInvitation: WithdrawInvitationUseCase,
        private readonly listQuestions: ListQuestionsUseCase,
        private readonly answerQuestion: AnswerQuestionUseCase,
    ) {}

    @Get('subcontracting/packages/:packageId/invitations')
    async list(@CurrentUser() user: AuthenticatedUser, @Param('packageId') packageId: string): Promise<ScInvitationDto[]> {
        return unwrap(await this.listInvitations.execute({ actorId: user.userId, packageId: packageParam(packageId) }));
    }

    @Post('subcontracting/packages/:packageId/invitations')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Body(new ZodPipe(createInvitationsRequestSchema)) body: CreateInvitationsRequest,
    ): Promise<CreateInvitationsResponse> {
        return unwrap(await this.createInvitations.execute({ actorId: user.userId, packageId: packageParam(packageId), body }));
    }

    @Post('subcontracting/invitations/:invitationId/resend')
    @HttpCode(HttpStatus.OK)
    async resend(@CurrentUser() user: AuthenticatedUser, @Param('invitationId') invitationId: string): Promise<ResendInvitationResponse> {
        return unwrap(await this.resendInvitation.execute({ actorId: user.userId, invitationId: invitationParam(invitationId) }));
    }

    @Post('subcontracting/invitations/:invitationId/withdraw')
    @HttpCode(HttpStatus.OK)
    async withdraw(@CurrentUser() user: AuthenticatedUser, @Param('invitationId') invitationId: string): Promise<ScInvitationDto> {
        return unwrap(await this.withdrawInvitation.execute({ actorId: user.userId, invitationId: invitationParam(invitationId) }));
    }

    @Get('subcontracting/packages/:packageId/questions')
    async questions(@CurrentUser() user: AuthenticatedUser, @Param('packageId') packageId: string): Promise<QuestionDto[]> {
        return unwrap(await this.listQuestions.execute({ actorId: user.userId, packageId: packageParam(packageId) }));
    }

    @Post('subcontracting/questions/:questionId/answer')
    @HttpCode(HttpStatus.OK)
    async answer(
        @CurrentUser() user: AuthenticatedUser,
        @Param('questionId') questionId: string,
        @Body(new ZodPipe(answerQuestionRequestSchema)) body: AnswerQuestionRequest,
    ): Promise<QuestionDto> {
        return unwrap(await this.answerQuestion.execute({ actorId: user.userId, questionId: questionParam(questionId), answer: body.answer }));
    }
}
