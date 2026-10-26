import { SOMCHAI, identityKit, requestCode } from '../../testing/identity-test-kit';

describe('CheckPhoneUseCase', () => {
    it('answers exists: false for an unknown phone', async () => {
        const kit = identityKit();
        const result = await kit.checkPhone.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        expect(result).toEqual({ ok: true, value: { exists: false } });
    });

    it('answers exists: true once the phone signed in (any phone format)', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        const signIn = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName });
        expect(signIn.ok).toBe(true);
        const result = await kit.checkPhone.execute({ phone: SOMCHAI.e164, ip: SOMCHAI.ip });
        expect(result).toEqual({ ok: true, value: { exists: true } });
    });

    it('rejects an invalid phone with validation_failed (without counting against the IP)', async () => {
        const kit = identityKit();
        const result = await kit.checkPhone.execute({ phone: '12', ip: SOMCHAI.ip });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('validation_failed');
        expect(kit.limiter.size).toBe(0);
    });

    it('allows 30 checks per hour per IP, then answers rate_limited until the hour has passed', async () => {
        const kit = identityKit();
        for (let i = 0; i < 30; i += 1) {
            const ok = await kit.checkPhone.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
            expect(ok.ok).toBe(true);
        }
        const limited = await kit.checkPhone.execute({ phone: '0899999999', ip: SOMCHAI.ip });
        expect(limited.ok).toBe(false);
        if (!limited.ok) expect(limited.error.code).toBe('rate_limited');

        // Another IP is not affected.
        expect((await kit.checkPhone.execute({ phone: SOMCHAI.phone, ip: '198.51.100.1' })).ok).toBe(true);

        kit.clock.advance(60 * 60 * 1000);
        expect((await kit.checkPhone.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip })).ok).toBe(true);
    });
});

describe('CheckPhoneUseCase when the platform does not offer subcontracting', () => {
    it('answers module_disabled without looking the phone up', async () => {
        const kit = identityKit();
        kit.flags.platform.delete('subcontracting');
        const result = await kit.checkPhone.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('module_disabled');
        expect(kit.limiter.size).toBe(0);
    });
});
