// ─── HTTP: POST /workspaces/:workspaceId/ai/boq-review and /ai/match-items (module `ai-assist`) ───
// Both are questions, not creations: they answer 200 and write nothing.
import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import {
    type BoqReviewRequest, type BoqReviewResponse, type MatchItemsRequest, type MatchItemsResponse, boqReviewRequestSchema,
    matchItemsRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain/ids';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { MatchItemsUseCase } from '../application/use-cases/match-items.use-case';
import { ReviewBoqUseCase } from '../application/use-cases/review-boq.use-case';

const parseWorkspaceId = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller('workspaces/:workspaceId/ai')
export class AiAssistController {
    constructor(private readonly reviewBoq: ReviewBoqUseCase, private readonly matchItems: MatchItemsUseCase) {}

    @Post('boq-review')
    @HttpCode(HttpStatus.OK)
    async review(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(boqReviewRequestSchema)) body: BoqReviewRequest,
    ): Promise<BoqReviewResponse> {
        return unwrap(await this.reviewBoq.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId), request: body }));
    }

    @Post('match-items')
    @HttpCode(HttpStatus.OK)
    async match(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(matchItemsRequestSchema)) body: MatchItemsRequest,
    ): Promise<MatchItemsResponse> {
        return unwrap(await this.matchItems.execute({ actorId: user.userId, workspaceId: parseWorkspaceId(workspaceId), request: body }));
    }
}
