// ─── Integration: the workforce Drizzle adapters (people, crews, assignments, supervisors) and use cases on PostgreSQL ───
// Tenant scope, the unique active crew name, the composite (…_id, workspace_id) foreign keys, the cascade when a
// project or workspace is deleted, overlap queries, and the advisory lock under concurrency.
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { PersonRole } from '@contrack/contract';
import { RepositoryProjectStatusLookup } from '../../src/modules/projects/infrastructure/adapters/project-directory.adapter';
import { DrizzleProjectRepository } from '../../src/modules/projects/infrastructure/adapters/drizzle-project.repository';
import { DrizzleRateCardRepository } from '../../src/modules/rate-cards/infrastructure/adapters/drizzle-rate-card.repository';
import { RepositoryRateCardLookup } from '../../src/modules/rate-cards/infrastructure/adapters/rate-card-lookup.adapter';
import { RateCard } from '../../src/modules/rate-cards/domain/entities/rate-card.entity';
import { DailyRate } from '../../src/modules/rate-cards/domain/value-objects/daily-rate.value-object';
import { RateCardName } from '../../src/modules/rate-cards/domain/value-objects/rate-card-name.value-object';
import { CrewPricing } from '../../src/modules/workforce/application/crew-pricing';
import { WorkforceAccess } from '../../src/modules/workforce/application/workforce-access';
import { WorkforceReferences } from '../../src/modules/workforce/application/workforce-references';
import { ArchivePersonUseCase } from '../../src/modules/workforce/application/use-cases/archive-person.use-case';
import { CreateCrewUseCase } from '../../src/modules/workforce/application/use-cases/create-crew.use-case';
import { CreatePersonUseCase } from '../../src/modules/workforce/application/use-cases/create-person.use-case';
import { CrewAssignment } from '../../src/modules/workforce/domain/entities/crew-assignment.entity';
import { Crew } from '../../src/modules/workforce/domain/entities/crew.entity';
import { Person } from '../../src/modules/workforce/domain/entities/person.entity';
import { WorkforceName } from '../../src/modules/workforce/domain/value-objects/workforce-name.value-object';
import { DrizzleCrewAssignmentRepository } from '../../src/modules/workforce/infrastructure/adapters/drizzle-crew-assignment.repository';
import { DrizzleCrewRepository } from '../../src/modules/workforce/infrastructure/adapters/drizzle-crew.repository';
import { DrizzlePersonRepository } from '../../src/modules/workforce/infrastructure/adapters/drizzle-person.repository';
import { DrizzleProjectSupervisorRepository } from '../../src/modules/workforce/infrastructure/adapters/drizzle-project-supervisor.repository';
import { DrizzleWorkforceLock } from '../../src/modules/workforce/infrastructure/adapters/drizzle-workforce-lock.adapter';
import { DrizzleMembershipRepository } from '../../src/modules/workspaces/infrastructure/adapters/drizzle-membership.repository';
import { RepositoryWorkspaceAccess } from '../../src/modules/workspaces/infrastructure/adapters/workspace-access.adapter';
import {
    type CrewId, type PersonId, type ProjectId, type RateCardId, type UserId, type WorkspaceId, asCrewAssignmentId, asCrewId,
    asPersonId, asRateCardId,
} from '../../src/shared/domain/ids';
import { type DatabaseContext, DrizzleUnitOfWork } from '../../src/shared/infrastructure/database/database';
import {
    crewAssignments, crewMembers, crews, people, projectSupervisors, projects, workspaces,
} from '../../src/shared/infrastructure/database/schema';
import { FixedClock, RandomIdGenerator } from '../../src/shared/infrastructure/system';
import { describeIfDatabase, skipIfNoDatabase } from '../support/database';
import { T0, expectPgError, must, seedProject, seedUser, seedWorkspace } from '../support/seed';

const later = (ms: number): Date => new Date(T0.getTime() + ms);
const crewName = (v: string): WorkforceName => must(WorkforceName.create(v, 'crew'));

function person(workspaceId: WorkspaceId, name: string, options: { now?: Date; role?: PersonRole; wage?: number | null } = {}): Person {
    return Person.create({
        id: asPersonId(randomUUID()), workspaceId, name: must(WorkforceName.create(name, 'person')), nickname: null, phone: null,
        role: options.role ?? 'skilled', employment: 'daily', trades: ['masonry'],
        dailyWage: options.wage ?? null, note: null, now: options.now ?? T0,
    });
}

function crew(
    workspaceId: WorkspaceId, name: string,
    options: { now?: Date; leaderId?: PersonId | null; memberIds?: PersonId[]; rateCardId?: RateCardId | null } = {},
): Crew {
    return Crew.create({
        id: asCrewId(randomUUID()), workspaceId, name: crewName(name), trade: 'masonry', leaderId: options.leaderId ?? null,
        memberIds: options.memberIds ?? [], skilledCount: 3, labourerCount: 2, rateCardId: options.rateCardId ?? null,
        dailyCostOverride: null, note: null, now: options.now ?? T0,
    });
}

function assignment(
    workspaceId: WorkspaceId, projectId: ProjectId, crewId: CrewId, createdBy: UserId, start: string, end: string, now = T0,
): CrewAssignment {
    return must(CrewAssignment.create({
        id: asCrewAssignmentId(randomUUID()), workspaceId, projectId, taskId: '4.1', crewId, start, end, note: null, createdBy, now,
    }));
}

function repos(ctx: DatabaseContext) {
    return {
        people: new DrizzlePersonRepository(ctx),
        crews: new DrizzleCrewRepository(ctx),
        assignments: new DrizzleCrewAssignmentRepository(ctx),
        supervisors: new DrizzleProjectSupervisorRepository(ctx),
        cards: new DrizzleRateCardRepository(ctx),
    };
}

async function seedCard(ctx: DatabaseContext, workspaceId: WorkspaceId, createdBy: UserId, name = 'ชุด A'): Promise<RateCard> {
    const card = RateCard.create({
        id: asRateCardId(randomUUID()), workspaceId, name: must(RateCardName.create(name)),
        skilledRate: must(DailyRate.create(800, 'skilled')), labourerRate: must(DailyRate.create(500, 'labourer')),
        note: null, createdBy, now: T0,
    });
    await new DrizzleRateCardRepository(ctx).insert(card);
    return card;
}

describeIfDatabase('workforce repositories (integration)', db => {
    it('people: stored and read back exactly (Thai text, trades array, wage); scoped by workspace; oldest first', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const second = person(ws, 'สมชาย ใจกล้า', { now: later(2000), wage: 1200, role: 'foreman' });
        const first = person(ws, 'สมชาย ใจกล้า', { now: later(1000) }); // same name: allowed
        await r.people.insert(second);
        await r.people.insert(first);
        expect((await r.people.find(ws, second.id))?.toProps()).toEqual(second.toProps());
        expect((await r.people.listActive(ws)).map(p => p.id)).toEqual([first.id, second.id]);
        expect(await r.people.countActive(ws)).toBe(2);
        expect(await r.people.find(other, first.id)).toBeUndefined();
        expect(await r.people.findMany(other, [first.id])).toEqual([]);
        expect((await r.people.findMany(ws, [first.id, first.id, asPersonId(randomUUID())])).map(p => p.id)).toEqual([first.id]);

        first.update({ dailyWage: 900, trades: ['painting', 'masonry'], phone: '081-234-5678' }, later(3000));
        first.archive(later(4000));
        await r.people.update(first);
        expect((await r.people.find(ws, first.id))?.toProps()).toEqual(first.toProps());
        expect(await r.people.countActive(ws)).toBe(1);
    });

    it('crews: members kept in order; unique active name ignoring case, per workspace; archived frees it', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const a = person(ws, 'A');
        const b = person(ws, 'B');
        await r.people.insert(a);
        await r.people.insert(b);
        const c = crew(ws, 'ทีมก่อฉาบ Red', { leaderId: a.id, memberIds: [b.id, a.id] });
        await r.crews.insert(c);
        expect((await r.crews.find(ws, c.id))?.toProps()).toEqual(c.toProps());
        expect((await r.crews.findActiveByName(ws, crewName('ทีมก่อฉาบ RED')))?.id).toBe(c.id);

        await expectPgError(r.crews.insert(crew(ws, 'ทีมก่อฉาบ red')), '23505', 'crews_name_key');
        await r.crews.insert(crew(other, 'ทีมก่อฉาบ Red'));
        c.update({ memberIds: [a.id] }, later(1000));
        c.archive(later(1000));
        await r.crews.update(c);
        expect((await r.crews.find(ws, c.id))?.memberIds).toEqual([a.id]);
        await r.crews.insert(crew(ws, 'ทีมก่อฉาบ RED'));
        expect(await r.crews.countActive(ws)).toBe(1);
    });

    it('crews: listInvolving finds crews by leader or member; updates through another workspace change nothing', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const p = person(ws, 'P');
        const q = person(ws, 'Q');
        await r.people.insert(p);
        await r.people.insert(q);
        const led = crew(ws, 'led', { leaderId: p.id, now: later(1) });
        const member = crew(ws, 'member', { memberIds: [q.id, p.id], now: later(2) });
        const neither = crew(ws, 'neither', { memberIds: [q.id] });
        for (const c of [led, member, neither]) await r.crews.insert(c);
        expect((await r.crews.listInvolving(ws, p.id)).map(c => c.id)).toEqual([led.id, member.id]);
        expect(await r.crews.listInvolving(other, p.id)).toEqual([]);

        const forged = Crew.rehydrate({ ...led.toProps(), workspaceId: other });
        forged.update({ skilledCount: 99, memberIds: [] }, later(9));
        await r.crews.update(forged);
        expect((await r.crews.find(ws, led.id))?.skilledCount).toBe(3);
    });

    it('composite foreign keys: a crew, member or assignment can only name rows of its own workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const theirPerson = person(other, 'Theirs');
        await r.people.insert(theirPerson);
        const theirCard = await seedCard(ctx, other, owner);
        const theirProject = await seedProject(ctx, other, owner);

        await expectPgError(r.crews.insert(crew(ws, 'x', { leaderId: theirPerson.id })), '23503', 'crews_leader_tenant_fk');
        await expectPgError(r.crews.insert(crew(ws, 'y', { rateCardId: theirCard.id })), '23503', 'crews_rate_card_tenant_fk');
        await expectPgError(r.crews.insert(crew(ws, 'z', { memberIds: [theirPerson.id] })), '23503', 'crew_members_person_tenant_fk');
        // The failed member insert ran in its own transaction: the crew row is not left behind.
        expect(await r.crews.findActiveByName(ws, crewName('z'))).toBeUndefined();

        const mine = crew(ws, 'mine');
        await r.crews.insert(mine);
        await expectPgError(
            r.assignments.insert(assignment(ws, theirProject.id, mine.id, owner, '2026-03-01', '2026-03-02')),
            '23503', 'crew_assignments_project_tenant_fk',
        );
        await expectPgError(
            r.supervisors.replace(ws, theirProject.id, [theirPerson.id]), '23503',
        );
    });

    it('check constraints back the domain rules', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);
        const base = { workspaceId: ws, name: 'x', role: 'skilled' as const, employment: 'daily' as const };
        await expectPgError(ctx.db.insert(people).values({ ...base, id: randomUUID(), dailyWage: -1 }), '23514', 'people_daily_wage_check');
        await expectPgError(ctx.db.insert(people).values({ ...base, id: randomUUID(), name: '' }), '23514', 'people_name_check');
        await expectPgError(ctx.db.insert(people).values({ ...base, id: randomUUID(), role: 'boss' as 'skilled' }), '23514', 'people_role_check');
        const crewRow = { workspaceId: ws, name: 'c', trade: 'misc', skilledCount: 1, labourerCount: 1 };
        await expectPgError(ctx.db.insert(crews).values({ ...crewRow, id: randomUUID(), skilledCount: 201 }), '23514', 'crews_skilled_count_check');
        await expectPgError(ctx.db.insert(crews).values({ ...crewRow, id: randomUUID(), dailyCostOverride: 100_001 }), '23514', 'crews_daily_cost_override_check');
        const crewId = randomUUID();
        await ctx.db.insert(crews).values({ ...crewRow, id: crewId });
        const row = { workspaceId: ws, projectId: project.id, crewId, taskId: '1.1', startDate: '2026-03-02', endDate: '2026-03-01', createdBy: owner };
        await expectPgError(ctx.db.insert(crewAssignments).values({ ...row, id: randomUUID() }), '23514', 'crew_assignments_dates_check');
        await expectPgError(ctx.db.insert(crewAssignments).values({ ...row, id: randomUUID(), endDate: '2026-03-03', taskId: '1' }), '23514', 'crew_assignments_task_check');
    });

    it('assignments: overlap filters, ordering, counts of open ones; scoped by workspace', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const other = await seedWorkspace(ctx, owner);
        const p1 = await seedProject(ctx, ws, owner);
        const p2 = await seedProject(ctx, ws, owner);
        const c1 = crew(ws, 'c1');
        const c2 = crew(ws, 'c2');
        await r.crews.insert(c1);
        await r.crews.insert(c2);
        const late = assignment(ws, p1.id, c1.id, owner, '2026-04-01', '2026-04-10');
        const early = assignment(ws, p2.id, c1.id, owner, '2026-03-01', '2026-03-05');
        const mid = assignment(ws, p1.id, c2.id, owner, '2026-03-04', '2026-03-20');
        // The same crew on two projects on overlapping days is allowed.
        const overlap = assignment(ws, p2.id, c2.id, owner, '2026-03-10', '2026-03-12', later(1));
        for (const a of [late, early, mid, overlap]) await r.assignments.insert(a);

        const ids = async (f: Parameters<typeof r.assignments.list>[1]) => (await r.assignments.list(ws, f)).map(a => a.id);
        expect(await ids({})).toEqual([early.id, mid.id, overlap.id, late.id]);
        expect(await ids({ projectId: p1.id })).toEqual([mid.id, late.id]);
        expect(await ids({ crewId: c2.id })).toEqual([mid.id, overlap.id]);
        expect(await ids({ from: '2026-03-05', to: '2026-03-05' })).toEqual([early.id, mid.id]);
        expect(await ids({ from: '2026-03-12' })).toEqual([mid.id, overlap.id, late.id]);
        expect(await ids({ to: '2026-03-04' })).toEqual([early.id, mid.id]);
        expect(await ids({ crewId: c1.id, from: '2026-03-06', to: '2026-03-31' })).toEqual([]);
        expect(await r.assignments.list(other, {})).toEqual([]);

        expect(await r.assignments.countEndingOnOrAfter(ws, [c1.id], '2026-03-05')).toBe(2);
        expect(await r.assignments.countEndingOnOrAfter(ws, [c1.id], '2026-03-06')).toBe(1);
        expect(await r.assignments.countEndingOnOrAfter(ws, [c1.id, c2.id], '2026-03-13')).toBe(2);
        expect(await r.assignments.countEndingOnOrAfter(ws, [], '2026-01-01')).toBe(0);
        expect(await r.assignments.countEndingOnOrAfter(other, [c1.id], '2026-01-01')).toBe(0);

        must(mid.update({ start: '2026-03-06', note: 'เลื่อน' }, later(5)));
        await r.assignments.update(mid);
        expect((await r.assignments.find(ws, mid.id))?.toProps()).toEqual(mid.toProps());
        await r.assignments.delete(other, mid.id);
        expect(await r.assignments.find(ws, mid.id)).toBeDefined();
        await r.assignments.delete(ws, mid.id);
        expect(await r.assignments.find(ws, mid.id)).toBeUndefined();
    });

    it('supervisors: replace keeps order; removePerson; deleting a project cascades its assignments and supervisors', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const doomed = await seedProject(ctx, ws, owner);
        const kept = await seedProject(ctx, ws, owner);
        const a = person(ws, 'A', { role: 'supervisor' });
        const b = person(ws, 'B', { role: 'engineer' });
        await r.people.insert(a);
        await r.people.insert(b);
        const c = crew(ws, 'c', { memberIds: [a.id] });
        await r.crews.insert(c);
        await r.supervisors.replace(ws, doomed.id, [b.id, a.id]);
        await r.supervisors.replace(ws, kept.id, [a.id]);
        expect(await r.supervisors.list(ws, doomed.id)).toEqual([b.id, a.id]);
        await r.assignments.insert(assignment(ws, doomed.id, c.id, owner, '2026-03-01', '2026-03-02'));
        const stays = assignment(ws, kept.id, c.id, owner, '2026-03-01', '2026-03-02');
        await r.assignments.insert(stays);

        // PostgreSQL's cascade alone (the use case also deletes them explicitly through ProjectDependents).
        await new DrizzleProjectRepository(ctx).delete(ws, doomed.id);
        expect((await ctx.db.select().from(crewAssignments)).map(x => x.id)).toEqual([stays.id]);
        expect(await r.supervisors.list(ws, doomed.id)).toEqual([]);
        expect(await r.supervisors.list(ws, kept.id)).toEqual([a.id]);

        await r.supervisors.removePerson(ws, a.id);
        expect(await r.supervisors.list(ws, kept.id)).toEqual([]);
        await r.supervisors.replace(ws, kept.id, [b.id]);
        await r.supervisors.deleteByProject(ws, kept.id);
        expect(await ctx.db.select().from(projectSupervisors)).toEqual([]);
    });

    it('deleting the workspace removes people, crews, members, assignments and supervisors', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const r = repos(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);
        const card = await seedCard(ctx, ws, owner);
        const leader = person(ws, 'L');
        await r.people.insert(leader);
        const c = crew(ws, 'c', { leaderId: leader.id, memberIds: [leader.id], rateCardId: card.id });
        await r.crews.insert(c);
        await r.assignments.insert(assignment(ws, project.id, c.id, owner, '2026-03-01', '2026-03-02'));
        await r.supervisors.replace(ws, project.id, [leader.id]);
        await ctx.db.delete(workspaces).where(eq(workspaces.id, ws));
        for (const table of [people, crews, crewMembers, crewAssignments, projectSupervisors, projects]) {
            expect(await ctx.db.select().from(table)).toEqual([]);
        }
    });
});

describeIfDatabase('workforce use cases on PostgreSQL (integration)', db => {
    function useCases(ctx: DatabaseContext) {
        const r = repos(ctx);
        const lookup = new RepositoryRateCardLookup(r.cards);
        const access = new WorkforceAccess(
            new RepositoryWorkspaceAccess(new DrizzleMembershipRepository(ctx)),
            new RepositoryProjectStatusLookup(new DrizzleProjectRepository(ctx)),
        );
        const refs = new WorkforceReferences(r.people, r.crews, lookup);
        const uow = new DrizzleUnitOfWork(ctx);
        const clock = new FixedClock(new Date('2026-03-01T08:00:00.000Z'));
        const lock = new DrizzleWorkforceLock(ctx);
        const ids = new RandomIdGenerator();
        return {
            ...r,
            createPerson: new CreatePersonUseCase(access, r.people, lock, uow, clock, ids),
            archivePerson: new ArchivePersonUseCase(access, r.people, r.crews, r.assignments, r.supervisors, lock, uow, clock),
            createCrew: new CreateCrewUseCase(access, r.crews, refs, new CrewPricing(lookup), lock, uow, clock, ids),
        };
    }

    it('create a priced crew; archive a person takes them out of the crew and the supervisors in one transaction', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const u = useCases(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const project = await seedProject(ctx, ws, owner);
        const card = await seedCard(ctx, ws, owner);
        const leader = must(await u.createPerson.execute({ userId: owner, workspaceId: ws, name: 'ช่างแดง', role: 'foreman', employment: 'permanent' })).person;
        const created = must(await u.createCrew.execute({
            userId: owner, workspaceId: ws, name: 'ทีมก่อฉาบช่างแดง', trade: 'masonry', leaderId: leader.id, memberIds: [leader.id],
            skilledCount: 3, labourerCount: 2, rateCardId: card.id,
        }));
        expect(created.dailyCost).toBe(3 * 800 + 2 * 500);
        await u.supervisors.replace(ws, project.id, [leader.id]);

        must(await u.archivePerson.execute({ userId: owner, workspaceId: ws, personId: leader.id }));
        const stored = await u.crews.find(ws, created.crew.id);
        expect(stored?.leaderId).toBeNull();
        expect(stored?.memberIds).toEqual([]);
        expect(await u.supervisors.list(ws, project.id)).toEqual([]);
        expect((await u.people.find(ws, leader.id))?.isArchived).toBe(true);
    });

    it('concurrent crew creates with one name are serialised by the workforce lock: one wins', async () => {
        if (await skipIfNoDatabase()) return;
        const ctx = db();
        const u = useCases(ctx);
        const owner = await seedUser(ctx);
        const ws = await seedWorkspace(ctx, owner);
        const results = await Promise.all([1, 2, 3].map(() => u.createCrew.execute({
            userId: owner, workspaceId: ws, name: 'ทีมทาสี', trade: 'painting', skilledCount: 1, labourerCount: 1,
        })));
        expect(results.map(r => (r.ok ? 'ok' : r.error.code)).sort()).toEqual(['conflict', 'conflict', 'ok']);
        expect(await u.crews.countActive(ws)).toBe(1);
    });
});
