import type {
    DocLanguage, MilestoneTemplateItem, QuotationCompanySnapshot, QuotationCustomerSnapshot, QuotationVersionStatus,
} from '@contrack/contract';
import type {
    DetailLevel, QuotationFormat, QuotationLine, QuotationPricing, QuotationSection, QuotationTotals,
} from '@contrack/domain/quotation';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `qt_quotations` row. */
export interface QuotationRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    customerId: string | null;
    title: string;
    number: string | null;
    currentVersionId: string | null;
    acceptedVersionId: string | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `qt_quotation_versions` row. */
export interface QuotationVersionRecord {
    id: string;
    quotationId: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    versionNo: number;
    status: QuotationVersionStatus;
    boqVersionId: string | null;
    format: QuotationFormat;
    detailLevel: DetailLevel;
    language: DocLanguage;
    issueDate: string | null;
    validUntil: string | null;
    number: string | null;
    customerSnapshot: QuotationCustomerSnapshot | null;
    companySnapshot: QuotationCompanySnapshot | null;
    pricing: QuotationPricing;
    totals: QuotationTotals;
    paymentTerms: MilestoneTemplateItem[];
    termsTh: string;
    termsEn: string;
    note: string;
    acceptedAt: Date | null;
    acceptedByName: string;
    responseNote: string;
    issuedBy: UserId | null;
    issuedAt: Date | null;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** A stored line always has its id. */
export type StoredQuotationLine = QuotationLine & { id: string };

export interface QuotationVersionRows {
    /** section `sort` order. */
    sections: QuotationSection[];
    /** section, then `sort` order. */
    lines: StoredQuotationLine[];
}

/** An issued version past its `valid_until` (for the expiry sweep). */
export interface ExpiredVersionRef {
    id: string;
    workspaceId: WorkspaceId;
}

/** Tables `qt_*`. Every method filters by workspace except the by-id lookups (callers then check access). */
export abstract class QuotationRepository {
    abstract findQuotation(quotationId: string): Promise<QuotationRecord | undefined>;
    /** `select … for update` of the quotation row (versions of one quotation change one at a time). */
    abstract lockQuotation(workspaceId: WorkspaceId, quotationId: string): Promise<QuotationRecord | undefined>;
    /** Quotations of a project, newest first. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<QuotationRecord[]>;
    abstract insertQuotation(q: QuotationRecord): Promise<void>;
    abstract saveQuotation(q: QuotationRecord): Promise<void>;

    abstract findVersion(versionId: string): Promise<QuotationVersionRecord | undefined>;
    /** Versions of many quotations of one workspace, version_no ascending. */
    abstract versionsOf(workspaceId: WorkspaceId, quotationIds: readonly string[]): Promise<QuotationVersionRecord[]>;
    /** Inserts a version with its sections and lines; a second open draft of the quotation throws (partial unique). */
    abstract insertVersion(v: QuotationVersionRecord, rows: QuotationVersionRows): Promise<void>;
    /** Header row only. */
    abstract saveVersion(v: QuotationVersionRecord): Promise<void>;
    /** Replaces sections and lines of a version. */
    abstract replaceRows(workspaceId: WorkspaceId, versionId: string, rows: QuotationVersionRows): Promise<void>;
    abstract rows(workspaceId: WorkspaceId, versionId: string): Promise<QuotationVersionRows>;

    /** Issued versions (every workspace) whose `valid_until` is before `today`. */
    abstract issuedValidBefore(today: string, limit: number): Promise<ExpiredVersionRef[]>;
    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
