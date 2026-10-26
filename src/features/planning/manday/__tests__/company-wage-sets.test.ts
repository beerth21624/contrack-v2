// Man-Day wage sets ↔ company rate cards: card → set (snapshot), duplicate detection both ways, whole-baht rounding
// and the Thai validation messages; the remembered Man-Day tab.
import { describe, expect, it } from 'vitest';
import { addWageSet, builtInWageSets, defaultPlanningInput, type WageSet } from '@/domain/planning';
import type { RateCardDto } from '@/shared/contract';
import { cardToWageSet, findCardOfSet, findSetOfCard, wageSetToCard } from '../company-wage-sets';
import { parseManDayTab } from '../manday-tab';

const card = (over: Partial<RateCardDto> = {}): RateCardDto => ({
    id: '00000000-0000-4000-8000-000000000001',
    workspaceId: '00000000-0000-4000-8000-000000000002',
    name: 'ทีมช่างไม้',
    skilledRate: 900,
    labourerRate: 550,
    note: null,
    createdBy: '00000000-0000-4000-8000-000000000003',
    createdAt: '2026-10-26T00:00:00.000Z',
    updatedAt: '2026-10-26T00:00:00.000Z',
    archivedAt: null,
    ...over,
});
const set = (over: Partial<WageSet> = {}): WageSet => ({ id: 'C', name: 'ทีมช่างไม้', skilled: 900, labourer: 550, ...over });

describe('cardToWageSet', () => {
    it('copies the name and rates (a snapshot: the set holds plain numbers)', () => {
        expect(cardToWageSet(card({ name: '  ทีมช่างไม้  ' }))).toEqual({ name: 'ทีมช่างไม้', skilled: 900, labourer: 550 });
    });

    it('addWageSet with it adds a new set at the end and leaves A / B and the blocks alone', () => {
        const md = defaultPlanningInput().manday;
        const { input, id } = addWageSet(md, cardToWageSet(card()));
        expect(id).toBe('C');
        expect(input.wageSets.slice(0, 2)).toEqual(builtInWageSets());
        expect(input.wageSets[2]).toEqual({ id: 'C', name: 'ทีมช่างไม้', skilled: 900, labourer: 550 });
        expect(input.blocks).toBe(md.blocks);
    });
});

describe('findSetOfCard (picking a card the project already has)', () => {
    it('finds a set with the same name and rates, the name trimmed and case-insensitive', () => {
        const sets = [...builtInWageSets(), set({ name: ' Team Wood ' })];
        expect(findSetOfCard(sets, card({ name: 'team wood' }))?.id).toBe('C');
    });

    it('matches the built-in sets too', () => {
        expect(findSetOfCard(builtInWageSets(), card({ name: 'งานทั่วไป', skilledRate: 800, labourerRate: 500 }))?.id).toBe('A');
    });

    it('a different rate or name is not a duplicate', () => {
        const sets = [...builtInWageSets(), set()];
        expect(findSetOfCard(sets, card({ skilledRate: 901 }))).toBeUndefined();
        expect(findSetOfCard(sets, card({ labourerRate: 551 }))).toBeUndefined();
        expect(findSetOfCard(sets, card({ name: 'ทีมช่างปูน' }))).toBeUndefined();
    });
});

describe('wageSetToCard (saving a set to the company)', () => {
    it('whole-baht rates go as they are', () => {
        expect(wageSetToCard(set({ name: '  ทีมช่างไม้ ' }))).toEqual({
            ok: true, rounded: false, body: { name: 'ทีมช่างไม้', skilledRate: 900, labourerRate: 550 },
        });
    });

    it('fractional rates are rounded to whole baht and flagged', () => {
        expect(wageSetToCard(set({ skilled: 812.5, labourer: 499.4 }))).toEqual({
            ok: true, rounded: true, body: { name: 'ทีมช่างไม้', skilledRate: 813, labourerRate: 499 },
        });
    });

    it('refuses a set without a name, a too-long name and out-of-range rates, in Thai', () => {
        expect(wageSetToCard(set({ name: '   ' }))).toEqual({ ok: false, message: 'ตั้งชื่อชุดก่อนบันทึกเป็นชุดของบริษัท' });
        expect(wageSetToCard(set({ name: 'ก'.repeat(61) }))).toEqual({ ok: false, message: 'ชื่อชุดของบริษัทยาวได้ไม่เกิน 60 ตัวอักษร' });
        expect(wageSetToCard(set({ name: 'ก'.repeat(60) })).ok).toBe(true);
        for (const bad of [-1, 100_001, Number.NaN, Number.POSITIVE_INFINITY]) {
            const r = wageSetToCard(set({ skilled: bad }));
            expect(r.ok).toBe(false);
            if (!r.ok) expect(r.message).toBe('ค่าแรงต้องอยู่ระหว่าง 0 ถึง 100,000 บาท/วัน');
        }
        // -0.4 and 100,000.4 round into range.
        expect(wageSetToCard(set({ labourer: -0.4 })).ok).toBe(true);
        expect(wageSetToCard(set({ skilled: 100_000.4 })).ok).toBe(true);
    });
});

describe('findCardOfSet (is this set already in the company library?)', () => {
    const cards = [card(), card({ id: '00000000-0000-4000-8000-000000000009', name: 'ทีมไฟฟ้า', skilledRate: 1000, labourerRate: 600 })];

    it('finds the card with the same name and the rates the set would be saved with', () => {
        expect(findCardOfSet(cards, set({ name: 'ทีมไฟฟ้า', skilled: 999.6, labourer: 600 }))?.name).toBe('ทีมไฟฟ้า');
        expect(findCardOfSet(cards, set())?.id).toBe(cards[0]?.id);
    });

    it('same name with other rates, or a set that cannot be saved, has no card', () => {
        expect(findCardOfSet(cards, set({ skilled: 950 }))).toBeUndefined();
        expect(findCardOfSet(cards, set({ name: '' }))).toBeUndefined();
    });
});

describe('parseManDayTab (the remembered page tab)', () => {
    it('only "rates" opens the rate tab; missing or unknown values open the plan', () => {
        expect(parseManDayTab('rates')).toBe('rates');
        expect(parseManDayTab('plan')).toBe('plan');
        expect(parseManDayTab(null)).toBe('plan');
        expect(parseManDayTab(undefined)).toBe('plan');
        expect(parseManDayTab('RATES')).toBe('plan');
    });
});
