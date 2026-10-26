// ─── Builds sessions: refresh tokens (opaque, stored as SHA-256) + signed access tokens ───
import { Injectable } from '@nestjs/common';
import { Clock, IdGenerator } from '../../../../shared/application/ports';
import { asRefreshTokenId } from '../../../../shared/domain/ids';
import { newOpaqueToken, sha256 } from '../../../../shared/infrastructure/crypto';
import { RefreshToken, asRefreshTokenFamilyId } from '../../domain/entities/refresh-token.entity';
import type { User } from '../../domain/entities/user.entity';
import { AccessTokenSigner } from '../ports/access-token-signer.port';
import { AuthSettings } from '../ports/auth-settings.port';

/** What register / login / refresh hand to the controller. The raw refresh token goes only into the cookie. */
export interface AuthSession {
    user: User;
    accessToken: string;
    expiresIn: number;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
}

export interface NewRefreshToken {
    raw: string;
    token: RefreshToken;
}

@Injectable()
export class SessionIssuer {
    constructor(
        private readonly signer: AccessTokenSigner,
        private readonly settings: AuthSettings,
        private readonly clock: Clock,
        private readonly ids: IdGenerator,
    ) {}

    /** First token of a new family (login / register). Not persisted yet. */
    newFamily(user: User): NewRefreshToken {
        const raw = newOpaqueToken();
        const token = RefreshToken.issue({
            id: asRefreshTokenId(this.ids.newId()),
            userId: user.id,
            familyId: asRefreshTokenFamilyId(this.ids.newId()),
            tokenHash: sha256(raw),
            now: this.clock.now(),
            ttlMs: this.settings.refreshTokenTtlMs,
        });
        return { raw, token };
    }

    /** Successor of `current` in the same family; `current` is revoked in its favour. Not persisted yet. */
    rotate(current: RefreshToken): NewRefreshToken {
        const raw = newOpaqueToken();
        const token = current.rotate({
            id: asRefreshTokenId(this.ids.newId()),
            tokenHash: sha256(raw),
            now: this.clock.now(),
            ttlMs: this.settings.refreshTokenTtlMs,
        });
        return { raw, token };
    }

    /**
     * Another token in the family of `rotated` (grace window: a concurrent tab lost the rotation). `rotated` itself
     * stays revoked; the family keeps every token it already has. Not persisted yet.
     */
    sibling(rotated: RefreshToken): NewRefreshToken {
        const raw = newOpaqueToken();
        const token = RefreshToken.issue({
            id: asRefreshTokenId(this.ids.newId()),
            userId: rotated.userId,
            familyId: rotated.familyId,
            tokenHash: sha256(raw),
            now: this.clock.now(),
            ttlMs: this.settings.refreshTokenTtlMs,
        });
        return { raw, token };
    }

    async session(user: User, refresh: NewRefreshToken): Promise<AuthSession> {
        const access = await this.signer.sign(user.id);
        return {
            user,
            accessToken: access.token,
            expiresIn: access.expiresIn,
            refreshToken: refresh.raw,
            refreshTokenExpiresAt: refresh.token.expiresAt,
        };
    }
}
