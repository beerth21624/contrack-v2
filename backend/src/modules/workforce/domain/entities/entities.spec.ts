import {
    asCrewAssignmentId, asCrewId, asPersonId, asProjectId, asRateCardId, asUserId, asWorkspaceId,
} from '../../../../shared/domain';
import { WorkforceName } from '../value-objects/workforce-name.value-object';
import { CrewAssignment } from './crew-assignment.entity';
import { Crew } from './crew.entity';
import { Person } from './person.entity';

const WS = asWorkspaceId('aaaaaaaa-0000-4000-8000-00000000000a');
const T0 = new Date('2026-03-01T08:00:00.000Z');
const T1 = new Date('2026-03-02T08:00:00.000Z');
const name = (v: string, of: 'person' | 'crew' = 'person'): WorkforceName => {
    const r = WorkforceName.create(v, of);
    if (!r.ok) throw new Error('bad name');
    return r.value;
};
const P1 = asPersonId('50000000-0000-4000-8000-000000000001');
const P2 = asPersonId('50000000-0000-4000-8000-000000000002');
const P3 = asPersonId('50000000-0000-4000-8000-000000000003');

function person(): Person {
    return Person.create({
        id: P1, workspaceId: WS, name: name('สมชาย'), nickname: 'ชาย', phone: null, role: 'foreman', employment: 'permanent',
        trades: ['structure'], dailyWage: 1200, note: null, now: T0,
    });
}

function crew(): Crew {
    return Crew.create({
        id: asCrewId('60000000-0000-4000-8000-000000000001'), workspaceId: WS, name: name('ทีมโครงสร้าง', 'crew'), trade: 'structure',
        leaderId: P1, memberIds: [P2, P3, P2], skilledCount: 2, labourerCount: 3, rateCardId: null, dailyCostOverride: null,
        note: null, now: T0,
    });
}

describe('Person', () => {
    it('is created active; update reports whether anything changed and bumps updatedAt', () => {
        const p = person();
        expect(p.isArchived).toBe(false);
        expect(p.createdAt).toEqual(T0);
        expect(p.update({ name: name('สมชาย'), dailyWage: 1200, trades: ['structure'] }, T1)).toBe(false);
        expect(p.updatedAt).toEqual(T0);
        expect(p.update({ dailyWage: null, trades: ['structure', 'masonry'], nickname: null }, T1)).toBe(true);
        expect(p.updatedAt).toEqual(T1);
        expect(p.dailyWage).toBeNull();
        expect(p.trades).toEqual(['structure', 'masonry']);
        expect(p.nickname).toBeNull();
    });

    it('archive once; rehydrate/toProps round trip and defensive copies', () => {
        const p = person();
        expect(p.archive(T1)).toBe(true);
        expect(p.archive(T1)).toBe(false);
        expect(p.archivedAt).toEqual(T1);
        const again = Person.rehydrate(p.toProps());
        expect(again.toProps()).toEqual(p.toProps());
        p.trades.push('painting');
        expect(p.trades).toEqual(['structure']);
    });
});

describe('Crew', () => {
    it('drops duplicate members; involves leader and members', () => {
        const c = crew();
        expect(c.memberIds).toEqual([P2, P3]);
        expect(c.involves(P1)).toBe(true);
        expect(c.involves(P3)).toBe(true);
        expect(c.involves(asPersonId('50000000-0000-4000-8000-000000000009'))).toBe(false);
    });

    it('update: member list order matters, duplicates dropped, nothing changed → false', () => {
        const c = crew();
        expect(c.update({ memberIds: [P2, P3, P3], skilledCount: 2 }, T1)).toBe(false);
        expect(c.update({ memberIds: [P3, P2] }, T1)).toBe(true);
        expect(c.memberIds).toEqual([P3, P2]);
        expect(c.update({ rateCardId: asRateCardId('40000000-0000-4000-8000-00000000000a'), dailyCostOverride: 5000 }, T1)).toBe(true);
        expect(c.dailyCostOverride).toBe(5000);
        expect(c.update({ leaderId: null }, T1)).toBe(true);
        expect(c.leaderId).toBeNull();
    });

    it('removePerson takes a person out as leader and as member', () => {
        const c = crew();
        expect(c.removePerson(P1, T1)).toBe(true);
        expect(c.leaderId).toBeNull();
        expect(c.removePerson(P2, T1)).toBe(true);
        expect(c.memberIds).toEqual([P3]);
        expect(c.removePerson(P2, T1)).toBe(false);
        expect(c.updatedAt).toEqual(T1);
    });

    it('archive once; round trip', () => {
        const c = crew();
        expect(c.archive(T1)).toBe(true);
        expect(c.archive(T1)).toBe(false);
        expect(Crew.rehydrate(c.toProps()).toProps()).toEqual(c.toProps());
    });
});

describe('CrewAssignment', () => {
    const base = {
        id: asCrewAssignmentId('70000000-0000-4000-8000-000000000001'), workspaceId: WS,
        projectId: asProjectId('30000000-0000-4000-8000-00000000000a'), taskId: '1.5',
        crewId: asCrewId('60000000-0000-4000-8000-000000000001'), start: '2026-03-01', end: '2026-03-10', note: null,
        createdBy: asUserId('10000000-0000-4000-8000-000000000001'), now: T0,
    };

    it('refuses start after end, on create and on update', () => {
        expect(CrewAssignment.create({ ...base, start: '2026-03-11' }).ok).toBe(false);
        const a = CrewAssignment.create(base);
        if (!a.ok) throw new Error('create failed');
        const moved = a.value.update({ start: '2026-03-11' }, T1);
        expect(!moved.ok && moved.error.code).toBe('validation_failed');
        expect(a.value.start).toBe('2026-03-01');
    });

    it('update reports changes; note null clears', () => {
        const a = CrewAssignment.create({ ...base, note: 'x' });
        if (!a.ok) throw new Error('create failed');
        expect(a.value.update({ start: '2026-03-01', end: '2026-03-10' }, T1)).toEqual({ ok: true, value: false });
        expect(a.value.updatedAt).toEqual(T0);
        expect(a.value.update({ end: '2026-03-12', note: null }, T1)).toEqual({ ok: true, value: true });
        expect(a.value.end).toBe('2026-03-12');
        expect(a.value.note).toBeNull();
        expect(a.value.updatedAt).toEqual(T1);
        expect(CrewAssignment.rehydrate(a.value.toProps()).toProps()).toEqual(a.value.toProps());
    });
});
