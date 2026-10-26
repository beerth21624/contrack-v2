// ─── VendorDirectory (shared port): vendor cards and vendor-list names for bidding / contracts ───
import { Injectable } from '@nestjs/common';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import type { VendorListEntryId } from '../../../shared/ids';
import { type VendorCardView, VendorDirectory } from '../../../shared/ports';
import { VendorListRepository, VendorProfileRepository } from '../../application/ports/sourcing.repositories';

@Injectable()
export class SourcingVendorDirectory extends VendorDirectory {
    constructor(private readonly profiles: VendorProfileRepository, private readonly entries: VendorListRepository) {
        super();
    }

    async cards(vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorCardView>> {
        const out = new Map<WorkspaceId, VendorCardView>();
        for (const profile of await this.profiles.findMany([...new Set(vendorWorkspaceIds)])) {
            const p = profile.props;
            out.set(p.workspaceId, {
                workspaceId: p.workspaceId, teamName: p.teamName, phone: p.phone, tier: p.tier,
                profileComplete: profile.isComplete((await this.profiles.listPortfolio(p.workspaceId)).length),
                vatRegistered: p.vatRegistered,
            });
        }
        return out;
    }

    async entryNames(entryIds: readonly VendorListEntryId[]): Promise<Map<VendorListEntryId, string>> {
        return new Map((await this.entries.findMany([...new Set(entryIds)])).map(e => [e.id, e.props.displayName]));
    }
}
