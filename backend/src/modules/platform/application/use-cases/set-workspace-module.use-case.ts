import { Injectable } from '@nestjs/common';
import { type ModuleId, type ModuleOffBlockers, dependencyClosure, dependentsOf } from '@contrack/contract';
import { Clock, ModuleWorkRegistry, UnitOfWork, WorkspaceAccess } from '../../../../shared/application/ports';
import { DomainError } from '../../../../shared/domain/domain-error';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { can } from '../../../../shared/domain/permissions';
import { type Result, err, ok } from '../../../../shared/domain/result';
import { WorkspaceModule } from '../../domain/entities/workspace-module.entity';
import { isActive, isEntitled } from '../../domain/module-activation';
import { WorkspaceModuleRepository } from '../ports/workspace-module.repository';
import { WorkspaceModuleStates } from '../services/workspace-module-states';
import { workspaceModuleViews } from './list-workspace-modules.use-case';
import type { WorkspaceModuleView } from './workspace-module.view';

export interface SetWorkspaceModuleInput {
    actorId: UserId;
    workspaceId: WorkspaceId;
    module: ModuleId;
    enabled: boolean;
    /** Needed to switch off while modules that depend on it are on, or while it still has running work. */
    confirm?: boolean;
}

/**
 * Owner / admin (`modules.manage`) switch a module on or off. Only modules the platform offers (else 422).
 * On: the workspace must be entitled (else 422 `not_entitled`) and every dependency active (else 422
 * `missing_dependencies` with `missing`). Off: while switched-on modules depend on it, or it (or they) still have
 * running work, `confirm` is needed (else 409 `has_dependents` with `dependents` and `work`); confirmed, the dependents
 * are switched off too. Switching off keeps every row of the modules: their routes answer module_disabled and their
 * UI disappears until they are switched on again.
 */
@Injectable()
export class SetWorkspaceModuleUseCase {
    constructor(
        private readonly access: WorkspaceAccess,
        private readonly states: WorkspaceModuleStates,
        private readonly modules: WorkspaceModuleRepository,
        private readonly work: ModuleWorkRegistry,
        private readonly uow: UnitOfWork,
        private readonly clock: Clock,
    ) {}

    async execute(input: SetWorkspaceModuleInput): Promise<Result<WorkspaceModuleView, DomainError>> {
        const role = await this.access.roleOf(input.actorId, input.workspaceId);
        if (role === undefined) return err(DomainError.notFound('Workspace'));
        if (!can(role, 'modules.manage')) return err(DomainError.forbidden());
        if (!this.states.isReleased(input.module)) {
            return err(DomainError.unprocessable('This module is not offered on this server', { module: input.module }));
        }
        const result = await this.uow.run(() => this.apply(input));
        if (result.ok) this.states.invalidate(input.workspaceId);
        return result;
    }

    private async apply(input: SetWorkspaceModuleInput): Promise<Result<WorkspaceModuleView, DomainError>> {
        const ws = input.workspaceId;
        const rows = await this.states.load(ws);
        const entry = rows.switches.get(input.module) ?? WorkspaceModule.initial(ws, input.module);
        const now = this.clock.now();

        if (input.enabled && !entry.enabled) {
            const inputs = this.states.inputsOf(rows);
            if (!isEntitled(inputs, input.module)) {
                return err(DomainError.unprocessable('This workspace is not entitled to the module', { reason: 'not_entitled', module: input.module }));
            }
            const missing = dependencyClosure(input.module).filter(d => !isActive(inputs, d));
            if (missing.length > 0) {
                return err(DomainError.unprocessable('Switch on the modules it depends on first', { reason: 'missing_dependencies', missing }));
            }
            entry.switch(true, input.actorId, now);
            await this.modules.save(entry);
            rows.switches.set(input.module, entry);
        } else if (!input.enabled && entry.enabled) {
            const dependents = dependentsOf(input.module).filter(d => rows.switches.get(d)?.enabled === true);
            if (input.confirm !== true) {
                const work = await this.workOf(ws, [input.module, ...dependents]);
                if (dependents.length > 0 || Object.values(work).some(n => n > 0)) {
                    const details: ModuleOffBlockers = { reason: 'has_dependents', dependents, work };
                    if (work.activeSubcontracts !== undefined) details.activeSubcontracts = work.activeSubcontracts;
                    return err(DomainError.conflict('Modules depend on it or it still has running work; confirm to switch them off', details));
                }
            }
            for (const module of [input.module, ...dependents]) {
                const row = rows.switches.get(module) ?? WorkspaceModule.initial(ws, module);
                row.switch(false, input.actorId, now);
                await this.modules.save(row);
                rows.switches.set(module, row);
            }
        }
        const view = workspaceModuleViews(this.states, ws, rows).find(v => v.module === input.module);
        if (view === undefined) throw new Error(`unknown module ${input.module}`);
        return ok(view);
    }

    /** Running work of the modules, counts of the same name added. */
    private async workOf(workspaceId: WorkspaceId, modules: readonly ModuleId[]): Promise<Record<string, number>> {
        const out: Record<string, number> = {};
        for (const module of modules) {
            for (const [name, n] of Object.entries(await this.work.workOf(workspaceId, module))) out[name] = (out[name] ?? 0) + n;
        }
        return out;
    }
}
