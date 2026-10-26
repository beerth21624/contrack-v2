import { PHONE_EMAIL_DOMAIN } from '@contrack/contract';
import { Phone, isPhonePlaceholderEmail } from './phone.value-object';

describe('Phone', () => {
    it.each([
        ['081-234-5678', '+66812345678'],
        ['0812345678', '+66812345678'],
        ['+66812345678', '+66812345678'],
        ['66812345678', '+66812345678'],
        [' 02 123 4567 ', '+6621234567'],
    ])('normalises %s to %s', (raw, expected) => {
        const phone = Phone.create(raw);
        expect(phone.ok).toBe(true);
        if (phone.ok) expect(phone.value.value).toBe(expected);
    });

    it.each(['', 'abc', '12345', '+14155550100', '0012345678'])('rejects %p with validation_failed', raw => {
        const phone = Phone.create(raw);
        expect(phone.ok).toBe(false);
        if (!phone.ok) expect(phone.error.code).toBe('validation_failed');
    });

    it('builds the lower-case placeholder e-mail of a phone-only user', () => {
        expect(Phone.rehydrate('+66812345678').placeholderEmail).toBe(`66812345678@${PHONE_EMAIL_DOMAIN}`);
    });

    it('recognises placeholder e-mails (any case) and nothing else', () => {
        expect(isPhonePlaceholderEmail(`66812345678@${PHONE_EMAIL_DOMAIN}`)).toBe(true);
        expect(isPhonePlaceholderEmail(` X@${PHONE_EMAIL_DOMAIN.toUpperCase()} `)).toBe(true);
        expect(isPhonePlaceholderEmail('alice@example.com')).toBe(false);
        expect(isPhonePlaceholderEmail(`alice@sub.${PHONE_EMAIL_DOMAIN}.example.com`)).toBe(false);
    });

    it('compares by value', () => {
        expect(Phone.rehydrate('+66812345678').equals(Phone.rehydrate('+66812345678'))).toBe(true);
        expect(Phone.rehydrate('+66812345678').equals(Phone.rehydrate('+66812345679'))).toBe(false);
    });
});
