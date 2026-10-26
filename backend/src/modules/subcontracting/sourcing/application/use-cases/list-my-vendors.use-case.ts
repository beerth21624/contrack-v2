import { Injectable } from '@nestjs/common';
import type { MyVendorsDto } from '@contrack/contract';
import { MembershipDirectory } from '../../../../../shared/application/ports';
import type { DomainError } from '../../../../../shared/domain/domain-error';
import type { UserId } from '../../../../../shared/domain/ids';
import { type Result, ok } from '../../../../../shared/domain/result';
import { ScAccess } from '../../../shared/sc-access';
import { VendorProfileRepository } from '../ports/sourcing.repositories';

/** The workspaces of the caller that carry a vendor profile (a user may run more than one crew). */
@Injectable()
export class ListMyVendorsUseCase {
    constructor(private readonly access: ScAccess, private readonly memberships: MembershipDirectory, private readonly profiles: VendorProfileRepository) {}

    async execute(input: { actorId: UserId }): Promise<Result<MyVendorsDto, DomainError>> {
        const on = this.access.platformOn();
        if (!on.ok) return on;
        const mine = await this.memberships.listForUser(input.actorId);
        const profiles = new Map((await this.profiles.findMany(mine.map(m => m.workspaceId))).map(p => [p.workspaceId, p]));
        return ok(mine.flatMap(m => {
            const p = profiles.get(m.workspaceId);
            return p === undefined ? [] : [{ workspaceId: p.workspaceId, teamName: p.props.teamName, tier: p.props.tier, role: m.role }];
        }));
    }
}
