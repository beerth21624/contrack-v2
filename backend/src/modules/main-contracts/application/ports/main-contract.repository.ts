import type {
    GuaranteeForm, GuaranteeKind, GuaranteeStatus, QuotationCompanySnapshot, QuotationCustomerSnapshot,
} from '@contrack/contract';
import type { MainContractInfo, MainContractMilestone } from '../../../../shared/application/ports';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `mc_contracts` row. */
export interface MainContractRecord extends Omit<MainContractInfo, 'milestones'> {
    durationDays: number | null;
    bodyTh: string;
    bodyEn: string;
    customerSnapshot: QuotationCustomerSnapshot | null;
    companySnapshot: QuotationCompanySnapshot | null;
    signedScanFileIds: string[];
    completedAt: string | null;
    closedAt: string | null;
    terminatedAt: string | null;
    terminationReason: string;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `mc_milestones` row. */
export interface MilestoneRecord extends MainContractMilestone {
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `mc_guarantees` row. */
export interface GuaranteeRecord {
    id: string;
    contractId: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    kind: GuaranteeKind;
    form: GuaranteeForm;
    issuer: string;
    refNo: string;
    amount: number;
    issueDate: string | null;
    expiryDate: string | null;
    status: GuaranteeStatus;
    returnedAt: string | null;
    fileIds: string[];
    note: string;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** Tables `mc_*`. Every method filters by workspace except the by-id lookups (callers then check access). */
export abstract class MainContractRepository {
    abstract findContract(contractId: string): Promise<MainContractRecord | undefined>;
    /** `select … for update` of the contract row. */
    abstract lockContract(workspaceId: WorkspaceId, contractId: string): Promise<MainContractRecord | undefined>;
    /** The contract that is not cancelled / terminated (at most one per project). */
    abstract effectiveForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractRecord | undefined>;
    /** Effective contracts of many projects (hub roll-up). */
    abstract effectiveForProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<MainContractRecord[]>;
    /** Every contract of a project, newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<MainContractRecord[]>;
    /** A second effective contract of the project throws (partial unique). */
    abstract insertContract(c: MainContractRecord): Promise<void>;
    abstract saveContract(c: MainContractRecord): Promise<void>;

    /** Milestones of contracts of one workspace, by contract then `no`. */
    abstract milestonesOf(workspaceId: WorkspaceId, contractIds: readonly string[]): Promise<MilestoneRecord[]>;
    abstract findMilestone(milestoneId: string): Promise<MilestoneRecord | undefined>;
    /** Replaces every milestone of a contract (drafts only: nothing refers to them yet). */
    abstract replaceMilestones(workspaceId: WorkspaceId, contractId: string, milestones: readonly MilestoneRecord[]): Promise<void>;
    abstract insertMilestone(m: MilestoneRecord): Promise<void>;
    abstract saveMilestone(m: MilestoneRecord): Promise<void>;

    abstract guaranteesOf(workspaceId: WorkspaceId, contractId: string): Promise<GuaranteeRecord[]>;
    abstract findGuarantee(guaranteeId: string): Promise<GuaranteeRecord | undefined>;
    abstract insertGuarantee(g: GuaranteeRecord): Promise<void>;
    abstract saveGuarantee(g: GuaranteeRecord): Promise<void>;
    /** Active guarantees (every workspace) expiring on or between `from` and `until`. */
    abstract guaranteesExpiring(from: string, until: string, limit: number): Promise<GuaranteeRecord[]>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
