// ─── Test kit for identity unit specs: fakes of the outbound ports and a wired set of use cases ───
// Not a spec file itself; only imported by *.spec.ts.
import {
    MembershipDirectory, type MembershipSummary, PersonalWorkspaceProvisioner,
} from '../../../shared/application/ports';
import { type UserId, type WorkspaceId, asUserId, asWorkspaceId } from '../../../shared/domain/ids';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { AccessTokenSigner, type SignedAccessToken } from '../application/ports/access-token-signer.port';
import { AuthSettings, REFRESH_REUSE_GRACE_MS } from '../application/ports/auth-settings.port';
import { PasswordHasher } from '../application/ports/password-hasher.port';
import { SessionIssuer } from '../application/services/session-issuer.service';
import { GetMeUseCase } from '../application/use-cases/get-me.use-case';
import { LoginUseCase } from '../application/use-cases/login.use-case';
import { LogoutUseCase } from '../application/use-cases/logout.use-case';
import { RefreshSessionUseCase } from '../application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from '../application/use-cases/register-user.use-case';
import { RefreshToken } from '../domain/entities/refresh-token.entity';
import type { PlainPassword } from '../domain/value-objects/plain-password.value-object';
import { InMemoryRefreshTokenRepository } from '../infrastructure/adapters/in-memory-refresh-token.repository';
import { InMemoryUserRepository } from '../infrastructure/adapters/in-memory-user.repository';

/** Fast, transparent hasher: `hashed:<password>`. Counts dummy verifications. */
export class FakePasswordHasher extends PasswordHasher {
    dummyVerifications = 0;

    hash(password: PlainPassword): Promise<string> {
        return Promise.resolve(`hashed:${password.value}`);
    }

    verify(password: string, hash: string): Promise<boolean> {
        return Promise.resolve(hash === `hashed:${password}`);
    }

    dummyVerify(): Promise<void> {
        this.dummyVerifications += 1;
        return Promise.resolve();
    }
}

export class FakeAccessTokenSigner extends AccessTokenSigner {
    signed: UserId[] = [];

    sign(userId: UserId): Promise<SignedAccessToken> {
        this.signed.push(userId);
        return Promise.resolve({ token: `access:${userId}:${this.signed.length}`, expiresIn: 900 });
    }
}

export class FakePersonalWorkspaceProvisioner extends PersonalWorkspaceProvisioner {
    calls: { userId: UserId; displayName: string }[] = [];
    /** Set to make provisioning fail (simulates a bug / database error inside the transaction). */
    failWith: Error | undefined;

    provision(userId: UserId, displayName: string): Promise<WorkspaceId> {
        if (this.failWith !== undefined) return Promise.reject(this.failWith);
        this.calls.push({ userId, displayName });
        return Promise.resolve(asWorkspaceId(`ffffffff-0000-4000-8000-${this.calls.length.toString(16).padStart(12, '0')}`));
    }
}

export class FakeMembershipDirectory extends MembershipDirectory {
    readonly byUser = new Map<UserId, MembershipSummary[]>();

    listForUser(userId: UserId): Promise<MembershipSummary[]> {
        return Promise.resolve(this.byUser.get(userId) ?? []);
    }
}

/** Counts transactions so specs can assert that multi-row writes ran inside `run`. */
export class CountingUnitOfWork extends InMemoryUnitOfWork {
    runs = 0;

    override run<T>(work: () => Promise<T>): Promise<T> {
        this.runs += 1;
        return super.run(work);
    }
}

/**
 * Returns a stale (pre-rotation) copy of one token on the next lookup of its hash: reproduces "both tabs read the
 * token before either rotated it" deterministically, so the second caller loses the conditional revoke.
 */
export class StaleReadRefreshTokenRepository extends InMemoryRefreshTokenRepository {
    private stale: RefreshToken | undefined;

    serveStaleOnce(token: RefreshToken): void {
        this.stale = token;
    }

    override findByHash(tokenHash: string): Promise<RefreshToken | undefined> {
        const stale = this.stale;
        if (stale?.tokenHash === tokenHash) {
            this.stale = undefined;
            return Promise.resolve(RefreshToken.rehydrate(stale.toSnapshot()));
        }
        return super.findByHash(tokenHash);
    }
}

export const REFRESH_TTL_DAYS = 30;
export const REFRESH_TTL_MS = REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000;
export const UNKNOWN_USER_ID = asUserId('99999999-0000-4000-8000-000000000000');

export interface IdentityKitOptions {
    users?: InMemoryUserRepository;
    refreshTokens?: InMemoryRefreshTokenRepository;
    /** Grace window for a token rotated by a concurrent tab (defaults to the production constant). */
    refreshReuseGraceMs?: number;
}

export function identityKit(options: IdentityKitOptions = {}) {
    const clock = new FixedClock(new Date('2026-03-01T10:00:00.000Z'));
    const ids = new SequentialIdGenerator();
    const users = options.users ?? new InMemoryUserRepository();
    const refreshTokens = options.refreshTokens ?? new InMemoryRefreshTokenRepository();
    const hasher = new FakePasswordHasher();
    const signer = new FakeAccessTokenSigner();
    const provisioner = new FakePersonalWorkspaceProvisioner();
    const memberships = new FakeMembershipDirectory();
    const uow = new CountingUnitOfWork();
    const settings = new AuthSettings(REFRESH_TTL_DAYS, options.refreshReuseGraceMs ?? REFRESH_REUSE_GRACE_MS);
    const sessions = new SessionIssuer(signer, settings, clock, ids);
    return {
        clock, ids, users, refreshTokens, hasher, signer, provisioner, memberships, uow, settings, sessions,
        register: new RegisterUserUseCase(users, refreshTokens, hasher, provisioner, uow, sessions, clock, ids),
        login: new LoginUseCase(users, refreshTokens, hasher, sessions),
        refresh: new RefreshSessionUseCase(users, refreshTokens, sessions, settings, uow, clock),
        logout: new LogoutUseCase(refreshTokens, clock),
        getMe: new GetMeUseCase(users, memberships),
    };
}

export type IdentityKit = ReturnType<typeof identityKit>;

export const ALICE = { email: 'Alice@Example.com', password: 'correct horse battery', displayName: 'Alice' } as const;
export const BOB = { email: 'bob@example.com', password: 'another password', displayName: 'Bob' } as const;
