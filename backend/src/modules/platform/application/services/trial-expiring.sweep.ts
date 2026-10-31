// ─── Daily sweep `platform.trial-expiring`: `trial.expiring` to the members who manage modules, 3 days before a trial ends ───
// Once per (workspace, module) per Bangkok day (SweepMarks). Modules the platform does not release are skipped.
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { DailySweeps, Notifier, type SweepContext, SweepMarks, WorkspaceDirectory } from '../../../../shared/application/ports';
import { can } from '../../../../shared/domain/permissions';
import { WorkspaceEntitlementRepository } from '../ports/workspace-entitlement.repository';
import { WorkspaceModuleStates } from './workspace-module-states';

export const TRIAL_EXPIRING_SWEEP = 'platform.trial-expiring';
export const TRIAL_REMINDER_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class TrialExpiringSweep implements OnModuleInit {
    constructor(
        private readonly sweeps: DailySweeps,
        private readonly entitlements: WorkspaceEntitlementRepository,
        private readonly states: WorkspaceModuleStates,
        private readonly directory: WorkspaceDirectory,
        private readonly marks: SweepMarks,
        private readonly notifier: Notifier,
    ) {}

    onModuleInit(): void {
        this.sweeps.register(TRIAL_EXPIRING_SWEEP, ctx => this.run(ctx).then(() => undefined));
    }

    /** Sends the notices due now; returns how many trials were reminded. */
    async run({ now, today }: SweepContext): Promise<number> {
        let sent = 0;
        const trials = await this.entitlements.listTrialsExpiring(now, new Date(now.getTime() + TRIAL_REMINDER_DAYS * DAY_MS));
        for (const trial of trials) {
            if (!this.states.isReleased(trial.module) || trial.expiresAt === null) continue;
            const managers = (await this.directory.members(trial.workspaceId)).filter(m => can(m.role, 'modules.manage')).map(m => m.userId);
            if (managers.length === 0) continue;
            if (!(await this.marks.markOnce(TRIAL_EXPIRING_SWEEP, `${trial.workspaceId}:${trial.module}`, today))) continue;
            // The last day the trial still counts (expiry instant minus 1 ms, Bangkok date).
            const lastDay = bangkokToday(new Date(trial.expiresAt.getTime() - 1));
            await this.notifier.notify({
                template: 'trial.expiring',
                toUserIds: managers,
                payload: { module: trial.module, date: lastDay, href: '/workspace/modules' },
            });
            sent += 1;
        }
        return sent;
    }
}
