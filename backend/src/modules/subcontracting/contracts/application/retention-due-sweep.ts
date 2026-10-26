// ─── Background sweep: sc.retention_due to both sides 7 days before a planned retention release (once per release) ───
// Runs every few hours (not under NODE_ENV=test, not when the platform does not offer the module; tests call runOnce).
// Only completed contracts have release dates. Each contract is locked and read again before it is written, so a
// contract closed (or a release recorded) meanwhile is never written back from a stale read; notices go after commit.
import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Clock, ModuleFlags, UnitOfWork } from '../../../../shared/application/ports';
import { AppConfig } from '../../../../shared/infrastructure/config/env';
import { MODULE } from '../../shared/sc-access';
import type { Subcontract } from '../domain/entities/subcontract.entity';
import { ContractNotices } from './contract-notices';
import { retentionOf } from './contract-state';
import { RetentionRepository } from './ports/retention.repository';
import { SubcontractRepository } from './ports/subcontract.repository';
import { formatBaht, formatThaiShortDate, bangkokDate } from './thai-format';

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETENTION_REMINDER_DAYS = 7;
const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;
const FIRST_SWEEP_AFTER_MS = 60 * 1000;

interface DueRelease {
    amount: number;
    dueAt: string;
}

@Injectable()
export class RetentionDueSweep implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger('RetentionDueSweep');
    private timers: NodeJS.Timeout[] = [];

    constructor(
        private readonly subcontracts: SubcontractRepository,
        private readonly retention: RetentionRepository,
        private readonly flags: ModuleFlags,
        private readonly notices: ContractNotices,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
        private readonly config: AppConfig,
    ) {}

    /** Whether onModuleInit starts the timers (exposed for specs). */
    get started(): boolean {
        return this.timers.length > 0;
    }

    onModuleInit(): void {
        if (this.config.env.NODE_ENV === 'test') return;
        if (!this.flags.platformEnabled(MODULE)) return;
        const run = (): void => {
            this.runOnce().catch((e: unknown) => { this.logger.error(e instanceof Error ? e.stack ?? e.message : String(e)); });
        };
        const first = setTimeout(run, FIRST_SWEEP_AFTER_MS);
        const every = setInterval(run, SWEEP_EVERY_MS);
        first.unref();
        every.unref();
        this.timers = [first, every];
    }

    onModuleDestroy(): void {
        for (const t of this.timers) clearTimeout(t);
        this.timers = [];
    }

    /** Sends the reminders that are due now; returns how many releases were reminded. */
    async runOnce(): Promise<number> {
        if (!this.flags.platformEnabled(MODULE)) return 0;
        const today = bangkokDate(this.clock.now());
        let sent = 0;
        for (const candidate of await this.subcontracts.listByStatuses(['completed'])) {
            if (!(await this.flags.isEnabled(candidate.buyerWorkspaceId, MODULE))) continue;
            const due = await this.uow.run(() => this.markDue(candidate, today));
            if (due === null) continue;
            for (const release of due.releases) {
                const payload = { title: due.sc.title, amount: formatBaht(release.amount), dueAt: formatThaiShortDate(release.dueAt) };
                await this.notices.toBuyer(due.sc, 'sc.retention_due', payload);
                await this.notices.toVendor(due.sc, 'sc.retention_due', payload);
                sent += 1;
            }
        }
        return sent;
    }

    /** Inside the transaction: lock, re-check the status, mark the releases due today as reminded. */
    private async markDue(candidate: Subcontract, today: string): Promise<{ sc: Subcontract; releases: DueRelease[] } | null> {
        const sc = await this.subcontracts.lockForUpdate(candidate.id);
        if (sc?.status !== 'completed') return null;
        const summary = retentionOf(sc, await this.retention.listBySubcontracts([sc.id]));
        const releases: DueRelease[] = [];
        for (const release of summary.schedule) {
            if (release.dueAt === null) continue;
            const key = `${release.dueAt}|${release.label}`;
            if (sc.retentionReminders.includes(key)) continue;
            const remindFrom = new Date(Date.parse(`${release.dueAt}T00:00:00Z`) - RETENTION_REMINDER_DAYS * DAY_MS).toISOString().slice(0, 10);
            if (today < remindFrom) continue;
            sc.markRetentionReminded(key);
            releases.push({ amount: release.amount, dueAt: release.dueAt });
        }
        if (releases.length === 0) return null;
        await this.subcontracts.update(sc);
        return { sc, releases };
    }
}
