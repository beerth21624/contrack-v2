// ─── PostgreSQL tables: Phone sign-in (one-time codes): owned by the identity work stream ───
// Conventions as in schema.ts: uuid ids, created_at, every tenant-owned row carries its workspace id(s), repositories
// always filter by them. Tables of business modules use a prefix (sc_ = subcontracting). Add every table to the export
// object below; schema.ts merges it into the Drizzle schema and drizzle.config.ts lists this file for migrations.
import { sql } from 'drizzle-orm';
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** One-time sign-in codes sent by SMS. Not tenant-owned (the phone may have no account yet). */
export const otpCodes = pgTable('otp_codes', {
    id: uuid('id').primaryKey(),
    /** E.164 (+66…). */
    phone: text('phone').notNull(),
    /** HMAC-SHA256 (server key) of phone + code; never the code itself. */
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** Verify attempts so far (at most 5 per code). */
    attempts: integer('attempts').notNull().default(0),
    /** Set when the code signed someone in, or when a newer code replaced it. */
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    requestIp: text('request_ip'),
}, t => [
    index('otp_codes_phone_idx').on(t.phone, t.createdAt),
    check('otp_codes_attempts_check', sql`${t.attempts} >= 0`),
]);

export const identityPhoneTables = { otpCodes };
