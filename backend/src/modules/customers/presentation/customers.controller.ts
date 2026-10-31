import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import {
    type CreateCustomerRequest, type CustomerDto, type CustomerListQuery, type PatchCustomerRequest,
    createCustomerRequestSchema, customerListQuerySchema, patchCustomerRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    CreateCustomerUseCase, GetCustomerUseCase, ListCustomersUseCase, PatchCustomerUseCase, SetCustomerArchivedUseCase,
} from '../application/use-cases/customers.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('project-hub')
export class CustomersController {
    constructor(
        private readonly list: ListCustomersUseCase,
        private readonly get: GetCustomerUseCase,
        private readonly create: CreateCustomerUseCase,
        private readonly patch: PatchCustomerUseCase,
        private readonly setArchived: SetCustomerArchivedUseCase,
    ) {}

    @Get('workspaces/:workspaceId/customers')
    async listCustomers(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Query(new ZodPipe(customerListQuerySchema)) query: CustomerListQuery,
    ): Promise<CustomerDto[]> {
        return unwrap(await this.list.execute(user.userId, workspaceIdParam(workspaceId), query));
    }

    @Post('workspaces/:workspaceId/customers')
    async createCustomer(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(createCustomerRequestSchema)) body: CreateCustomerRequest,
    ): Promise<CustomerDto> {
        return unwrap(await this.create.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), body }));
    }

    @Get('customers/:customerId')
    async getCustomer(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string): Promise<CustomerDto> {
        return unwrap(await this.get.execute(user.userId, customerId));
    }

    @Patch('customers/:customerId')
    async patchCustomer(
        @CurrentUser() user: AuthenticatedUser,
        @Param('customerId') customerId: string,
        @Body(new ZodPipe(patchCustomerRequestSchema)) body: PatchCustomerRequest,
    ): Promise<CustomerDto> {
        return unwrap(await this.patch.execute({ userId: user.userId, customerId, body }));
    }

    @Post('customers/:customerId/archive')
    @HttpCode(200)
    async archive(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string): Promise<CustomerDto> {
        return unwrap(await this.setArchived.execute({ userId: user.userId, customerId, archived: true }));
    }

    @Post('customers/:customerId/restore')
    @HttpCode(200)
    async restore(@CurrentUser() user: AuthenticatedUser, @Param('customerId') customerId: string): Promise<CustomerDto> {
        return unwrap(await this.setArchived.execute({ userId: user.userId, customerId, archived: false }));
    }
}
