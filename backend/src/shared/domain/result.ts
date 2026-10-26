// ─── Result: expected failures are values, not exceptions ───
// Domain and application code return Result; only programming errors throw.

export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}

export interface Err<E> {
    readonly ok: false;
    readonly error: E;
}

export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

/** `ok(undefined)` for use cases that return nothing on success. */
export const okVoid = (): Ok<undefined> => ok(undefined);

export function map<T, U, E>(r: Result<T, E>, f: (v: T) => U): Result<U, E> {
    return r.ok ? ok(f(r.value)) : r;
}

export async function andThen<T, U, E>(r: Result<T, E>, f: (v: T) => Promise<Result<U, E>> | Result<U, E>): Promise<Result<U, E>> {
    return r.ok ? f(r.value) : r;
}

/** Collects results; the first error wins. */
export function all<T, E>(results: readonly Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const r of results) {
        if (!r.ok) return r;
        values.push(r.value);
    }
    return ok(values);
}
