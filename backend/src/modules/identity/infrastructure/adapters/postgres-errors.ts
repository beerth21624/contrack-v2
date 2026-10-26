// ─── Recognising PostgreSQL errors through Drizzle's wrapping (DrizzleQueryError.cause = pg DatabaseError) ───

const UNIQUE_VIOLATION = '23505';

function field(value: unknown, key: string): unknown {
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined;
}

/** True when `error` (or one of its causes) is a unique violation, optionally of the given constraint. */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current !== undefined && current !== null; depth += 1) {
        if (field(current, 'code') === UNIQUE_VIOLATION) {
            return constraint === undefined || field(current, 'constraint') === constraint;
        }
        current = field(current, 'cause');
    }
    return false;
}
