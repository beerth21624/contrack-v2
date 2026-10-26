// ─── Refresh: rotates the refresh token; reuse of a rotated token revokes the whole family ───
// Several tabs share one cookie and often refresh at the same moment. Exactly one of them wins the rotation
// (conditional revoke); a tab presenting a token that was rotated at most `refreshReuseGraceMs` ago — or that lost
// the race just now — gets a sibling token in the same family. Later presentation of a rotated token is reuse.
import { Injectable } from '@nestjs/common';
import { Clock, UnitOfWork } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import type { RefreshToken } from '../../domain/entities/refresh-token.entity';
import { IdentityErrors } from '../../domain/identity-errors';
import { AuthSettings } from '../ports/auth-settings.port';
import { RefreshTokenRepository } from '../ports/refresh-token.repository';
import { UserRepository } from '../ports/user.repository';
import { type AuthSession, type NewRefreshToken, SessionIssuer } from '../services/session-issuer.service';

export interface RefreshSessionInput {
    /** Raw token from the cookie (undefined when there is no cookie). */
    refreshToken: string | undefined;
}

@Injectable()
export class RefreshSessionUseCase {
    constructor(
        private readonly users: UserRepository,
        private readonly refreshTokens: RefreshTokenRepository,
        private readonly sessions: SessionIssuer,
        private readonly settings: AuthSettings,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: RefreshSessionInput): Promise<Result<AuthSession, DomainError>> {
        if (input.refreshToken === undefined || input.refreshToken === '') return err(IdentityErrors.invalidToken());
        const tokenHash = sha256(input.refreshToken);
        const current = await this.refreshTokens.findByHash(tokenHash);
        if (current === undefined) return err(IdentityErrors.invalidToken());

        const now = this.clock.now();
        if (current.isRevoked) return this.revokedTokenPresented(current, now);
        if (current.isExpired(now)) return err(IdentityErrors.invalidToken());

        const user = await this.users.findById(current.userId);
        if (user === undefined) {
            await this.refreshTokens.revokeFamily(current.familyId, now);
            return err(IdentityErrors.invalidToken());
        }

        // Conditional revoke + insert of the successor: only the winner writes anything.
        const rotated = await this.uow.run(async (): Promise<NewRefreshToken | undefined> => {
            const next = this.sessions.rotate(current);
            const won = await this.refreshTokens.rotateIfActive(current.id, next.token, now);
            return won ? next : undefined;
        });
        if (rotated !== undefined) return ok(await this.sessions.session(user, rotated));

        // Lost the race: a concurrent refresh (or logout) revoked the token in between. Judge it by its stored state.
        const fresh = await this.refreshTokens.findByHash(tokenHash);
        if (!fresh?.isRevoked) return err(IdentityErrors.invalidToken());
        return this.revokedTokenPresented(fresh, now);
    }

    private async revokedTokenPresented(token: RefreshToken, now: Date): Promise<Result<AuthSession, DomainError>> {
        // Revoked by logout (never rotated): simply no longer valid.
        if (!token.wasRotated) return err(IdentityErrors.invalidToken());

        // Rotated moments ago by another tab, and the family is still alive (no logout / reuse since): a sibling.
        if (token.rotatedWithin(now, this.settings.refreshReuseGraceMs)
            && await this.refreshTokens.hasActiveInFamily(token.familyId, now)) {
            const user = await this.users.findById(token.userId);
            if (user !== undefined) {
                const sibling = this.sessions.sibling(token);
                await this.refreshTokens.insert(sibling.token);
                return ok(await this.sessions.session(user, sibling));
            }
        }

        // Reuse of a rotated token: someone holds a copy. End every session of that chain.
        await this.refreshTokens.revokeFamily(token.familyId, now);
        return err(IdentityErrors.invalidToken());
    }
}
