import { authResponseSchema, meResponseSchema } from '@contrack/contract';
import { asWorkspaceId } from '../../../shared/domain/ids';
import { ALICE, identityKit } from '../testing/identity-test-kit';
import { toAuthResponse, toMeResponse } from './identity.mapper';

describe('identity mapper', () => {
    it('maps a session to a contract-valid AuthResponse without the refresh token', async () => {
        const kit = identityKit();
        const reg = await kit.register.execute(ALICE);
        if (!reg.ok) throw new Error('register failed');
        const dto = toAuthResponse(reg.value);
        expect(authResponseSchema.safeParse(dto).success).toBe(true);
        expect(dto.user.createdAt).toBe(kit.clock.now().toISOString());
        expect(JSON.stringify(dto)).not.toContain(reg.value.refreshToken);
    });

    it('maps me to a contract-valid MeResponse', async () => {
        const kit = identityKit();
        const reg = await kit.register.execute(ALICE);
        if (!reg.ok) throw new Error('register failed');
        const dto = toMeResponse({
            user: reg.value.user,
            workspaces: [{ workspaceId: asWorkspaceId('11111111-0000-4000-8000-000000000001'), name: 'Alice', kind: 'personal', role: 'owner' }],
        });
        expect(meResponseSchema.safeParse(dto).success).toBe(true);
        expect(dto.workspaces).toEqual([{ id: '11111111-0000-4000-8000-000000000001', name: 'Alice', kind: 'personal', role: 'owner' }]);
    });
});
