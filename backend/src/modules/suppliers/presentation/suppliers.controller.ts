import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CreateSupplierRatingRequest, type CreateSupplierRequest, type ImportScSuppliersDto, type PatchSupplierRequest, type SupplierDto,
    type SupplierListQuery, type SupplierRatedDto, type SupplierRatingDto,
    createSupplierRatingRequestSchema, createSupplierRequestSchema, patchSupplierRequestSchema, supplierListQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { ListSupplierRatingsUseCase, RateSupplierUseCase } from '../application/use-cases/supplier-ratings.use-cases';
import {
    CreateSupplierUseCase, GetSupplierUseCase, ImportScSuppliersUseCase, ListSuppliersUseCase, PatchSupplierUseCase, SetSupplierArchivedUseCase,
} from '../application/use-cases/suppliers.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('procurement')
export class SuppliersController {
    constructor(
        private readonly list: ListSuppliersUseCase,
        private readonly get: GetSupplierUseCase,
        private readonly create: CreateSupplierUseCase,
        private readonly patch: PatchSupplierUseCase,
        private readonly setArchived: SetSupplierArchivedUseCase,
        private readonly importSc: ImportScSuppliersUseCase,
        private readonly rate: RateSupplierUseCase,
        private readonly ratings: ListSupplierRatingsUseCase,
    ) {}

    @Get('workspaces/:workspaceId/suppliers')
    async listSuppliers(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(supplierListQuerySchema)) query: SupplierListQuery,
    ): Promise<SupplierDto[]> {
        return unwrap(await this.list.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('workspaces/:workspaceId/suppliers')
    async createSupplier(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createSupplierRequestSchema)) body: CreateSupplierRequest,
    ): Promise<SupplierDto> {
        return unwrap(await this.create.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), body }));
    }

    @Post('workspaces/:workspaceId/suppliers/import-sc')
    @HttpCode(200)
    async importFromSubcontracting(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<ImportScSuppliersDto> {
        return unwrap(await this.importSc.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId) }));
    }

    @Get('suppliers/:supplierId')
    async getSupplier(@CurrentUser() user: AuthenticatedUser, @Param('supplierId') supplierId: string): Promise<SupplierDto> {
        return unwrap(await this.get.execute(user.userId, supplierId));
    }

    @Patch('suppliers/:supplierId')
    async patchSupplier(
        @CurrentUser() user: AuthenticatedUser,
        @Param('supplierId') supplierId: string,
        @Body(new ZodPipe(patchSupplierRequestSchema)) body: PatchSupplierRequest,
    ): Promise<SupplierDto> {
        return unwrap(await this.patch.execute({ userId: user.userId, supplierId, body }));
    }

    @Post('suppliers/:supplierId/archive')
    @HttpCode(200)
    async archive(@CurrentUser() user: AuthenticatedUser, @Param('supplierId') supplierId: string): Promise<SupplierDto> {
        return unwrap(await this.setArchived.execute({ userId: user.userId, supplierId, archived: true }));
    }

    @Post('suppliers/:supplierId/restore')
    @HttpCode(200)
    async restore(@CurrentUser() user: AuthenticatedUser, @Param('supplierId') supplierId: string): Promise<SupplierDto> {
        return unwrap(await this.setArchived.execute({ userId: user.userId, supplierId, archived: false }));
    }

    @Get('suppliers/:supplierId/ratings')
    async listRatings(@CurrentUser() user: AuthenticatedUser, @Param('supplierId') supplierId: string): Promise<SupplierRatingDto[]> {
        return unwrap(await this.ratings.execute(user.userId, supplierId));
    }

    @Post('suppliers/:supplierId/ratings')
    async addRating(
        @CurrentUser() user: AuthenticatedUser,
        @Param('supplierId') supplierId: string,
        @Body(new ZodPipe(createSupplierRatingRequestSchema)) body: CreateSupplierRatingRequest,
    ): Promise<SupplierRatedDto> {
        return unwrap(await this.rate.execute({ userId: user.userId, supplierId, body }));
    }
}
