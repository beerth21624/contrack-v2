import { asUserId } from '../../../../shared/domain/ids';
import { DisplayName } from '../value-objects/display-name.value-object';
import { Email } from '../value-objects/email.value-object';
import { Phone } from '../value-objects/phone.value-object';
import { User } from './user.entity';

const props = () => ({
    id: asUserId('00000000-0000-4000-8000-000000000001'),
    email: Email.rehydrate('alice@example.com'),
    displayName: DisplayName.rehydrate('Alice'),
    passwordHash: 'scrypt$32768$8$1$salt$hash',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
});

describe('User', () => {
    it('exposes its properties', () => {
        const user = User.create(props());
        expect(user.id).toBe('00000000-0000-4000-8000-000000000001');
        expect(user.email.value).toBe('alice@example.com');
        expect(user.displayName.value).toBe('Alice');
        expect(user.passwordHash).toBe('scrypt$32768$8$1$salt$hash');
        expect(user.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('does not share its dates with callers', () => {
        const input = props();
        const user = User.create(input);
        input.createdAt.setUTCFullYear(2000);
        user.createdAt.setUTCFullYear(1999);
        expect(user.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    });

    it('refuses an empty password hash (programming error)', () => {
        expect(() => User.create({ ...props(), passwordHash: '' })).toThrow();
    });

    it('rehydrates from storage', () => {
        expect(User.rehydrate(props()).email.value).toBe('alice@example.com');
    });
});

describe('User phone', () => {
    it('has no phone by default', () => {
        const user = User.create(props());
        expect(user.phone).toBeNull();
        expect(user.phoneVerifiedAt).toBeNull();
        expect(user.isPhoneOnly).toBe(false);
    });

    it('keeps a verified phone and copies the verification date', () => {
        const at = new Date('2026-02-01T00:00:00.000Z');
        const user = User.create(props()).withVerifiedPhone(Phone.rehydrate('+66812345678'), at);
        at.setUTCFullYear(2000);
        expect(user.phone?.value).toBe('+66812345678');
        expect(user.phoneVerifiedAt?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
        user.phoneVerifiedAt?.setUTCFullYear(1999);
        expect(user.phoneVerifiedAt?.toISOString()).toBe('2026-02-01T00:00:00.000Z');
    });

    it('recognises a phone-only user by the placeholder e-mail', () => {
        const phone = Phone.rehydrate('+66812345678');
        const user = User.create({ ...props(), email: Email.rehydrate(phone.placeholderEmail), phone });
        expect(user.isPhoneOnly).toBe(true);
    });

    it('round-trips through toProps', () => {
        const user = User.create({ ...props(), phone: Phone.rehydrate('+66812345678'), phoneVerifiedAt: new Date(0) });
        const again = User.rehydrate(user.toProps());
        expect(again.phone?.value).toBe('+66812345678');
        expect(again.phoneVerifiedAt?.getTime()).toBe(0);
    });
});
