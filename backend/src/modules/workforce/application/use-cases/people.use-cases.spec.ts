import { MAX_ACTIVE_PEOPLE, type Role } from '@contrack/contract';
import { asPersonId } from '../../../../shared/domain';
import { Person } from '../../domain/entities/person.entity';
import { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';
import {
    OUTSIDER, OWNER, OWNER_B, P_A, ROLE_USERS, TODAY, WS_A, WS_B, workforceKit,
} from '../../testing/workforce-test-kit';

const UNKNOWN = asPersonId('99999999-0000-4000-8000-000000000000');

describe('people use cases', () => {
    describe('create and list', () => {
        it('creates a person with every field normalised; lists active people oldest first', async () => {
            const kit = workforceKit();
            const r = await kit.createPerson.execute({
                userId: OWNER, workspaceId: WS_A, name: '  สมชาย ใจกล้า ', nickname: ' ชาย ', phone: ' 081-234-5678 ',
                role: 'foreman', employment: 'permanent', trades: ['structure', 'masonry', 'structure'], dailyWage: 1200, note: '  ',
            });
            expect(r.ok).toBe(true);
            if (!r.ok) return;
            expect(r.value.role).toBe('owner');
            expect(r.value.person.toProps()).toMatchObject({
                workspaceId: WS_A, nickname: 'ชาย', phone: '081-234-5678', role: 'foreman', employment: 'permanent',
                trades: ['structure', 'masonry'], dailyWage: 1200, note: null, archivedAt: null,
            });
            expect(r.value.person.name.value).toBe('สมชาย ใจกล้า');
            kit.clock.advance(1000);
            const second = await kit.seedPerson({ name: 'สมชาย ใจกล้า' }); // same name: allowed
            const list = await kit.listPeople.execute({ userId: OWNER, workspaceId: WS_A });
            expect(list.ok && list.value.people.map(p => p.id)).toEqual([r.value.person.id, second.id]);
        });

        it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
            '%s may create: %s; every role may list',
            async (role, allowed) => {
                const kit = workforceKit();
                const r = await kit.createPerson.execute({ userId: ROLE_USERS[role], workspaceId: WS_A, name: 'A', role: 'skilled', employment: 'daily' });
                expect(r.ok ? 'ok' : r.error.code).toBe(allowed ? 'ok' : 'forbidden');
                const list = await kit.listPeople.execute({ userId: ROLE_USERS[role], workspaceId: WS_A });
                expect(list.ok && list.value.role).toBe(role);
            },
        );

        it('a non-member gets not_found; workspaces do not see each other', async () => {
            const kit = workforceKit();
            await kit.seedPerson();
            const outsider = await kit.listPeople.execute({ userId: OUTSIDER, workspaceId: WS_A });
            expect(!outsider.ok && outsider.error.code).toBe('not_found');
            const b = await kit.listPeople.execute({ userId: OWNER_B, workspaceId: WS_B });
            expect(b.ok && b.value.people).toEqual([]);
        });

        it('validates every field', async () => {
            const kit = workforceKit();
            const base = { userId: OWNER, workspaceId: WS_A, name: 'A', role: 'skilled', employment: 'daily' };
            for (const bad of [
                { name: ' ' }, { role: 'boss' }, { employment: 'x' }, { trades: ['x'] }, { dailyWage: -1 }, { dailyWage: 1.5 },
                { phone: 'abc' }, { nickname: 'x'.repeat(41) }, { note: 'x'.repeat(501) },
            ]) {
                const r = await kit.createPerson.execute({ ...base, ...bad });
                expect(r.ok ? 'ok' : r.error.code).toBe('validation_failed');
            }
            expect(await kit.people.countActive(WS_A)).toBe(0);
        });

        it('at most MAX_ACTIVE_PEOPLE active people; archived ones free a place', async () => {
            const kit = workforceKit();
            for (let i = 0; i < MAX_ACTIVE_PEOPLE; i += 1) {
                await kit.people.insert(Person.create({
                    id: asPersonId(`50000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`), workspaceId: WS_A,
                    name: (WorkforceName.create(`p${i}`, 'person') as { ok: true; value: WorkforceName }).value,
                    nickname: null, phone: null, role: 'labourer', employment: 'daily', trades: [], dailyWage: null, note: null,
                    now: kit.clock.now(),
                }));
            }
            const full = await kit.createPerson.execute({ userId: OWNER, workspaceId: WS_A, name: 'A', role: 'skilled', employment: 'daily' });
            expect(!full.ok && full.error.details).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_PEOPLE });
            const someone = (await kit.people.listActive(WS_A))[0];
            if (someone === undefined) throw new Error('no people');
            await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: someone.id });
            const again = await kit.createPerson.execute({ userId: OWNER, workspaceId: WS_A, name: 'A', role: 'skilled', employment: 'daily' });
            expect(again.ok).toBe(true);
        });
    });

    describe('update', () => {
        it('changes the given fields only; null clears; nothing changed keeps updatedAt', async () => {
            const kit = workforceKit();
            const p = await kit.seedPerson({ dailyWage: 800, phone: '0812345678' });
            kit.clock.advance(60_000);
            const r = await kit.updatePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id, dailyWage: null, role: 'foreman' });
            expect(r.ok && r.value.person.toProps()).toMatchObject({ dailyWage: null, role: 'foreman', phone: '0812345678' });
            expect(r.ok && r.value.person.updatedAt).toEqual(kit.clock.now());
            kit.clock.advance(60_000);
            const same = await kit.updatePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id, role: 'foreman' });
            expect(same.ok && same.value.person.updatedAt.getTime()).toBe(kit.clock.now().getTime() - 60_000);
        });

        it('nothing to update, unknown / other workspace / archived → errors; estimators may not', async () => {
            const kit = workforceKit();
            const p = await kit.seedPerson();
            const foreign = await kit.seedPerson({ by: OWNER_B, workspaceId: WS_B });
            const none = await kit.updatePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id });
            expect(!none.ok && none.error.code).toBe('validation_failed');
            for (const personId of [UNKNOWN, foreign.id]) {
                const r = await kit.updatePerson.execute({ userId: OWNER, workspaceId: WS_A, personId, note: 'x' });
                expect(!r.ok && r.error.code).toBe('not_found');
            }
            const est = await kit.updatePerson.execute({ userId: ROLE_USERS.estimator, workspaceId: WS_A, personId: p.id, note: 'x' });
            expect(!est.ok && est.error.code).toBe('forbidden');
            await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id });
            const archived = await kit.updatePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id, note: 'x' });
            expect(!archived.ok && archived.error.code).toBe('not_found');
        });
    });

    describe('archive', () => {
        it('takes the person out of every crew (leader and member) and off every project\'s supervisors', async () => {
            const kit = workforceKit();
            const leader = await kit.seedPerson();
            const member = await kit.seedPerson();
            const crew = await kit.seedCrew({ leaderId: leader.id, memberIds: [leader.id, member.id] });
            await kit.putSupervisors.execute({ userId: OWNER, projectId: P_A, personIds: [leader.id, member.id] });

            const r = await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: leader.id });
            expect(r.ok).toBe(true);
            const stored = await kit.crews.find(WS_A, crew.id);
            expect(stored?.leaderId).toBeNull();
            expect(stored?.memberIds).toEqual([member.id]);
            expect(await kit.supervisors.list(WS_A, P_A)).toEqual([member.id]);
            expect((await kit.people.find(WS_A, leader.id))?.archivedAt).toEqual(kit.clock.now());
            const list = await kit.listPeople.execute({ userId: OWNER, workspaceId: WS_A });
            expect(list.ok && list.value.people.map(p => p.id)).toEqual([member.id]);
        });

        it('refuses (in_use) while a crew of theirs has an assignment ending today or later; past ones do not count', async () => {
            const kit = workforceKit();
            const member = await kit.seedPerson();
            const crew = await kit.seedCrew({ memberIds: [member.id] });
            await kit.seedAssignment(crew.id, { start: '2026-02-01', end: '2026-02-28' }); // ended yesterday
            const open = await kit.seedAssignment(crew.id, { start: '2026-02-20', end: TODAY }); // ends today
            const refused = await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: member.id });
            expect(!refused.ok && refused.error.details).toEqual({ reason: 'in_use', assignments: 1 });
            expect((await kit.people.find(WS_A, member.id))?.isArchived).toBe(false);

            await kit.deleteAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: open.id });
            expect((await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: member.id })).ok).toBe(true);
        });

        it('archiving again is a no-op; unknown or other workspace → not_found; only owner/admin', async () => {
            const kit = workforceKit();
            const p = await kit.seedPerson();
            const foreign = await kit.seedPerson({ by: OWNER_B, workspaceId: WS_B });
            expect((await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id })).ok).toBe(true);
            const first = (await kit.people.find(WS_A, p.id))?.archivedAt;
            kit.clock.advance(1000);
            expect((await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: p.id })).ok).toBe(true);
            expect((await kit.people.find(WS_A, p.id))?.archivedAt).toEqual(first);
            const crossed = await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: foreign.id });
            expect(!crossed.ok && crossed.error.code).toBe('not_found');
            const viewer = await kit.archivePerson.execute({ userId: ROLE_USERS.viewer, workspaceId: WS_A, personId: foreign.id });
            expect(!viewer.ok && viewer.error.code).toBe('forbidden');
        });
    });
});
