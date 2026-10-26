// ─── identity: users, password hashes, refresh-token families, access tokens, phone sign-in (one-time codes) ───
// Phone sign-in also needs SmsSender (platform) and PhoneSignInHook (subcontracting sourcing), provided globally.
import { Global, Module } from '@nestjs/common';
import { AccessTokenVerifier, Clock, UserDirectory } from '../../shared/application/ports';
import { AppConfig } from '../../shared/infrastructure/config/env';
import { persistence } from '../../shared/infrastructure/core.module';
import { AccessTokenSigner } from './application/ports/access-token-signer.port';
import { AuthSettings } from './application/ports/auth-settings.port';
import { OtpCodeRepository } from './application/ports/otp-code.repository';
import { OtpGenerator, OtpHasher } from './application/ports/otp-code.port';
import { OtpSettings } from './application/ports/otp-settings.port';
import { PasswordHasher } from './application/ports/password-hasher.port';
import { RateLimiter } from './application/ports/rate-limiter.port';
import { RefreshTokenRepository } from './application/ports/refresh-token.repository';
import { UserRepository } from './application/ports/user.repository';
import { SessionIssuer } from './application/services/session-issuer.service';
import { CheckPhoneUseCase } from './application/use-cases/check-phone.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { LoginUseCase } from './application/use-cases/login.use-case';
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import { RequestOtpUseCase } from './application/use-cases/request-otp.use-case';
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case';
import { DrizzleOtpCodeRepository } from './infrastructure/adapters/drizzle-otp-code.repository';
import { DrizzleRefreshTokenRepository } from './infrastructure/adapters/drizzle-refresh-token.repository';
import { DrizzleUserRepository } from './infrastructure/adapters/drizzle-user.repository';
import { InMemoryOtpCodeRepository } from './infrastructure/adapters/in-memory-otp-code.repository';
import { InMemoryRateLimiter } from './infrastructure/adapters/in-memory-rate-limiter.adapter';
import { InMemoryRefreshTokenRepository } from './infrastructure/adapters/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from './infrastructure/adapters/in-memory-user.repository';
import { JwtAccessTokenService } from './infrastructure/adapters/jwt-access-token.service';
import { HmacOtpHasher, RandomOtpGenerator } from './infrastructure/adapters/otp-code.adapter';
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
        persistence(OtpCodeRepository, () => new InMemoryOtpCodeRepository(), ctx => new DrizzleOtpCodeRepository(ctx)),
        { provide: OtpGenerator, useFactory: (): OtpGenerator => new RandomOtpGenerator() },
        {
            provide: OtpHasher,
            inject: [AppConfig],
            // Server key: derived from the access-token secret (domain-separated), never stored with the codes.
            useFactory: (config: AppConfig): OtpHasher => new HmacOtpHasher(`otp-code:${config.env.JWT_ACCESS_SECRET}`),
        },
        {
            provide: OtpSettings,
            inject: [AppConfig],
            useFactory: (config: AppConfig): OtpSettings => new OtpSettings(config.env.OTP_TTL_SECONDS),
        },
        { provide: RateLimiter, inject: [Clock], useFactory: (clock: Clock): RateLimiter => new InMemoryRateLimiter(clock) },
        SessionIssuer,
        RegisterUserUseCase,
        LoginUseCase,
        RefreshSessionUseCase,
        LogoutUseCase,
        GetMeUseCase,
        CheckPhoneUseCase,
        RequestOtpUseCase,
        VerifyOtpUseCase,
    ],
    exports: [AccessTokenVerifier, UserDirectory],
})
export class IdentityModule {}
