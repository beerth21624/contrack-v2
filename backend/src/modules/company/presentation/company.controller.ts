import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { type CompanyProfileDto, type PutCompanyProfileRequest, putCompanyProfileRequestSchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { GetCompanyUseCase, PutCompanyUseCase } from '../application/use-cases/company.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

@Controller()
@RequiresModule('project-hub')
export class CompanyController {
    constructor(private readonly getCompany: GetCompanyUseCase, private readonly putCompany: PutCompanyUseCase) {}

    @Get('workspaces/:workspaceId/company')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<CompanyProfileDto> {
        return unwrap(await this.getCompany.execute(user.userId, workspaceIdParam(workspaceId)));
    }

    @Put('workspaces/:workspaceId/company')
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Body(new ZodPipe(putCompanyProfileRequestSchema)) body: PutCompanyProfileRequest,
    ): Promise<CompanyProfileDto> {
        return unwrap(await this.putCompany.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), body }));
    }
}
