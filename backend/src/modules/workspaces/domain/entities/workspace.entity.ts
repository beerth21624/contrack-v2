// ─── Workspace (tenant): a personal one per user, plus any number of company ones ───
import type { WorkspaceKind } from '@contrack/contract';
import type { WorkspaceId } from '../../../../shared/domain/ids';
import type { WorkspaceName } from '../value-objects/workspace-name.value-object';

export interface WorkspaceProps {
    id: WorkspaceId;
    name: WorkspaceName;
    kind: WorkspaceKind;
    createdAt: Date;
}

export class Workspace {
    private constructor(private props: WorkspaceProps) {}

    static create(props: WorkspaceProps): Workspace {
        return new Workspace({ ...props, createdAt: new Date(props.createdAt.getTime()) });
    }

    static rehydrate(props: WorkspaceProps): Workspace {
        return new Workspace({ ...props });
    }

    get id(): WorkspaceId {
        return this.props.id;
    }

    get name(): WorkspaceName {
        return this.props.name;
    }

    get kind(): WorkspaceKind {
        return this.props.kind;
    }

    get createdAt(): Date {
        return new Date(this.props.createdAt.getTime());
    }

    get isPersonal(): boolean {
        return this.props.kind === 'personal';
    }

    rename(name: WorkspaceName): void {
        this.props = { ...this.props, name };
    }

    toProps(): WorkspaceProps {
        return { ...this.props, createdAt: this.createdAt };
    }
}
