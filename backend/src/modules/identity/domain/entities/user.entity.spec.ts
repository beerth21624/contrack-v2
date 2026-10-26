import { asUserId } from '../../../../shared/domain/ids';
import { DisplayName } from '../value-objects/display-name.value-object';
import { Email } from '../value-objects/email.value-object';
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
