// ─── Entities → contract DTOs (dates as ISO strings) ───
import type { AuthResponse, MeResponse, UserDto } from '@contrack/contract';
import type { AuthSession } from '../application/services/session-issuer.service';
import type { Me } from '../application/use-cases/get-me.use-case';
import type { User } from '../domain/entities/user.entity';

export function toUserDto(user: User): UserDto {
    return {
        id: user.id,
        email: user.email.value,
        displayName: user.displayName.value,
        createdAt: user.createdAt.toISOString(),
    };
}

export function toAuthResponse(session: AuthSession): AuthResponse {
    return { accessToken: session.accessToken, expiresIn: session.expiresIn, user: toUserDto(session.user) };
}

export function toMeResponse(me: Me): MeResponse {
    return {
        user: toUserDto(me.user),
        workspaces: me.workspaces.map(w => ({ id: w.workspaceId, name: w.name, kind: w.kind, role: w.role })),
    };
}
