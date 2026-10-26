// ─── Vendor side of bidding: inbox, bid draft / submit / withdraw, messages (API-module1.md "Bidding (C2)") ───
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common';
import { z } from 'zod';
import {
    type BidDto, type MyBidStateDto, type NegotiationMessageDto, type SaveBidDraftRequest, type SendMessageRequest,
    type SubmitBidRequest, type VendorInboxDto, saveBidDraftRequestSchema, sendMessageRequestSchema, submitBidRequestSchema,
    uuidSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { asWorkspaceId } from '../../../../shared/domain';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { GetMyBidStateUseCase } from '../application/use-cases/get-my-bid-state.use-case';
import { GetVendorInboxUseCase } from '../application/use-cases/get-vendor-inbox.use-case';
import { ListMessagesUseCase, SendMessageUseCase } from '../application/use-cases/messages.use-case';
import { SaveBidDraftUseCase } from '../application/use-cases/save-bid-draft.use-case';
import { SubmitBidUseCase } from '../application/use-cases/submit-bid.use-case';
import { WithdrawBidUseCase } from '../application/use-cases/withdraw-bid.use-case';
import { invitationIdParam } from './route-params';

const inboxQuerySchema = z.object({ workspaceId: uuidSchema });

@Controller('vendor')
export class VendorBiddingController {
    constructor(
        private readonly inbox: GetVendorInboxUseCase,
        private readonly bidState: GetMyBidStateUseCase,
        private readonly saveDraft: SaveBidDraftUseCase,
        private readonly submitBid: SubmitBidUseCase,
        private readonly withdrawBid: WithdrawBidUseCase,
        private readonly listMessages: ListMessagesUseCase,
        private readonly sendMessage: SendMessageUseCase,
    ) {}

    @Get('inbox')
    async getInbox(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodPipe(inboxQuerySchema)) query: { workspaceId: string },
    ): Promise<VendorInboxDto> {
        return unwrap(await this.inbox.execute({ userId: user.userId, workspaceId: asWorkspaceId(query.workspaceId.toLowerCase()) }));
    }

    @Get('invitations/:id/bid')
    async getBid(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<MyBidStateDto> {
        return unwrap(await this.bidState.execute({ userId: user.userId, invitationId: invitationIdParam(id) }));
    }

    @Put('invitations/:id/bid-draft')
    async putDraft(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body(new ZodPipe(saveBidDraftRequestSchema)) body: SaveBidDraftRequest,
    ): Promise<BidDto> {
        return unwrap(await this.saveDraft.execute({ userId: user.userId, invitationId: invitationIdParam(id), body }));
    }

    @Post('invitations/:id/bid')
    @HttpCode(201)
    async submit(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body(new ZodPipe(submitBidRequestSchema)) body: SubmitBidRequest,
    ): Promise<BidDto> {
        return unwrap(await this.submitBid.execute({ userId: user.userId, invitationId: invitationIdParam(id), body }));
    }

    @Post('invitations/:id/bid/withdraw')
    @HttpCode(204)
    async withdraw(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
        unwrap(await this.withdrawBid.execute({ userId: user.userId, invitationId: invitationIdParam(id) }));
    }

    @Get('invitations/:id/messages')
    async messages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<NegotiationMessageDto[]> {
        return unwrap(await this.listMessages.execute({ userId: user.userId, invitationId: invitationIdParam(id), side: 'vendor' }));
    }

    @Post('invitations/:id/messages')
    @HttpCode(200)
    async send(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') id: string,
        @Body(new ZodPipe(sendMessageRequestSchema)) body: SendMessageRequest,
    ): Promise<NegotiationMessageDto> {
        return unwrap(await this.sendMessage.execute({ userId: user.userId, invitationId: invitationIdParam(id), side: 'vendor', body }));
    }
}
