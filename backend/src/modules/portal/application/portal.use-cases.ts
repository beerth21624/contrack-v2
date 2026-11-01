import { Injectable } from '@nestjs/common';
import {
    MODULE_REGISTRY, type ModuleId, type ModuleTile, PORTAL_TASK_LIMIT, type PortalDto, type PortalTask, type QuickAction,
    type QuickActionId, RISK_REASONS, type RiskReason, type RiskyProject, type Role, SEARCH_HIT_TYPES, SEARCH_SOURCE_LIMIT, SEARCH_TOTAL_LIMIT,
    type SearchHit,
} from '@contrack/contract';
import { bangkokToday } from '@contrack/domain/dates/business-date';
import { sumMoney } from '@contrack/domain/money';
import { ModuleAccess } from '../../../shared/application/module-access';
import {
    Clock, HubRollups, ModuleFlags, ModuleStatesLookup, PortalCashOutlook, type PortalContext, PortalSources, ProjectCatalog, SearchSources,
} from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import { type ProjectId, type UserId, type WorkspaceId, asProjectId } from '../../../shared/domain/ids';
import { type Permission, can } from '../../../shared/domain/permissions';
import { type Result, ok } from '../../../shared/domain/result';

export const MODULE: ModuleId = 'portal';

/** Quick actions: shown when the module is active and the role holds the permission (in this order). */
const QUICK_ACTIONS: readonly { id: QuickActionId; module: ModuleId; permission: Permission; href: string }[] = [
    { id: 'new_project', module: 'project-hub', permission: 'projects.create', href: '/hub' },
    { id: 'create_quotation', module: 'quotations', permission: 'quotations.manage', href: '/hub' },
    { id: 'create_claim', module: 'billing', permission: 'billing.manage', href: '/hub' },
    { id: 'record_receipt', module: 'billing', permission: 'billing.receive', href: '/receivables' },
    { id: 'create_variation', module: 'variations', permission: 'variations.manage', href: '/hub' },
    { id: 'add_customer', module: 'project-hub', permission: 'customers.manage', href: '/customers' },
    { id: 'open_approvals', module: 'project-hub', permission: 'workspace.read', href: '/approvals' },
];

const RISK_ALERTS = new Set<string>(RISK_REASONS);

/** `isEnabled` once per module per request. */
function flagCache(flags: ModuleFlags, workspaceId: WorkspaceId): (m: ModuleId) => Promise<boolean> {
    const seen = new Map<ModuleId, Promise<boolean>>();
    return m => {
        let hit = seen.get(m);
        if (hit === undefined) {
            hit = flags.isEnabled(workspaceId, m);
            seen.set(m, hit);
        }
        return hit;
    };
}

/** Due date ascending, tasks without one last; then the larger amount first. */
function byDue(a: PortalTask, b: PortalTask): number {
    if (a.dueDate !== b.dueDate) {
        if (a.dueDate === null) return 1;
        if (b.dueDate === null) return -1;
        return a.dueDate < b.dueDate ? -1 : 1;
    }
    return (b.amount ?? 0) - (a.amount ?? 0);
}

/**
 * GET /workspaces/:workspaceId/portal — any member (`workspace.read`) while `portal` is active. Sources of modules that
 * are not active, or whose permission the role lacks, are not called.
 */
@Injectable()
export class GetPortalUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly flags: ModuleFlags,
        private readonly states: ModuleStatesLookup,
        private readonly catalog: ProjectCatalog,
        private readonly portalSources: PortalSources,
        private readonly rollups: HubRollups,
        private readonly outlook: PortalCashOutlook,
        private readonly clock: Clock,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId): Promise<Result<PortalDto, DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'workspace.read');
        if (!grant.ok) return grant;
        const { role } = grant.value;
        const now = this.clock.now();
        const isActive = flagCache(this.flags, workspaceId);
        const projects = await this.catalog.list(workspaceId, { archived: false });
        const names = new Map<ProjectId, string>(projects.map(p => [asProjectId(p.id), p.name]));
        const ctx: PortalContext = { workspaceId, userId, role, today: bangkokToday(now), projects: names };

        const tasks: PortalTask[] = [];
        for (const { module, permission, source } of this.portalSources.sources()) {
            if (permission !== null && !can(role, permission)) continue;
            if (!(await isActive(module))) continue;
            for (const t of await source(ctx)) {
                const projectName = t.projectId === null ? null : names.get(t.projectId);
                if (projectName === undefined) continue;
                tasks.push({ ...t, projectName });
            }
        }
        tasks.sort(byDue);

        const states = await this.states.forWorkspace(workspaceId);
        const tiles: ModuleTile[] = states
            .filter(s => MODULE_REGISTRY[s.module].kind === 'erp')
            .map(s => ({
                module: s.module,
                available: s.available,
                active: s.active,
                entitlement: { status: s.entitlementStatus, expiresAt: s.entitlementExpiresAt?.toISOString() ?? null },
                trialAvailable: s.trialAvailable,
            }));
        const activeModules = new Set(states.filter(s => s.active).map(s => s.module));
        const quickActions: QuickAction[] = QUICK_ACTIONS
            .filter(a => activeModules.has(a.module) && can(role, a.permission))
            .map(({ id, module, href }) => ({ id, module, href }));
        if (can(role, 'modules.manage') && tiles.some(t => t.available && !t.active && t.trialAvailable)) {
            quickActions.push({ id: 'start_trial', module: MODULE, href: '/workspace/modules' });
        }

        return ok({
            tasks: tasks.slice(0, PORTAL_TASK_LIMIT),
            riskyProjects: await this.riskyProjects(workspaceId, role, names, isActive),
            cashOutlook: await this.cashOutlook(workspaceId, role, now, isActive),
            tiles,
            quickActions,
            generatedAt: now.toISOString(),
        });
    }

    /** The registered outlook (job-cost) when its module is active and the role holds its permission, else null. */
    private async cashOutlook(
        workspaceId: WorkspaceId, role: Role, now: Date, isActive: (m: ModuleId) => Promise<boolean>,
    ): Promise<PortalDto['cashOutlook']> {
        const entry = this.outlook.get();
        if (entry === null || !can(role, entry.permission) || !(await isActive(entry.module))) return null;
        return entry.source(workspaceId, now);
    }

    /**
     * From the hub roll-ups of the active modules: `overdueReceivable > 0` (only for roles that read billing) and the
     * alerts that are risk reasons (job-cost registers `cost_overrun` / `negative_cash`).
     */
    private async riskyProjects(
        workspaceId: WorkspaceId, role: Role, names: ReadonlyMap<ProjectId, string>,
        isActive: (m: ModuleId) => Promise<boolean>,
    ): Promise<RiskyProject[]> {
        if (!can(role, 'projects.read') || names.size === 0) return [];
        const seeMoney = can(role, 'billing.read');
        const ids = [...names.keys()];
        const overdue = new Map<ProjectId, number[]>();
        const reasons = new Map<ProjectId, Set<RiskReason>>();
        const addReason = (id: ProjectId, r: RiskReason): void => {
            const set = reasons.get(id) ?? new Set<RiskReason>();
            set.add(r);
            reasons.set(id, set);
        };
        for (const { module, source } of this.rollups.sources()) {
            if (!(await isActive(module))) continue;
            for (const [id, figures] of await source(workspaceId, ids)) {
                if (!names.has(id)) continue;
                if (seeMoney && figures.overdueReceivable !== undefined && figures.overdueReceivable !== null && figures.overdueReceivable > 0) {
                    overdue.set(id, [...(overdue.get(id) ?? []), figures.overdueReceivable]);
                    addReason(id, 'overdue_receivable');
                }
                for (const a of figures.alerts ?? []) if (RISK_ALERTS.has(a)) addReason(id, a as RiskReason);
            }
        }
        const out: RiskyProject[] = [];
        for (const [id, set] of reasons) {
            const amounts = overdue.get(id);
            out.push({
                projectId: id,
                projectName: names.get(id) ?? '',
                reasons: RISK_REASONS.filter(r => set.has(r)),
                overdueReceivable: amounts === undefined ? null : sumMoney(amounts),
            });
        }
        return out.sort((a, b) => b.reasons.length - a.reasons.length || (b.overdueReceivable ?? 0) - (a.overdueReceivable ?? 0));
    }
}

/** GET /workspaces/:workspaceId/search?q= — any member while `portal` is active; same source rules as the portal. */
@Injectable()
export class GlobalSearchUseCase {
    constructor(
        private readonly access: ModuleAccess,
        private readonly flags: ModuleFlags,
        private readonly searchSources: SearchSources,
    ) {}

    async execute(userId: UserId, workspaceId: WorkspaceId, q: string): Promise<Result<SearchHit[], DomainError>> {
        const grant = await this.access.inWorkspace(userId, workspaceId, MODULE, 'workspace.read');
        if (!grant.ok) return grant;
        const { role } = grant.value;
        const isActive = flagCache(this.flags, workspaceId);
        const hits: SearchHit[] = [];
        for (const { module, permission, source } of this.searchSources.sources()) {
            if (hits.length >= SEARCH_TOTAL_LIMIT) break;
            if (permission !== null && !can(role, permission)) continue;
            if (!(await isActive(module))) continue;
            const found = await source({ workspaceId, userId, role, q: q.trim(), limit: SEARCH_SOURCE_LIMIT });
            hits.push(...found.slice(0, SEARCH_SOURCE_LIMIT));
        }
        // Stable: projects, customers, suppliers, then documents (each source's own order kept).
        hits.sort((a, b) => SEARCH_HIT_TYPES.indexOf(a.type) - SEARCH_HIT_TYPES.indexOf(b.type));
        return ok(hits.slice(0, SEARCH_TOTAL_LIMIT));
    }
}
