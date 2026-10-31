import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { type NumberingSeriesDto, type PutNumberingSeriesRequest, docTypeSchema, putNumberingSeriesRequestSchema } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { DomainError, type WorkspaceId, parseId } from '../../../shared/domain';
import { CurrentUser } from '../../../shared/presentation/auth';
import { DomainHttpException, ZodPipe, unwrap } from '../../../shared/presentation/http';
import { RequiresModule } from '../../../shared/presentation/modules';
import {
    ListNumberingSeriesUseCase, type NumberingSeriesView, PutNumberingSeriesUseCase,
} from '../application/use-cases/numbering-series.use-cases';

const workspaceIdParam = (raw: string): WorkspaceId => unwrap(parseId<'WorkspaceId'>(raw, 'Workspace'));

const toDto = (v: NumberingSeriesView): NumberingSeriesDto => ({
    docType: v.docType,
    prefix: v.prefix,
    pattern: v.pattern,
    reset: v.reset,
    yearStyle: v.yearStyle,
    isDefault: v.isDefault,
    nextNumber: v.nextNumber,
    periodKey: v.periodKey,
    issuedInPeriod: v.issuedInPeriod,
    updatedBy: v.updatedBy,
    updatedAt: v.updatedAt === null ? null : v.updatedAt.toISOString(),
});

@Controller()
@RequiresModule('project-hub')
export class NumberingController {
    constructor(private readonly listSeries: ListNumberingSeriesUseCase, private readonly putSeries: PutNumberingSeriesUseCase) {}

    @Get('workspaces/:workspaceId/numbering')
    async list(@CurrentUser() user: AuthenticatedUser, @Param('workspaceId') workspaceId: string): Promise<NumberingSeriesDto[]> {
        const list = unwrap(await this.listSeries.execute(user.userId, workspaceIdParam(workspaceId)));
        return list.map(toDto);
    }

    @Put('workspaces/:workspaceId/numbering/:docType')
    async put(
        @CurrentUser() user: AuthenticatedUser,
        @Param('workspaceId') workspaceId: string,
        @Param('docType') rawDocType: string,
        @Body(new ZodPipe(putNumberingSeriesRequestSchema)) body: PutNumberingSeriesRequest,
    ): Promise<NumberingSeriesDto> {
        const docType = docTypeSchema.safeParse(rawDocType);
        if (!docType.success) throw new DomainHttpException(DomainError.notFound('Document type'));
        const saved = unwrap(await this.putSeries.execute({ userId: user.userId, workspaceId: workspaceIdParam(workspaceId), docType: docType.data, body }));
        return toDto(saved);
    }
}
