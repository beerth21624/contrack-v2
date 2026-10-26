import { and, desc, eq, gt, isNull, lt, sql } from 'drizzle-orm';
import type { DatabaseContext } from '../../../../shared/infrastructure/database/database';
import { otpCodes } from '../../../../shared/infrastructure/database/schema-identity-phone';
import { OtpCodeRepository } from '../../application/ports/otp-code.repository';
import { OtpCode, type OtpCodeId, asOtpCodeId } from '../../domain/entities/otp-code.entity';
import { Phone } from '../../domain/value-objects/phone.value-object';

type OtpCodeRow = typeof otpCodes.$inferSelect;

function toOtpCode(row: OtpCodeRow): OtpCode {
    return OtpCode.rehydrate({
        id: asOtpCodeId(row.id),
        phone: Phone.rehydrate(row.phone),
        codeHash: row.codeHash,
        expiresAt: row.expiresAt,
        attempts: row.attempts,
        consumedAt: row.consumedAt,
        createdAt: row.createdAt,
        requestIp: row.requestIp,
    });
}

export class DrizzleOtpCodeRepository extends OtpCodeRepository {
    constructor(private readonly ctx: DatabaseContext) {
        super();
    }

    async insert(code: OtpCode): Promise<void> {
        const s = code.toSnapshot();
        await this.ctx.executor.insert(otpCodes).values({
            id: s.id,
            phone: s.phone.value,
            codeHash: s.codeHash,
            expiresAt: s.expiresAt,
            attempts: s.attempts,
            consumedAt: s.consumedAt,
            createdAt: s.createdAt,
            requestIp: s.requestIp,
        });
    }

    async findLatestActive(phone: Phone, now: Date): Promise<OtpCode | undefined> {
        const rows = await this.ctx.executor.select().from(otpCodes)
            .where(and(eq(otpCodes.phone, phone.value), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, now)))
            .orderBy(desc(otpCodes.createdAt))
            .limit(1);
        const row = rows[0];
        return row === undefined ? undefined : toOtpCode(row);
    }

    /** One conditional UPDATE: concurrent guesses can never exceed `maxAttempts` in total. */
    async tryAttempt(id: OtpCodeId, now: Date, maxAttempts: number): Promise<boolean> {
        const rows = await this.ctx.executor.update(otpCodes)
            .set({ attempts: sql`${otpCodes.attempts} + 1` })
            .where(and(
                eq(otpCodes.id, id),
                isNull(otpCodes.consumedAt),
                gt(otpCodes.expiresAt, now),
                lt(otpCodes.attempts, maxAttempts),
            ))
            .returning({ id: otpCodes.id });
        return rows.length === 1;
    }

    async consumeIfUnused(id: OtpCodeId, at: Date): Promise<boolean> {
        const rows = await this.ctx.executor.update(otpCodes)
            .set({ consumedAt: at })
            .where(and(eq(otpCodes.id, id), isNull(otpCodes.consumedAt)))
            .returning({ id: otpCodes.id });
        return rows.length === 1;
    }

    async invalidateActive(phone: Phone, at: Date): Promise<void> {
        await this.ctx.executor.update(otpCodes)
            .set({ consumedAt: at })
            .where(and(eq(otpCodes.phone, phone.value), isNull(otpCodes.consumedAt)));
    }
}
