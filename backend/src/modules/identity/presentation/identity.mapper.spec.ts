import { authResponseSchema, meResponseSchema, phoneAuthResponseSchema } from '@contrack/contract';
import { asWorkspaceId } from '../../../shared/domain/ids';
import { ALICE, SOMCHAI, identityKit, requestCode } from '../testing/identity-test-kit';
import { toAuthResponse, toMeResponse, toPhoneAuthResponse } from './identity.mapper';

describe('identity mapper', () => {
    it('maps a session to a contract-valid AuthResponse without the refresh token', async () => {
        const kit = identityKit();
        const reg = await kit.register.execute(ALICE);
        if (!reg.ok) throw new Error('register failed');
        const dto = toAuthResponse(reg.value);
        expect(authResponseSchema.safeParse(dto).success).toBe(true);
        expect(dto.user.createdAt).toBe(kit.clock.now().toISOString());
        expect(JSON.stringify(dto)).not.toContain(reg.value.refreshToken);
        expect(dto.user.phone).toBeNull();
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

    it('maps a phone sign-in to a contract-valid PhoneAuthResponse carrying the phone', async () => {
        const kit = identityKit();
        kit.hook.vendorWorkspaceId = asWorkspaceId('eeeeeeee-0000-4000-8000-000000000001');
        const signIn = await kit.verifyOtp.execute({
            ip: SOMCHAI.ip,
            phone: SOMCHAI.phone, code: await requestCode(kit), displayName: SOMCHAI.displayName,
        });
        if (!signIn.ok) throw new Error('verify failed');
        const dto = toPhoneAuthResponse(signIn.value);
        expect(phoneAuthResponseSchema.safeParse(dto).success).toBe(true);
        expect(dto.user.phone).toBe(SOMCHAI.e164);
        expect(dto.isNewUser).toBe(true);
        expect(dto.vendorWorkspaceId).toBe('eeeeeeee-0000-4000-8000-000000000001');
        expect(JSON.stringify(dto)).not.toContain(signIn.value.session.refreshToken);
        expect(toMeResponse({ user: signIn.value.session.user, workspaces: [] }).user.phone).toBe(SOMCHAI.e164);
    });
});
