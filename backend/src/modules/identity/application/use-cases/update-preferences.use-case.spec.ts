import { ALICE, UNKNOWN_USER_ID, identityKit } from '../../testing/identity-test-kit';

describe('UpdatePreferencesUseCase', () => {
    it('stores the locale on the account, so /me answers it on every device', async () => {
        const kit = identityKit();
        const reg = await kit.register.execute(ALICE);
        if (!reg.ok) throw new Error('register failed');
        const userId = reg.value.user.id;
        expect((await kit.users.findById(userId))?.locale).toBe('th');

        const result = await kit.updatePreferences.execute({ userId, locale: 'en' });

        expect(result.ok && result.value).toEqual({ locale: 'en' });
        const me = await kit.getMe.execute({ userId });
        expect(me.ok && me.value.user.locale).toBe('en');
    });

    it('answers unauthenticated for a user that does not exist', async () => {
        const kit = identityKit();
        const result = await kit.updatePreferences.execute({ userId: UNKNOWN_USER_ID, locale: 'en' });
        expect(!result.ok && result.error.code).toBe('unauthenticated');
    });
});
