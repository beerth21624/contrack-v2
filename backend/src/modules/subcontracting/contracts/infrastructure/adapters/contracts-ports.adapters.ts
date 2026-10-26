// ─── Ports the contracts stream provides to the others: settings reader, vendor stats, vendor link, module usage ───
import { Injectable } from '@nestjs/common';
import type { ModuleId, SubcontractingSettingsDto } from '@contrack/contract';
import { Clock, ModuleUsage } from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain';
import type { ScInvitationId } from '../../../shared/ids';
import {
    ScActivityLog, SubcontractingSettingsReader, VendorDirectory, VendorLinkListener, VendorStats, type VendorStatsView,
} from '../../../shared/ports';
import { DEFAULT_SUBCONTRACTING_SETTINGS } from '../../../shared/settings';
import { logContract } from '../../application/contract-activity';
import { RatingRepository } from '../../application/ports/rating.repository';
import { ScSettingsRepository } from '../../application/ports/sc-settings.repository';
import { SubcontractRepository } from '../../application/ports/subcontract.repository';

@Injectable()
export class RepositorySettingsReader extends SubcontractingSettingsReader {
    constructor(private readonly repo: ScSettingsRepository) {
        super();
    }

    async get(workspaceId: WorkspaceId): Promise<SubcontractingSettingsDto> {
        // Saved settings are merged over the defaults, so a field added later reads its default.
        return { ...DEFAULT_SUBCONTRACTING_SETTINGS, ...(await this.repo.get(workspaceId)) };
    }
}

@Injectable()
export class RepositoryModuleUsage extends ModuleUsage {
    constructor(private readonly subcontracts: SubcontractRepository) {
        super();
    }

    /** Contracts waiting for acceptance or running: switching the module off would hide them from the buyer. */
    async activeWork(workspaceId: WorkspaceId, module: ModuleId): Promise<{ activeSubcontracts: number }> {
        if (module !== 'subcontracting') return { activeSubcontracts: 0 };
        const list = await this.subcontracts.listByBuyer(workspaceId);
        return { activeSubcontracts: list.filter(s => s.status === 'pending_acceptance' || s.status === 'active').length };
    }
}

@Injectable()
export class RepositoryVendorStats extends VendorStats {
    constructor(private readonly subcontracts: SubcontractRepository, private readonly ratings: RatingRepository) {
        super();
    }

    async forBuyer(buyerWorkspaceId: WorkspaceId, vendorWorkspaceIds: readonly WorkspaceId[]): Promise<Map<WorkspaceId, VendorStatsView>> {
        const wanted = new Set(vendorWorkspaceIds);
        const list = (await this.subcontracts.listByBuyer(buyerWorkspaceId))
            .filter(s => s.status !== 'cancelled' && s.vendorWorkspaceId !== null && wanted.has(s.vendorWorkspaceId));
        const ratings = await this.ratings.listGivenByBuyer(buyerWorkspaceId, [...wanted]);
        const out = new Map<WorkspaceId, VendorStatsView>();
        for (const ws of wanted) {
            const mine = list.filter(s => s.vendorWorkspaceId === ws);
            const scores = ratings.filter(r => r.toWorkspaceId === ws).flatMap(r => Object.values(r.scores));
            const last = mine.reduce<Date | null>((m, s) => (m === null || s.state.createdAt > m ? s.state.createdAt : m), null);
            out.set(ws, {
                lastEngagedAt: last,
                ratingFromUs: scores.length === 0 ? null : Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
                completedWithUs: mine.filter(s => s.status === 'completed' || s.status === 'closed').length,
            });
        }
        return out;
    }
}

@Injectable()
export class RepositoryVendorLinkListener extends VendorLinkListener {
    constructor(
        private readonly subcontracts: SubcontractRepository,
        private readonly vendors: VendorDirectory,
        private readonly activity: ScActivityLog,
        private readonly clock: Clock,
    ) {
        super();
    }

    /** Subcontracts awarded to the invitation before the crew had an account now belong to that crew workspace. */
    async onInvitationLinked(invitationId: ScInvitationId, vendorWorkspaceId: WorkspaceId): Promise<void> {
        const list = await this.subcontracts.listByInvitation(invitationId);
        if (list.length === 0) return;
        const card = (await this.vendors.cards([vendorWorkspaceId])).get(vendorWorkspaceId);
        const now = this.clock.now();
        for (const found of list) {
            // Lock and read again (runs inside the caller's transaction): never write a contract back from a stale read.
            const sc = await this.subcontracts.lockForUpdate(found.id);
            if (!sc?.linkVendor(vendorWorkspaceId, card?.teamName, now)) continue;
            await this.subcontracts.update(sc);
            await logContract(this.activity, sc, 'subcontract', sc.id, 'vendor_linked', null, now, { vendorWorkspaceId });
        }
    }
}
