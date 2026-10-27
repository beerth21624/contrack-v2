import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import {
    type CreateRateCardRequest, type RateCardDto, type UpdateRateCardRequest, createRateCardRequestSchema,
    updateRateCardRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type RateCardId, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { ArchiveRateCardUseCase } from '../application/use-cases/archive-rate-card.use-case';
import { CreateRateCardUseCase } from '../application/use-cases/create-rate-card.use-case';
import { ListRateCardsUseCase } from '../application/use-cases/list-rate-cards.use-case';
import { UpdateRateCardUseCase } from '../application/use-cases/update-rate-card.use-case';
import { rateCardToDto } from './rate-cards.mapper';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));
const rateCardIdParam = (raw: string): RateCardId => unwrap(parseId<'RateCardId'>(raw, 'Rate card'));

@Controller('workspaces/:workspaceId/rate-cards')
export class RateCardsController {
    constructor(
        private readonly listCards: ListRateCardsUseCase,
        private readonly createCard: CreateRateCardUseCase,
        private readonly updateCard: UpdateRateCardUseCase,
        private readonly archiveCard: ArchiveRateCardUseCase,
    ) {}

    @Get()
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<RateCardDto[]> {
        const cards = unwrap(await this.listCards.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId) }));
        return cards.map(rateCardToDto);
    }

    @Post()
    @HttpCode(201)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createRateCardRequestSchema)) body: CreateRateCardRequest,
    ): Promise<RateCardDto> {
        const card = unwrap(await this.createCard.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            name: body.name,
            skilledRate: body.skilledRate,
            labourerRate: body.labourerRate,
            note: body.note,
        }));
        return rateCardToDto(card);
    }

    @Patch(':rateCardId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('rateCardId') rateCardId: string,
        @Body(new ZodPipe(updateRateCardRequestSchema)) body: UpdateRateCardRequest,
    ): Promise<RateCardDto> {
        const card = unwrap(await this.updateCard.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            rateCardId: rateCardIdParam(rateCardId),
            name: body.name,
            skilledRate: body.skilledRate,
            labourerRate: body.labourerRate,
            note: body.note,
        }));
        return rateCardToDto(card);
    }

    /** Archive (soft delete). */
    @Delete(':rateCardId')
    @HttpCode(204)
    async archive(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('rateCardId') rateCardId: string,
    ): Promise<void> {
        unwrap(await this.archiveCard.execute({
            userId: user.userId,
            workspaceId: workspaceIdParam(workspaceId),
            rateCardId: rateCardIdParam(rateCardId),
        }));
    }
}
