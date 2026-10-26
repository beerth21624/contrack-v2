// ─── Integration-test seeding: rows written straight through Drizzle (each suite tests its own repository) ───
import { randomUUID } from 'node:crypto';
import type { ProjectStart } from '@contrack/domain/project';
import type { Role } from '@contrack/contract';
import { Project } from '../../src/modules/projects/domain/entities/project.entity';
import { ProjectAssembler } from '../../src/modules/projects/domain/services/project-assembler.service';
import { ProjectName } from '../../src/modules/projects/domain/value-objects/project-name.value-object';
import type { DomainError } from '../../src/shared/domain/domain-error';
import {
    type ProjectId, type UserId, type WorkspaceId, asProjectId, asUserId, asWorkspaceId,
} from '../../src/shared/domain/ids';
import type { Result } from '../../src/shared/domain/result';
import type { DatabaseContext } from '../../src/shared/infrastructure/database/database';
import { memberships, projects, users, workspaces } from '../../src/shared/infrastructure/database/schema';

/** The value of an ok Result (fails the test otherwise). */
export function must<T>(result: Result<T, DomainError>): T {
    if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
    return result.value;
}

/** The error codes of the failed results, in order. */
export function errorCodes<T>(results: readonly Result<T, DomainError>[]): string[] {
    return results.flatMap(r => (r.ok ? [] : [r.error.code]));
}

/** A PostgreSQL error raised through drizzle / pg (the driver error may be wrapped in `cause`). */
export function pgError(error: unknown): { code?: string; constraint?: string } {
    let current: unknown = error;
    for (let i = 0; i < 5 && typeof current === 'object' && current !== null; i += 1) {
        const e = current as { code?: unknown; constraint?: unknown; cause?: unknown };
        if (typeof e.code === 'string') {
            return { code: e.code, constraint: typeof e.constraint === 'string' ? e.constraint : undefined };
        }
        current = e.cause;
    }
    return {};
}

/** Rejects with a PostgreSQL error of `code` (23503 foreign key, 23505 unique, …), optionally on `constraint`. */
export async function expectPgError(work: Promise<unknown>, code: string, constraint?: string): Promise<void> {
    let caught: unknown;
    try {
        await work;
    } catch (error) {
        caught = error;
    }
    if (caught === undefined) throw new Error(`expected PostgreSQL error ${code}, but the statement succeeded`);
    const pg = pgError(caught);
    expect(pg.code).toBe(code);
    if (constraint !== undefined) expect(pg.constraint).toBe(constraint);
}

export const T0 = new Date('2026-03-01T08:00:00.000Z');

export async function seedUser(ctx: DatabaseContext, name = 'User', email?: string): Promise<UserId> {
    const id = asUserId(randomUUID());
    await ctx.db.insert(users).values({
        id, email: email ?? `${name.toLowerCase()}.${id}@example.com`, passwordHash: 'not-a-real-hash', displayName: name, createdAt: T0,
    });
    return id;
}

export async function seedWorkspace(
    ctx: DatabaseContext, ownerId: UserId, kind: 'personal' | 'company' = 'company',
): Promise<WorkspaceId> {
    const id = asWorkspaceId(randomUUID());
    await ctx.db.insert(workspaces).values({ id, name: `Workspace ${id.slice(0, 8)}`, kind, createdAt: T0 });
    await seedMember(ctx, id, ownerId, 'owner');
    return id;
}

export async function seedMember(
    ctx: DatabaseContext, workspaceId: WorkspaceId, userId: UserId, role: Role, joinedAt = T0,
): Promise<void> {
    await ctx.db.insert(memberships).values({ workspaceId, userId, role, joinedAt });
}

/** A project with the summary the shared engine computes for no documents. */
export async function seedProject(
    ctx: DatabaseContext, workspaceId: WorkspaceId, createdBy: UserId,
    options: { start?: ProjectStart; name?: string; now?: Date } = {},
): Promise<Project> {
    const start = options.start ?? 'sample';
    const evaluated = must(new ProjectAssembler().evaluate(start, []));
    const project = Project.create({
        id: asProjectId(randomUUID()),
        workspaceId,
        name: must(ProjectName.create(options.name ?? 'House')),
        start,
        summary: evaluated.summary,
        createdBy,
        now: options.now ?? T0,
    });
    const p = project.toProps();
    await ctx.db.insert(projects).values({
        id: p.id,
        workspaceId: p.workspaceId,
        name: p.name.value,
        start: p.start,
        engineVersion: p.engineVersion,
        schemaVersion: p.schemaVersion,
        summary: { ...p.summary },
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        archivedAt: p.archivedAt,
    });
    return project;
}

/** Two tenants, each with an owner and one project (the usual isolation fixture). */
export async function seedTwoTenants(ctx: DatabaseContext): Promise<{
    a: { owner: UserId; workspaceId: WorkspaceId; projectId: ProjectId };
    b: { owner: UserId; workspaceId: WorkspaceId; projectId: ProjectId };
}> {
    const ownerA = await seedUser(ctx, 'OwnerA');
    const ownerB = await seedUser(ctx, 'OwnerB');
    const wsA = await seedWorkspace(ctx, ownerA);
    const wsB = await seedWorkspace(ctx, ownerB);
    const pA = await seedProject(ctx, wsA, ownerA);
    const pB = await seedProject(ctx, wsB, ownerB);
    return {
        a: { owner: ownerA, workspaceId: wsA, projectId: pA.id },
        b: { owner: ownerB, workspaceId: wsB, projectId: pB.id },
    };
}

export const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Resolves when `predicate` holds (polling), or fails after `timeoutMs`. */
export async function eventually(predicate: () => boolean, timeoutMs = 3000, what = 'condition'): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!predicate()) {
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
        await sleep(20);
    }
}

/** A promise with its resolve function (a gate a test opens by hand). */
export function gate(): { promise: Promise<void>; open: () => void } {
    let open: () => void = () => undefined;
    const promise = new Promise<void>(resolve => { open = resolve; });
    return { promise, open };
}
