import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import {
    type AddendumRequest, type BuyerPackageDto, type CancelRequest, type CreatePackageRequest, type ExtendDeadlineRequest,
    type PackageSummaryDto, type UpdatePackageRequest, addendumRequestSchema, cancelRequestSchema, createPackageRequestSchema,
    extendDeadlineRequestSchema, updatePackageRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../../shared/application/ports';
import { CurrentUser } from '../../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../../shared/presentation/http';
import { AttachPackageFileUseCase } from '../application/use-cases/attach-package-file.use-case';
import { CancelPackageUseCase } from '../application/use-cases/cancel-package.use-case';
import { CreatePackageUseCase } from '../application/use-cases/create-package.use-case';
import { DeletePackageUseCase } from '../application/use-cases/delete-package.use-case';
import { ExtendDeadlineUseCase } from '../application/use-cases/extend-deadline.use-case';
import { GetPackageUseCase } from '../application/use-cases/get-package.use-case';
import { IssueAddendumUseCase } from '../application/use-cases/issue-addendum.use-case';
import { ListPackagesUseCase } from '../application/use-cases/list-packages.use-case';
import { RemovePackageFileUseCase } from '../application/use-cases/remove-package-file.use-case';
import { UpdatePackageUseCase } from '../application/use-cases/update-package.use-case';
import { type AttachPackageFileRequest, attachPackageFileRequestSchema, packageParam, projectParam } from './sourcing-params';

/** Work packages (buyer side). */
@Controller()
export class PackagesController {
    constructor(
        private readonly listPackages: ListPackagesUseCase,
        private readonly createPackage: CreatePackageUseCase,
        private readonly getPackage: GetPackageUseCase,
        private readonly updatePackage: UpdatePackageUseCase,
        private readonly deletePackage: DeletePackageUseCase,
        private readonly attachFile: AttachPackageFileUseCase,
        private readonly removeFile: RemovePackageFileUseCase,
        private readonly issueAddendum: IssueAddendumUseCase,
        private readonly extendDeadline: ExtendDeadlineUseCase,
        private readonly cancelPackage: CancelPackageUseCase,
    ) {}

    @Get('projects/:projectId/subcontracting/packages')
    async list(@CurrentUser() user: AuthenticatedUser, @Param('projectId') projectId: string): Promise<PackageSummaryDto[]> {
        return unwrap(await this.listPackages.execute({ actorId: user.userId, projectId: projectParam(projectId) }));
    }

    @Post('projects/:projectId/subcontracting/packages')
    @HttpCode(HttpStatus.CREATED)
    async create(
        @CurrentUser() user: AuthenticatedUser,
        @Param('projectId') projectId: string,
        @Body(new ZodPipe(createPackageRequestSchema)) body: CreatePackageRequest,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.createPackage.execute({ actorId: user.userId, projectId: projectParam(projectId), body }));
    }

    @Get('subcontracting/packages/:packageId')
    async get(@CurrentUser() user: AuthenticatedUser, @Param('packageId') packageId: string): Promise<BuyerPackageDto> {
        return unwrap(await this.getPackage.execute({ actorId: user.userId, packageId: packageParam(packageId) }));
    }

    @Patch('subcontracting/packages/:packageId')
    async update(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Body(new ZodPipe(updatePackageRequestSchema)) body: UpdatePackageRequest,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.updatePackage.execute({ actorId: user.userId, packageId: packageParam(packageId), body }));
    }

    @Delete('subcontracting/packages/:packageId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async remove(@CurrentUser() user: AuthenticatedUser, @Param('packageId') packageId: string): Promise<void> {
        unwrap(await this.deletePackage.execute({ actorId: user.userId, packageId: packageParam(packageId) }));
    }

    @Post('subcontracting/packages/:packageId/files')
    @HttpCode(HttpStatus.OK)
    async addFile(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Body(new ZodPipe(attachPackageFileRequestSchema)) body: AttachPackageFileRequest,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.attachFile.execute({ actorId: user.userId, packageId: packageParam(packageId), fileId: body.fileId }));
    }

    @Delete('subcontracting/packages/:packageId/files/:fileId')
    async deleteFile(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Param('fileId') fileId: string,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.removeFile.execute({ actorId: user.userId, packageId: packageParam(packageId), fileId: fileId.toLowerCase() }));
    }

    @Post('subcontracting/packages/:packageId/addendum')
    @HttpCode(HttpStatus.OK)
    async addendum(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Body(new ZodPipe(addendumRequestSchema)) body: AddendumRequest,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.issueAddendum.execute({ actorId: user.userId, packageId: packageParam(packageId), body }));
    }

    @Post('subcontracting/packages/:packageId/extend')
    @HttpCode(HttpStatus.OK)
    async extend(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Body(new ZodPipe(extendDeadlineRequestSchema)) body: ExtendDeadlineRequest,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.extendDeadline.execute({
            actorId: user.userId, packageId: packageParam(packageId), bidDeadline: new Date(body.bidDeadline),
        }));
    }

    @Post('subcontracting/packages/:packageId/cancel')
    @HttpCode(HttpStatus.OK)
    async cancel(
        @CurrentUser() user: AuthenticatedUser,
        @Param('packageId') packageId: string,
        @Body(new ZodPipe(cancelRequestSchema)) body: CancelRequest,
    ): Promise<BuyerPackageDto> {
        return unwrap(await this.cancelPackage.execute({ actorId: user.userId, packageId: packageParam(packageId), reason: body.reason }));
    }
}
