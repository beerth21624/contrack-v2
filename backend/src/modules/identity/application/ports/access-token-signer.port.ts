import type { UserId } from '../../../../shared/domain/ids';

export interface SignedAccessToken {
    token: string;
    /** Seconds until the token expires. */
    expiresIn: number;
}

/** Issues short-lived access tokens (the counterpart of the shared AccessTokenVerifier). */
export abstract class AccessTokenSigner {
    abstract sign(userId: UserId): Promise<SignedAccessToken>;
}
