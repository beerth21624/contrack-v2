// ─── Lists: subcontracts of a project (buyer), of a crew (vendor), retention held across a buyer workspace ───
import { Injectable } from '@nestjs/common';
import type { SubcontractSummaryDto, WorkspaceRetentionRow } from '@contrack/contract';
import { type DomainError, type ProjectId, type Result, type UserId, type WorkspaceId, ok } from '../../../../../shared/domain';
import { ScAccess } from '../../../shared/sc-access';
import { retentionOf } from '../contract-state';
import { ContractViews } from '../contract-views';
import { RetentionRepository } from '../ports/retention.repository';
import { SubcontractRepository } from '../ports/subcontract.repository';

@Injectable()
export class ListProjectSubcontractsUseCase {
    constructor(private readonly access: ScAccess, private readonly subcontracts: SubcontractRepository, private readonly views: ContractViews) {}

    async execute(input: { userId: UserId; projectId: ProjectId }): Promise<Result<SubcontractSummaryDto[], DomainError>> {
        const granted = await this.access.buyerProject(input.userId, input.projectId, ['sc.read']);
        if (!granted.ok) return granted;
        const { workspaceId, role } = granted.value;
        const seesPrices = await this.access.allowed(role, 'sc.readPrices', workspaceId);
        return ok(await this.views.summaries(await this.subcontracts.listByProject(workspaceId, input.projectId), { side: 'buyer', seesPrices }));
    }
}

@Injectable()
export class ListVendorSubcontractsUseCase {
    constructor(private readonly access: ScAccess, private readonly subcontracts: SubcontractRepository, private readonly views: ContractViews) {}

    /** Contracts of the crew workspace (read-only ones of buyers that switched the module off included). */
    async execute(input: { userId: UserId; workspaceId: WorkspaceId }): Promise<Result<SubcontractSummaryDto[], DomainError>> {
        const role = await this.access.vendor(input.userId, input.workspaceId, ['vendor.read']);
        if (!role.ok) return role;
        return ok(await this.views.summaries(await this.subcontracts.listByVendor(input.workspaceId), { side: 'vendor', seesPrices: true }));
    }
}

@Injectable()
export class ListWorkspaceRetentionUseCase {
    constructor(private readonly access: ScAccess, private readonly subcontracts: SubcontractRepository, private readonly retention: RetentionRepository) {}

    /** Every contract of the workspace still holding retention, soonest planned release first. */
    async execute(input: { userId: UserId; workspaceId: WorkspaceId }): Promise<Result<WorkspaceRetentionRow[], DomainError>> {
        const role = await this.access.buyer(input.userId, input.workspaceId, ['sc.read']);
        if (!role.ok) return role;
        const seesPrices = await this.access.allowed(role.value, 'sc.readPrices', input.workspaceId);
        const list = await this.subcontracts.listByBuyer(input.workspaceId);
        const entries = await this.retention.listBySubcontracts(list.map(s => s.id));
        const rows: WorkspaceRetentionRow[] = [];
        for (const sc of list) {
            const summary = retentionOf(sc, entries.filter(e => e.subcontractId === sc.id));
            if (summary.balance <= 0) continue;
            const due = summary.schedule.map(s => s.dueAt).filter((d): d is string => d !== null).sort();
            rows.push({
                subcontractId: sc.id, contractNo: sc.state.contractNo, projectName: sc.state.projectName, vendorName: sc.vendorName,
                balance: seesPrices ? summary.balance : 0, nextDueAt: due[0] ?? null, status: sc.status,
            });
        }
        return ok(rows.sort((a, b) => (a.nextDueAt ?? '9999').localeCompare(b.nextDueAt ?? '9999')));
    }
}
