// ─── Login: e-mail + password → new session (new refresh-token family) ───
import { Injectable } from '@nestjs/common';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { IdentityErrors } from '../../domain/identity-errors';
import { Email } from '../../domain/value-objects/email.value-object';
import { PasswordHasher } from '../ports/password-hasher.port';
import { RefreshTokenRepository } from '../ports/refresh-token.repository';
import { UserRepository } from '../ports/user.repository';
import { type AuthSession, SessionIssuer } from '../services/session-issuer.service';

export interface LoginInput {
    email: string;
    password: string;
}

@Injectable()
export class LoginUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly refreshTokens: RefreshTokenRepository,
        private readonly hasher: PasswordHasher,
        private readonly sessions: SessionIssuer,
    ) {}

    async execute(input: LoginInput): Promise<Result<AuthSession, DomainError>> {
        const email = Email.create(input.email);
        const user = email.ok ? await this.users.findByEmail(email.value) : undefined;
        if (user === undefined) {
            // Same work and the same answer as a wrong password: response time does not reveal unknown e-mails.
            await this.hasher.dummyVerify(input.password);
            return err(IdentityErrors.invalidCredentials());
        }
        if (!(await this.hasher.verify(input.password, user.passwordHash))) {
            return err(IdentityErrors.invalidCredentials());
        }

        const refresh = this.sessions.newFamily(user);
        await this.refreshTokens.insert(refresh.token);
        return ok(await this.sessions.session(user, refresh));
    }
}
