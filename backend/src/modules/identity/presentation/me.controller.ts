import { Body, Controller, Get, Patch } from '@nestjs/common';
import {
    type MeResponse, type UpdatePreferencesRequest, type UserPreferences, updatePreferencesRequestSchema,
} from '@contrack/contract';
import type { AuthenticatedUser } from '../../../shared/application/ports';
import { CurrentUser } from '../../../shared/presentation/auth';
import { ZodPipe, unwrap } from '../../../shared/presentation/http';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { UpdatePreferencesUseCase } from '../application/use-cases/update-preferences.use-case';
import { toMeResponse } from './identity.mapper';

@Controller('me')
export class MeController {
    constructor(private readonly getMe: GetMeUseCase, private readonly updatePreferences: UpdatePreferencesUseCase) {}

    @Get()
    async me(@CurrentUser() user: AuthenticatedUser): Promise<MeResponse> {
        return toMeResponse(unwrap(await this.getMe.execute({ userId: user.userId })));
    }

    /** UI language of the account (the web also keeps it in the NEXT_LOCALE cookie). */
    @Patch('preferences')
    async preferences(
        @CurrentUser() user: AuthenticatedUser,
        @Body(new ZodPipe(updatePreferencesRequestSchema)) body: UpdatePreferencesRequest,
    ): Promise<UserPreferences> {
        return unwrap(await this.updatePreferences.execute({ userId: user.userId, locale: body.locale }));
    }
}
