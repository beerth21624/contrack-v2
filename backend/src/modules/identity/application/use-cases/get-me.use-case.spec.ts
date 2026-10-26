import { asWorkspaceId } from '../../../../shared/domain/ids';
import { ALICE, UNKNOWN_USER_ID, identityKit } from '../../testing/identity-test-kit';

describe('GetMeUseCase', () => {
    it('returns the user and their workspaces with roles', async () => {
        const kit = identityKit();
        const reg = await kit.register.execute(ALICE);
        if (!reg.ok) throw new Error('register failed');
        const userId = reg.value.user.id;
        const workspaces = [
            { workspaceId: asWorkspaceId('11111111-0000-4000-8000-000000000001'), name: 'Alice', kind: 'personal' as const, role: 'owner' as const },
            { workspaceId: asWorkspaceId('11111111-0000-4000-8000-000000000002'), name: 'Acme', kind: 'company' as const, role: 'estimator' as const },
        ];
        kit.memberships.byUser.set(userId, workspaces);

        const result = await kit.getMe.execute({ userId });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.value.user.id).toBe(userId);
        expect(result.value.user.email.value).toBe('alice@example.com');
        expect(result.value.workspaces).toEqual(workspaces);
    });

    it('returns an empty workspace list when the user has none', async () => {
        const kit = identityKit();
        const reg = await kit.register.execute(ALICE);
        if (!reg.ok) throw new Error('register failed');
        const result = await kit.getMe.execute({ userId: reg.value.user.id });
        expect(result.ok && result.value.workspaces).toEqual([]);
    });

    it('answers unauthenticated for a user that does not exist (token of a deleted user)', async () => {
        const kit = identityKit();
        const result = await kit.getMe.execute({ userId: UNKNOWN_USER_ID });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('unauthenticated');
    });
});
