// ─── Project: aggregate root of a cloud project (its documents, revisions, assignments hang off its id) ───
import type { ProjectSummaryValues } from '@contrack/domain/sync';
import { ENGINE_VERSION, PROJECT_SCHEMA_VERSION, type ProjectStart } from '@contrack/domain/project';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';
import type { ProjectName } from '../value-objects/project-name.value-object';

/** The calculation engine every cloud project is computed with (declared in @contrack/domain/project). */
export { ENGINE_VERSION };
export type EngineVersion = typeof ENGINE_VERSION;

export type ProjectSummary = Readonly<ProjectSummaryValues>;

export interface ProjectProps {
    id: ProjectId;
    workspaceId: WorkspaceId;
    name: ProjectName;
    start: ProjectStart;
    engineVersion: EngineVersion;
    schemaVersion: number;
    summary: ProjectSummary;
    createdBy: UserId;
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
}

export interface CreateProjectProps {
    id: ProjectId;
    workspaceId: WorkspaceId;
    name: ProjectName;
    start: ProjectStart;
    /** Computed by ProjectAssembler from the project's documents. */
    summary: ProjectSummary;
    createdBy: UserId;
    now: Date;
}

const copyDate = (d: Date): Date => new Date(d.getTime());
const copySummary = (s: ProjectSummary): ProjectSummary => ({
    constructionTotal: s.constructionTotal,
    preConstructionTotal: s.preConstructionTotal,
    levelsDone: s.levelsDone,
    levelsTotal: s.levelsTotal,
});

export class Project {
    private constructor(private props: ProjectProps) {}

    static create(input: CreateProjectProps): Project {
        return new Project({
            id: input.id,
            workspaceId: input.workspaceId,
            name: input.name,
            start: input.start,
            engineVersion: ENGINE_VERSION,
            schemaVersion: PROJECT_SCHEMA_VERSION,
            summary: copySummary(input.summary),
            createdBy: input.createdBy,
            createdAt: copyDate(input.now),
            updatedAt: copyDate(input.now),
            archivedAt: null,
        });
    }

    /** From storage (no rules re-applied). */
    static rehydrate(props: ProjectProps): Project {
        return new Project({
            ...props,
            summary: copySummary(props.summary),
            createdAt: copyDate(props.createdAt),
            updatedAt: copyDate(props.updatedAt),
            archivedAt: props.archivedAt === null ? null : copyDate(props.archivedAt),
        });
    }

    get id(): ProjectId { return this.props.id; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get name(): ProjectName { return this.props.name; }
    get start(): ProjectStart { return this.props.start; }
    get engineVersion(): EngineVersion { return this.props.engineVersion; }
    get schemaVersion(): number { return this.props.schemaVersion; }
    get summary(): ProjectSummary { return copySummary(this.props.summary); }
    get createdBy(): UserId { return this.props.createdBy; }
    get createdAt(): Date { return copyDate(this.props.createdAt); }
    get updatedAt(): Date { return copyDate(this.props.updatedAt); }
    get archivedAt(): Date | null { return this.props.archivedAt === null ? null : copyDate(this.props.archivedAt); }
    get isArchived(): boolean { return this.props.archivedAt !== null; }

    /** False when the name is already this one (nothing changed). */
    rename(name: ProjectName, now: Date): boolean {
        if (this.props.name.equals(name)) return false;
        this.props = { ...this.props, name, updatedAt: copyDate(now) };
        return true;
    }

    /** False when it is already archived. */
    archive(now: Date): boolean {
        if (this.props.archivedAt !== null) return false;
        this.props = { ...this.props, archivedAt: copyDate(now), updatedAt: copyDate(now) };
        return true;
    }

    /** False when it is not archived. */
    restore(now: Date): boolean {
        if (this.props.archivedAt === null) return false;
        this.props = { ...this.props, archivedAt: null, updatedAt: copyDate(now) };
        return true;
    }

    /** Stores the totals recomputed after a document changed. */
    applySummary(summary: ProjectSummary, now: Date): void {
        this.props = { ...this.props, summary: copySummary(summary), updatedAt: copyDate(now) };
    }

    /** A copy of the state (for persistence). */
    toProps(): ProjectProps {
        return {
            ...this.props,
            summary: this.summary,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt,
            archivedAt: this.archivedAt,
        };
    }
}
