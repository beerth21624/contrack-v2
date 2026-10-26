// ─── ProjectDoc: one stored document of a project (optimistic concurrency through `version`) ───
// version starts at 1 and grows by exactly 1 on every write; data = null means "back to the default"
// (the row is kept so versions never go backwards).
import type { DocEntry, DocKey } from '@contrack/domain/sync';
import type { ProjectId, UserId, WorkspaceId } from '../../../../shared/domain';

export interface ProjectDocProps {
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    docKey: DocKey;
    /** JSON data of the document; null = reset to its default. */
    data: unknown;
    version: number;
    updatedBy: UserId;
    updatedAt: Date;
}

export interface WriteDocProps {
    projectId: ProjectId;
    workspaceId: WorkspaceId;
    docKey: DocKey;
    data: unknown;
    /** Version the writer edited: 0 when the document does not exist yet. */
    baseVersion: number;
    updatedBy: UserId;
    now: Date;
}

function assertVersion(version: number, what: string): void {
    if (!Number.isSafeInteger(version) || version < 0) throw new Error(`${what} must be a non-negative integer, got ${version}`);
}

export class ProjectDoc {
    private constructor(private readonly props: ProjectDocProps) {}

    /** The document as written on top of `baseVersion` (its version becomes baseVersion + 1). */
    static write(input: WriteDocProps): ProjectDoc {
        assertVersion(input.baseVersion, 'baseVersion');
        return new ProjectDoc({
            projectId: input.projectId,
            workspaceId: input.workspaceId,
            docKey: input.docKey,
            data: input.data ?? null,
            version: input.baseVersion + 1,
            updatedBy: input.updatedBy,
            updatedAt: new Date(input.now.getTime()),
        });
    }

    static rehydrate(props: ProjectDocProps): ProjectDoc {
        assertVersion(props.version, 'version');
        if (props.version < 1) throw new Error(`a stored document has version ${props.version} (must be ≥ 1)`);
        return new ProjectDoc({ ...props, data: props.data ?? null, updatedAt: new Date(props.updatedAt.getTime()) });
    }

    get projectId(): ProjectId { return this.props.projectId; }
    get workspaceId(): WorkspaceId { return this.props.workspaceId; }
    get docKey(): DocKey { return this.props.docKey; }
    get data(): unknown { return this.props.data; }
    get version(): number { return this.props.version; }
    get updatedBy(): UserId { return this.props.updatedBy; }
    get updatedAt(): Date { return new Date(this.props.updatedAt.getTime()); }
    get isReset(): boolean { return this.props.data === null; }

    /** What the shared domain needs to rebuild the project. */
    toEntry(): DocEntry {
        return { docKey: this.props.docKey, data: this.props.data };
    }

    toProps(): ProjectDocProps {
        return { ...this.props, updatedAt: this.updatedAt };
    }
}
