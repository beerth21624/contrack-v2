import { MAX_ACTIVE_CREWS, type Role } from '@contrack/contract';
import { asCrewId, asPersonId } from '../../../../shared/domain';
import { Crew } from '../../domain/entities/crew.entity';
import { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';
import {
    CARD_A, CARD_B, CARD_OLD, CARD_OTHER, OUTSIDER, OWNER, OWNER_B, ROLE_USERS, TODAY, WS_A, WS_B, workforceKit,
} from '../../testing/workforce-test-kit';

const UNKNOWN_PERSON = asPersonId('99999999-0000-4000-8000-000000000000');

describe('crew use cases', () => {
    describe('create', () => {
        it('creates a crew with a leader, members and a rate card; prices it from the card', async () => {
            const kit = workforceKit();
            const leader = await kit.seedPerson();
            const member = await kit.seedPerson();
            const r = await kit.createCrew.execute({
                userId: OWNER, workspaceId: WS_A, name: ' ทีมก่อฉาบช่างแดง ', trade: 'masonry', leaderId: leader.id,
                memberIds: [member.id, member.id], skilledCount: 3, labourerCount: 2, rateCardId: CARD_A, note: 'ทีมประจำ',
            });
            expect(r.ok).toBe(true);
            if (!r.ok) return;
            expect(r.value.crew.toProps()).toMatchObject({
                name: expect.objectContaining({ value: 'ทีมก่อฉาบช่างแดง' }), trade: 'masonry', leaderId: leader.id,
                memberIds: [member.id], skilledCount: 3, labourerCount: 2, rateCardId: CARD_A, dailyCostOverride: null, note: 'ทีมประจำ',
            });
            expect(r.value.dailyCost).toBe(3 * 800 + 2 * 500);
        });

        it('dailyCost: the override wins; no card and no override → null', async () => {
            const kit = workforceKit();
            const override = await kit.createCrew.execute({
                userId: OWNER, workspaceId: WS_A, name: 'A', trade: 'electrical', skilledCount: 2, labourerCount: 1,
                rateCardId: CARD_B, dailyCostOverride: 3500,
            });
            expect(override.ok && override.value.dailyCost).toBe(3500);
            const none = await kit.createCrew.execute({ userId: OWNER, workspaceId: WS_A, name: 'B', trade: 'painting', skilledCount: 2, labourerCount: 1 });
            expect(none.ok && none.value.dailyCost).toBeNull();
        });

        it('a name taken by an active crew (any case) → name_taken; an archived crew frees it', async () => {
            const kit = workforceKit();
            const first = await kit.seedCrew({ name: 'ทีมหลังคา A' });
            const dup = await kit.createCrew.execute({ userId: OWNER, workspaceId: WS_A, name: 'ทีมหลังคา a', trade: 'roofing', skilledCount: 1, labourerCount: 1 });
            expect(!dup.ok && dup.error.details).toEqual({ reason: 'name_taken', name: 'ทีมหลังคา a' });
            expect((await kit.createCrew.execute({ userId: OWNER_B, workspaceId: WS_B, name: 'ทีมหลังคา A', trade: 'roofing', skilledCount: 1, labourerCount: 1 })).ok).toBe(true);
            await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: first.id });
            expect((await kit.createCrew.execute({ userId: OWNER, workspaceId: WS_A, name: 'ทีมหลังคา A', trade: 'roofing', skilledCount: 1, labourerCount: 1 })).ok).toBe(true);
        });

        it('leader, members and card must be active and of the workspace (422 with the stale ids)', async () => {
            const kit = workforceKit();
            const archived = await kit.seedPerson();
            await kit.archivePerson.execute({ userId: OWNER, workspaceId: WS_A, personId: archived.id });
            const foreign = await kit.seedPerson({ by: OWNER_B, workspaceId: WS_B });
            const ok = await kit.seedPerson();
            const base = { userId: OWNER, workspaceId: WS_A, name: 'X', trade: 'plumbing', skilledCount: 1, labourerCount: 1 };
            const cases: [Record<string, unknown>, string, string[]][] = [
                [{ leaderId: archived.id }, 'leaderId', [archived.id]],
                [{ leaderId: UNKNOWN_PERSON }, 'leaderId', [UNKNOWN_PERSON]],
                [{ memberIds: [ok.id, foreign.id] }, 'memberIds', [foreign.id]],
                [{ rateCardId: CARD_OLD }, 'rateCardId', [CARD_OLD]],
                [{ rateCardId: CARD_OTHER }, 'rateCardId', [CARD_OTHER]],
            ];
            for (const [extra, field, ids] of cases) {
                const r = await kit.createCrew.execute({ ...base, ...extra });
                expect(!r.ok && r.error.code).toBe('unprocessable');
                expect(!r.ok && r.error.details).toEqual({ field, ids });
            }
            expect(await kit.crews.countActive(WS_A)).toBe(0);
        });

        it('validates fields; at most MAX_ACTIVE_CREWS active crews', async () => {
            const kit = workforceKit();
            const base = { userId: OWNER, workspaceId: WS_A, name: 'X', trade: 'plumbing', skilledCount: 1, labourerCount: 1 };
            for (const bad of [{ trade: 'x' }, { skilledCount: 201 }, { labourerCount: -1 }, { dailyCostOverride: 100_001 }, { name: '' }]) {
                const r = await kit.createCrew.execute({ ...base, ...bad });
                expect(r.ok ? 'ok' : r.error.code).toBe('validation_failed');
            }
            for (let i = 0; i < MAX_ACTIVE_CREWS; i += 1) {
                await kit.crews.insert(Crew.create({
                    id: asCrewId(`60000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`), workspaceId: WS_A,
                    name: (WorkforceName.create(`crew ${i}`, 'crew') as { ok: true; value: WorkforceName }).value, trade: 'misc',
                    leaderId: null, memberIds: [], skilledCount: 1, labourerCount: 1, rateCardId: null, dailyCostOverride: null, note: null,
                    now: kit.clock.now(),
                }));
            }
            const full = await kit.createCrew.execute(base);
            expect(!full.ok && full.error.details).toEqual({ reason: 'limit_reached', limit: MAX_ACTIVE_CREWS });
        });

        it.each<[Role, boolean]>([['owner', true], ['admin', true], ['estimator', false], ['viewer', false]])(
            '%s may create: %s',
            async (role, allowed) => {
                const kit = workforceKit();
                const r = await kit.createCrew.execute({ userId: ROLE_USERS[role], workspaceId: WS_A, name: 'A', trade: 'misc', skilledCount: 1, labourerCount: 0 });
                expect(r.ok ? 'ok' : r.error.code).toBe(allowed ? 'ok' : 'forbidden');
            },
        );
    });

    describe('list', () => {
        it('active crews oldest first, priced; members of other workspaces never mix; non-members → not_found', async () => {
            const kit = workforceKit();
            const a = await kit.seedCrew({ rateCardId: CARD_B, skilledCount: 1, labourerCount: 1 });
            kit.clock.advance(1000);
            const b = await kit.seedCrew();
            const gone = await kit.seedCrew();
            await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: gone.id });
            const r = await kit.listCrews.execute({ userId: ROLE_USERS.viewer, workspaceId: WS_A });
            expect(r.ok && r.value.crews.map(c => [c.crew.id, c.dailyCost])).toEqual([[a.id, 1600], [b.id, null]]);
            expect(r.ok && r.value.role).toBe('viewer');
            const outsider = await kit.listCrews.execute({ userId: OUTSIDER, workspaceId: WS_A });
            expect(!outsider.ok && outsider.error.code).toBe('not_found');
        });

        it('a card archived after it was picked still prices the crew', async () => {
            const kit = workforceKit();
            await kit.seedCrew({ rateCardId: CARD_A, skilledCount: 1, labourerCount: 0 });
            const card = kit.rateCards.rows.get(CARD_A);
            if (card !== undefined) card.archived = true;
            const r = await kit.listCrews.execute({ userId: OWNER, workspaceId: WS_A });
            expect(r.ok && r.value.crews[0]?.dailyCost).toBe(800);
        });
    });

    describe('update', () => {
        it('renames, replaces members, moves to another card; keeps an archived card it already has', async () => {
            const kit = workforceKit();
            const p1 = await kit.seedPerson();
            const p2 = await kit.seedPerson();
            const crew = await kit.seedCrew({ memberIds: [p1.id], rateCardId: CARD_A });
            const card = kit.rateCards.rows.get(CARD_A);
            if (card !== undefined) card.archived = true;
            kit.clock.advance(1000);
            const r = await kit.updateCrew.execute({
                userId: ROLE_USERS.admin, workspaceId: WS_A, crewId: crew.id, name: 'ทีมใหม่', memberIds: [p2.id, p1.id], rateCardId: CARD_A,
            });
            expect(r.ok && r.value.crew.memberIds).toEqual([p2.id, p1.id]);
            expect(r.ok && r.value.crew.name.value).toBe('ทีมใหม่');
            const moved = await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id, rateCardId: CARD_B, skilledCount: 1, labourerCount: 1 });
            expect(moved.ok && moved.value.dailyCost).toBe(1600);
            const back = await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id, rateCardId: CARD_A });
            expect(!back.ok && back.error.code).toBe('unprocessable');
        });

        it('name taken by another crew → conflict; its own name in another case is fine', async () => {
            const kit = workforceKit();
            const a = await kit.seedCrew({ name: 'Team A' });
            await kit.seedCrew({ name: 'Team B' });
            const taken = await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: a.id, name: 'team b' });
            expect(!taken.ok && taken.error.code).toBe('conflict');
            expect((await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: a.id, name: 'TEAM A' })).ok).toBe(true);
        });

        it('nothing to update, unknown / foreign / archived crew, estimator → errors', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            const foreign = await kit.seedCrew({ by: OWNER_B, workspaceId: WS_B });
            const none = await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id });
            expect(!none.ok && none.error.code).toBe('validation_failed');
            const crossed = await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: foreign.id, note: 'x' });
            expect(!crossed.ok && crossed.error.code).toBe('not_found');
            const est = await kit.updateCrew.execute({ userId: ROLE_USERS.estimator, workspaceId: WS_A, crewId: crew.id, note: 'x' });
            expect(!est.ok && est.error.code).toBe('forbidden');
            await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id });
            const archived = await kit.updateCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id, note: 'x' });
            expect(!archived.ok && archived.error.code).toBe('not_found');
        });
    });

    describe('archive', () => {
        it('refuses (in_use) while an assignment ends today or later; archives once they are past or gone', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            await kit.seedAssignment(crew.id, { start: '2026-01-01', end: '2026-02-28' });
            const a1 = await kit.seedAssignment(crew.id, { start: TODAY, end: TODAY });
            const a2 = await kit.seedAssignment(crew.id, { start: '2026-04-01', end: '2026-04-10' });
            const refused = await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id });
            expect(!refused.ok && refused.error.details).toEqual({ reason: 'in_use', assignments: 2 });
            await kit.deleteAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a1.id });
            await kit.deleteAssignment.execute({ userId: OWNER, workspaceId: WS_A, assignmentId: a2.id });
            expect((await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id })).ok).toBe(true);
            expect((await kit.crews.find(WS_A, crew.id))?.isArchived).toBe(true);
            // Past assignments stay as history.
            expect((await kit.assignments.list(WS_A, { crewId: crew.id })).length).toBe(1);
        });

        it('the in-use day follows Bangkok time', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            await kit.seedAssignment(crew.id, { start: '2026-02-01', end: TODAY });
            kit.clock.set(new Date('2026-03-01T17:00:00.000Z')); // already 2 March in Bangkok
            expect((await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id })).ok).toBe(true);
        });

        it('again → no-op; unknown → not_found; estimator → forbidden', async () => {
            const kit = workforceKit();
            const crew = await kit.seedCrew();
            expect((await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id })).ok).toBe(true);
            expect((await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: crew.id })).ok).toBe(true);
            const unknown = await kit.archiveCrew.execute({ userId: OWNER, workspaceId: WS_A, crewId: asCrewId('99999999-0000-4000-8000-000000000000') });
            expect(!unknown.ok && unknown.error.code).toBe('not_found');
            const est = await kit.archiveCrew.execute({ userId: ROLE_USERS.estimator, workspaceId: WS_A, crewId: crew.id });
            expect(!est.ok && est.error.code).toBe('forbidden');
        });
    });
});
