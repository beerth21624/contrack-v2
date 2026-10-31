'use client';

// ─── API errors as text in the UI language: errors.reasons.<details.reason>, else errors.codes.<code> ───
// The older thaiErrorMessage (errors.ts) stays for the screens track I has not moved yet; ERP screens use this.
import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { isApiError } from './errors';

export type ErrorsTranslator = ReturnType<typeof useTranslations<'errors'>>;
type ErrorKey = Parameters<ErrorsTranslator>[0];

/** `details.reason` of an error response (snake_case, docs/erp/01-architecture.md §1.5), when there is one. */
export function errorReason(details: unknown): string | undefined {
    if (typeof details !== 'object' || details === null) return undefined;
    const reason = (details as Record<string, unknown>).reason;
    return typeof reason === 'string' && reason !== '' ? reason : undefined;
}

/** Text for any thrown value: a known reason, else the error code, else the generic message. */
export function errorMessage(t: ErrorsTranslator, e: unknown): string {
    if (!isApiError(e)) return t('unknown');
    const reason = errorReason(e.details);
    if (reason !== undefined) {
        const key = `reasons.${reason}` as ErrorKey;
        if (t.has(key)) return t(key);
    }
    const key = `codes.${e.code}` as ErrorKey;
    return t.has(key) ? t(key) : t('unknown');
}

/** `const toText = useErrorMessage(); message.error(toText(e));` */
export function useErrorMessage(): (e: unknown) => string {
    const t = useTranslations('errors');
    return useCallback((e: unknown) => errorMessage(t, e), [t]);
}
