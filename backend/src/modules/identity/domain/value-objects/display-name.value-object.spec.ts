import { DisplayName } from './display-name.value-object';

describe('DisplayName', () => {
    it('trims a valid name', () => {
        const name = DisplayName.create('  Alice Smith  ');
        expect(name.ok).toBe(true);
        if (name.ok) expect(name.value.value).toBe('Alice Smith');
    });

    it('accepts 80 characters', () => {
        expect(DisplayName.create('x'.repeat(80)).ok).toBe(true);
    });

    it.each(['', '   ', 'x'.repeat(81)])('rejects %j', raw => {
        const name = DisplayName.create(raw);
        expect(name.ok).toBe(false);
        if (!name.ok) expect(name.error.code).toBe('validation_failed');
    });
});
