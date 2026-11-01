import { describe, expect, it } from 'vitest';
import { ITEM_MATCH_AUTO, ITEM_MATCH_SUGGEST, type ItemMatch } from '@/shared/contract/ai-assist';
import type { Catalogue } from '@/domain/calculators/shared/pick-list';
import {
    catalogueTexts, createMatchStore, rememberResponse, suggestionLevel, textKey, unmatchedTexts,
} from '../itemMatch';

const catalogue: Catalogue = {
    'อ่างล้างหน้า ': { unit: 'ชุด', mat: 1500, lab: 300 },
    'โถส้วม  ชักโครก': { unit: 'ชุด', mat: 4000, lab: 500 },
    'ฝักบัว': { unit: 'ชุด', mat: 800, lab: 200 },
};

const match = (input: string, item: string | null, confidence: number): ItemMatch => ({ input, item, confidence });

describe('suggestionLevel', () => {
    it('follows the contract thresholds', () => {
        expect(suggestionLevel(match('x', 'ฝักบัว', ITEM_MATCH_AUTO))).toBe('auto');
        expect(suggestionLevel(match('x', 'ฝักบัว', 0.95))).toBe('auto');
        expect(suggestionLevel(match('x', 'ฝักบัว', ITEM_MATCH_SUGGEST))).toBe('suggest');
        expect(suggestionLevel(match('x', 'ฝักบัว', 0.89))).toBe('suggest');
        expect(suggestionLevel(match('x', 'ฝักบัว', 0.59))).toBe('none');
        expect(suggestionLevel(match('x', 'ฝักบัว', 0))).toBe('none');
    });

    it('shows nothing for a null or blank item, or no answer', () => {
        expect(suggestionLevel(match('x', null, 0.99))).toBe('none');
        expect(suggestionLevel(match('x', '  ', 0.99))).toBe('none');
        expect(suggestionLevel(undefined)).toBe('none');
        expect(suggestionLevel(null)).toBe('none');
    });
});

describe('textKey', () => {
    it('is the domain matchKey (trim, collapse spaces)', () => {
        expect(textKey('  โถส้วม   ชักโครก ')).toBe('โถส้วม ชักโครก');
    });
});

describe('unmatchedTexts', () => {
    it('lists non-empty texts not in the catalogue, once each, in list order', () => {
        const rows = [
            { item: 'อ่างล้างหน้า', qty: 1, unit: '', mat: null, lab: null },          // catalogue (spacing differs)
            { item: 'ซิงค์ล้างหน้า', qty: 1, unit: '', mat: null, lab: null },
            { item: '', qty: 0, unit: '', mat: null, lab: null },
            { item: ' ซิงค์ล้างหน้า  ', qty: 2, unit: '', mat: null, lab: null },     // duplicate by key
            { item: 'ที่อาบน้ำ', qty: 1, unit: '', mat: null, lab: null },
        ];
        expect(unmatchedTexts(rows, catalogue)).toEqual(['ซิงค์ล้างหน้า', 'ที่อาบน้ำ']);
    });
});

describe('catalogueTexts', () => {
    it('sends the original keys, verbatim', () => {
        expect(catalogueTexts(catalogue)).toEqual(['อ่างล้างหน้า ', 'โถส้วม  ชักโครก', 'ฝักบัว']);
    });
});

describe('MatchStore', () => {
    it('asks each normalised text once: cache hit after an answer, whatever the confidence', () => {
        const store = createMatchStore();
        expect(store.pending(['ซิงค์ล้างหน้า', ' ซิงค์ล้างหน้า ', 'ที่อาบน้ำ', ''])).toEqual(['ซิงค์ล้างหน้า', 'ที่อาบน้ำ']);
        rememberResponse(store, ['ซิงค์ล้างหน้า', 'ที่อาบน้ำ'], [
            match('ซิงค์ล้างหน้า', 'อ่างล้างหน้า ', 0.93),
            match('ที่อาบน้ำ', null, 0.2),
        ]);
        expect(store.pending(['ซิงค์ล้างหน้า', 'ที่อาบน้ำ'])).toEqual([]);
        expect(store.get('  ซิงค์ล้างหน้า')?.item).toBe('อ่างล้างหน้า ');
        expect(store.suggestionFor(catalogue, 'ซิงค์ล้างหน้า')).toEqual({ level: 'auto', item: 'อ่างล้างหน้า ' });
        expect(store.suggestionFor(catalogue, 'ที่อาบน้ำ')).toBeUndefined();
    });

    it('leaves an unanswered input unknown so it can be asked again', () => {
        const store = createMatchStore();
        rememberResponse(store, ['a', 'b'], [match('a', 'ฝักบัว', 0.7)]);
        expect(store.pending(['a', 'b'])).toEqual(['b']);
        expect(store.suggestionFor(catalogue, 'a')).toEqual({ level: 'suggest', item: 'ฝักบัว' });
    });

    it('remembers a declined text for the session and stops asking or showing it', () => {
        const store = createMatchStore();
        store.remember('ซิงค์ล้างหน้า', match('ซิงค์ล้างหน้า', 'อ่างล้างหน้า ', 0.95));
        expect(store.suggestionFor(catalogue, 'ซิงค์ล้างหน้า')).toBeDefined();
        store.decline(' ซิงค์ล้างหน้า ');
        expect(store.isDeclined('ซิงค์ล้างหน้า')).toBe(true);
        expect(store.suggestionFor(catalogue, 'ซิงค์ล้างหน้า')).toBeUndefined();
        expect(store.pending(['ซิงค์ล้างหน้า'])).toEqual([]);
        // Declining an unanswered text also stops the question.
        store.decline('ที่อาบน้ำ');
        expect(store.pending(['ที่อาบน้ำ'])).toEqual([]);
    });

    it('never suggests for an exact catalogue item or a model answer outside the catalogue', () => {
        const store = createMatchStore();
        store.remember('ฝักบัว', match('ฝักบัว', 'อ่างล้างหน้า ', 0.99));
        expect(store.suggestionFor(catalogue, 'ฝักบัว')).toBeUndefined();
        store.remember('ก๊อกน้ำ', match('ก๊อกน้ำ', 'ของที่ไม่มี', 0.99));
        expect(store.suggestionFor(catalogue, 'ก๊อกน้ำ')).toBeUndefined();
        expect(store.suggestionFor(catalogue, '')).toBeUndefined();
    });

    it('remembers a workspace whose module is off', () => {
        const store = createMatchStore();
        expect(store.isDisabled('ws1')).toBe(false);
        store.markDisabled('ws1');
        expect(store.isDisabled('ws1')).toBe(true);
        expect(store.isDisabled('ws2')).toBe(false);
        store.clear();
        expect(store.isDisabled('ws1')).toBe(false);
    });
});
