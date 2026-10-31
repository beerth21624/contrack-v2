import type {
    ContractMilestoneKind, ContractMilestoneSource, ContractMilestoneStatus, ContractMilestoneTrigger, GuaranteeForm, GuaranteeKind,
    GuaranteeStatus, MainContractBillingMode, MainContractStatus,
} from '@contrack/contract';
import { and, asc, desc, eq, gte, inArray, lte, notInArray } from 'drizzle-orm';
import { type ProjectId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId } from '../../../../shared/domain/ids';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { mcContracts, mcGuarantees, mcMilestones } from '../../../../shared/infrastructure/database/schema-contracts-billing';
import {
    type GuaranteeRecord, MainContractRepository, type MainContractRecord, type MilestoneRecord,
} from '../../application/ports/main-contract.repository';

type ContractRow = typeof mcContracts.$inferSelect;
type MilestoneRow = typeof mcMilestones.$inferSelect;
type GuaranteeRow = typeof mcGuarantees.$inferSelect;

const ENDED = ['cancelled', 'terminated'];

const toContract = (r: ContractRow): MainContractRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    status: r.status as MainContractStatus,
    billingMode: r.billingMode as MainContractBillingMode,
    createdBy: asUserId(r.createdBy),
});

const toMilestone = (r: MilestoneRow): MilestoneRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    kind: r.kind as ContractMilestoneKind,
    trigger: r.trigger as ContractMilestoneTrigger,
    status: r.status as ContractMilestoneStatus,
    source: r.source as ContractMilestoneSource,
});

const toGuarantee = (r: GuaranteeRow): GuaranteeRecord => ({
    ...r,
    workspaceId: asWorkspaceId(r.workspaceId),
    projectId: asProjectId(r.projectId),
    kind: r.kind as GuaranteeKind,
    form: r.form as GuaranteeForm,
    status: r.status as GuaranteeStatus,
    createdBy: asUserId(r.createdBy),
});

/** Postgres adapter; `ctx.executor` joins the UnitOfWork transaction. */
export class DrizzleMainContractRepository extends MainContractRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async findContract(contractId: string): Promise<MainContractRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(mcContracts).where(eq(mcContracts.id, contractId)).limit(1);
        return row === undefined ? undefined : toContract(row);
    }

    async lockContract(workspaceId: WorkspaceId, contractId: string): Promise<MainContractRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(mcContracts)
            .where(and(eq(mcContracts.workspaceId, workspaceId), eq(mcContracts.id, contractId))).limit(1).for('update');
        return row === undefined ? undefined : toContract(row);
    }

    async effectiveForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(mcContracts)
            .where(and(eq(mcContracts.workspaceId, workspaceId), eq(mcContracts.projectId, projectId), notInArray(mcContracts.status, ENDED)))
            .limit(1);
        return row === undefined ? undefined : toContract(row);
    }

    async effectiveForProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<MainContractRecord[]> {
        if (projectIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(mcContracts)
            .where(and(eq(mcContracts.workspaceId, workspaceId), inArray(mcContracts.projectId, [...projectIds]), notInArray(mcContracts.status, ENDED)));
        return rows.map(toContract);
    }

    async listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractRecord[]> {
        const rows = await this.ctx.executor.select().from(mcContracts)
            .where(and(eq(mcContracts.workspaceId, workspaceId), eq(mcContracts.projectId, projectId)))
            .orderBy(desc(mcContracts.createdAt));
        return rows.map(toContract);
    }

    async insertContract(c: MainContractRecord): Promise<void> {
        await this.ctx.executor.insert(mcContracts).values({ ...c });
    }

    async saveContract(c: MainContractRecord): Promise<void> {
        const { id, workspaceId, ...rest } = c;
        await this.ctx.executor.update(mcContracts).set(rest).where(and(eq(mcContracts.workspaceId, workspaceId), eq(mcContracts.id, id)));
    }

    async milestonesOf(workspaceId: WorkspaceId, contractIds: readonly string[]): Promise<MilestoneRecord[]> {
        if (contractIds.length === 0) return [];
        const rows = await this.ctx.executor.select().from(mcMilestones)
            .where(and(eq(mcMilestones.workspaceId, workspaceId), inArray(mcMilestones.contractId, [...contractIds])))
            .orderBy(asc(mcMilestones.contractId), asc(mcMilestones.no));
        return rows.map(toMilestone);
    }

    async findMilestone(milestoneId: string): Promise<MilestoneRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(mcMilestones).where(eq(mcMilestones.id, milestoneId)).limit(1);
        return row === undefined ? undefined : toMilestone(row);
    }

    async replaceMilestones(workspaceId: WorkspaceId, contractId: string, milestones: readonly MilestoneRecord[]): Promise<void> {
        await this.ctx.executor.delete(mcMilestones).where(and(eq(mcMilestones.workspaceId, workspaceId), eq(mcMilestones.contractId, contractId)));
        if (milestones.length > 0) await this.ctx.executor.insert(mcMilestones).values(milestones.map(m => ({ ...m })));
    }

    async insertMilestone(m: MilestoneRecord): Promise<void> {
        await this.ctx.executor.insert(mcMilestones).values({ ...m });
    }

    async saveMilestone(m: MilestoneRecord): Promise<void> {
        const { id, workspaceId, ...rest } = m;
        await this.ctx.executor.update(mcMilestones).set(rest).where(and(eq(mcMilestones.workspaceId, workspaceId), eq(mcMilestones.id, id)));
    }

    async guaranteesOf(workspaceId: WorkspaceId, contractId: string): Promise<GuaranteeRecord[]> {
        const rows = await this.ctx.executor.select().from(mcGuarantees)
            .where(and(eq(mcGuarantees.workspaceId, workspaceId), eq(mcGuarantees.contractId, contractId)))
            .orderBy(asc(mcGuarantees.createdAt));
        return rows.map(toGuarantee);
    }

    async findGuarantee(guaranteeId: string): Promise<GuaranteeRecord | undefined> {
        const [row] = await this.ctx.executor.select().from(mcGuarantees).where(eq(mcGuarantees.id, guaranteeId)).limit(1);
        return row === undefined ? undefined : toGuarantee(row);
    }

    async insertGuarantee(g: GuaranteeRecord): Promise<void> {
        await this.ctx.executor.insert(mcGuarantees).values({ ...g });
    }

    async saveGuarantee(g: GuaranteeRecord): Promise<void> {
        const { id, workspaceId, ...rest } = g;
        await this.ctx.executor.update(mcGuarantees).set(rest).where(and(eq(mcGuarantees.workspaceId, workspaceId), eq(mcGuarantees.id, id)));
    }

    async guaranteesExpiring(from: string, until: string, limit: number): Promise<GuaranteeRecord[]> {
        const rows = await this.ctx.executor.select().from(mcGuarantees)
            .where(and(eq(mcGuarantees.status, 'active'), gte(mcGuarantees.expiryDate, from), lte(mcGuarantees.expiryDate, until)))
            .limit(limit);
        return rows.map(toGuarantee);
    }

    async deleteByProject(): Promise<void> {
        // PostgreSQL drops the contracts with the project (tenant FK on delete cascade).
    }
}
