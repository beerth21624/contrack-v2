import { OtpCode, asOtpCodeId } from '../../domain/entities/otp-code.entity';
import { Phone } from '../../domain/value-objects/phone.value-object';
import { InMemoryOtpCodeRepository } from './in-memory-otp-code.repository';

const NOW = new Date('2026-03-01T10:00:00.000Z');
const PHONE = Phone.rehydrate('+66812345678');
const OTHER = Phone.rehydrate('+66899999999');

const code = (n: number, phone: Phone = PHONE, at: Date = NOW) => OtpCode.issue({
    id: asOtpCodeId(`00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`),
    phone, codeHash: `h${n}`, now: at, ttlMs: 300_000, requestIp: null,
});

describe('InMemoryOtpCodeRepository', () => {
    it('finds the newest active code of the phone', async () => {
        const repo = new InMemoryOtpCodeRepository();
        await repo.insert(code(1));
        await repo.insert(code(2, PHONE, new Date(NOW.getTime() + 1000)));
        await repo.insert(code(3, OTHER, new Date(NOW.getTime() + 2000)));
        expect((await repo.findLatestActive(PHONE, NOW))?.codeHash).toBe('h2');
        expect(await repo.findLatestActive(PHONE, new Date(NOW.getTime() + 301_000))).toBeUndefined();
    });

    it('counts attempts only up to the maximum and only for usable codes', async () => {
        const repo = new InMemoryOtpCodeRepository();
        const c = code(1);
        await repo.insert(c);
        expect(await repo.tryAttempt(c.id, NOW, 2)).toBe(true);
        expect(await repo.tryAttempt(c.id, NOW, 2)).toBe(true);
        expect(await repo.tryAttempt(c.id, NOW, 2)).toBe(false);
        expect(repo.all()[0]!.attempts).toBe(2);
        expect(await repo.tryAttempt(asOtpCodeId('missing'), NOW, 5)).toBe(false);

        const expired = code(2);
        await repo.insert(expired);
        expect(await repo.tryAttempt(expired.id, new Date(NOW.getTime() + 300_000), 5)).toBe(false);
    });

    it('consumes once', async () => {
        const repo = new InMemoryOtpCodeRepository();
        const c = code(1);
        await repo.insert(c);
        expect(await repo.consumeIfUnused(c.id, NOW)).toBe(true);
        expect(await repo.consumeIfUnused(c.id, NOW)).toBe(false);
        expect(await repo.tryAttempt(c.id, NOW, 5)).toBe(false);
        expect(await repo.findLatestActive(PHONE, NOW)).toBeUndefined();
    });

    it('invalidates only the codes of the given phone', async () => {
        const repo = new InMemoryOtpCodeRepository();
        await repo.insert(code(1));
        await repo.insert(code(2, OTHER));
        await repo.invalidateActive(PHONE, NOW);
        expect(await repo.findLatestActive(PHONE, NOW)).toBeUndefined();
        expect((await repo.findLatestActive(OTHER, NOW))?.codeHash).toBe('h2');
    });

    it('does not share state with what it returns', async () => {
        const repo = new InMemoryOtpCodeRepository();
        await repo.insert(code(1));
        const found = await repo.findLatestActive(PHONE, NOW);
        found?.consume(NOW);
        expect((await repo.findLatestActive(PHONE, NOW))?.isConsumed).toBe(false);
    });
});
