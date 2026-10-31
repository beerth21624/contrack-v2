import type { DocType, IssuedDocumentStatus, NumberReset, YearStyle } from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** A saved `doc_number_series` row. */
export interface SavedSeries {
    docType: DocType;
    prefix: string;
    pattern: string;
    reset: NumberReset;
    yearStyle: YearStyle;
    updatedBy: UserId | null;
    updatedAt: Date;
}

/** An `issued_documents` row. */
export interface IssuedDocumentRecord {
    id: string;
    workspaceId: WorkspaceId;
    docType: DocType;
    number: string;
    periodKey: string;
    seq: number;
    issueDate: string;
    subjectType: string;
    subjectId: string;
    projectId: ProjectId | null;
    issuedBy: UserId;
    issuedAt: Date;
    status: IssuedDocumentStatus;
    voidedBy: UserId | null;
    voidedAt: Date | null;
    voidReason: string;
}

/** Series, counters and issued numbers of a workspace. Every method filters by `workspaceId`. */
export abstract class NumberingRepository {
    abstract findSeries(workspaceId: WorkspaceId, docType: DocType): Promise<SavedSeries | undefined>;
    abstract listSeries(workspaceId: WorkspaceId): Promise<SavedSeries[]>;
    abstract saveSeries(workspaceId: WorkspaceId, series: SavedSeries): Promise<void>;

    /**
     * Runs `work` while holding the counter of (docType, period) exclusively, with its current last seq (0 when new).
     * Postgres: the counter row is upserted and stays locked until the surrounding transaction ends (call inside
     * `uow.run`). Memory: a mutex per counter for the duration of `work`.
     */
    abstract exclusive<T>(workspaceId: WorkspaceId, docType: DocType, periodKey: string, work: (lastSeq: number) => Promise<T>): Promise<T>;
    /** Only while holding `exclusive` of the same counter. */
    abstract setLastSeq(workspaceId: WorkspaceId, docType: DocType, periodKey: string, seq: number): Promise<void>;
    /** Current last seq without locking (preview); 0 when the counter does not exist. */
    abstract peekLastSeq(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<number>;

    /** Latest issue date of the numbers (issued or voided) of a counter period. */
    abstract latestIssueDate(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<string | undefined>;
    abstract countInPeriod(workspaceId: WorkspaceId, docType: DocType, periodKey: string): Promise<number>;
    abstract numberExists(workspaceId: WorkspaceId, docType: DocType, number: string): Promise<boolean>;
    abstract findBySubject(workspaceId: WorkspaceId, docType: DocType, subjectId: string): Promise<IssuedDocumentRecord | undefined>;
    abstract insertIssued(record: IssuedDocumentRecord): Promise<void>;
    abstract markVoided(workspaceId: WorkspaceId, id: string, by: UserId, at: Date, reason: string): Promise<void>;

    /** Numbers of the workspace containing `q` (case-insensitive), newest first, at most `limit` (global search, WP-35). */
    abstract searchNumbers(workspaceId: WorkspaceId, q: string, limit: number): Promise<IssuedDocumentRecord[]>;

    /** Numbers (issued or voided) of other types than `exemptTypes`, of one project or (null) of the whole workspace. */
    abstract countBlocking(workspaceId: WorkspaceId, projectId: ProjectId | null, exemptTypes: readonly DocType[]): Promise<number>;
}
