import { asRateCardId, asUserId, asWorkspaceId } from '../../../../shared/domain';
import { DailyRate, type RateKind } from '../value-objects/daily-rate.value-object';
import { RateCardName } from '../value-objects/rate-card-name.value-object';
import { RateCard } from './rate-card.entity';

const T0 = new Date('2026-03-01T08:00:00.000Z');
const T1 = new Date('2026-03-02T08:00:00.000Z');

function name(raw: string): RateCardName {
    const r = RateCardName.create(raw);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
}

function rate(baht: number, kind: RateKind = 'skilled'): DailyRate {
    const r = DailyRate.create(baht, kind);
    if (!r.ok) throw new Error(r.error.message);
    return r.value;
}

function card(): RateCard {
    return RateCard.create({
        id: asRateCardId('00000000-0000-4000-8000-000000000001'),
        workspaceId: asWorkspaceId('aaaaaaaa-0000-4000-8000-00000000000a'),
        name: name('ชุด A'),
        skilledRate: rate(800),
        labourerRate: rate(500, 'labourer'),
        note: null,
        createdBy: asUserId('10000000-0000-4000-8000-000000000001'),
        now: T0,
    });
}

describe('RateCard', () => {
    it('starts active, created and updated now', () => {
        const c = card();
        expect(c.isArchived).toBe(false);
        expect(c.archivedAt).toBeNull();
        expect(c.createdAt).toEqual(T0);
        expect(c.updatedAt).toEqual(T0);
        expect(c.skilledRate.baht).toBe(800);
        expect(c.labourerRate.baht).toBe(500);
    });

    it('update changes only the given fields and moves updatedAt', () => {
        const c = card();
        expect(c.update({ skilledRate: rate(1000), note: 'หลังคา' }, T1)).toBe(true);
        expect(c.skilledRate.baht).toBe(1000);
        expect(c.labourerRate.baht).toBe(500);
        expect(c.name.value).toBe('ชุด A');
        expect(c.note).toBe('หลังคา');
        expect(c.updatedAt).toEqual(T1);
        expect(c.createdAt).toEqual(T0);
    });

    it('update with the current values changes nothing', () => {
        const c = card();
        expect(c.update({ name: name('ชุด A'), skilledRate: rate(800), labourerRate: rate(500), note: null }, T1)).toBe(false);
        expect(c.updatedAt).toEqual(T0);
    });

    it('a note can be cleared with null', () => {
        const c = card();
        c.update({ note: 'x' }, T1);
        expect(c.update({ note: null }, T1)).toBe(true);
        expect(c.note).toBeNull();
    });

    it('archive is a one-way soft delete (a second archive is a no-op)', () => {
        const c = card();
        expect(c.archive(T1)).toBe(true);
        expect(c.isArchived).toBe(true);
        expect(c.archivedAt).toEqual(T1);
        expect(c.archive(new Date('2026-03-03T00:00:00.000Z'))).toBe(false);
        expect(c.archivedAt).toEqual(T1);
    });

    it('rehydrate and toProps copy dates (no shared mutable state)', () => {
        const c = card();
        const props = c.toProps();
        props.createdAt.setFullYear(2000);
        expect(c.createdAt).toEqual(T0);
        const again = RateCard.rehydrate(c.toProps());
        expect(again.toProps()).toEqual(c.toProps());
    });
});
