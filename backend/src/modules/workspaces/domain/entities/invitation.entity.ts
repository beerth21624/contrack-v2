// ─── Invitation to a company workspace: single use, expires, can be revoked ───
import type { AssignableRole } from '@contrack/contract';
import type { DomainError } from '../../../../shared/domain/domain-error';
import type { InvitationId, UserId, WorkspaceId } from '../../../../shared/domain/ids';
import { type Result, err, okVoid } from '../../../../shared/domain/result';
import type { Email } from '../value-objects/email.value-object';
import { WorkspaceErrors } from '../workspace.errors';

export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InvitationProps {
    id: InvitationId;
    workspaceId: WorkspaceId;
    email: Email;
    role: AssignableRole;
    /** SHA-256 of the raw token; the raw token is never stored. */
    tokenHash: string;
    invitedBy: UserId;
    createdAt: Date;
    expiresAt: Date;
    acceptedAt: Date | null;
    acceptedBy: UserId | null;
    revokedAt: Date | null;
}

export interface NewInvitation {
    id: InvitationId;
    workspaceId: WorkspaceId;
    email: Email;
    role: AssignableRole;
    tokenHash: string;
    invitedBy: UserId;
    now: Date;
    ttlDays: number;
}

const copy = (d: Date | null): Date | null => (d === null ? null : new Date(d.getTime()));

export class Invitation {
    private constructor(private props: InvitationProps) {}

    static create(input: NewInvitation): Invitation {
        const createdAt = new Date(input.now.getTime());
        return new Invitation({
            id: input.id,
            workspaceId: input.workspaceId,
            email: input.email,
            role: input.role,
            tokenHash: input.tokenHash,
            invitedBy: input.invitedBy,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + input.ttlDays * DAY_MS),
            acceptedAt: null,
            acceptedBy: null,
            revokedAt: null,
        });
    }

    static rehydrate(props: InvitationProps): Invitation {
        return new Invitation({ ...props });
    }

    get id(): InvitationId {
        return this.props.id;
    }

    get workspaceId(): WorkspaceId {
        return this.props.workspaceId;
    }

    get email(): Email {
        return this.props.email;
    }

    get role(): AssignableRole {
        return this.props.role;
    }

    get tokenHash(): string {
        return this.props.tokenHash;
    }

    get invitedBy(): UserId {
        return this.props.invitedBy;
    }

    get createdAt(): Date {
        return new Date(this.props.createdAt.getTime());
    }

    get expiresAt(): Date {
        return new Date(this.props.expiresAt.getTime());
    }

    get acceptedAt(): Date | null {
        return copy(this.props.acceptedAt);
    }

    get acceptedBy(): UserId | null {
        return this.props.acceptedBy;
    }

    get revokedAt(): Date | null {
        return copy(this.props.revokedAt);
    }

    /** Accepted and revoked are final; otherwise it expires at `expiresAt` (inclusive). */
    status(now: Date): InvitationStatus {
        if (this.props.acceptedAt !== null) return 'accepted';
        if (this.props.revokedAt !== null) return 'revoked';
        if (now.getTime() >= this.props.expiresAt.getTime()) return 'expired';
        return 'pending';
    }

    isPending(now: Date): boolean {
        return this.status(now) === 'pending';
    }

    revoke(now: Date): Result<undefined, DomainError> {
        if (!this.isPending(now)) return err(WorkspaceErrors.invitationInvalid());
        this.props = { ...this.props, revokedAt: new Date(now.getTime()) };
        return okVoid();
    }

    accept(userId: UserId, now: Date): Result<undefined, DomainError> {
        if (!this.isPending(now)) return err(WorkspaceErrors.invitationInvalid());
        this.props = { ...this.props, acceptedAt: new Date(now.getTime()), acceptedBy: userId };
        return okVoid();
    }

    toProps(): InvitationProps {
        return {
            ...this.props,
            createdAt: this.createdAt,
            expiresAt: this.expiresAt,
            acceptedAt: this.acceptedAt,
            revokedAt: this.revokedAt,
        };
    }
}
