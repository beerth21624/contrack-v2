import { Controller, Get } from '@nestjs/common';
import type { MeResponse } from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { unwrap } from '../../../shared/presentation/http';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { toMeResponse } from './identity.mapper';

@Controller('me')
export class MeController {
    constructor(private readonly getMe: GetMeUseCase) {}

    @Get()
    async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
        return toMeResponse(unwrap(await this.getMe.execute({ userId: user.userId })));
    }
}
