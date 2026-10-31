// ─── Test support for the workspaces specs: in-memory adapters, fixed clock, sequential ids, fake UserDirectory ───
import type { Role, WorkspaceKind } from '@contrack/contract';
import { MemberAssignmentCleanup, UserDirectory, type UserProfile } from '../../../shared/application/ports';
import type { DomainError } from '../../../shared/domain/domain-error';
import { type UserId, type WorkspaceId, asUserId, asWorkspaceId } from '../../../shared/domain/ids';
import type { Result } from '../../../shared/domain/result';
import { AppConfig, testEnv } from '../../../shared/infrastructure/config/env';
import { InMemoryUnitOfWork } from '../../../shared/infrastructure/database/database';
import { FixedClock, SequentialIdGenerator } from '../../../shared/infrastructure/system';
import { Membership } from '../domain/entities/membership.entity';
import { Workspace } from '../domain/entities/workspace.entity';
import { WorkspaceName } from '../domain/value-objects/workspace-name.value-object';
import { InMemoryInvitationRepository } from '../infrastructure/adapters/in-memory-invitation.repository';
import { InMemoryMembershipRepository } from '../infrastructure/adapters/in-memory-membership.repository';
import { InMemoryWorkspaceRepository } from '../infrastructure/adapters/in-memory-workspace.repository';

/** The four roles `seedCompany` seeds (one member each); the ERP working roles are added per test with `addMember`. */
export type SeededRole = Extract<Role, 'owner' | 'admin' | 'estimator' | 'viewer'>;
export const ROLES_UNDER_TEST: readonly SeededRole[] = ['owner', 'admin', 'estimator', 'viewer'];
export const INVITATION_TTL_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Stand-in for identity's UserDirectory. */
export class FakeUserDirectory extends UserDirectory {
    private readonly profiles = new Map<UserId, UserProfile>();

    add(profile: UserProfile): void {
        this.profiles.set(profile.id, profile);
    }

    findMany(ids: readonly UserId[]): Promise<Map<UserId, UserProfile>> {
        const found = new Map<UserId, UserProfile>();
        for (const id of ids) {
            const profile = this.profiles.get(id);
            if (profile !== undefined) found.set(id, profile);
        }
        return Promise.resolve(found);
    }
}

/** Stand-in for projects' MemberAssignmentCleanup: records every call. */
export class FakeMemberAssignmentCleanup extends MemberAssignmentCleanup {
    readonly calls: { workspaceId: WorkspaceId; userId: UserId }[] = [];
    /** How many after-commit steps ran (they must run only for removals that committed). */
    published = 0;

    removeUser(workspaceId: WorkspaceId, userId: UserId): Promise<() => Promise<void>> {
        this.calls.push({ workspaceId, userId });
        return Promise.resolve(() => { this.published += 1; return Promise.resolve(); });
    }
}

export interface CompanyScenario {
    workspaceId: WorkspaceId;
    owner: UserId;
    admin: UserId;
    estimator: UserId;
    viewer: UserId;
    outsider: UserId;
    /** The member with each role (outsider excluded). */
    byRole: Record<SeededRole, UserId>;
}

const nextTurn = (): Promise<void> => new Promise(resolve => setImmediate(resolve));

/**
 * Writes yield to the event loop first, so concurrent use cases really interleave between their read and their
 * write (without the membership lock, both would read the same owner count).
 */
export class SlowWriteMembershipRepository extends InMemoryMembershipRepository {
    override async update(membership: Membership): Promise<void> {
        await nextTurn();
        await super.update(membership);
    }

    override async insert(membership: Membership): Promise<void> {
        await nextTurn();
        await super.insert(membership);
    }

    override async delete(workspaceId: WorkspaceId, userId: UserId): Promise<void> {
        await nextTurn();
        await super.delete(workspaceId, userId);
    }
}

/** `'ok'` or the error code: compact assertions on a Result. */
export function outcome(result: Result<unknown, DomainError>): string {
    return result.ok ? 'ok' : result.error.code;
}

/** The value of an ok Result (fails the test otherwise). */
export function valueOf<T>(result: Result<T, DomainError>): T {
    if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
    return result.value;
}

export class WorkspacesTestKit {
    readonly clock = new FixedClock(new Date('2026-01-01T00:00:00.000Z'));
    readonly ids = new SequentialIdGenerator();
    readonly uow = new InMemoryUnitOfWork();
    readonly workspaces = new InMemoryWorkspaceRepository();
    readonly memberships: InMemoryMembershipRepository;
    readonly invitations = new InMemoryInvitationRepository();
    readonly users = new FakeUserDirectory();
    readonly assignmentCleanup = new FakeMemberAssignmentCleanup();
    readonly config = new AppConfig(testEnv({ INVITATION_TTL_DAYS: String(INVITATION_TTL_DAYS) }));

    constructor(options: { slowMembershipWrites?: boolean } = {}) {
        this.memberships = options.slowMembershipWrites === true ? new SlowWriteMembershipRepository() : new InMemoryMembershipRepository();
    }

    addUser(displayName: string, email = `${displayName.toLowerCase().replace(/\s+/g, '.')}@example.com`): UserId {
        const id = asUserId(this.ids.newId());
        this.users.add({ id, email, displayName });
        return id;
    }

    async seedWorkspace(kind: WorkspaceKind, members: readonly (readonly [UserId, Role])[], name = 'Acme Construction'): Promise<WorkspaceId> {
        const nameVo = WorkspaceName.create(name);
        if (!nameVo.ok) throw new Error('bad name');
        const id = asWorkspaceId(this.ids.newId());
        await this.workspaces.insert(Workspace.create({ id, name: nameVo.value, kind, createdAt: this.clock.now() }));
        for (const [userId, role] of members) {
            await this.memberships.insert(Membership.create({ workspaceId: id, userId, role, joinedAt: this.clock.now() }));
        }
        return id;
    }

    async seedCompany(): Promise<CompanyScenario> {
        const owner = this.addUser('Olivia Owner');
        const admin = this.addUser('Adam Admin');
        const estimator = this.addUser('Erin Estimator');
        const viewer = this.addUser('Victor Viewer');
        const outsider = this.addUser('Oscar Outsider');
        const workspaceId = await this.seedWorkspace('company', [
            [owner, 'owner'], [admin, 'admin'], [estimator, 'estimator'], [viewer, 'viewer'],
        ]);
        return {
            workspaceId, owner, admin, estimator, viewer, outsider,
            byRole: { owner, admin, estimator, viewer },
        };
    }

    async seedPersonal(owner: UserId, name = 'Olivia (ส่วนตัว)'): Promise<WorkspaceId> {
        return this.seedWorkspace('personal', [[owner, 'owner']], name);
    }

    async addMember(workspaceId: WorkspaceId, userId: UserId, role: Role): Promise<void> {
        await this.memberships.insert(Membership.create({ workspaceId, userId, role, joinedAt: this.clock.now() }));
    }

    async roleOf(workspaceId: WorkspaceId, userId: UserId): Promise<Role | undefined> {
        return (await this.memberships.find(workspaceId, userId))?.role;
    }
}
