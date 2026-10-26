import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
    type AskQuestionRequest, type DeclineRequest, type GuestPackageDto, type QuestionDto, askQuestionRequestSchema,
    declineRequestSchema,
} from '@contrack/contract';
import { Public } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { AskQuestionUseCase } from '../application/use-cases/ask-question.use-case';
import { DeclineInvitationUseCase } from '../application/use-cases/decline-invitation.use-case';
import { ViewInvitationUseCase } from '../application/use-cases/view-invitation.use-case';

/** The secret invitation link /s/:token (public, no sign-in). */
@Controller('s')
@Public()
export class GuestController {
    constructor(
        private readonly viewInvitation: ViewInvitationUseCase,
        private readonly declineInvitation: DeclineInvitationUseCase,
        private readonly askQuestion: AskQuestionUseCase,
    ) {}

    @Get(':token')
    async view(@Param('token') token: string): Promise<GuestPackageDto> {
        return unwrap(await this.viewInvitation.execute({ via: { token } }));
    }

    @Post(':token/decline')
    @HttpCode(HttpStatus.NO_CONTENT)
    async decline(@Param('token') token: string, @Body(new ZodPipe(declineRequestSchema)) body: DeclineRequest): Promise<void> {
        unwrap(await this.declineInvitation.execute({ via: { token }, reason: body.reason, note: body.note }));
    }

    @Post(':token/questions')
    @HttpCode(HttpStatus.CREATED)
    async ask(@Param('token') token: string, @Body(new ZodPipe(askQuestionRequestSchema)) body: AskQuestionRequest): Promise<QuestionDto> {
        return unwrap(await this.askQuestion.execute({ via: { token }, question: body.question }));
    }
}
