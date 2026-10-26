// ─── Buyer side of bidding: bids, leveling, manual bid, messages, award (API-module1.md "Bidding (C2)") ───
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
    type AwardRequest, type AwardResponse, type BidDto, type LevelingDto, type ManualBidRequest, type NegotiationMessageDto,
    type SendMessageRequest, awardRequestSchema, manualBidRequestSchema, sendMessageRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { AwardPackageUseCase } from '../application/use-cases/award-package.use-case';
import { EnterManualBidUseCase } from '../application/use-cases/enter-manual-bid.use-case';
import { GetLevelingUseCase } from '../application/use-cases/get-leveling.use-case';
import { ListPackageBidsUseCase } from '../application/use-cases/list-package-bids.use-case';
import { ListMessagesUseCase, SendMessageUseCase } from '../application/use-cases/messages.use-case';
import { invitationIdParam, packageIdParam } from './route-params';

@Controller('subcontracting')
export class BuyerBiddingController {
    constructor(
        private readonly listBids: ListPackageBidsUseCase,
        private readonly leveling: GetLevelingUseCase,
        private readonly manualBid: EnterManualBidUseCase,
        private readonly listMessages: ListMessagesUseCase,
        private readonly sendMessage: SendMessageUseCase,
        private readonly award: AwardPackageUseCase,
    ) {}

    @Get('packages/:id/bids')
    async bids(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<BidDto[]> {
        return unwrap(await this.listBids.execute({ userId: user.userId, packageId: packageIdParam(id) }));
    }

    @Get('packages/:id/leveling')
    async getLeveling(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<LevelingDto> {
        return unwrap(await this.leveling.execute({ userId: user.userId, packageId: packageIdParam(id) }));
    }

    @Post('invitations/:id/manual-bid')
    @HttpCode(201)
    async enterManualBid(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body(new ZodPipe(manualBidRequestSchema)) body: ManualBidRequest,
    ): Promise<BidDto> {
        return unwrap(await this.manualBid.execute({ userId: user.userId, invitationId: invitationIdParam(id), body }));
    }

    @Get('invitations/:id/messages')
    async messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<NegotiationMessageDto[]> {
        return unwrap(await this.listMessages.execute({ userId: user.userId, invitationId: invitationIdParam(id), side: 'buyer' }));
    }

    @Post('invitations/:id/messages')
    @HttpCode(200)
    async send(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body(new ZodPipe(sendMessageRequestSchema)) body: SendMessageRequest,
    ): Promise<NegotiationMessageDto> {
        return unwrap(await this.sendMessage.execute({ userId: user.userId, invitationId: invitationIdParam(id), side: 'buyer', body }));
    }

    @Post('packages/:id/award')
    @HttpCode(200)
    async awardPackage(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body(new ZodPipe(awardRequestSchema)) body: AwardRequest,
    ): Promise<AwardResponse> {
        return unwrap(await this.award.execute({ userId: user.userId, packageId: packageIdParam(id), body }));
    }
}
