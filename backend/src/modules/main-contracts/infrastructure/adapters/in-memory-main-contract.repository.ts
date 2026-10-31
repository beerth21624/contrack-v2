import type { ProjectId, WorkspaceId } from '../../../../shared/domain/ids';
import {
    type GuaranteeRecord, MainContractRepository, type MainContractRecord, type MilestoneRecord,
} from '../../application/ports/main-contract.repository';

const clone = <T>(v: T): T => structuredClone(v);
const effective = (c: MainContractRecord): boolean => c.status !== 'cancelled' && c.status !== 'terminated';

/** Memory adapter (tests / trying without a database); mimics the unique keys of `mc_*`. */
export class InMemoryMainContractRepository extends MainContractRepository {
    private readonly contracts = new Map<string, MainContractRecord>();
    private readonly milestones = new Map<string, MilestoneRecord>();
    private readonly guarantees = new Map<string, GuaranteeRecord>();

    findContract(contractId: string): Promise<MainContractRecord | undefined> {
        const c = this.contracts.get(contractId);
        return Promise.resolve(c === undefined ? undefined : clone(c));
    }

    lockContract(workspaceId: WorkspaceId, contractId: string): Promise<MainContractRecord | undefined> {
        const c = this.contracts.get(contractId);
        return Promise.resolve(c?.workspaceId === workspaceId ? clone(c) : undefined);
    }

    effectiveForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractRecord | undefined> {
        const c = [...this.contracts.values()].find(o => o.workspaceId === workspaceId && o.projectId === projectId && effective(o));
        return Promise.resolve(c === undefined ? undefined : clone(c));
    }

    effectiveForProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<MainContractRecord[]> {
        const ids = new Set<string>(projectIds);
        return Promise.resolve([...this.contracts.values()]
            .filter(c => c.workspaceId === workspaceId && ids.has(c.projectId) && effective(c)).map(clone));
    }

    listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractRecord[]> {
        return Promise.resolve([...this.contracts.values()]
            .filter(c => c.workspaceId === workspaceId && c.projectId === projectId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(clone));
    }

    insertContract(c: MainContractRecord): Promise<void> {
        const clash = [...this.contracts.values()].some(o => o.id === c.id
            || (o.projectId === c.projectId && effective(o) && effective(c))
            || (c.number !== null && o.workspaceId === c.workspaceId && o.number === c.number));
        if (clash) return Promise.reject(new Error(`duplicate main contract ${c.id} (project ${c.projectId})`));
        this.contracts.set(c.id, clone(c));
        return Promise.resolve();
    }

    saveContract(c: MainContractRecord): Promise<void> {
        if (this.contracts.get(c.id)?.workspaceId === c.workspaceId) this.contracts.set(c.id, clone(c));
        return Promise.resolve();
    }

    milestonesOf(workspaceId: WorkspaceId, contractIds: readonly string[]): Promise<MilestoneRecord[]> {
        const ids = new Set(contractIds);
        return Promise.resolve([...this.milestones.values()]
            .filter(m => m.workspaceId === workspaceId && ids.has(m.contractId))
            .sort((a, b) => a.contractId.localeCompare(b.contractId) || a.no - b.no)
            .map(clone));
    }

    findMilestone(milestoneId: string): Promise<MilestoneRecord | undefined> {
        const m = this.milestones.get(milestoneId);
        return Promise.resolve(m === undefined ? undefined : clone(m));
    }

    replaceMilestones(workspaceId: WorkspaceId, contractId: string, milestones: readonly MilestoneRecord[]): Promise<void> {
        for (const m of [...this.milestones.values()]) {
            if (m.workspaceId === workspaceId && m.contractId === contractId) this.milestones.delete(m.id);
        }
        for (const m of milestones) this.milestones.set(m.id, clone(m));
        return Promise.resolve();
    }

    insertMilestone(m: MilestoneRecord): Promise<void> {
        const clash = [...this.milestones.values()].some(o => o.id === m.id || (o.contractId === m.contractId && o.no === m.no));
        if (clash) return Promise.reject(new Error(`duplicate milestone ${m.id} (contract ${m.contractId}, no ${m.no})`));
        this.milestones.set(m.id, clone(m));
        return Promise.resolve();
    }

    saveMilestone(m: MilestoneRecord): Promise<void> {
        if (this.milestones.get(m.id)?.workspaceId === m.workspaceId) this.milestones.set(m.id, clone(m));
        return Promise.resolve();
    }

    guaranteesOf(workspaceId: WorkspaceId, contractId: string): Promise<GuaranteeRecord[]> {
        return Promise.resolve([...this.guarantees.values()]
            .filter(g => g.workspaceId === workspaceId && g.contractId === contractId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(clone));
    }

    findGuarantee(guaranteeId: string): Promise<GuaranteeRecord | undefined> {
        const g = this.guarantees.get(guaranteeId);
        return Promise.resolve(g === undefined ? undefined : clone(g));
    }

    insertGuarantee(g: GuaranteeRecord): Promise<void> {
        if (this.guarantees.has(g.id)) return Promise.reject(new Error(`duplicate guarantee ${g.id}`));
        this.guarantees.set(g.id, clone(g));
        return Promise.resolve();
    }

    saveGuarantee(g: GuaranteeRecord): Promise<void> {
        if (this.guarantees.get(g.id)?.workspaceId === g.workspaceId) this.guarantees.set(g.id, clone(g));
        return Promise.resolve();
    }

    guaranteesExpiring(from: string, until: string, limit: number): Promise<GuaranteeRecord[]> {
        return Promise.resolve([...this.guarantees.values()]
            .filter(g => g.status === 'active' && g.expiryDate !== null && g.expiryDate >= from && g.expiryDate <= until)
            .slice(0, limit)
            .map(clone));
    }

    deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void> {
        for (const map of [this.guarantees, this.milestones] as Map<string, { workspaceId: WorkspaceId; projectId: ProjectId }>[]) {
            for (const [id, row] of [...map.entries()]) if (row.workspaceId === workspaceId && row.projectId === projectId) map.delete(id);
        }
        for (const c of [...this.contracts.values()]) {
            if (c.workspaceId === workspaceId && c.projectId === projectId) this.contracts.delete(c.id);
        }
        return Promise.resolve();
    }
}
