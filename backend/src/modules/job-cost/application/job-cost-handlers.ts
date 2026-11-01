// ─── Job cost as the platform calls it: the daily `job-cost.alerts` sweep ───
import { Injectable, Logger } from '@nestjs/common';
import { ModuleFlags, ProjectCatalog, WorkspaceDirectory } from '../../../shared/application/ports';
import { asProjectId } from '../../../shared/domain/ids';
import { JobCostEngine, MODULE } from './job-cost.service';

export const ALERTS_SWEEP = 'job-cost.alerts';

/** Most workspaces one sweep visits. */
const WORKSPACE_LIMIT = 10_000;

@Injectable()
export class JobCostHandlers {
    private readonly logger = new Logger(JobCostHandlers.name);

    constructor(
        private readonly engine: JobCostEngine,
        private readonly flags: ModuleFlags,
        private readonly directory: WorkspaceDirectory,
        private readonly catalog: ProjectCatalog,
    ) {}

    /**
     * Every live project of every workspace with job-cost active: subcontracts → ledger, alerts upserted / resolved,
     * `cost.overrun` for the new ones (idempotent, so running every 6 hours notifies each alert once).
     */
    async alertsSweep(): Promise<void> {
        if (!this.flags.platformEnabled(MODULE)) return;
        for (const ws of await this.directory.search('', WORKSPACE_LIMIT)) {
            try {
                if (!(await this.flags.isEnabled(ws.id, MODULE))) continue;
                for (const p of await this.catalog.list(ws.id, { archived: false })) {
                    try {
                        const r = await this.engine.refresh(ws.id, asProjectId(p.id));
                        if (!r.ok) this.logger.warn(`${ALERTS_SWEEP} ${p.id}: ${r.error.message}`);
                    } catch (e) {
                        this.logger.error(`${ALERTS_SWEEP} ${p.id}: ${e instanceof Error ? e.message : String(e)}`);
                    }
                }
            } catch (e) {
                this.logger.error(`${ALERTS_SWEEP} ${ws.id}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }
    }
}
