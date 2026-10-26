// ─── Access tokens: HS256 JWT, short-lived, `sub` = user id. Signer for identity, verifier for everyone ───
import { JwtService } from '@nestjs/jwt';
import { AccessTokenVerifier, type AuthenticatedUser, type Clock } from '../../../../shared/application/ports';
import { asUserId, isUuid } from '../../../../shared/domain/ids';
import type { UserId } from '../../../../shared/domain/ids';
import type { AccessTokenSigner, SignedAccessToken } from '../../application/ports/access-token-signer.port';

export const ACCESS_TOKEN_ISSUER = 'contrack-api';
export const ACCESS_TOKEN_AUDIENCE = 'contrack-web';

export interface JwtAccessTokenOptions {
    secret: string;
    ttlSeconds: number;
}

interface AccessTokenClaims {
    sub: string;
    iat: number;
    exp: number;
}

const seconds = (date: Date): number => Math.floor(date.getTime() / 1000);

/**
 * `iat`/`exp` come from the injected Clock (not Date.now), and verification checks expiry against the same clock,
 * so tests with a FixedClock are deterministic.
 */
export class JwtAccessTokenService extends AccessTokenVerifier implements AccessTokenSigner {
    private readonly jwt: JwtService;

    constructor(private readonly options: JwtAccessTokenOptions, private readonly clock: Clock) {
        super();
        this.jwt = new JwtService({ secret: options.secret });
    }

    async sign(userId: UserId): Promise<SignedAccessToken> {
        const iat = seconds(this.clock.now());
        const claims: AccessTokenClaims = { sub: userId, iat, exp: iat + this.options.ttlSeconds };
        const token = await this.jwt.signAsync(claims, {
            algorithm: 'HS256',
            issuer: ACCESS_TOKEN_ISSUER,
            audience: ACCESS_TOKEN_AUDIENCE,
        });
        return { token, expiresIn: this.options.ttlSeconds };
    }

    /** Undefined on any failure (bad signature, expired, wrong issuer / audience, malformed); never throws. */
    async verify(token: string): Promise<AuthenticatedUser | undefined> {
        try {
            const claims = await this.jwt.verifyAsync<Partial<AccessTokenClaims>>(token, {
                algorithms: ['HS256'],
                issuer: ACCESS_TOKEN_ISSUER,
                audience: ACCESS_TOKEN_AUDIENCE,
                clockTimestamp: seconds(this.clock.now()),
            });
            const sub = claims.sub;
            if (typeof sub !== 'string' || !isUuid(sub) || typeof claims.exp !== 'number') return undefined;
            return { userId: asUserId(sub.toLowerCase()) };
        } catch {
            return undefined;
        }
    }
}
