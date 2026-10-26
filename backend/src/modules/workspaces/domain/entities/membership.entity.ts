// ─── Membership: a user's role in one workspace ───
import type { Role } from '@contrack/contract';
import type { UserId, WorkspaceId } from '../../../../shared/domain/ids';

export interface MembershipProps {
    workspaceId: WorkspaceId;
    userId: UserId;
    role: Role;
    joinedAt: Date;
}

export class Membership {
    private constructor(private props: MembershipProps) {}

    static create(props: MembershipProps): Membership {
        return new Membership({ ...props, joinedAt: new Date(props.joinedAt.getTime()) });
    }

    static rehydrate(props: MembershipProps): Membership {
        return new Membership({ ...props });
    }

    get workspaceId(): WorkspaceId {
        return this.props.workspaceId;
    }

    get userId(): UserId {
        return this.props.userId;
    }

    get role(): Role {
        return this.props.role;
    }

    get joinedAt(): Date {
        return new Date(this.props.joinedAt.getTime());
    }

    get isOwner(): boolean {
        return this.props.role === 'owner';
    }

    /** The rules (who may change whom, last owner) live in `role-change.policy.ts`. */
    changeRole(role: Role): void {
        this.props = { ...this.props, role };
    }

    toProps(): MembershipProps {
        return { ...this.props, joinedAt: this.joinedAt };
    }
}
