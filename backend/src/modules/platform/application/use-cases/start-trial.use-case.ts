import { Injectable } from '@nestjs/common';
import { MODULE_IDS, MODULE_REGISTRY, type ModuleId, dependencyClosure } from '@contrack/contract';
import { Clock, UnitOfWork, WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceEntitlement } from '../../domain/entities/workspace-entitlement.entity';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { grantIsLive, isEntitled, trialAvailable } from '../../domain/module-activation';
import { WorkspaceEntitlementRepository } from '../ports/workspace-entitlement.repository';
import { WorkspaceModuleRepository } from '../ports/workspace-module.repository';
import { WorkspaceModuleStates } from '../services/workspace-module-states';
import { workspaceModuleViews } from './list-workspace-modules.use-case';
import type { WorkspaceModuleView } from './workspace-module.view';

export interface StartTrialInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    module: ModuleId;
}

export interface StartTrialResult {
    module: WorkspaceModuleView;
    /** Modules whose trial started now (MODULE_IDS order). */
    started: ModuleId[];
    /** Every module of the workspace after the call (MODULE_IDS order). */
    modules: WorkspaceModuleView[];
}

/**
 * Owner / admin (`modules.manage`) start the one trial (`trialDays`, 30) of a module: entitlement `trial` until
 * now + trialDays, the switch on, and the same for every dependency the workspace is not entitled to yet (dependencies
 * already entitled are only switched on). Refused: a module the server does not offer, or one without a trial → 422;
 * the module's trial already used → 409 `trial_used`; a live grant → 409 `already_entitled`; a revoked grant → 409
 * `entitlement_revoked`; a dependency that is not offered, or not entitled with its own trial used / revoked → 422
 * `missing_dependencies` with `missing`.
 */
@Injectable()
export class StartTrialUseCase {
    constructor(
        private readonly access: WorkspaceAccess,
        private readonly states: WorkspaceModuleStates,
        private readonly modules: WorkspaceModuleRepository,
        private readonly entitlements: WorkspaceEntitlementRepository,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: StartTrialInput): Promise<Result<StartTrialResult, DomainError>> {
        const role = await this.access.roleOf(input.actorId, input.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, 'modules.manage')) return err(DomainError.forbidden());
        if (!this.states.isReleased(input.module)) {
            return err(DomainError.unprocessable('This module is not offered on this server', { module: input.module }));
        }
        if (MODULE_REGISTRY[input.module].trialDays <= 0) {
            return err(DomainError.unprocessable('This module has no trial', { reason: 'no_trial', module: input.module }));
        }
        const result = await this.uow.run(() => this.apply(input));
        if (result.ok) this.states.invalidate(input.workspaceId);
        return result;
    }

    private async apply(input: StartTrialInput): Promise<Result<StartTrialResult, DomainError>> {
        const ws = input.workspaceId;
        const now = this.clock.now();
        const rows = await this.states.load(ws);
        const inputs = this.states.inputsOf(rows);

        const own = rows.grants.get(input.module);
        if (own !== undefined && own.trialUsedAt !== null) return err(DomainError.conflict('The trial of this module was already used', { reason: 'trial_used' }));
        if (own?.status === 'revoked') return err(DomainError.conflict('The entitlement of this module was revoked', { reason: 'entitlement_revoked' }));
        if (grantIsLive(own, now)) return err(DomainError.conflict('The workspace is already entitled to this module', { reason: 'already_entitled' }));

        const closure = dependencyClosure(input.module);
        const trials = new Set<ModuleId>([input.module]);
        const missing: ModuleId[] = [];
        for (const dep of closure) {
            if (!this.states.isReleased(dep)) missing.push(dep);
            else if (isEntitled(inputs, dep)) continue;
            else if (trialAvailable(inputs, dep)) trials.add(dep);
            else missing.push(dep);
        }
        if (missing.length > 0) {
            return err(DomainError.unprocessable('A module it depends on cannot be used', { reason: 'missing_dependencies', missing }));
        }

        const started = MODULE_IDS.filter(m => trials.has(m));
        for (const module of started) {
            const days = MODULE_REGISTRY[module].trialDays;
            const existing = rows.grants.get(module);
            const grant = existing ?? WorkspaceEntitlement.trial(ws, module, days, now);
            if (existing !== undefined) grant.startTrial(days, now);
            await this.entitlements.save(grant);
            rows.grants.set(module, grant);
        }
        for (const module of [...closure, input.module]) {
            const row = rows.switches.get(module) ?? WorkspaceModule.initial(ws, module);
            if (row.enabled) continue;
            row.switch(true, input.actorId, now);
            await this.modules.save(row);
            rows.switches.set(module, row);
        }

        const modules = workspaceModuleViews(this.states, ws, rows);
        const view = modules.find(v => v.module === input.module);
        if (view === undefined) throw new Error(`unknown module ${input.module}`);
        return ok({ module: view, started, modules });
    }
}
