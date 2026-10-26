import { EMAIL_MAX_LENGTH, Email } from './email.value-object';

describe('Email', () => {
    it('trims and lower-cases', () => {
        const email = Email.create('  Somchai@Example.COM ');
        expect(email.ok && email.value.value).toBe('somchai@example.com');
    });

    it.each(['', 'no-at-sign', 'a@b', '@example.com', 'a b@example.com', 'a@@example.com'])('rejects %j', raw => {
        const email = Email.create(raw);
        expect(!email.ok && email.error.code).toBe('validation_failed');
    });

    it('rejects an address longer than 254 characters', () => {
        const local = 'a'.repeat(EMAIL_MAX_LENGTH);
        expect(Email.create(`${local}@example.com`).ok).toBe(false);
    });

    it('matches case-insensitively and ignores surrounding spaces', () => {
        const email = Email.rehydrate('Somchai@example.com');
        expect(email.value).toBe('somchai@example.com');
        expect(email.matches('SOMCHAI@EXAMPLE.COM')).toBe(true);
        expect(email.matches(' somchai@example.com ')).toBe(true);
        expect(email.matches('somsak@example.com')).toBe(false);
    });
});
