import type { BoqVersionKind } from '@contrack/contract';
import type { BoqVersionLine, BoqVersionSection } from '@contrack/domain/boq-control/version-lines';
import type { ProjectId, RevisionId, UserId, WorkspaceId } from '../../../../shared/domain/ids';

/** One `boq_versions` row. */
export interface BoqVersionRecord {
    id: string;
    workspaceId: WorkspaceId;
    projectId: ProjectId;
    revisionId: RevisionId;
    versionNo: number;
    kind: BoqVersionKind;
    engineVersion: string;
    constructionTotal: number;
    preConstructionTotal: number;
    matTotal: number;
    labTotal: number;
    lineCount: number;
    createdBy: UserId;
    createdAt: Date;
}

export interface BoqVersionRows {
    sections: BoqVersionSection[];
    lines: BoqVersionLine[];
}

export abstract class BoqVersionRepository {
    /** Locks the project row (`select … for update`) so versions of one project are numbered one at a time. */
    abstract lockProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
    /** Every version of the project, version_no ascending. */
    abstract listByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<BoqVersionRecord[]>;
    /** By id alone (the caller then checks access to the version's project). */
    abstract findById(versionId: string): Promise<BoqVersionRecord | undefined>;
    /** Sections (section_no order) and lines (sort order) of a version. */
    abstract rows(workspaceId: WorkspaceId, versionId: string): Promise<BoqVersionRows>;
    abstract insert(version: BoqVersionRecord, rows: BoqVersionRows): Promise<void>;
    abstract setKind(workspaceId: WorkspaceId, versionId: string, kind: BoqVersionKind): Promise<void>;
    /** Memory adapter only (PostgreSQL cascades from projects). */
    abstract deleteByProject(workspaceId: WorkspaceId, projectId: ProjectId): Promise<void>;
}
