// ─── Ports shared between modules ───
// Abstract classes double as Nest DI tokens (type-safe, no string tokens). A module depends only on these
// abstractions; the module that owns the data provides the implementation (exported from its Nest module).
import type {
    AssignmentUpdatedEvent, DocUpdatedEvent, ProjectUpdatedEvent, Role,
} from '@contrack/contract';
import type { ProjectId, UserId, WorkspaceId } from '../domain/ids';

/** Current time (fixed in tests). */
export abstract class Clock {
    abstract now(): Date;
}

/** New random ids (UUID v4). */
export abstract class IdGenerator {
    abstract newId(): string;
}

/**
 * Runs work in one database transaction. Repositories called inside `run` join it automatically
 * (AsyncLocalStorage); the in-memory implementation just runs the work.
 */
export abstract class UnitOfWork {
    abstract run<T>(work: () => Promise<T>): Promise<T>;
}

/** Provided by workspaces: the caller's role in a workspace, or undefined when not a member. */
export abstract class WorkspaceAccess {
    abstract roleOf(userId: UserId, workspaceId: WorkspaceId): Promise<Role | undefined>;
}

/**
 * Provided by workspaces: creates the personal workspace (with the user as owner) of a newly registered user.
 * Called by identity inside the registration transaction.
 */
export abstract class PersonalWorkspaceProvisioner {
    abstract provision(userId: UserId, displayName: string): Promise<WorkspaceId>;
}

/** Provided by workspaces: the workspaces a user belongs to (for GET /me). */
export interface MembershipSummary {
    workspaceId: WorkspaceId;
    name: string;
    kind: 'personal' | 'company';
    role: Role;
}
export abstract class MembershipDirectory {
    abstract listForUser(userId: UserId): Promise<MembershipSummary[]>;
}

/** Provided by identity: public profile of users (for member lists and presence). */
export interface UserProfile {
    id: UserId;
    email: string;
    displayName: string;
}
export abstract class UserDirectory {
    abstract findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>>;
}

/** Provided by projects: which workspace a project belongs to (undefined when it does not exist / is deleted). */
export abstract class ProjectDirectory {
    abstract workspaceOf(projectId: ProjectId): Promise<WorkspaceId | undefined>;
}

/** Provided by realtime: fan-out to everyone viewing a project. Called only after the transaction committed. */
export abstract class RealtimePublisher {
    abstract docUpdated(event: DocUpdatedEvent): Promise<void>;
    abstract projectUpdated(event: ProjectUpdatedEvent): Promise<void>;
    abstract assignmentUpdated(event: AssignmentUpdatedEvent): Promise<void>;
}

/** Provided by identity: checks an access token. */
export interface AuthenticatedUser {
    userId: UserId;
}
export abstract class AccessTokenVerifier {
    abstract verify(token: string): Promise<AuthenticatedUser | undefined>;
}
