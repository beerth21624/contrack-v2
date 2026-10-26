import { Email } from './email.value-object';

describe('Email', () => {
    it('trims and lower-cases a valid address', () => {
        const email = Email.create('  Alice.Smith@Example.COM ');
        expect(email.ok).toBe(true);
        if (email.ok) expect(email.value.value).toBe('alice.smith@example.com');
    });

    it.each(['', 'not-an-email', 'a@', '@example.com', 'a b@example.com'])('rejects %j', raw => {
        const email = Email.create(raw);
        expect(email.ok).toBe(false);
        if (!email.ok) expect(email.error.code).toBe('validation_failed');
    });

    it('rejects addresses longer than 254 characters', () => {
        const raw = `${'a'.repeat(250)}@example.com`;
        expect(Email.create(raw).ok).toBe(false);
    });

    it('compares by normalised value', () => {
        const a = Email.create('BOB@example.com');
        const b = Email.create('bob@EXAMPLE.com');
        expect(a.ok && b.ok && a.value.equals(b.value)).toBe(true);
    });

    it('rehydrates a stored value as is', () => {
        expect(Email.rehydrate('carol@example.com').toString()).toBe('carol@example.com');
    });
});
