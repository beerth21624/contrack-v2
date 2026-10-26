// ─── Raw person fields (from the edge) → validated domain values ───
import { type DomainError, type Result, ok } from '../../../../shared/domain';
import type { PersonChanges, PersonFields } from '../../domain/entities/person.entity';
import {
    bahtPerDay, employment, nickname, personRole, phone, trades, workforceNote,
} from '../../domain/value-objects/workforce-fields';
import { WorkforceName } from '../../domain/value-objects/workforce-name.value-object';

export interface PersonInput {
    name?: string;
    nickname?: string | null;
    phone?: string | null;
    role?: string;
    employment?: string;
    trades?: readonly string[];
    dailyWage?: number | null;
    note?: string | null;
}

/** Validates the fields that are given (undefined = not given); null or blank clears an optional field. */
export function parsePersonChanges(input: PersonInput): Result<PersonChanges, DomainError> {
    const changes: PersonChanges = {};
    if (input.name !== undefined) {
        const r = WorkforceName.create(input.name, 'person');
        if (!r.ok) return r;
        changes.name = r.value;
    }
    if (input.nickname !== undefined) {
        const r = nickname(input.nickname);
        if (!r.ok) return r;
        changes.nickname = r.value;
    }
    if (input.phone !== undefined) {
        const r = phone(input.phone);
        if (!r.ok) return r;
        changes.phone = r.value;
    }
    if (input.role !== undefined) {
        const r = personRole(input.role);
        if (!r.ok) return r;
        changes.role = r.value;
    }
    if (input.employment !== undefined) {
        const r = employment(input.employment);
        if (!r.ok) return r;
        changes.employment = r.value;
    }
    if (input.trades !== undefined) {
        const r = trades(input.trades);
        if (!r.ok) return r;
        changes.trades = r.value;
    }
    if (input.dailyWage !== undefined) {
        const r = bahtPerDay(input.dailyWage, 'daily wage');
        if (!r.ok) return r;
        changes.dailyWage = r.value;
    }
    if (input.note !== undefined) {
        const r = workforceNote(input.note);
        if (!r.ok) return r;
        changes.note = r.value;
    }
    return ok(changes);
}

/** Every field of a new person (name, role and employment required; the rest default to empty). */
export function parseNewPerson(
    input: PersonInput & { name: string; role: string; employment: string },
): Result<PersonFields, DomainError> {
    const parsed = parsePersonChanges({ nickname: null, phone: null, trades: [], dailyWage: null, note: null, ...input });
    if (!parsed.ok) return parsed;
    const c = parsed.value;
    if (c.name === undefined || c.role === undefined || c.employment === undefined) throw new Error('required person fields missing');
    return ok({
        name: c.name,
        nickname: c.nickname ?? null,
        phone: c.phone ?? null,
        role: c.role,
        employment: c.employment,
        trades: c.trades ?? [],
        dailyWage: c.dailyWage ?? null,
        note: c.note ?? null,
    });
}
