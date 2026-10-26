import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CreateVendorListEntryRequest, type ImportVendorListRequest, type ImportVendorListResponse,
    type UpdateVendorListEntryRequest, type VendorCardDto, type VendorListEntryDto, createVendorListEntryRequestSchema,
    importVendorListRequestSchema, updateVendorListEntryRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { CreateVendorListEntryUseCase } from '../application/use-cases/create-vendor-list-entry.use-case';
import { DeleteVendorListEntryUseCase } from '../application/use-cases/delete-vendor-list-entry.use-case';
import { GetVendorCardUseCase } from '../application/use-cases/get-vendor-card.use-case';
import { ImportVendorListUseCase } from '../application/use-cases/import-vendor-list.use-case';
import { ListVendorListUseCase } from '../application/use-cases/list-vendor-list.use-case';
import { UpdateVendorListEntryUseCase } from '../application/use-cases/update-vendor-list-entry.use-case';
import { type VendorListQuery, entryParam, vendorListQuerySchema, workspaceParam } from './sourcing-params';

/** ทะเบียนทีมช่าง of a buyer workspace. */
@Controller()
export class VendorListController {
    constructor(
        private readonly listEntries: ListVendorListUseCase,
        private readonly createEntry: CreateVendorListEntryUseCase,
        private readonly importEntries: ImportVendorListUseCase,
        private readonly updateEntry: UpdateVendorListEntryUseCase,
        private readonly deleteEntry: DeleteVendorListEntryUseCase,
        private readonly getCard: GetVendorCardUseCase,
    ) {}

    @Get('workspaces/:workspaceId/vendor-list')
    async list(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(vendorListQuerySchema)) query: VendorListQuery,
    ): Promise<VendorListEntryDto[]> {
        return unwrap(await this.listEntries.execute({
            actorId: user.userId, workspaceId: workspaceParam(workspaceId),
            ...(query.hidden === undefined ? {} : { hidden: query.hidden === 'true' }),
            ...(query.trade === undefined ? {} : { trade: query.trade }), ...(query.q === undefined ? {} : { q: query.q }),
        }));
    }

    @Post('workspaces/:workspaceId/vendor-list')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createVendorListEntryRequestSchema)) body: CreateVendorListEntryRequest,
    ): Promise<VendorListEntryDto> {
        return unwrap(await this.createEntry.execute({ actorId: user.userId, workspaceId: workspaceParam(workspaceId), body }));
    }

    @Post('workspaces/:workspaceId/vendor-list/import')
    @HttpCode(HttpStatus.OK)
    async import(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(importVendorListRequestSchema)) body: ImportVendorListRequest,
    ): Promise<ImportVendorListResponse> {
        return unwrap(await this.importEntries.execute({ actorId: user.userId, workspaceId: workspaceParam(workspaceId), body }));
    }

    @Patch('subcontracting/vendor-list/:entryId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('entryId') entryId: string,
        @Body(new ZodPipe(updateVendorListEntryRequestSchema)) body: UpdateVendorListEntryRequest,
    ): Promise<VendorListEntryDto> {
        return unwrap(await this.updateEntry.execute({ actorId: user.userId, entryId: entryParam(entryId), body }));
    }

    @Delete('subcontracting/vendor-list/:entryId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@CurrentUser() user: AuthenticatedUser, @Param('entryId') entryId: string): Promise<void> {
        unwrap(await this.deleteEntry.execute({ actorId: user.userId, entryId: entryParam(entryId) }));
    }

    @Get('workspaces/:workspaceId/vendors/:vendorWorkspaceId/card')
    async card(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('vendorWorkspaceId') vendorWorkspaceId: string,
    ): Promise<VendorCardDto> {
        return unwrap(await this.getCard.execute({
            actorId: user.userId, workspaceId: workspaceParam(workspaceId), vendorWorkspaceId: workspaceParam(vendorWorkspaceId),
        }));
    }
}
