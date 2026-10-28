// ─── The small fields of people and crews, validated like the contract's schemas (the domain never trusts the edge) ───
import {
    EMPLOYMENT_TYPES, type EmploymentType, MAX_CREW_HEADCOUNT, PERSON_ROLES, type PersonRole, WORKFORCE_NOTE_MAX,
    WORKFORCE_TRADE_IDS, WORKFORCE_WAGE_MAX, type WorkforceTradeId,
} from '@contrack/contract';
import { DomainError, type Result, err, ok } from '../../../../shared/domain';

export const NICKNAME_MAX = 40;
export const PHONE_MAX = 20;
const PHONE = /^\+?[\d\s-]*$/;

/** Optional text: trimmed, blank → null, at most `max` characters. */
export function optionalText(raw: string | null | undefined, max: number, label: string): Result<string | null, DomainError> {
    const value = raw?.trim() ?? '';
    if (value.length > max) return err(DomainError.validation(`The ${label} is longer than ${max} characters`));
    return ok(value === '' ? null : value);
}

export const workforceNote = (raw: string | null | undefined): Result<string | null, DomainError> =>
    optionalText(raw, WORKFORCE_NOTE_MAX, 'note');

export const nickname = (raw: string | null | undefined): Result<string | null, DomainError> =>
    optionalText(raw, NICKNAME_MAX, 'nickname');

/** A Thai phone number as typed (digits, spaces, dashes, a leading +); blank → null. */
export function phone(raw: string | null | undefined): Result<string | null, DomainError> {
    const text = optionalText(raw, PHONE_MAX, 'phone number');
    if (!text.ok || text.value === null) return text;
    if (!PHONE.test(text.value)) return err(DomainError.validation('The phone number may only hold digits, spaces, dashes and a leading +'));
    return text;
}

/** Whole baht per day, 0–100,000 (a wage or a crew's typed daily cost); null = not set. */
export function bahtPerDay(raw: number | null | undefined, label: string): Result<number | null, DomainError> {
    if (raw === null || raw === undefined) return ok(null);
    if (!Number.isInteger(raw)) return err(DomainError.validation(`The ${label} must be a whole number of baht`));
    if (raw < 0 || raw > WORKFORCE_WAGE_MAX) {
        return err(DomainError.validation(`The ${label} must be between 0 and ${WORKFORCE_WAGE_MAX} baht per day`));
    }
    return ok(raw);
}

/** ช่าง / คนงาน in a crew: 0–200. */
export function headcount(raw: number, label: string): Result<number, DomainError> {
    if (!Number.isInteger(raw) || raw < 0 || raw > MAX_CREW_HEADCOUNT) {
        return err(DomainError.validation(`The ${label} must be a whole number between 0 and ${MAX_CREW_HEADCOUNT}`));
    }
    return ok(raw);
}

export function trade(raw: string): Result<WorkforceTradeId, DomainError> {
    const found = WORKFORCE_TRADE_IDS.find(t => t === raw);
    return found === undefined ? err(DomainError.validation(`"${raw}" is not a trade`)) : ok(found);
}

/** Trades of a person: known ids, duplicates dropped, order kept. */
export function trades(raw: readonly string[]): Result<WorkforceTradeId[], DomainError> {
    const out: WorkforceTradeId[] = [];
    for (const r of raw) {
        const t = trade(r);
        if (!t.ok) return t;
        if (!out.includes(t.value)) out.push(t.value);
    }
    return ok(out);
}

export function personRole(raw: string): Result<PersonRole, DomainError> {
    const found = PERSON_ROLES.find(r => r === raw);
    return found === undefined ? err(DomainError.validation(`"${raw}" is not a person role`)) : ok(found);
}

export function employment(raw: string): Result<EmploymentType, DomainError> {
    const found = EMPLOYMENT_TYPES.find(e => e === raw);
    return found === undefined ? err(DomainError.validation(`"${raw}" is not an employment type`)) : ok(found);
}

/** Ids in the order given, duplicates dropped. */
export function distinct<T>(ids: readonly T[]): T[] {
    return [...new Set(ids)];
}
