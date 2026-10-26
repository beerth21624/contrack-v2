import { describe, expect, it } from 'vitest';
import { nextCopyName } from '../copyName';

describe('nextCopyName', () => {
    it('counts up a trailing number', () => {
        expect(nextCopyName('ห้องนอน 1', ['ห้องนอน 1'])).toBe('ห้องนอน 2');
        expect(nextCopyName('ห้องนอน 1', ['ห้องนอน 1', 'ห้องนอน 2', 'ห้องนอน 3'])).toBe('ห้องนอน 4');
    });
    it('counts up a part number in brackets', () => {
        expect(nextCopyName('ห้องนอน 1 (1)', ['ห้องนอน 1 (1)'])).toBe('ห้องนอน 1 (2)');
    });
    it('adds a number to a plain name', () => {
        expect(nextCopyName('ครัว', ['ครัว'])).toBe('ครัว (2)');
        expect(nextCopyName('ครัว', ['ครัว', 'ครัว (2)'])).toBe('ครัว (3)');
    });
    it('keeps an empty name empty', () => {
        expect(nextCopyName('  ', [])).toBe('');
    });
});
