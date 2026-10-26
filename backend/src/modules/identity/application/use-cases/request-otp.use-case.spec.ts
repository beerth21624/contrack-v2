import { OTP_TEST_KEY, OTP_TTL_SECONDS, SOMCHAI, identityKit } from '../../testing/identity-test-kit';
import { HmacOtpHasher } from '../../infrastructure/adapters/otp-code.adapter';

const MINUTE = 60_000;

describe('RequestOtpUseCase', () => {
    it('stores only a keyed hash of a 6-digit code and sends the code by SMS in Thai', async () => {
        const kit = identityKit();
        const result = await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        expect(result.ok).toBe(true);

        expect(kit.sms.sent).toEqual([{
            phone: SOMCHAI.e164,
            text: 'รหัสยืนยัน ConTrack: 100001 (ใช้ได้ 5 นาที) อย่าบอกรหัสนี้กับผู้อื่น',
        }]);
        const stored = kit.otpCodes.all();
        expect(stored).toHaveLength(1);
        const code = stored[0]!;
        expect(code.phone.value).toBe(SOMCHAI.e164);
        expect(code.codeHash).not.toContain('100001');
        expect(code.codeHash).toBe(new HmacOtpHasher(OTP_TEST_KEY).hash(SOMCHAI.e164, '100001'));
        expect(code.attempts).toBe(0);
        expect(code.consumedAt).toBeNull();
        expect(code.requestIp).toBe(SOMCHAI.ip);
        expect(code.expiresAt.getTime() - kit.clock.now().getTime()).toBe(OTP_TTL_SECONDS * 1000);
        expect(kit.uow.runs).toBe(1);
    });

    it('invalidates older unconsumed codes of the phone when a new one is requested', async () => {
        const kit = identityKit();
        await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        kit.clock.advance(MINUTE);
        await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });

        const [first, second] = kit.otpCodes.all();
        expect(first!.consumedAt).toEqual(kit.clock.now());
        expect(second!.consumedAt).toBeNull();
        expect((await kit.otpCodes.findLatestActive(second!.phone, kit.clock.now()))?.id).toBe(second!.id);
    });

    it('does not touch the codes of other phones', async () => {
        const kit = identityKit();
        await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        await kit.requestOtp.execute({ phone: '0899999999', ip: SOMCHAI.ip });
        expect(kit.otpCodes.all().map(c => c.consumedAt)).toEqual([null, null]);
    });

    it('rejects an invalid phone with validation_failed and sends nothing', async () => {
        const kit = identityKit();
        const result = await kit.requestOtp.execute({ phone: 'not a phone', ip: SOMCHAI.ip });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('validation_failed');
        expect(kit.sms.sent).toHaveLength(0);
        expect(kit.otpCodes.all()).toHaveLength(0);
        expect(kit.limiter.size).toBe(0);
    });

    it('allows one request per phone per minute', async () => {
        const kit = identityKit();
        expect((await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip })).ok).toBe(true);
        kit.clock.advance(MINUTE - 1);
        const limited = await kit.requestOtp.execute({ phone: SOMCHAI.e164, ip: '198.51.100.1' });
        expect(limited.ok).toBe(false);
        if (!limited.ok) expect(limited.error.code).toBe('rate_limited');
        expect(kit.sms.sent).toHaveLength(1);
        expect(kit.otpCodes.all()).toHaveLength(1);

        kit.clock.advance(1);
        expect((await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip })).ok).toBe(true);
    });

    it('allows five requests per phone per hour', async () => {
        const kit = identityKit();
        for (let i = 0; i < 5; i += 1) {
            expect((await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip })).ok).toBe(true);
            kit.clock.advance(MINUTE);
        }
        const limited = await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        expect(limited.ok).toBe(false);
        if (!limited.ok) expect(limited.error.code).toBe('rate_limited');

        // The first request leaves the one-hour window 60 minutes after it was made.
        kit.clock.advance(55 * MINUTE);
        expect((await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip })).ok).toBe(true);
    });

    it('allows thirty requests per IP per hour (any phones)', async () => {
        const kit = identityKit();
        for (let i = 0; i < 30; i += 1) {
            const phone = `08${(10_000_000 + i).toString()}`;
            expect((await kit.requestOtp.execute({ phone, ip: SOMCHAI.ip })).ok).toBe(true);
        }
        const limited = await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        expect(limited.ok).toBe(false);
        if (!limited.ok) expect(limited.error.code).toBe('rate_limited');
        // The refused request used no per-phone budget: the same phone from another IP still works.
        expect((await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: '198.51.100.1' })).ok).toBe(true);
    });

    it('propagates an SMS failure (bug / provider down) after the code was stored', async () => {
        const kit = identityKit();
        kit.sms.failWith = new Error('sms down');
        await expect(kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip })).rejects.toThrow('sms down');
        expect(kit.otpCodes.all()).toHaveLength(1);
    });
});

describe('RequestOtpUseCase when the platform does not offer subcontracting', () => {
    it('answers module_disabled and sends nothing', async () => {
        const kit = identityKit();
        kit.flags.platform.delete('subcontracting');
        const result = await kit.requestOtp.execute({ phone: SOMCHAI.phone, ip: SOMCHAI.ip });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('module_disabled');
        expect(kit.sms.sent).toEqual([]);
        expect(kit.otpCodes.all()).toEqual([]);
        expect(kit.limiter.size).toBe(0);
    });
});
