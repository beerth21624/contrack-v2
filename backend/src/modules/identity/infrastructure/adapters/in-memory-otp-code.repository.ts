import { OtpCodeRepository } from '../../application/ports/otp-code.repository';
import { OtpCode, type OtpCodeId } from '../../domain/entities/otp-code.entity';
import type { Phone } from '../../domain/value-objects/phone.value-object';

/** Map-based one-time codes (unit tests, e2e, PERSISTENCE=memory). Same semantics as the Drizzle adapter. */
export class InMemoryOtpCodeRepository extends OtpCodeRepository {
    private readonly byId = new Map<OtpCodeId, OtpCode>();

    insert(code: OtpCode): Promise<void> {
        if (this.byId.has(code.id)) throw new Error(`InMemoryOtpCodeRepository: duplicate id ${code.id}`);
        this.byId.set(code.id, OtpCode.rehydrate(code.toSnapshot()));
        return Promise.resolve();
    }

    findLatestActive(phone: Phone, now: Date): Promise<OtpCode | undefined> {
        let latest: OtpCode | undefined;
        for (const code of this.byId.values()) {
            if (!code.phone.equals(phone) || code.isConsumed || code.isExpired(now)) continue;
            if (latest === undefined || code.createdAt.getTime() >= latest.createdAt.getTime()) latest = code;
        }
        return Promise.resolve(latest === undefined ? undefined : OtpCode.rehydrate(latest.toSnapshot()));
    }

    tryAttempt(id: OtpCodeId, now: Date, maxAttempts: number): Promise<boolean> {
        const code = this.byId.get(id);
        if (code === undefined || code.isConsumed || code.isExpired(now) || code.attempts >= maxAttempts) {
            return Promise.resolve(false);
        }
        code.registerAttempt();
        return Promise.resolve(true);
    }

    consumeIfUnused(id: OtpCodeId, at: Date): Promise<boolean> {
        const code = this.byId.get(id);
        if (code === undefined || code.isConsumed) return Promise.resolve(false);
        code.consume(at);
        return Promise.resolve(true);
    }

    invalidateActive(phone: Phone, at: Date): Promise<void> {
        for (const code of this.byId.values()) {
            if (code.phone.equals(phone)) code.consume(at);
        }
        return Promise.resolve();
    }

    /** Test helper: every stored code, oldest first. */
    all(): OtpCode[] {
        return [...this.byId.values()]
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map(c => OtpCode.rehydrate(c.toSnapshot()));
    }
}
