import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import {
    type AdminEntitlementDto, type AdminWorkspaceDto, type AdminWorkspaceListQuery, type ModuleId, type PlatformAdminStatusDto,
    type PutEntitlementRequest, adminWorkspaceListQuerySchema, moduleIdSchema, putEntitlementRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { parseId } from '../../../shared/domain/ids';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { GetPlatformAdminStatusUseCase } from '../application/use-cases/get-platform-admin-status.use-case';
import { ListAdminWorkspacesUseCase } from '../application/use-cases/list-admin-workspaces.use-case';
import { SetEntitlementUseCase } from '../application/use-cases/set-entitlement.use-case';
import { toAdminEntitlementDto, toAdminWorkspaceDto } from './platform.mapper';

/** Platform admin area (PLATFORM_ADMIN_EMAILS): everything but `status` answers 404 to other users. */
@Controller('platform/admin')
export class PlatformAdminController {
    constructor(
        private readonly getStatus: GetPlatformAdminStatusUseCase,
        private readonly listWorkspaces: ListAdminWorkspacesUseCase,
        private readonly setEntitlement: SetEntitlementUseCase,
    ) {}

    @Get('status')
    status(@CurrentUser() user: AuthenticatedUser): Promise<PlatformAdminStatusDto> {
        return this.getStatus.execute(user.userId);
    }

    @Get('workspaces')
    async workspaces(
        @CurrentUser() user: AuthenticatedUser,
        @Query(new ZodPipe(adminWorkspaceListQuerySchema)) query: AdminWorkspaceListQuery,
    ): Promise<AdminWorkspaceDto[]> {
        const views = unwrap(await this.listWorkspaces.execute({ actorId: user.userId, q: query.q, limit: query.limit }));
        return views.map(toAdminWorkspaceDto);
    }

    @Put('workspaces/:workspaceId/entitlements/:module')
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('module', new ZodPipe(moduleIdSchema)) module: ModuleId,
        @Body(new ZodPipe(putEntitlementRequestSchema)) body: PutEntitlementRequest,
    ): Promise<AdminEntitlementDto> {
        const view = unwrap(await this.setEntitlement.execute({
            actorId: user.userId,
            workspaceId: unwrap(parseId<'WorkspaceId'>(workspaceId, 'Workspace')),
            module,
            status: body.status,
            expiresAt: body.expiresAt === undefined || body.expiresAt === null ? null : new Date(body.expiresAt),
            note: body.note,
        }));
        return toAdminEntitlementDto(view);
    }
}
