// ─── Authorization of every subcontracting use case (one place, so no use case can forget a rule) ───
// Buyer side: member of the buyer workspace → module switched on for it → permission (some widened by settings).
// Vendor side: member of the vendor workspace → platform offers the module → permission. Vendor WRITES on a buyer's
// package / contract also need the buyer's module on (when the buyer switched it off, the vendor can still read
// running contracts, plan §1 / README §1).
// Not a member → not_found (never reveal another tenant's data). Module off → module_disabled. No permission → forbidden.
import { Injectable } from '@nestjs/common';
import type { Role } from '@contrack/contract';
import { ModuleFlags, ProjectDirectory, WorkspaceAccess } from '../../../shared/application/ports';
import { DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, err, ok, okVoid } from '../../../shared/domain';
import { can, type Permission } from '../../../shared/domain/permissions';
import { SubcontractingSettingsReader } from './ports';

export const MODULE = 'subcontracting' as const;

export function moduleDisabled(): DomainError {
    return new DomainError('module_disabled', 'The subcontracting module is switched off');
}

@Injectable()
export class ScAccess {
    constructor(
        private readonly workspaces: WorkspaceAccess,
        private readonly flags: ModuleFlags,
        private readonly projects: ProjectDirectory,
        private readonly settings: SubcontractingSettingsReader,
    ) {}

    /** The platform offers the module (public / vendor routes). */
    platformOn(): Result<undefined, DomainError> {
        return this.flags.platformEnabled(MODULE) ? okVoid() : err(moduleDisabled());
    }

    /** The buyer workspace has the module on (vendor writes on that buyer's things). */
    async buyerModuleOn(buyerWorkspaceId: WorkspaceId): Promise<Result<undefined, DomainError>> {
        return (await this.flags.isEnabled(buyerWorkspaceId, MODULE)) ? okVoid() : err(moduleDisabled());
    }

    /**
     * The caller's role in the buyer workspace when it has every permission. `what` names the thing in not_found
     * (e.g. 'Package' when the workspace was found through a package id).
     */
    async buyer(userId: UserId, workspaceId: WorkspaceId, permissions: Permission[], what = 'Workspace'): Promise<Result<Role, DomainError>> {
        const role = await this.workspaces.roleOf(userId, workspaceId);
        if (role === undefined) return err(DomainError.notFound(what));
        if (!(await this.flags.isEnabled(workspaceId, MODULE))) return err(moduleDisabled());
        for (const p of permissions) {
            if (!(await this.allowed(role, p, workspaceId))) return err(DomainError.forbidden());
        }
        return ok(role);
    }

    /** Buyer access through a project id (its workspace is the buyer). */
    async buyerProject(userId: UserId, projectId: ProjectId, permissions: Permission[]): Promise<Result<{ workspaceId: WorkspaceId; role: Role }, DomainError>> {
        const workspaceId = await this.projects.workspaceOf(projectId);
        if (workspaceId === undefined) return err(DomainError.notFound('Project'));
        const role = await this.buyer(userId, workspaceId, permissions, 'Project');
        return role.ok ? ok({ workspaceId, role: role.value }) : role;
    }

    /** The caller's role in a vendor workspace (the crew acting) when it has every permission. */
    async vendor(userId: UserId, vendorWorkspaceId: WorkspaceId, permissions: Permission[], what = 'Workspace'): Promise<Result<Role, DomainError>> {
        const role = await this.workspaces.roleOf(userId, vendorWorkspaceId);
        if (role === undefined) return err(DomainError.notFound(what));
        const on = this.platformOn();
        if (!on.ok) return on;
        if (!permissions.every(p => can(role, p))) return err(DomainError.forbidden());
        return ok(role);
    }

    /** Whether `role` may do `permission` in the buyer workspace, counting the workspace settings that widen it. */
    async allowed(role: Role, permission: Permission, workspaceId: WorkspaceId): Promise<boolean> {
        if (can(role, permission)) return true;
        if (permission !== 'sc.award' && permission !== 'sc.claims.approve' && permission !== 'sc.readPrices') return false;
        const s = await this.settings.get(workspaceId);
        if (role === 'estimator' && permission === 'sc.award') return s.estimatorCanAward;
        if (role === 'estimator' && permission === 'sc.claims.approve') return s.estimatorCanApproveClaims;
        if (role === 'viewer' && permission === 'sc.readPrices') return s.viewerSeesPrices;
        return false;
    }
}
