// ─── Register: new user + personal workspace (one transaction), then a new session ───
import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator, PersonalWorkspaceProvisioner, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { asUserId } from '../../../../shared/domain/ids';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { User } from '../../domain/entities/user.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import { DisplayName } from '../../domain/value-objects/display-name.value-object';
import { Email } from '../../domain/value-objects/email.value-object';
import { PlainPassword } from '../../domain/value-objects/plain-password.value-object';
import { PasswordHasher } from '../ports/password-hasher.port';
import { RefreshTokenRepository } from '../ports/refresh-token.repository';
import { UserRepository } from '../ports/user.repository';
import { type AuthSession, SessionIssuer } from '../services/session-issuer.service';

export interface RegisterUserInput {
    email: string;
    password: string;
    displayName: string;
}

@Injectable()
export class RegisterUserUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly refreshTokens: RefreshTokenRepository,
        private readonly hasher: PasswordHasher,
        private readonly provisioner: PersonalWorkspaceProvisioner,
        private readonly uow: UnitOfWork,
        private readonly sessions: SessionIssuer,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    async execute(input: RegisterUserInput): Promise<Result<AuthSession, DomainError>> {
        const email = Email.create(input.email);
        if (!email.ok) return email;
        const displayName = DisplayName.create(input.displayName);
        if (!displayName.ok) return displayName;
        const password = PlainPassword.create(input.password);
        if (!password.ok) return password;

        if (await this.users.findByEmail(email.value)) return err(IdentityErrors.emailTaken());

        const user = User.create({
            id: asUserId(this.ids.newId()),
            email: email.value,
            displayName: displayName.value,
            passwordHash: await this.hasher.hash(password.value),
            createdAt: this.clock.now(),
        });

        // The insert is the first write: when a concurrent registration took the e-mail (unique violation), nothing
        // else has been written and the failed transaction is rolled back.
        const created = await this.uow.run(async (): Promise<Result<User, DomainError>> => {
            const inserted = await this.users.insert(user);
            if (!inserted.ok) return inserted;
            await this.provisioner.provision(user.id, user.displayName.value);
            return ok(user);
        });
        if (!created.ok) return created;

        const refresh = this.sessions.newFamily(created.value);
        await this.refreshTokens.insert(refresh.token);
        return ok(await this.sessions.session(created.value, refresh));
    }
}
