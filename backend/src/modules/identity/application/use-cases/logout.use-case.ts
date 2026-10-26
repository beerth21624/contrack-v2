// ─── Logout: revokes the refresh-token family. Idempotent: no / unknown / revoked token is still ok ───
import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports';
import type { DomainError } from '../../../../shared/domain/domain-error';
import { type Result, okVoid } from '../../../../shared/domain/result';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import { RefreshTokenRepository } from '../ports/refresh-token.repository';

export interface LogoutInput {
    refreshToken: string | undefined;
}

@Injectable()
export class LogoutUseCase {
    constructor(private readonly refreshTokens: RefreshTokenRepository, private readonly clock: Clock) {}

    async execute(input: LogoutInput): Promise<Result<undefined, DomainError>> {
        if (input.refreshToken === undefined || input.refreshToken === '') return okVoid();
        const token = await this.refreshTokens.findByHash(sha256(input.refreshToken));
        if (token !== undefined) await this.refreshTokens.revokeFamily(token.familyId, this.clock.now());
        return okVoid();
    }
}
