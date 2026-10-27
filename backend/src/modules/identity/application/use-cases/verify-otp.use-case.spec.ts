import { PHONE_EMAIL_DOMAIN } from '@contrack/contract';
import { asWorkspaceId } from '../../../../shared/domain/ids';
import { sha256 } from '../../../../shared/infrastructure/crypto';
import { OTP_MAX_ATTEMPTS } from '../../domain/entities/otp-code.entity';
import type { User } from '../../domain/entities/user.entity';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { InMemoryOtpCodeRepository } from '../../infrastructure/adapters/in-memory-otp-code.repository';
import { InMemoryUserRepository } from '../../infrastructure/adapters/in-memory-user.repository';
import { ALICE, OTP_TTL_SECONDS, SOMCHAI, identityKit, requestCode } from '../../testing/identity-test-kit';

const PHONE = Phone.rehydrate(SOMCHAI.e164);
const VENDOR_WS = asWorkspaceId('eeeeeeee-0000-4000-8000-000000000001');

/** Another verify consumed the code between this one's checks and its transaction. */
class RacingOtpCodeRepository extends InMemoryOtpCodeRepository {
    override consumeIfUnused(): Promise<boolean> {
        return Promise.resolve(false);
    }
}

/** A concurrent sign-in created the user of the phone first: the existence checks miss it, the insert does not. */
class RacingPhoneUserRepository extends InMemoryUserRepository {
    hide = false;

    override findByPhone(phone: Phone): Promise<User | undefined> {
        return this.hide ? Promise.resolve(undefined) : super.findByPhone(phone);
    }
}

describe('VerifyOtpUseCase', () => {
    it('creates a phone-only user with a personal workspace, calls the hook in the transaction and signs in', async () => {
        const kit = identityKit();
        kit.hook.vendorWorkspaceId = VENDOR_WS;
        const code = await requestCode(kit);
        const runsBefore = kit.uow.runs;

        const result = await kit.verifyOtp.execute({
            ip: SOMCHAI.ip,
            phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName, teamName: 'ทีมสมชาย', invitationToken: 'x'.repeat(32),
        });

        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const { session, isNewUser, vendorWorkspaceId } = result.value;
        expect(isNewUser).toBe(true);
        expect(vendorWorkspaceId).toBe(VENDOR_WS);
        expect(session.user.email.value).toBe(`66812345678@${PHONE_EMAIL_DOMAIN}`);
        expect(session.user.phone?.value).toBe(SOMCHAI.e164);
        expect(session.user.phoneVerifiedAt).toEqual(kit.clock.now());
        expect(session.user.displayName.value).toBe(SOMCHAI.displayName);
        expect(session.user.isPhoneOnly).toBe(true);
        // Unusable password: a random secret hashed and thrown away.
        expect(session.user.passwordHash).toMatch(/^hashed:[A-Za-z0-9_-]{43}$/);

        expect(kit.uow.runs).toBe(runsBefore + 1);
        expect(kit.provisioner.calls).toEqual([{ userId: session.user.id, displayName: SOMCHAI.displayName }]);
        expect(kit.hook.events).toEqual([{
            userId: session.user.id, phone: SOMCHAI.e164, isNewUser: true, displayName: SOMCHAI.displayName,
            teamName: 'ทีมสมชาย', invitationToken: 'x'.repeat(32),
        }]);
        expect((await kit.users.findByPhone(PHONE))?.id).toBe(session.user.id);
        expect(kit.otpCodes.all()[0]!.consumedAt).toEqual(kit.clock.now());

        const token = await kit.refreshTokens.findByHash(sha256(session.refreshToken));
        expect(token?.userId).toBe(session.user.id);
        expect(session.accessToken).toBe(`access:${session.user.id}:1`);
    });

    it('signs an existing phone user in again without a name, without a new workspace', async () => {
        const kit = identityKit();
        const first = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: await requestCode(kit), displayName: SOMCHAI.displayName });
        if (!first.ok) throw new Error('first sign-in failed');
        kit.clock.advance(2 * 60_000);

        const again = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.e164, code: await requestCode(kit), displayName: 'Ignored' });
        expect(again.ok).toBe(true);
        if (!again.ok) return;
        expect(again.value.isNewUser).toBe(false);
        expect(again.value.vendorWorkspaceId).toBeNull();
        expect(again.value.session.user.id).toBe(first.value.session.user.id);
        expect(again.value.session.user.displayName.value).toBe(SOMCHAI.displayName);
        expect(again.value.session.user.phoneVerifiedAt).toEqual(kit.clock.now());
        expect((await kit.users.findByPhone(PHONE))?.phoneVerifiedAt).toEqual(kit.clock.now());
        expect(kit.provisioner.calls).toHaveLength(1);
        expect(kit.hook.events[1]).toEqual({
            userId: first.value.session.user.id, phone: SOMCHAI.e164, isNewUser: false, displayName: SOMCHAI.displayName,
            teamName: undefined, invitationToken: undefined,
        });
        expect(kit.refreshTokens.all()).toHaveLength(2);
    });

    it('answers name_required for the right code of a new phone without a name, and keeps the code usable', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code });
        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.code).toBe('unprocessable');
            expect(result.error.details).toMatchObject({ reason: 'name_required' });
        }
        // The check counted as an attempt, but the code is not consumed.
        expect(kit.otpCodes.all()[0]!.attempts).toBe(1);
        expect(kit.otpCodes.all()[0]!.consumedAt).toBeNull();
        expect(kit.hook.events).toHaveLength(0);
        expect(kit.refreshTokens.all()).toHaveLength(0);

        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName })).ok).toBe(true);
    });

    it('answers otp_invalid for a wrong code without a name, exactly like for a known phone (no enumeration)', async () => {
        const kit = identityKit();
        // Unknown phone, no name, wrong code.
        await requestCode(kit);
        const unknown = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '999999' });
        expect(unknown.ok).toBe(false);
        if (!unknown.ok) expect(unknown.error.code).toBe('otp_invalid');
        expect(kit.otpCodes.all()[0]!.attempts).toBe(1);

        // Known phone, no name, wrong code.
        const known = '0899999999';
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: known, code: await requestCode(kit, known), displayName: 'K' })).ok).toBe(true);
        kit.clock.advance(60_000);
        await requestCode(kit, known);
        const wrongKnown = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: known, code: '999999' });
        expect(wrongKnown.ok).toBe(false);
        if (!wrongKnown.ok && !unknown.ok) expect(wrongKnown.error).toEqual(unknown.error);
    });

    it('answers otp_invalid (not name_required) for an expired code of a new phone without a name', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        kit.clock.advance(OTP_TTL_SECONDS * 1000);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('otp_invalid');
    });

    it('allows 20 wrong codes per phone a day across codes, then answers rate_limited even for the right code', async () => {
        const kit = identityKit();
        for (let n = 0; n < 4; n += 1) {
            await requestCode(kit);
            for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
                const wrong = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '000000', displayName: 'X' });
                if (!wrong.ok) expect(wrong.error.code).toBe('otp_invalid');
            }
            kit.clock.advance(60_000);
        }
        const code = await requestCode(kit);
        const limited = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: 'X' });
        expect(limited.ok).toBe(false);
        if (!limited.ok) expect(limited.error.code).toBe('rate_limited');
        // Refused before the code was touched.
        expect(kit.otpCodes.all()[4]!.attempts).toBe(0);
        // Another phone is not affected.
        const other = '0899999999';
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: other, code: await requestCode(kit, other), displayName: 'O' })).ok).toBe(true);

        kit.clock.advance(24 * 60 * 60 * 1000);
        const fresh = await requestCode(kit);
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: fresh, displayName: 'X' })).ok).toBe(true);
    });

    it('allows 60 verifies per hour per IP, then answers rate_limited', async () => {
        const kit = identityKit();
        for (let i = 0; i < 60; i += 1) {
            const r = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '123456', displayName: 'X' });
            if (!r.ok) expect(r.error.code).toBe('otp_invalid');
        }
        const code = await requestCode(kit);
        const limited = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: 'X' });
        expect(limited.ok).toBe(false);
        if (!limited.ok) expect(limited.error.code).toBe('rate_limited');
        expect((await kit.verifyOtp.execute({ ip: '198.51.100.1', phone: SOMCHAI.phone, code, displayName: 'X' })).ok).toBe(true);
    });

    it('answers module_disabled when the platform does not offer subcontracting, touching nothing', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        kit.flags.platform.delete('subcontracting');
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('module_disabled');
        expect(kit.otpCodes.all()[0]!.attempts).toBe(0);
        await expect(kit.users.findByPhone(PHONE)).resolves.toBeUndefined();
    });

    it.each([
        ['an invalid phone', { phone: '12', code: '123456', displayName: 'X' }],
        ['an empty display name', { phone: SOMCHAI.phone, code: '123456', displayName: '  ' }],
    ])('rejects %s with validation_failed', async (_label, input) => {
        const kit = identityKit();
        await requestCode(kit);
        const result = await kit.verifyOtp.execute({ ...input, ip: SOMCHAI.ip });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('validation_failed');
        expect(kit.otpCodes.all()[0]!.attempts).toBe(0);
    });

    it('answers otp_invalid for a wrong code and counts the attempt', async () => {
        const kit = identityKit();
        await requestCode(kit);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '999999', displayName: SOMCHAI.displayName });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('otp_invalid');
        expect(kit.otpCodes.all()[0]!.attempts).toBe(1);
        expect(kit.otpCodes.all()[0]!.consumedAt).toBeNull();
        await expect(kit.users.findByPhone(PHONE)).resolves.toBeUndefined();
        expect(kit.provisioner.calls).toHaveLength(0);
        expect(kit.hook.events).toHaveLength(0);
        expect(kit.refreshTokens.all()).toHaveLength(0);
    });

    it('answers otp_invalid for a malformed code without counting an attempt', async () => {
        const kit = identityKit();
        await requestCode(kit);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '12ab', displayName: SOMCHAI.displayName });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('otp_invalid');
        expect(kit.otpCodes.all()[0]!.attempts).toBe(0);
    });

    it('locks the code after five attempts, even for the right code', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        for (let i = 0; i < OTP_MAX_ATTEMPTS; i += 1) {
            const wrong = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '000000', displayName: SOMCHAI.displayName });
            expect(wrong.ok).toBe(false);
        }
        const right = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName });
        expect(right.ok).toBe(false);
        if (!right.ok) expect(right.error.code).toBe('otp_invalid');
        expect(kit.otpCodes.all()[0]!.attempts).toBe(OTP_MAX_ATTEMPTS);
    });

    it('accepts the right code on the fifth attempt', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        for (let i = 0; i < OTP_MAX_ATTEMPTS - 1; i += 1) {
            await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '000000', displayName: SOMCHAI.displayName });
        }
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName })).ok).toBe(true);
    });

    it('answers otp_invalid for an expired code', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        kit.clock.advance(OTP_TTL_SECONDS * 1000);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('otp_invalid');
    });

    it('answers otp_invalid for a code that was already used', async () => {
        const kit = identityKit();
        const code = await requestCode(kit);
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName })).ok).toBe(true);
        const again = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code });
        expect(again.ok).toBe(false);
        if (!again.ok) expect(again.error.code).toBe('otp_invalid');
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });

    it('answers otp_invalid for a code replaced by a newer request', async () => {
        const kit = identityKit();
        const old = await requestCode(kit);
        kit.clock.advance(60_000);
        const fresh = await requestCode(kit);
        const withOld = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: old, displayName: SOMCHAI.displayName });
        expect(withOld.ok).toBe(false);
        if (!withOld.ok) expect(withOld.error.code).toBe('otp_invalid');
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: fresh, displayName: SOMCHAI.displayName })).ok).toBe(true);
    });

    it('answers otp_invalid when no code was requested, and for the code of another phone', async () => {
        const kit = identityKit();
        const none = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: '100001', displayName: 'X' });
        expect(none.ok).toBe(false);
        if (!none.ok) expect(none.error.code).toBe('otp_invalid');

        const other = await requestCode(kit, '0899999999');
        const cross = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: other, displayName: 'X' });
        expect(cross.ok).toBe(false);
        if (!cross.ok) expect(cross.error.code).toBe('otp_invalid');
    });

    it('answers otp_invalid when a concurrent verify consumed the code first, writing nothing else', async () => {
        const otpCodes = new RacingOtpCodeRepository();
        const kit = identityKit({ otpCodes });
        const code = await requestCode(kit);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.error.code).toBe('otp_invalid');
        expect(kit.provisioner.calls).toHaveLength(0);
        expect(kit.hook.events).toHaveLength(0);
        expect(kit.refreshTokens.all()).toHaveLength(0);
    });

    it('answers conflict when a concurrent sign-in created the phone user first', async () => {
        const users = new RacingPhoneUserRepository();
        const kit = identityKit({ users });
        expect((await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: await requestCode(kit), displayName: 'A' })).ok).toBe(true);
        kit.clock.advance(60_000);
        users.hide = true;
        const raced = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code: await requestCode(kit), displayName: 'B' });
        expect(raced.ok).toBe(false);
        if (!raced.ok) expect(raced.error.code).toBe('conflict');
        expect(kit.provisioner.calls).toHaveLength(1);
        expect(kit.hook.events).toHaveLength(1);
        expect(kit.refreshTokens.all()).toHaveLength(1);
    });

    it('does not let an e-mail user be found by an unverified phone (no phone set)', async () => {
        const kit = identityKit();
        await kit.register.execute(ALICE);
        const code = await requestCode(kit);
        const result = await kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName });
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.value.isNewUser).toBe(true);
        expect(kit.provisioner.calls).toHaveLength(2);
    });

    it('propagates a hook failure (bug) instead of issuing a session', async () => {
        const kit = identityKit();
        kit.hook.failWith = new Error('hook down');
        const code = await requestCode(kit);
        await expect(kit.verifyOtp.execute({ ip: SOMCHAI.ip, phone: SOMCHAI.phone, code, displayName: SOMCHAI.displayName }))
            .rejects.toThrow('hook down');
        expect(kit.refreshTokens.all()).toHaveLength(0);
        expect(kit.signer.signed).toHaveLength(0);
    });
});
