import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@contrack/contract';
import { PlainPassword } from './plain-password.value-object';

describe('PlainPassword', () => {
    it('accepts the minimum and maximum length', () => {
        expect(PlainPassword.create('a'.repeat(PASSWORD_MIN_LENGTH)).ok).toBe(true);
        expect(PlainPassword.create('a'.repeat(PASSWORD_MAX_LENGTH)).ok).toBe(true);
    });

    it('rejects a password that is too short', () => {
        const p = PlainPassword.create('a'.repeat(PASSWORD_MIN_LENGTH - 1));
        expect(p.ok).toBe(false);
        if (!p.ok) expect(p.error.code).toBe('validation_failed');
    });

    it('rejects a password that is too long', () => {
        const p = PlainPassword.create('a'.repeat(PASSWORD_MAX_LENGTH + 1));
        expect(p.ok).toBe(false);
        if (!p.ok) expect(p.error.code).toBe('validation_failed');
    });

    it('keeps surrounding spaces (they are part of the password)', () => {
        const p = PlainPassword.create('  spaced out  ');
        expect(p.ok).toBe(true);
        if (p.ok) expect(p.value.value).toBe('  spaced out  ');
    });

    it('never leaks the value through toString / JSON', () => {
        const p = PlainPassword.create('super secret 123');
        expect(p.ok).toBe(true);
        if (!p.ok) return;
        expect(String(p.value)).toBe('[password]');
        expect(JSON.stringify({ p: p.value })).toBe('{"p":"[password]"}');
    });
});
