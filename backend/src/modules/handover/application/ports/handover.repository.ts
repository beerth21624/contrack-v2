import type {
    CloseoutStatus, CloseoutSummaryDto, DocLanguage, HandoverAttendee, HandoverChecklistItem, HandoverDocumentKind, HandoverStatus, WarrantyClaimChannel, WarrantyClaimPhoto,
    WarrantyClaimSeverity, WarrantyClaimStatus, WarrantyStatus,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `ho_handovers` row. */
export interface HandoverRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    contractId: string;
    number: string | null;
    status: HandoverStatus;
    scheduledDate: string | null;
    inspectionDate: string | null;
    handoverDate: string | null;
    attendees: HandoverAttendee[];
    checklist: HandoverChecklistItem[];
    defectsNote: string;
    acceptedByName: string;
    language: DocLanguage;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ho_handover_documents` row. */
export interface HandoverDocumentRecord {
    id: string;
    handoverId: string;
    workspaceId: WorkspaceId;
    kind: HandoverDocumentKind;
    fileId: string;
    title: string;
    createdBy: UserId;
    createdAt: Date;
}

/** One `ho_warranties` row. */
export interface WarrantyRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    contractId: string;
    handoverId: string;
    startDate: string;
    endDate: string;
    status: WarrantyStatus;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ho_warranty_claims` row. */
export interface WarrantyClaimRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    warrantyId: string;
    number: string | null;
    reportedDate: string;
    reportedByName: string;
    channel: WarrantyClaimChannel;
    description: string;
    location: string;
    photos: WarrantyClaimPhoto[];
    severity: WarrantyClaimSeverity;
    status: WarrantyClaimStatus;
    assigneeUserId: UserId | null;
    assigneeSupplierId: string | null;
    dueDate: string | null;
    resolutionNote: string;
    resolvedAt: Date | null;
    closedAt: Date | null;
    costAmount: number;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
}

/** One `ho_closeouts` row (WP-55); `summary` = the full figures (quoted margin included, masked per caller in the DTO). */
export interface CloseoutRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    status: CloseoutStatus;
    asOf: string | null;
    summary: CloseoutSummaryDto | null;
    lessons: string;
    finalizedBy: UserId | null;
    finalizedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

/** Tables `ho_*`. Every method filters by workspace except the by-id lookups and the sweep (callers then check access). */
export abstract class HandoverRepository {
    abstract findHandover(handoverId: string): Promise<HandoverRecord | undefined>;
    abstract handoverForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<HandoverRecord | undefined>;
    /** `select … for update`. */
    abstract lockHandover(workspaceId: WorkspaceId, handoverId: string): Promise<HandoverRecord | undefined>;
    /** A second handover of the project throws (unique project_id). */
    abstract insertHandover(h: HandoverRecord): Promise<void>;
    abstract saveHandover(h: HandoverRecord): Promise<void>;

    /** Oldest first. */
    abstract documentsOf(workspaceId: WorkspaceId, handoverId: string): Promise<HandoverDocumentRecord[]>;
    abstract insertDocument(d: HandoverDocumentRecord): Promise<void>;
    abstract deleteDocuments(workspaceId: WorkspaceId, handoverId: string, documentIds: readonly string[]): Promise<void>;

    abstract warrantyForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<WarrantyRecord | undefined>;
    abstract warrantiesForProjects(workspaceId: WorkspaceId, projectIds: readonly ProjectId[]): Promise<WarrantyRecord[]>;
    /** A second warranty of the project throws (unique project_id). */
    abstract insertWarranty(w: WarrantyRecord): Promise<void>;
    abstract saveWarranty(w: WarrantyRecord): Promise<void>;
    /** Active warranties of every workspace ending on or before `endBy` (daily sweep), earliest end first. */
    abstract activeWarrantiesEndingBy(endBy: string, limit: number): Promise<WarrantyRecord[]>;

    abstract findClaim(claimId: string): Promise<WarrantyClaimRecord | undefined>;
    abstract lockClaim(workspaceId: WorkspaceId, claimId: string): Promise<WarrantyClaimRecord | undefined>;
    /** Newest reported first (then newest created). */
    abstract claimsByProject(workspaceId: WorkspaceId, projectId: ProjectId, status?: WarrantyClaimStatus): Promise<WarrantyClaimRecord[]>;
    /** Claims in `statuses` of many projects (portal, roll-ups). */
    abstract claimsOfProjects(
        workspaceId: WorkspaceId, projectIds: readonly ProjectId[], statuses: readonly WarrantyClaimStatus[],
    ): Promise<WarrantyClaimRecord[]>;
    abstract insertClaim(c: WarrantyClaimRecord): Promise<void>;
    abstract saveClaim(c: WarrantyClaimRecord): Promise<void>;

    abstract closeoutForProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<CloseoutRecord | undefined>;
    /** Insert or replace by project. */
    abstract saveCloseout(c: CloseoutRecord): Promise<void>;

    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
