import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import {
    type AddSignedScanRequest, type CloseMainContractRequest, type ContractGuaranteeDto, type CreateGuaranteeRequest,
    type CreateMainContractRequest, type MainContractDto, type PatchGuaranteeRequest, type PatchMainContractRequest, type ProjectMainContractDto,
    type PutContractMilestonesRequest, type SignMainContractRequest, type SignMainContractResponse, type TerminateMainContractRequest,
    addSignedScanRequestSchema, closeMainContractRequestSchema, createGuaranteeRequestSchema, createMainContractRequestSchema,
    patchGuaranteeRequestSchema, patchMainContractRequestSchema, putContractMilestonesRequestSchema, signMainContractRequestSchema,
    terminateMainContractRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { type ProjectId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import { CreateGuaranteeUseCase, ListGuaranteesUseCase, PatchGuaranteeUseCase } from '../application/use-cases/guarantees.use-cases';
import {
    AddSignedScanUseCase, CancelMainContractUseCase, CloseMainContractUseCase, CreateMainContractUseCase, GetMainContractUseCase,
    GetProjectMainContractUseCase, PatchMainContractUseCase, PutContractMilestonesUseCase, SignMainContractUseCase, TerminateMainContractUseCase,
} from '../application/use-cases/main-contracts.use-cases';

const projectIdParam = (raw: string): ProjectId => unwrap(parseId<'ProjectId'>(raw, 'Project'));

@Controller()
@RequiresModule('contracts')
export class MainContractsController {
    constructor(
        private readonly getProject: GetProjectMainContractUseCase,
        private readonly getOne: GetMainContractUseCase,
        private readonly create: CreateMainContractUseCase,
        private readonly patch: PatchMainContractUseCase,
        private readonly milestones: PutContractMilestonesUseCase,
        private readonly sign: SignMainContractUseCase,
        private readonly terminate: TerminateMainContractUseCase,
        private readonly cancel: CancelMainContractUseCase,
        private readonly close: CloseMainContractUseCase,
        private readonly signedScan: AddSignedScanUseCase,
        private readonly listGuarantees: ListGuaranteesUseCase,
        private readonly createGuarantee: CreateGuaranteeUseCase,
        private readonly patchGuarantee: PatchGuaranteeUseCase,
    ) {}

    @Get('projects/:projectId/main-contract')
    async projectContract(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<ProjectMainContractDto> {
        return unwrap(await this.getProject.execute(user.userId, projectIdParam(projectId)));
    }

    @Post('projects/:projectId/main-contract')
    async createContract(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createMainContractRequestSchema)) body: CreateMainContractRequest,
    ): Promise<MainContractDto> {
        return unwrap(await this.create.execute({ userId: user.userId, projectId: projectIdParam(projectId), body }));
    }

    @Get('main-contracts/:contractId')
    async getContract(@CurrentUser() user: AuthenticatedUser, @Param('contractId') contractId: string): Promise<MainContractDto> {
        return unwrap(await this.getOne.execute(user.userId, contractId));
    }

    @Patch('main-contracts/:contractId')
    async patchContract(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(patchMainContractRequestSchema)) body: PatchMainContractRequest,
    ): Promise<MainContractDto> {
        return unwrap(await this.patch.execute({ userId: user.userId, contractId, body }));
    }

    @Put('main-contracts/:contractId/milestones')
    async putMilestones(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(putContractMilestonesRequestSchema)) body: PutContractMilestonesRequest,
    ): Promise<MainContractDto> {
        return unwrap(await this.milestones.execute({ userId: user.userId, contractId, body }));
    }

    @Post('main-contracts/:contractId/sign')
    @HttpCode(200)
    async signContract(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(signMainContractRequestSchema)) body: SignMainContractRequest,
    ): Promise<SignMainContractResponse> {
        return unwrap(await this.sign.execute({ userId: user.userId, contractId, body }));
    }

    @Post('main-contracts/:contractId/terminate')
    @HttpCode(200)
    async terminateContract(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(terminateMainContractRequestSchema)) body: TerminateMainContractRequest,
    ): Promise<MainContractDto> {
        return unwrap(await this.terminate.execute({ userId: user.userId, contractId, body }));
    }

    @Post('main-contracts/:contractId/cancel')
    @HttpCode(200)
    async cancelContract(@CurrentUser() user: AuthenticatedUser, @Param('contractId') contractId: string): Promise<MainContractDto> {
        return unwrap(await this.cancel.execute({ userId: user.userId, contractId }));
    }

    @Post('main-contracts/:contractId/close')
    @HttpCode(200)
    async closeContract(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(closeMainContractRequestSchema)) body: CloseMainContractRequest,
    ): Promise<MainContractDto> {
        return unwrap(await this.close.execute({ userId: user.userId, contractId, body }));
    }

    @Post('main-contracts/:contractId/signed-scan')
    @HttpCode(200)
    async addSignedScan(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(addSignedScanRequestSchema)) body: AddSignedScanRequest,
    ): Promise<MainContractDto> {
        return unwrap(await this.signedScan.execute({ userId: user.userId, contractId, body }));
    }

    @Get('main-contracts/:contractId/guarantees')
    async guarantees(@CurrentUser() user: AuthenticatedUser, @Param('contractId') contractId: string): Promise<ContractGuaranteeDto[]> {
        return unwrap(await this.listGuarantees.execute(user.userId, contractId));
    }

    @Post('main-contracts/:contractId/guarantees')
    async addGuarantee(
        @CurrentUser() user: AuthenticatedUser,
        @Param('contractId') contractId: string,
        @Body(new ZodPipe(createGuaranteeRequestSchema)) body: CreateGuaranteeRequest,
    ): Promise<ContractGuaranteeDto> {
        return unwrap(await this.createGuarantee.execute({ userId: user.userId, contractId, body }));
    }

    @Patch('guarantees/:guaranteeId')
    async updateGuarantee(
        @CurrentUser() user: AuthenticatedUser,
        @Param('guaranteeId') guaranteeId: string,
        @Body(new ZodPipe(patchGuaranteeRequestSchema)) body: PatchGuaranteeRequest,
    ): Promise<ContractGuaranteeDto> {
        return unwrap(await this.patchGuarantee.execute({ userId: user.userId, guaranteeId, body }));
    }
}
