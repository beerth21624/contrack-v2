// ─── Entities → contract DTOs (dates as ISO strings) ───
import type { AuthResponse, MeResponse, PhoneAuthResponse, UserDto } from '@contrack/contract';
import type { AuthSession } from '../application/services/session-issuer.service';
import type { Me } from '../application/use-cases/get-me.use-case';
import type { PhoneSignIn } from '../application/use-cases/verify-otp.use-case';
import type { User } from '../domain/entities/user.entity';

export function toUserDto(user: User): UserDto {
    return {
        id: user.id,
        email: user.email.value,
        phone: user.phone?.value ?? null,
        displayName: user.displayName.value,
        createdAt: user.createdAt.toISOString(),
    };
}

export function toAuthResponse(session: AuthSession): AuthResponse {
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: toUserDto(session.user) };
}

export function toPhoneAuthResponse(signIn: PhoneSignIn): PhoneAuthResponse {
    return {
        ...toAuthResponse(signIn.session),
        isNewUser: signIn.isNewUser,
        vendorWorkspaceId: signIn.vendorWorkspaceId,
    };
}

export function toMeResponse(me: Me): MeResponse {
    return {
        user: toUserDto(me.user),
        workspaces: me.workspaces.map(w => ({ id: w.workspaceId, name: w.name, kind: w.kind, role: w.role })),
        locale: me.user.locale,
    };
}
