// ─── Who is a platform admin: the e-mail of the signed-in user is listed in PLATFORM_ADMIN_EMAILS ───
import { Injectable } from '@nestjs/common';
import { UserDirectory } from '../../../shared/application/ports';
import { DomainError } from '../../../shared/domain/domain-error';
import type { UserId } from '../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../shared/domain/result';
import { AppConfig } from '../../../shared/infrastructure/config/env';

@Injectable()
export class PlatformAdminAccess {
    constructor(
        private readonly users: UserDirectory,
        private readonly config: AppConfig,
    ) {}

    /** The e-mail (compared in lower case) is in PLATFORM_ADMIN_EMAILS; false when the list is empty. */
    async isAdmin(userId: UserId): Promise<boolean> {
        const admins = this.config.platformAdminEmails;
        if (admins.length === 0) return false;
        const profile = (await this.users.findMany([userId])).get(userId);
        const email = profile?.email.trim().toLowerCase() ?? '';
        return email !== '' && admins.includes(email);
    }

    /** Not an admin → `not_found` (the admin area is never revealed). */
    async check(userId: UserId): Promise<Result<void, DomainError>> {
        return (await this.isAdmin(userId)) ? okVoid() : err(DomainError.notFound('Resource'));
    }
}
