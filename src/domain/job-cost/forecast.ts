// ─── Job cost: forecast at completion of one cost code (docs/erp/02-domain-model.md §9) ───
// Pure. Money in baht without VAT, rounded to satang.
import { round2 } from '../money';

export type ForecastMethod = 'auto' | 'manual';

export interface ForecastInput {
    method: ForecastMethod;
    /** The entered EAC (used by `manual` only). */
    eac: number;
}

export interface ForecastResult {
    /** Estimate to complete = eac − actual. */
    etc: number;
    eac: number;
}

/** Progress as a fraction clamped to 0–1 (non-finite → 0). */
export function clampProgress(progress: number): number {
    if (!Number.isFinite(progress)) return 0;
    return Math.min(1, Math.max(0, progress));
}

/** auto: etc = max(round2(budget × (1 − progress)), committedOpen), eac = actual + etc. */
export function autoForecast(budget: number, progress: number, actual: number, committedOpen: number): ForecastResult {
    const remaining = round2(budget * (1 - clampProgress(progress)));
    const etc = round2(Math.max(remaining, committedOpen));
    return { etc, eac: round2(actual + etc) };
}

/** manual: eac = max(entered, actual + committedOpen) (a forecast never below what is already spent or ordered). */
export function manualForecast(entered: number, actual: number, committedOpen: number): ForecastResult {
    const eac = round2(Math.max(entered, actual + committedOpen));
    return { etc: round2(eac - actual), eac };
}

export function forecastOf(
    budget: number, progress: number, actual: number, committedOpen: number, forecast?: ForecastInput | null,
): ForecastResult {
    return forecast?.method === 'manual'
        ? manualForecast(forecast.eac, actual, committedOpen)
        : autoForecast(budget, progress, actual, committedOpen);
}
