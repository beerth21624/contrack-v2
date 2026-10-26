// ─── identity: users, password hashes, refresh-token families, access tokens ───
import { Global, Module } from '@nestjs/common';
import { AccessTokenVerifier, Clock, UserDirectory } from '../../shared/application/ports';
import { AppConfig } from '../../shared/infrastructure/config/env';
import { persistence } from '../../shared/infrastructure/core.module';
import { AccessTokenSigner } from './application/ports/access-token-signer.port';
import { AuthSettings } from './application/ports/auth-settings.port';
import { PasswordHasher } from './application/ports/password-hasher.port';
import { RefreshTokenRepository } from './application/ports/refresh-token.repository';
import { UserRepository } from './application/ports/user.repository';
import { SessionIssuer } from './application/services/session-issuer.service';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { DrizzleRefreshTokenRepository } from './infrastructure/adapters/drizzle-refresh-token.repository';
import { DrizzleUserRepository } from './infrastructure/adapters/drizzle-user.repository';
import { InMemoryRefreshTokenRepository } from './infrastructure/adapters/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from './infrastructure/adapters/in-memory-user.repository';
import { JwtAccessTokenService } from './infrastructure/adapters/jwt-access-token.service';
import { ScryptPasswordHasher } from './infrastructure/adapters/scrypt-password-hasher.adapter';
import { IdentityUserDirectory } from './infrastructure/adapters/user-directory.adapter';
import { AuthController } from './presentation/auth.controller';
import { MeController } from './presentation/me.controller';

@Global()
@Module({
    controllers: [AuthController, MeController],
    providers: [
        persistence(UserRepository, () => new InMemoryUserRepository(), ctx => new DrizzleUserRepository(ctx)),
        persistence(RefreshTokenRepository, () => new InMemoryRefreshTokenRepository(),
            ctx => new DrizzleRefreshTokenRepository(ctx)),
        { provide: PasswordHasher, useFactory: (): PasswordHasher => new ScryptPasswordHasher() },
        {
            provide: AuthSettings,
            inject: [AppConfig],
            useFactory: (config: AppConfig): AuthSettings => new AuthSettings(config.env.REFRESH_TOKEN_TTL_DAYS),
        },
        {
            provide: JwtAccessTokenService,
            inject: [AppConfig, Clock],
            useFactory: (config: AppConfig, clock: Clock): JwtAccessTokenService => new JwtAccessTokenService(
                { secret: config.env.JWT_ACCESS_SECRET, ttlSeconds: config.env.JWT_ACCESS_TTL_SECONDS }, clock),
        },
        { provide: AccessTokenSigner, useExisting: JwtAccessTokenService },
        { provide: AccessTokenVerifier, useExisting: JwtAccessTokenService },
        {
            provide: UserDirectory,
            inject: [UserRepository],
            useFactory: (users: UserRepository): UserDirectory => new IdentityUserDirectory(users),
        },
        SessionIssuer,
        RegisterUserUseCase,
        LoginUseCase,
        RefreshSessionUseCase,
        LogoutUseCase,
        GetMeUseCase,
    ],
    exports: [AccessTokenVerifier, UserDirectory],
})
export class IdentityModule {}
