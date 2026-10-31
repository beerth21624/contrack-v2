import type {
    ContractVariationBilling, DocLanguage, QuotationCustomerSnapshot, VariationEvidenceKind, VariationLineSource, VariationReason,
    VariationSandbox, VariationStatus,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `vo_variations` row. */
export interface VariationRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    contractId: string;
    seqNo: number;
    number: string | null;
    title: string;
    reason: VariationReason;
    requestedByName: string;
    requestedDate: string | null;
    status: VariationStatus;
    sandbox: VariationSandbox;
    costTotal: number;
    sellTotal: number;
    vat: number;
    scheduleImpactDays: number;
    billing: ContractVariationBilling;
    language: DocLanguage;
    customerSnapshot: QuotationCustomerSnapshot | null;
    acceptedAt: Date | null;
    acceptedByName: string;
    responseNote: string;
    submittedAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `vo_lines` row. */
export interface VariationLineRecord {
    id: string;
    variationId: string;
    workspaceId: WorkspaceId;
    costCodeId: string | null;
    sectionNo: number;
    lineKey: string | null;
    descTh: string;
    descEn: string;
    unit: string;
    qtyDelta: number;
    costMatUnit: number;
    costLabUnit: number;
    costAmount: number;
    sellUnit: number;
    sellAmount: number;
    source: VariationLineSource;
    sort: number;
}

/** One `vo_evidence` row. */
export interface VariationEvidenceRecord {
    id: string;
    variationId: string;
    workspaceId: WorkspaceId;
    kind: VariationEvidenceKind;
    fileId: string | null;
    note: string;
    takenAt: Date | null;
    authorUserId: UserId;
    createdAt: Date;
}

/** Tables `vo_*`. Every method filters by workspace except the by-id lookups (callers then check access). */
export abstract class VariationRepository {
    abstract find(variationId: string): Promise<VariationRecord | undefined>;
    /** `select … for update` of the row. */
    abstract lock(workspaceId: WorkspaceId, variationId: string): Promise<VariationRecord | undefined>;
    /** Variations of a project, newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<VariationRecord[]>;
    /** Variations of many projects (hub roll-up, unlock guard). */
    abstract listByProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<VariationRecord[]>;
    /** Highest `seq_no` of a contract (0 when none). */
    abstract maxSeq(workspaceId: WorkspaceId, contractId: string): Promise<number>;
    /** A second (contract, seq_no) or (workspace, number) throws. */
    abstract insert(v: VariationRecord): Promise<void>;
    abstract save(v: VariationRecord): Promise<void>;

    /** `sort` order. */
    abstract linesOf(workspaceId: WorkspaceId, variationId: string): Promise<VariationLineRecord[]>;
    abstract replaceLines(workspaceId: WorkspaceId, variationId: string, lines: readonly VariationLineRecord[]): Promise<void>;
    /** Line and evidence counts per variation. */
    abstract counts(workspaceId: WorkspaceId, variationIds: readonly string[]): Promise<Map<string, { lines: number; evidence: number }>>;

    /** `created_at` order. */
    abstract evidenceOf(workspaceId: WorkspaceId, variationId: string): Promise<VariationEvidenceRecord[]>;
    abstract findEvidence(evidenceId: string): Promise<VariationEvidenceRecord | undefined>;
    abstract insertEvidence(e: VariationEvidenceRecord): Promise<void>;
    abstract deleteEvidence(workspaceId: WorkspaceId, evidenceId: string): Promise<void>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
