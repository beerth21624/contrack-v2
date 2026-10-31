import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import {
    type CreateCustomerLinkRequest, type CreateCustomerLinkResponse, type CustomerLinkDto, type CustomerLinkListQuery,
    createCustomerLinkRequestSchema, customerLinkListQuerySchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { CreateCustomerLinkUseCase, ListCustomerLinksUseCase, RevokeCustomerLinkUseCase } from '../application/use-cases/customer-links.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

/** The team's side of customer links (signed in). */
@Controller()
@RequiresModule('project-hub')
export class CustomerLinksController {
    constructor(
        private readonly create: CreateCustomerLinkUseCase,
        private readonly list: ListCustomerLinksUseCase,
        private readonly revoke: RevokeCustomerLinkUseCase,
    ) {}

    @Post('workspaces/:workspaceId/customer-links')
    async createLink(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createCustomerLinkRequestSchema)) body: CreateCustomerLinkRequest,
    ): Promise<CreateCustomerLinkResponse> {
        return unwrap(await this.create.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), body }));
    }

    @Get('workspaces/:workspaceId/customer-links')
    async listLinks(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(customerLinkListQuerySchema)) query: CustomerLinkListQuery,
    ): Promise<CustomerLinkDto[]> {
        return unwrap(await this.list.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('customer-links/:linkId/revoke')
    @HttpCode(200)
    async revokeLink(@CurrentUser() user: AuthenticatedUser, @Param('linkId') linkId: string): Promise<CustomerLinkDto> {
        return unwrap(await this.revoke.execute(user.userId, linkId));
    }
}
