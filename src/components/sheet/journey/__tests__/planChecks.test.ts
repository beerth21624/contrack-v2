import { describe, expect, it } from 'vitest';
import { isPositive, planChecks } from '../planChecks';
import { insertAfter, nextFreeName, patchAt, removeAt } from '../listOps';

describe('planChecks', () => {
    it('is empty while nothing is filled, missing once started, done when complete', () => {
        expect(planChecks([{ label: 'กว้าง', ok: false }, { label: 'ยาว', ok: false }]).state).toBe('empty');
        const half = planChecks([{ label: 'กว้าง', ok: true }, { label: 'ยาว', ok: false }]);
        expect(half.state).toBe('missing');
        expect(half.missingText).toBe('ยังขาด: ยาว');
        expect(half.hasData).toBe(true);
        expect(planChecks([{ label: 'กว้าง', ok: true }]).state).toBe('done');
    });

    it('treats pre-filled values as not started when told so', () => {
        const k = planChecks([{ label: 'เหล็กปลอก', ok: true }, { label: 'ยาว', ok: false }], false);
        expect(k.state).toBe('empty');
        expect(k.missingText).toBeUndefined();
        expect(k.hasData).toBe(false);
    });

    it('shortens a long missing list', () => {
        const k = planChecks(['a', 'b', 'c', 'd', 'e', 'f'].map(label => ({ label, ok: false })), true);
        expect(k.missingText).toBe('ยังขาด: a, b, c, d และอีก 2 ช่อง');
    });

    it('counts only positive finite numbers as filled', () => {
        expect(isPositive(0.1)).toBe(true);
        expect(isPositive(0)).toBe(false);
        expect(isPositive(-1)).toBe(false);
        expect(isPositive(Number.NaN)).toBe(false);
    });
});

describe('listOps', () => {
    it('inserts a copy after a row, patches and removes rows', () => {
        expect(insertAfter([1, 2, 3], 0, 9)).toEqual([1, 9, 2, 3]);
        expect(insertAfter([1, 2], 1, 9)).toEqual([1, 2, 9]);
        expect(patchAt([{ a: 1 }, { a: 2 }], 1, { a: 5 })).toEqual([{ a: 1 }, { a: 5 }]);
        expect(removeAt([1, 2, 3], 1)).toEqual([1, 3]);
    });

    it('picks the first free name', () => {
        expect(nextFreeName(['C1', 'C2', 'C3'], ['C1'])).toBe('C2');
        expect(nextFreeName(['C1'], ['C1'])).toBe('');
    });
});
