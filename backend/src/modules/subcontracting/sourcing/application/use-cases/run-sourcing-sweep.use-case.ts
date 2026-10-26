import { Injectable } from '@nestjs/common';
import { Clock, ModuleFlags, UnitOfWork } from '../../../../../shared/application/ports';
import type { WorkspaceId } from '../../../../../shared/domain/ids';
import type { PackageId } from '../../../shared/ids';
import { ScActivityLog } from '../../../shared/ports';
import { MODULE } from '../../../shared/sc-access';
import type { ScInvitation } from '../../domain/entities/sc-invitation.entity';
import type { WorkPackage } from '../../domain/entities/work-package.entity';
import { InvitationRepository, WorkPackageRepository } from '../ports/sourcing.repositories';
import { SourcingNotices } from '../services/sourcing-notices.service';
import { hasSubmitted } from '../services/sourcing-views.service';

export const DEADLINE_SOON_MS = 24 * 60 * 60 * 1000;

export interface SweepResult {
    reminded: number;
    settled: number;
}

interface PackageOutcome {
    settled: boolean;
    reminders: { pkg: WorkPackage; invitation: ScInvitation }[];
}

const NOTHING: PackageOutcome = { settled: false, reminders: [] };

/**
 * Background sweep (every few minutes): reminds invitees without a bid 24 h before the deadline (once per deadline)
 * and stores the status of open packages whose deadline passed (reviewing with a bid, else expired). Nothing runs
 * when the platform does not offer the module; packages of buyer workspaces that switched it off are skipped. Each
 * package is re-read under a row lock in its own transaction and written only while still open, so an award / cancel /
 * extend that committed after the batch was listed is never overwritten.
 */
@Injectable()
export class RunSourcingSweepUseCase {
    constructor(
        private readonly packages: WorkPackageRepository,
        private readonly invitations: InvitationRepository,
        private readonly notices: SourcingNotices,
        private readonly activity: ScActivityLog,
        private readonly flags: ModuleFlags,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(): Promise<SweepResult> {
        if (!this.flags.platformEnabled(MODULE)) return { reminded: 0, settled: 0 };
        const now = this.clock.now();
        const soon = new Date(now.getTime() + DEADLINE_SOON_MS);
        const due = await this.packages.listOpenDueBy(soon);
        const moduleOn = new Map<WorkspaceId, boolean>();
        const reminders: PackageOutcome['reminders'] = [];
        let settled = 0;
        for (const candidate of due) {
            const ws = candidate.buyerWorkspaceId;
            if (!moduleOn.has(ws)) moduleOn.set(ws, await this.flags.isEnabled(ws, MODULE));
            if (moduleOn.get(ws) !== true) continue;
            const outcome = await this.uow.run(() => this.sweepPackage(candidate.id, now, soon));
            if (outcome.settled) settled += 1;
            reminders.push(...outcome.reminders);
        }
        for (const r of reminders) await this.notices.deadlineSoon(r.pkg, r.invitation);
        return { reminded: reminders.length, settled };
    }

    /** Inside the package's transaction: lock, re-check (still open, still due), then write. */
    private async sweepPackage(id: PackageId, now: Date, soon: Date): Promise<PackageOutcome> {
        const pkg = await this.packages.lockById(id);
        if (pkg?.status !== 'open' || pkg.props.bidDeadline.getTime() > soon.getTime()) return NOTHING;
        const invitations = await this.invitations.lockByPackage(pkg.id);
        if (pkg.settle(now, hasSubmitted(invitations))) {
            if (!(await this.packages.updateIfStatus(pkg, 'open'))) return NOTHING;
            await this.activity.record({
                buyerWorkspaceId: pkg.buyerWorkspaceId, entity: 'package', entityId: pkg.id, action: `package.${pkg.status}`,
                actorUserId: null, data: { from: 'open', to: pkg.status }, at: now,
            });
            return { settled: true, reminders: [] };
        }
        const reminders: PackageOutcome['reminders'] = [];
        for (const inv of invitations) {
            const waiting = inv.status === 'sent' || inv.status === 'viewed';
            if (!waiting || inv.props.deadlineSoonAt !== null) continue;
            inv.markReminded(now);
            await this.invitations.update(inv);
            reminders.push({ pkg, invitation: inv });
        }
        return { settled: false, reminders };
    }
}
