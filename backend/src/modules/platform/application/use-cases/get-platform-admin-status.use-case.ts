import { Injectable } from '@nestjs/common';
import type { UserId } from '../../../../shared/domain/ids';
import { PlatformAdminAccess } from '../platform-admin-access';

/** Whether the signed-in user is a platform admin (the web app shows the admin link with it; never an error). */
@Injectable()
export class GetPlatformAdminStatusUseCase {
    constructor(private readonly admins: PlatformAdminAccess) {}

    async execute(actorId: UserId): Promise<{ admin: boolean }> {
        return { admin: await this.admins.isAdmin(actorId) };
    }
}
