import type { SubcontractStatus } from '@contrack/contract';
import type { ProjectId, WorkspaceId } from '../../../../../shared/domain';
import type { PackageId, ScInvitationId, SubcontractId } from '../../../shared/ids';
import { SubcontractRepository } from '../../application/ports/subcontract.repository';
import { Subcontract, type SubcontractProps } from '../../domain/entities/subcontract.entity';

export class InMemorySubcontractRepository extends SubcontractRepository {
    private readonly rows = new Map<SubcontractId, SubcontractProps>();
    private readonly counters = new Map<string, number>();

    private list(filter: (p: SubcontractProps) => boolean): Promise<Subcontract[]> {
        return Promise.resolve([...this.rows.values()].filter(filter)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(p => Subcontract.rehydrate(p)));
    }

    insert(subcontract: Subcontract): Promise<void> {
        const p = subcontract.toProps();
        const clash = [...this.rows.values()].some(r => r.buyerWorkspaceId === p.buyerWorkspaceId && r.contractNo === p.contractNo);
        if (this.rows.has(p.id) || clash) throw new Error(`subcontract ${p.id} / ${p.contractNo} already exists`);
        this.rows.set(p.id, p);
        return Promise.resolve();
    }

    update(subcontract: Subcontract): Promise<void> {
        if (!this.rows.has(subcontract.id)) throw new Error(`subcontract ${subcontract.id} not found`);
        this.rows.set(subcontract.id, subcontract.toProps());
        return Promise.resolve();
    }

    findById(id: SubcontractId): Promise<Subcontract | undefined> {
        const p = this.rows.get(id);
        return Promise.resolve(p === undefined ? undefined : Subcontract.rehydrate(p));
    }

    /** No row lock in memory: returns the row as it is now (specs check that use cases call this before writing). */
    lockForUpdate(id: SubcontractId): Promise<Subcontract | undefined> {
        return this.findById(id);
    }

    async lockByPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Subcontract[]> {
        return (await this.listByPackage(buyerWorkspaceId, packageId)).sort((a, b) => a.id.localeCompare(b.id));
    }

    listByProject(buyerWorkspaceId: WorkspaceId, projectId: ProjectId): Promise<Subcontract[]> {
        return this.list(p => p.buyerWorkspaceId === buyerWorkspaceId && p.projectId === projectId);
    }

    listByBuyer(buyerWorkspaceId: WorkspaceId): Promise<Subcontract[]> {
        return this.list(p => p.buyerWorkspaceId === buyerWorkspaceId);
    }

    listByVendor(vendorWorkspaceId: WorkspaceId): Promise<Subcontract[]> {
        return this.list(p => p.vendorWorkspaceId === vendorWorkspaceId);
    }

    listByPackage(buyerWorkspaceId: WorkspaceId, packageId: PackageId): Promise<Subcontract[]> {
        return this.list(p => p.buyerWorkspaceId === buyerWorkspaceId && p.packageId === packageId);
    }

    listByInvitation(invitationId: ScInvitationId): Promise<Subcontract[]> {
        return this.list(p => p.invitationId === invitationId);
    }

    listByStatuses(statuses: readonly SubcontractStatus[]): Promise<Subcontract[]> {
        return this.list(p => statuses.includes(p.status));
    }

    /** Next number after the counter and after any number already used (contracts inserted directly in specs). */
    nextSeq(buyerWorkspaceId: WorkspaceId, year: number): Promise<number> {
        const key = buyerWorkspaceId + '|' + String(year);
        const used = [...this.rows.values()].filter(p => p.buyerWorkspaceId === buyerWorkspaceId && p.year === year).map(p => p.seq);
        const next = Math.max(this.counters.get(key) ?? 0, ...used) + 1;
        this.counters.set(key, next);
        return Promise.resolve(next);
    }
}
