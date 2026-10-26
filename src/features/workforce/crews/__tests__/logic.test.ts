import { describe, expect, it } from 'vitest';
import type { CrewAssignmentDto, CrewDto, PersonDto } from '@/shared/contract';
import {
    EMPTY_CREW_FORM, crewCostPreview, crewFormToRequest, crewStatusOn, crewToForm, crewUpdate, crewsByPerson, dayMonth,
    filterCrews, filterPeople, headcountLabel, isoDay, peopleForTrade, personFormToRequest, personLabel, personUpdate,
    placeLines, type PlaceNames,
} from '../logic';

const T = '2026-10-01T00:00:00.000Z';
const W = '00000000-0000-4000-8000-000000000001';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function person(n: number, over: Partial<PersonDto> = {}): PersonDto {
    return {
        id: uuid(100 + n), workspaceId: W, name: `คน ${String(n)}`, nickname: null, phone: null, role: 'skilled',
        employment: 'daily', trades: [], dailyWage: 500, wagesHidden: false, note: null, createdAt: T, updatedAt: T,
        archivedAt: null, ...over,
    };
}

function crew(n: number, over: Partial<CrewDto> = {}): CrewDto {
    return {
        id: uuid(200 + n), workspaceId: W, name: `ทีม ${String(n)}`, trade: 'masonry', leaderId: null, memberIds: [],
        skilledCount: 2, labourerCount: 1, rateCardId: null, dailyCostOverride: null, dailyCost: null, wagesHidden: false,
        note: null, createdAt: T, updatedAt: T, archivedAt: null, ...over,
    };
}

function assignment(n: number, crewId: string, start: string, end: string, over: Partial<CrewAssignmentDto> = {}): CrewAssignmentDto {
    return {
        id: uuid(300 + n), workspaceId: W, projectId: uuid(400), taskId: '2.1', crewId, start, end, note: null,
        createdBy: uuid(1), createdAt: T, updatedAt: T, ...over,
    };
}

const names: PlaceNames = {
    project: id => (id === uuid(400) ? 'บ้านคุณวิชัย' : 'บ้านคุณสมศรี'),
    task: id => `งาน ${id}`,
};

describe('dates', () => {
    it('isoDay uses the local calendar day', () => {
        expect(isoDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
        expect(isoDay(new Date(2026, 11, 31, 0, 0))).toBe('2026-12-31');
    });
    it('dayMonth gives dd/mm', () => {
        expect(dayMonth('2026-10-30')).toBe('30/10');
        expect(dayMonth('2026-01-05')).toBe('05/01');
        expect(dayMonth('bad')).toBe('bad');
    });
});

describe('crewStatusOn (ตอนนี้อยู่ที่)', () => {
    const c = crew(1);
    it('is free with no assignment covering today', () => {
        const a = [assignment(1, c.id, '2026-10-01', '2026-10-25'), assignment(2, c.id, '2026-10-27', '2026-11-03')];
        expect(crewStatusOn(c.id, a, '2026-10-26', names)).toEqual({ kind: 'free' });
    });
    it('counts the first and last days (inclusive)', () => {
        const a = [assignment(1, c.id, '2026-10-26', '2026-10-30')];
        expect(crewStatusOn(c.id, a, '2026-10-26', names).kind).toBe('busy');
        expect(crewStatusOn(c.id, a, '2026-10-30', names).kind).toBe('busy');
        expect(crewStatusOn(c.id, a, '2026-10-31', names).kind).toBe('free');
    });
    it('ignores other crews', () => {
        const a = [assignment(1, crew(2).id, '2026-10-20', '2026-10-30')];
        expect(crewStatusOn(c.id, a, '2026-10-26', names)).toEqual({ kind: 'free' });
    });
    it('names the project and task, soonest end first when booked twice', () => {
        const a = [
            assignment(1, c.id, '2026-10-20', '2026-11-02', { projectId: uuid(401), taskId: '3.1' }),
            assignment(2, c.id, '2026-10-25', '2026-10-28'),
        ];
        const s = crewStatusOn(c.id, a, '2026-10-26', names);
        expect(s.kind).toBe('busy');
        if (s.kind !== 'busy') return;
        expect(s.places.map(p => [p.projectName, p.taskName, p.end])).toEqual([
            ['บ้านคุณวิชัย', 'งาน 2.1', '2026-10-28'],
            ['บ้านคุณสมศรี', 'งาน 3.1', '2026-11-02'],
        ]);
        expect(placeLines(s.places[0], '2026-10-26')).toEqual({ where: 'บ้านคุณวิชัย · งาน 2.1', until: 'ถึง 28/10' });
        expect(placeLines(s.places[0], '2026-10-28').until).toBe('วันนี้วันสุดท้าย');
    });
});

describe('crewCostPreview', () => {
    const card = { skilledRate: 800, labourerRate: 500 };
    it('prices skilled × card + labourers × card', () => {
        expect(crewCostPreview({ skilledCount: 3, labourerCount: 2, source: 'card', card, lumpSum: 9999 })).toEqual({
            total: 3400, formula: { skilled: 3, skilledRate: 800, labourers: 2, labourerRate: 500 },
        });
    });
    it('treats empty or negative counts as 0', () => {
        expect(crewCostPreview({ skilledCount: null, labourerCount: -2, source: 'card', card, lumpSum: null })?.total).toBe(0);
    });
    it('needs a card when the source is a card', () => {
        expect(crewCostPreview({ skilledCount: 3, labourerCount: 2, source: 'card', card: undefined, lumpSum: 5000 })).toBeUndefined();
    });
    it('uses the typed lump sum as is', () => {
        expect(crewCostPreview({ skilledCount: 3, labourerCount: 2, source: 'lump', card, lumpSum: 4200 })).toEqual({ total: 4200, formula: undefined });
        expect(crewCostPreview({ skilledCount: 3, labourerCount: 2, source: 'lump', card, lumpSum: null })).toBeUndefined();
    });
});

describe('labels', () => {
    it('headcount and person', () => {
        expect(headcountLabel({ skilledCount: 3, labourerCount: 0 })).toBe('ช่าง 3 · คนงาน 0');
        expect(personLabel({ name: 'สมชาย ใจดี', nickname: 'ชาย' })).toBe('สมชาย ใจดี (ชาย)');
        expect(personLabel({ name: 'สมชาย ใจดี', nickname: '  ' })).toBe('สมชาย ใจดี');
    });
});

describe('filters', () => {
    const leader = person(1, { name: 'พงษ์ศักดิ์', nickname: 'พงษ์' });
    const peopleById = new Map([[leader.id, leader]]);
    const crews = [
        crew(1, { name: 'ทีมไฟฟ้า ก.', trade: 'electrical', leaderId: leader.id }),
        crew(2, { name: 'ทีมก่อฉาบ ข.', trade: 'masonry' }),
        crew(3, { name: 'ทีมเก่า', trade: 'masonry', archivedAt: T }),
    ];
    it('crews by name, leader and trade; archived never shown', () => {
        expect(filterCrews(crews, { search: '', trade: undefined }, peopleById).map(c => c.name)).toEqual(['ทีมไฟฟ้า ก.', 'ทีมก่อฉาบ ข.']);
        expect(filterCrews(crews, { search: 'ก่อฉาบ', trade: undefined }, peopleById).map(c => c.name)).toEqual(['ทีมก่อฉาบ ข.']);
        expect(filterCrews(crews, { search: ' พงษ์ ', trade: undefined }, peopleById).map(c => c.name)).toEqual(['ทีมไฟฟ้า ก.']);
        expect(filterCrews(crews, { search: '', trade: 'masonry' }, peopleById).map(c => c.name)).toEqual(['ทีมก่อฉาบ ข.']);
        expect(filterCrews(crews, { search: 'ไฟฟ้า', trade: 'masonry' }, peopleById)).toEqual([]);
    });
    it('people by name, nickname, phone digits, trade and role', () => {
        const people = [
            person(1, { name: 'สมชาย', nickname: 'ชาย', phone: '081-234-5678', trades: ['electrical'], role: 'foreman' }),
            person(2, { name: 'สมศรี', trades: ['masonry', 'painting'] }),
            person(3, { name: 'สมปอง', archivedAt: T }),
        ];
        const all = { search: '', trade: undefined, role: undefined };
        expect(filterPeople(people, all).map(p => p.name)).toEqual(['สมชาย', 'สมศรี']);
        expect(filterPeople(people, { ...all, search: 'ชาย' }).map(p => p.name)).toEqual(['สมชาย']);
        expect(filterPeople(people, { ...all, search: '0812345' }).map(p => p.name)).toEqual(['สมชาย']);
        expect(filterPeople(people, { ...all, trade: 'painting' }).map(p => p.name)).toEqual(['สมศรี']);
        expect(filterPeople(people, { ...all, role: 'foreman' }).map(p => p.name)).toEqual(['สมชาย']);
    });
    it('crewsByPerson counts the leader once and skips archived crews', () => {
        const a = person(1);
        const b = person(2);
        const map = crewsByPerson([
            crew(1, { name: 'ข', leaderId: a.id, memberIds: [a.id, b.id] }),
            crew(2, { name: 'ก', memberIds: [a.id] }),
            crew(3, { name: 'ค', memberIds: [b.id], archivedAt: T }),
        ]);
        expect(map.get(a.id)?.map(c => c.name)).toEqual(['ก', 'ข']);
        expect(map.get(b.id)?.map(c => c.name)).toEqual(['ข']);
    });
    it('peopleForTrade puts the trade first', () => {
        const people = [person(1, { name: 'ข', trades: ['masonry'] }), person(2, { name: 'ก' }), person(3, { name: 'ค', trades: ['masonry'], archivedAt: T })];
        const r = peopleForTrade(people, 'masonry');
        expect(r.inTrade.map(p => p.name)).toEqual(['ข']);
        expect(r.others.map(p => p.name)).toEqual(['ก']);
        expect(peopleForTrade(people, undefined).others.map(p => p.name)).toEqual(['ก', 'ข']);
    });
});

describe('crew form', () => {
    it('a quick add needs only name, trade, counts and a rate', () => {
        expect(crewFormToRequest({ ...EMPTY_CREW_FORM, name: '  ทีมทาสี  ', trade: 'painting', skilledCount: 2, labourerCount: 1, rateCardId: uuid(9) }))
            .toEqual({
                name: 'ทีมทาสี', trade: 'painting', leaderId: null, memberIds: [], skilledCount: 2, labourerCount: 1,
                rateCardId: uuid(9), dailyCostOverride: null, note: null,
            });
    });
    it('a lump sum drops the card; the leader is not listed twice', () => {
        const req = crewFormToRequest({
            ...EMPTY_CREW_FORM, name: 'ก', trade: 'masonry', leaderId: uuid(1), memberIds: [uuid(1), uuid(2), uuid(2)],
            rateSource: 'lump', rateCardId: uuid(9), lumpSum: 3500.4, note: ' ',
        });
        expect(req).toMatchObject({ leaderId: uuid(1), memberIds: [uuid(2)], rateCardId: null, dailyCostOverride: 3500, note: null });
    });
    it('needs a trade', () => {
        expect(crewFormToRequest({ ...EMPTY_CREW_FORM, name: 'ก' })).toBeUndefined();
    });
    it('round-trips a crew', () => {
        const c = crew(1, { leaderId: uuid(1), memberIds: [uuid(2)], rateCardId: uuid(9), note: 'x' });
        expect(crewFormToRequest(crewToForm(c))).toEqual({
            name: c.name, trade: c.trade, leaderId: uuid(1), memberIds: [uuid(2)], skilledCount: 2, labourerCount: 1,
            rateCardId: uuid(9), dailyCostOverride: null, note: 'x',
        });
        expect(crewToForm(crew(2, { dailyCostOverride: 4000 })).rateSource).toBe('lump');
    });
    it('an update never wipes rates the caller cannot see', () => {
        const req = crewFormToRequest({ ...EMPTY_CREW_FORM, name: 'ก', trade: 'masonry' });
        expect(req).toBeDefined();
        if (req === undefined) return;
        expect(crewUpdate(req, true)).not.toHaveProperty('rateCardId');
        expect(crewUpdate(req, true)).not.toHaveProperty('dailyCostOverride');
        expect(crewUpdate(req, false)).toMatchObject({ rateCardId: null, dailyCostOverride: null });
    });
});

describe('person form', () => {
    it('blank text fields become null', () => {
        expect(personFormToRequest({
            name: ' สมชาย ', nickname: ' ', phone: '', role: 'skilled', employment: 'daily', trades: ['masonry', 'masonry'],
            dailyWage: null, note: '',
        })).toEqual({
            name: 'สมชาย', nickname: null, phone: null, role: 'skilled', employment: 'daily', trades: ['masonry'],
            dailyWage: null, note: null,
        });
    });
    it('an update leaves out a hidden wage', () => {
        const req = personFormToRequest({
            name: 'ก', nickname: '', phone: '', role: 'labourer', employment: 'permanent', trades: [], dailyWage: 450, note: '',
        });
        expect(personUpdate(req, true)).not.toHaveProperty('dailyWage');
        expect(personUpdate(req, false)).toMatchObject({ dailyWage: 450 });
    });
});
