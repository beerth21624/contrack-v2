// ─── Preferences of the signed-in user (UI language), kept on the account so every device gets them ───
import { Injectable } from '@nestjs/common';
import type { UserLocale } from '@contrack/contract';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { IdentityErrors } from '../../domain/identity-errors';
import { UserRepository } from '../ports/user.repository';

export interface UpdatePreferencesInput {
    userId: UserId;
    locale: UserLocale;
}

export interface Preferences {
    locale: UserLocale;
}

@Injectable()
export class UpdatePreferencesUseCase {
    constructor(private readonly users: UserRepository) {}

    async execute(input: UpdatePreferencesInput): Promise<Result<Preferences, DomainError>> {
        const user = await this.users.findById(input.userId);
        // A valid access token of a user that no longer exists: the client must sign in again.
        if (user === undefined) return err(IdentityErrors.unauthenticated());
        if (user.locale !== input.locale) await this.users.setLocale(user.id, input.locale);
        return ok({ locale: input.locale });
    }
}
