// ─── What the site diary plugs into the core registries (wired in SiteDiaryModule.onModuleInit) ───
// HubRollups('site-diary') progressPct, PortalSources (no report submitted today on a project in progress).
import { Injectable } from '@nestjs/common';
import type { ProjectRollup } from '@contrack/contract';
import { weightedProgress } from '@contrack/domain/site-diary/progress';
import {
    CostCodeLookup, ModuleFlags, type PortalContext, type PortalTaskItem, ProjectLifecycle,
} from '../../../shared/application/ports';
import type { ProjectId, WorkspaceId } from '../../../shared/domain/ids';
import { SiteDiaryRepository } from './ports/site-diary.repository';
import { MODULE } from './site-diary.service';

@Injectable()
export class SiteDiaryHandlers {
    constructor(
        private readonly repo: SiteDiaryRepository,
        private readonly costCodes: CostCodeLookup,
        private readonly lifecycle: ProjectLifecycle,
        private readonly flags: ModuleFlags,
    ) {}

    /**
     * progressPct = Σ budget_total × reported_progress / Σ budget_total over the project's cost codes that are not
     * omitted (reported_progress is what the submitted reports set). Projects without a budget are left out.
     */
    async rollup(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<Map<ProjectId, Partial<ProjectRollup>>> {
        const out = new Map<ProjectId, Partial<ProjectRollup>>();
        if (projectIds.length === 0 || !(await this.flags.isEnabled(workspaceId, MODULE))) return out;
        const byProject = new Map<ProjectId, { progress: Map<string, number>; weights: { costCodeId: string; budget: number }[] }>();
        for (const c of await this.costCodes.listByProjects(workspaceId, projectIds)) {
            if (c.status === 'omitted') continue;
            let p = byProject.get(c.projectId);
            if (p === undefined) {
                p = { progress: new Map(), weights: [] };
                byProject.set(c.projectId, p);
            }
            p.progress.set(c.id, c.reportedProgress);
            p.weights.push({ costCodeId: c.id, budget: c.budgetTotal });
        }
        for (const [projectId, p] of byProject) {
            const pct = weightedProgress(p.progress, p.weights);
            if (pct !== null) out.set(projectId, { progressPct: pct });
        }
        return out;
    }

    /** Projects in progress (hub status `in_progress`) with no submitted report for today. */
    async portalMissingReports(ctx: PortalContext): Promise<PortalTaskItem[]> {
        if (!(await this.flags.isEnabled(ctx.workspaceId, MODULE))) return [];
        const inProgress: ProjectId[] = [];
        for (const projectId of ctx.projects.keys()) {
            if ((await this.lifecycle.hubFields(ctx.workspaceId, projectId))?.status === 'in_progress') inProgress.push(projectId);
        }
        if (inProgress.length === 0) return [];
        const submitted = new Set((await this.repo.listOnDate(ctx.workspaceId, inProgress, ctx.today))
            .filter(r => r.status === 'submitted').map(r => r.projectId as string));
        return inProgress.filter(id => !submitted.has(id)).map(projectId => ({
            kind: 'site_report_missing' as const,
            params: { date: ctx.today },
            href: `/p/${projectId}/site-diary`,
            dueDate: ctx.today,
            amount: null,
            projectId,
        }));
    }
}
