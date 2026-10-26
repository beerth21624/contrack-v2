import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, Query } from '@nestjs/common';
import {
    type AskQuestionRequest, type CreatePortfolioItemRequest, type DeclineRequest, type GuestPackageDto, type MyVendorsDto,
    type PortfolioItemDto, type PutVendorProfileRequest, type QuestionDto, type VendorProfileDto, askQuestionRequestSchema,
    createPortfolioItemRequestSchema, declineRequestSchema, putVendorProfileRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { AddPortfolioItemUseCase } from '../application/use-cases/add-portfolio-item.use-case';
import { AskQuestionUseCase } from '../application/use-cases/ask-question.use-case';
import { ClaimInvitationUseCase } from '../application/use-cases/claim-invitation.use-case';
import { DeclineInvitationUseCase } from '../application/use-cases/decline-invitation.use-case';
import { DeletePortfolioItemUseCase } from '../application/use-cases/delete-portfolio-item.use-case';
import { GetVendorProfileUseCase } from '../application/use-cases/get-vendor-profile.use-case';
import { ListMyVendorsUseCase } from '../application/use-cases/list-my-vendors.use-case';
import { PutVendorProfileUseCase } from '../application/use-cases/put-vendor-profile.use-case';
import { ViewInvitationUseCase } from '../application/use-cases/view-invitation.use-case';
import {
    type ClaimInvitationRequest, claimInvitationRequestSchema, invitationParam, portfolioParam, vendorWorkspaceQuerySchema,
    workspaceParam,
} from './sourcing-params';

/** The crew's side (signed in): profile, portfolio, invitations. */
@Controller('vendor')
export class VendorController {
    constructor(
        private readonly claimInvitation: ClaimInvitationUseCase,
        private readonly listMine: ListMyVendorsUseCase,
        private readonly getProfile: GetVendorProfileUseCase,
        private readonly putProfile: PutVendorProfileUseCase,
        private readonly addPortfolio: AddPortfolioItemUseCase,
        private readonly deletePortfolio: DeletePortfolioItemUseCase,
        private readonly viewInvitation: ViewInvitationUseCase,
        private readonly declineInvitation: DeclineInvitationUseCase,
        private readonly askQuestion: AskQuestionUseCase,
    ) {}

    @Post('claim-invitation')
    @HttpCode(HttpStatus.OK)
    async claim(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodPipe(claimInvitationRequestSchema)) body: ClaimInvitationRequest,
    ): Promise<GuestPackageDto> {
        return unwrap(await this.claimInvitation.execute({ actorId: user.userId, token: body.token, workspaceId: workspaceParam(body.workspaceId) }));
    }

    @Get('me')
    async me(@CurrentUser() user: AuthenticatedUser): Promise<MyVendorsDto> {
        return unwrap(await this.listMine.execute({ actorId: user.userId }));
    }

    @Get('profile')
    async profile(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodPipe(vendorWorkspaceQuerySchema)) query: { workspaceId: string },
    ): Promise<VendorProfileDto> {
        return unwrap(await this.getProfile.execute({ actorId: user.userId, workspaceId: workspaceParam(query.workspaceId) }));
    }

    @Put('profile')
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodPipe(putVendorProfileRequestSchema)) body: PutVendorProfileRequest,
    ): Promise<VendorProfileDto> {
        return unwrap(await this.putProfile.execute({ actorId: user.userId, body: { ...body, workspaceId: workspaceParam(body.workspaceId) } }));
    }

    @Post('portfolio')
    @HttpCode(HttpStatus.CREATED)
    async addItem(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodPipe(vendorWorkspaceQuerySchema)) query: { workspaceId: string },
        @Body(new ZodPipe(createPortfolioItemRequestSchema)) body: CreatePortfolioItemRequest,
    ): Promise<PortfolioItemDto> {
        return unwrap(await this.addPortfolio.execute({ actorId: user.userId, workspaceId: workspaceParam(query.workspaceId), body }));
    }

    @Delete('portfolio/:itemId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async deleteItem(@CurrentUser() user: AuthenticatedUser, @Param('itemId') itemId: string): Promise<void> {
        unwrap(await this.deletePortfolio.execute({ actorId: user.userId, itemId: portfolioParam(itemId) }));
    }

    @Get('invitations/:invitationId')
    async invitation(@CurrentUser() user: AuthenticatedUser, @Param('invitationId') invitationId: string): Promise<GuestPackageDto> {
        return unwrap(await this.viewInvitation.execute({ via: { userId: user.userId, invitationId: invitationParam(invitationId) } }));
    }

    @Post('invitations/:invitationId/decline')
    @HttpCode(HttpStatus.NO_CONTENT)
    async decline(
        @CurrentUser() user: AuthenticatedUser,
        @Param('invitationId') invitationId: string,
        @Body(new ZodPipe(declineRequestSchema)) body: DeclineRequest,
    ): Promise<void> {
        unwrap(await this.declineInvitation.execute({
            via: { userId: user.userId, invitationId: invitationParam(invitationId) }, reason: body.reason, note: body.note,
        }));
    }

    @Post('invitations/:invitationId/questions')
    @HttpCode(HttpStatus.CREATED)
    async ask(
        @CurrentUser() user: AuthenticatedUser,
        @Param('invitationId') invitationId: string,
        @Body(new ZodPipe(askQuestionRequestSchema)) body: AskQuestionRequest,
    ): Promise<QuestionDto> {
        return unwrap(await this.askQuestion.execute({
            via: { userId: user.userId, invitationId: invitationParam(invitationId) }, question: body.question,
        }));
    }
}
